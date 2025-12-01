use std::collections::{HashMap, VecDeque};
use std::error::Error as StdError;
use std::path::Path;
use std::thread::sleep;
use std::time::Duration;

use base64::engine::general_purpose::STANDARD as Base64;
use base64::Engine as _;
use futures_util::stream::TryStreamExt;
use pulsar::consumer::{Consumer, ConsumerOptions, InitialPosition, Message as ConsumerMessage};
use pulsar::message::proto::MessageIdData;
use pulsar::{Authentication, Pulsar, SubType, TokioExecutor};
use reqwest::{header::HeaderMap, Certificate, Client, Method};
use serde::Deserialize;
use serde_json::{Map, Value};
use tauri::Manager;
use tauri_plugin_keyring;
use tokio::time::{timeout, Duration as TokioDuration};
use url::Url;
use uuid::Uuid;

fn format_error_chain(err: &dyn StdError) -> String {
    let mut message = err.to_string();
    let mut source = err.source();

    while let Some(next) = source {
        message.push_str(" | caused by: ");
        message.push_str(&next.to_string());
        source = next.source();
    }

    message
}

fn split_url_and_token(service_url: &str) -> Result<(String, Option<String>), String> {
    let parsed = Url::parse(service_url).map_err(|err| err.to_string())?;
    let token = parsed
        .query_pairs()
        .find(|(key, _)| key == "token")
        .map(|(_, value)| value.to_string());

    let mut cleaned = parsed.clone();
    cleaned.set_query(None);
    cleaned.set_fragment(None);
    if cleaned.path() == "/" {
        cleaned.set_path("");
    }

    let normalized_scheme = match cleaned.scheme() {
        "wss" | "https" => Some("pulsar+ssl"),
        "ws" | "http" => Some("pulsar"),
        _ => None,
    };

    let serialized = cleaned.to_string();
    let normalized = if let Some(target) = normalized_scheme {
        let (_, rest) = serialized
            .split_once("://")
            .ok_or_else(|| format!("Service URL '{}' is missing scheme separator", serialized))?;
        format!("{}://{}", target, rest)
    } else {
        serialized
    };

    Ok((normalized, token))
}

fn builder_with_ca(
    mut builder: pulsar::PulsarBuilder<TokioExecutor>,
    ca_source: Option<&str>,
) -> Result<pulsar::PulsarBuilder<TokioExecutor>, String> {
    if let Some(ca) = ca_source {
        let trimmed = ca.trim();
        if !trimmed.is_empty() {
            if Path::new(trimmed).exists() {
                builder = builder
                    .with_certificate_chain_file(trimmed)
                    .map_err(|err| format_error_chain(&err))?;
            } else {
                builder = builder.with_certificate_chain(trimmed.as_bytes().to_vec());
            }
        }
    }

    Ok(builder)
}

const CONNECT_TIMEOUT_MS: u64 = 4000;

async fn build_client(
    service_url: &str,
    token: Option<&str>,
    ca_pem: Option<&str>,
) -> Result<Pulsar<TokioExecutor>, String> {
    let mut builder = Pulsar::builder(service_url, TokioExecutor);

    if let Some(token) = token {
        if !token.trim().is_empty() {
            builder = builder.with_auth(Authentication {
                name: "token".into(),
                data: token.trim().as_bytes().to_vec(),
            });
        }
    }

    builder = builder_with_ca(builder, ca_pem)?;

    match timeout(
        TokioDuration::from_millis(CONNECT_TIMEOUT_MS),
        builder.build(),
    )
    .await
    {
        Ok(result) => result.map_err(|err| format_error_chain(&err)),
        Err(_) => Err(format!(
            "Timed out connecting to Pulsar service at {}",
            service_url
        )),
    }
}

const INCLUDE_ZERO_BATCH: bool = true; //set to false for compact WS id (omit batchIndex=0)

fn norm_i32(opt: Option<i32>) -> Option<i32> {
    match opt {
        Some(x) if x >= 0 => Some(x),
        _ => None,
    }
}

///minimal protobuf varint encoder (unsigned)
#[inline]
fn push_varint_u64(mut v: u64, out: &mut Vec<u8>) {
    while v >= 0x80 {
        out.push(((v as u8) & 0x7F) | 0x80);
        v >>= 7;
    }
    out.push(v as u8);
}

///encode MessageIdData to same base64 protobuf format pulsar WebSocket API uses
///(varint):
///   1 = ledgerId (u64) – always
///   2 = entryId  (u64) – always
///   5 = partition (u32) – only if >= 0
///   6 = batchIndex (u32) – only if >= 0; or forced 0 if INCLUDE_ZERO_BATCH
fn message_id_b64_ws_style(id: &MessageIdData) -> String {
    let mut buf = Vec::with_capacity(16);

    // tag = field_number << 3 | wire_type(0=varint)
    const TAG_LEDGER: u8 = (1 << 3) | 0;
    const TAG_ENTRY: u8 = (2 << 3) | 0;
    const TAG_PARTITION: u8 = (5 << 3) | 0;
    const TAG_BATCH: u8 = (6 << 3) | 0;

    // ledgerId
    buf.push(TAG_LEDGER);
    push_varint_u64(id.ledger_id as u64, &mut buf);

    // entryId
    buf.push(TAG_ENTRY);
    push_varint_u64(id.entry_id as u64, &mut buf);

    // partition (only if non-negative)
    if let Some(p) = id.partition {
        if p >= 0 {
            buf.push(TAG_PARTITION);
            push_varint_u64(p as u64, &mut buf);
        }
    }

    // batchIndex (only if non-negative, or force write 0 when requested)
    match id.batch_index {
        Some(b) if b >= 0 => {
            buf.push(TAG_BATCH);
            push_varint_u64(b as u64, &mut buf);
        }
        _ => {
            if INCLUDE_ZERO_BATCH {
                buf.push(TAG_BATCH);
                push_varint_u64(0, &mut buf);
            }
        }
    }

    Base64.encode(buf)
}

fn message_id_parts(id: &MessageIdData) -> Value {
    // mirror the encoded batch behavior (0 if INCLUDE_ZERO_BATCH and absent)
    let batch_index = match id.batch_index {
        Some(b) if b >= 0 => Some(b),
        None if INCLUDE_ZERO_BATCH => Some(0),
        _ => None,
    };

    let nested = id
        .first_chunk_message_id
        .as_ref()
        .map(|inner| message_id_parts(inner));
    let ack_set = if id.ack_set.is_empty() {
        None
    } else {
        Some(id.ack_set.clone())
    };

    serde_json::json!({
      "ledgerId": id.ledger_id,
      "entryId": id.entry_id,
      "partition": norm_i32(id.partition),
      "batchIndex": batch_index,
      "batchSize": norm_i32(id.batch_size),
      "chunkId": Value::Null,
      "firstChunkMessageId": nested,
      "ackSet": ack_set,
    })
}

fn message_id_string(id: &MessageIdData) -> String {
    let ledger = id.ledger_id;
    let entry = id.entry_id;
    let partition = id.partition.unwrap_or(-1);
    let batch = match id.batch_index {
        Some(b) if b >= 0 => b,
        None if INCLUDE_ZERO_BATCH => 0,
        _ => -1,
    };
    format!("{ledger}:{entry}:{partition}:{batch}")
}

fn encode_schema_version(bytes: Option<&Vec<u8>>) -> Option<String> {
    bytes
        .filter(|version| !version.is_empty())
        .map(|version| Base64.encode(version))
}

fn encode_binary(value: Option<&Vec<u8>>) -> Option<String> {
    value
        .filter(|data| !data.is_empty())
        .map(|data| Base64.encode(data))
}

fn apply_metadata_fields(message: &ConsumerMessage<Vec<u8>>, target: &mut Map<String, Value>) {
    let metadata = &message.payload.metadata;

    if !metadata.producer_name.is_empty() {
        target.insert(
            "producerName".into(),
            Value::String(metadata.producer_name.clone()),
        );
    }

    if metadata.sequence_id != 0 {
        target.insert("sequenceId".into(), serde_json::json!(metadata.sequence_id));
    }

    if metadata.publish_time != 0 {
        let publish_value = serde_json::json!(metadata.publish_time);
        target.insert("publishTime".into(), publish_value.clone());
        target.insert("publishTimestamp".into(), publish_value);
    }

    if let Some(event_time) = metadata.event_time {
        target.insert("eventTime".into(), serde_json::json!(event_time));
    }

    if let Some(partition_key) = metadata.partition_key.as_ref() {
        if !partition_key.is_empty() {
            target.insert("partitionKey".into(), Value::String(partition_key.clone()));
        }
    }

    if let Some(ordering_key) = encode_binary(metadata.ordering_key.as_ref()) {
        target.insert("orderingKey".into(), Value::String(ordering_key));
    }

    if let Some(schema_version) = encode_schema_version(metadata.schema_version.as_ref()) {
        target.insert("schemaVersion".into(), Value::String(schema_version));
    }

    if !metadata.replicate_to.is_empty() {
        target.insert(
            "replicateTo".into(),
            serde_json::json!(metadata.replicate_to.clone()),
        );
    }

    if !metadata.properties.is_empty() {
        let mut map = Map::new();
        for kv in &metadata.properties {
            if !kv.value.is_empty() {
                map.insert(kv.key.clone(), Value::String(kv.value.clone()));
            }
        }

        if !map.is_empty() {
            target.insert("properties".into(), Value::Object(map));
        }
    }
}

fn build_message_value(message: &ConsumerMessage<Vec<u8>>, data: &[u8]) -> Value {
    let payload_b64 = Base64.encode(data);
    let decoded_text = String::from_utf8_lossy(data).to_string();
    let decoded_json = serde_json::from_str::<Value>(&decoded_text)
        .unwrap_or_else(|_| Value::String(decoded_text.clone()));

    let id = message.message_id();

    //base64 protobuf WS messageId (includes batchIndex=0 if INCLUDE_ZERO_BATCH)
    let ws_b64 = message_id_b64_ws_style(&id);

    let mut root = Map::new();
    //base64 protobuf for parity with WS API
    root.insert("messageId".into(), Value::String(ws_b64));
    //human readable composite
    root.insert(
        "messageIdString".into(),
        Value::String(message_id_string(&id)),
    );
    //structured normalized object (mirrored with INCLUDE_ZERO_BATCH)
    root.insert("messageIdData".into(), message_id_parts(&id));

    root.insert("payload".into(), Value::String(payload_b64));
    root.insert("decoded".into(), decoded_json);

    apply_metadata_fields(message, &mut root);

    Value::Object(root)
}

#[tauri::command]
async fn pulsar_produce(
    service_url: String,
    topic: String,
    message: String,
    ca_pem: Option<String>,
    token: Option<String>,
) -> Result<Value, String> {
    let (clean_url, embedded_token) = split_url_and_token(&service_url)?;
    let effective_token = token
        .filter(|value| !value.trim().is_empty())
        .or(embedded_token);
    let client = build_client(&clean_url, effective_token.as_deref(), ca_pem.as_deref()).await?;

    let mut producer = client
        .producer()
        .with_topic(topic.clone())
        .with_name(format!("pulsar-toolbox-producer-{}", Uuid::new_v4()))
        .build()
        .await
        .map_err(|err| format_error_chain(&err))?;

    producer
        .send_non_blocking(message)
        .await
        .map_err(|err| format_error_chain(&err))?;

    Ok(serde_json::json!({
      "result": "ok",
    }))
}

async fn read_messages(
    mut consumer: Consumer<Vec<u8>, TokioExecutor>,
    limit: usize,
    timeout_ms: u64,
) -> Result<Vec<Value>, String> {
    let mut messages = VecDeque::with_capacity(limit);
    let wait_duration = TokioDuration::from_millis(timeout_ms.max(1));

    loop {
        let next = match timeout(wait_duration, consumer.try_next()).await {
            Err(_) => break,
            Ok(Err(err)) => return Err(format_error_chain(&err)),
            Ok(Ok(None)) => break,
            Ok(Ok(Some(message))) => message,
        };

        let payload = next.payload.data.clone();
        messages.push_back(build_message_value(&next, &payload));
        if messages.len() > limit {
            messages.pop_front();
        }

        if let Err(err) = consumer.ack(&next).await {
            log::warn!("Failed to acknowledge Pulsar message: {}", err);
        }
    }

    if let Err(err) = consumer.close().await {
        log::warn!("Failed to close Pulsar consumer cleanly: {}", err);
    }

    Ok(messages.into_iter().collect())
}

#[tauri::command]
async fn pulsar_read_messages(
    service_url: String,
    topic: String,
    start_position: Option<String>,
    limit: Option<usize>,
    timeout_ms: Option<u64>,
    ca_pem: Option<String>,
    token: Option<String>,
) -> Result<Vec<Value>, String> {
    let (clean_url, embedded_token) = split_url_and_token(&service_url)?;
    let effective_token = token
        .filter(|value| !value.trim().is_empty())
        .or(embedded_token);
    let client = build_client(&clean_url, effective_token.as_deref(), ca_pem.as_deref()).await?;

    let mut consumer_builder = client
        .consumer()
        .with_topic(topic.clone())
        .with_consumer_name(format!("pulsar-toolbox-consumer-{}", Uuid::new_v4()))
        .with_subscription_type(SubType::Exclusive)
        .with_subscription(format!("pulsar-toolbox-sub-{}", Uuid::new_v4()));

    if matches!(start_position.as_deref(), Some(pos) if pos.eq_ignore_ascii_case("earliest")) {
        let mut options = ConsumerOptions::default();
        options.initial_position = InitialPosition::Earliest;
        consumer_builder = consumer_builder.with_options(options);
    }

    let consumer: Consumer<Vec<u8>, _> = match timeout(
        TokioDuration::from_millis(CONNECT_TIMEOUT_MS),
        consumer_builder.build(),
    )
    .await
    {
        Ok(result) => result.map_err(|err| format_error_chain(&err))?,
        Err(_) => {
            return Err(format!(
                "Timed out preparing consumer for topic '{}' at {}",
                &topic, service_url
            ))
        }
    };

    let limit = limit.unwrap_or(10).max(1);
    let timeout_ms = timeout_ms.unwrap_or(2000).max(1);

    read_messages(consumer, limit, timeout_ms).await
}

#[tauri::command]
async fn pulsar_check_connection(
    service_url: String,
    ca_pem: Option<String>,
    token: Option<String>,
) -> Result<(), String> {
    let (clean_url, embedded_token) = split_url_and_token(&service_url)?;
    let effective_token = token
        .filter(|value| !value.trim().is_empty())
        .or(embedded_token);
    let client = build_client(&clean_url, effective_token.as_deref(), ca_pem.as_deref()).await?;
    drop(client);
    Ok(())
}

fn allow_non_pulsar_metadata(metadata: &log::Metadata) -> bool {
    if metadata.target().starts_with("pulsar") {
        metadata.level() >= log::Level::Error
    } else {
        true
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FetchJsonArgs {
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
    ca_pem: Option<String>,
}

#[tauri::command]
async fn fetch_json_with_tls(args: FetchJsonArgs) -> Result<Value, String> {
    let FetchJsonArgs {
        url,
        method,
        headers,
        body,
        ca_pem,
    } = args;

    let http_method = method
        .as_deref()
        .unwrap_or("GET")
        .parse::<Method>()
        .map_err(|err| err.to_string())?;

    let mut client_builder = Client::builder();

    if let Some(ca) = ca_pem.as_deref() {
        if !ca.trim().is_empty() {
            if Path::new(ca).exists() {
                let pem = std::fs::read(ca).map_err(|err| err.to_string())?;
                let cert = Certificate::from_pem(&pem).map_err(|err| err.to_string())?;
                client_builder = client_builder.add_root_certificate(cert);
            } else {
                let cert = Certificate::from_pem(ca.as_bytes()).map_err(|err| err.to_string())?;
                client_builder = client_builder.add_root_certificate(cert);
            }
        }
    }

    let client = client_builder.build().map_err(|err| err.to_string())?;

    let mut request = client
        .request(http_method, &url)
        .body(body.unwrap_or_default());

    if let Some(map) = headers {
        let mut header_map = HeaderMap::new();
        for (key, value) in map {
            header_map.insert(
                reqwest::header::HeaderName::from_bytes(key.as_bytes())
                    .map_err(|err| err.to_string())?,
                reqwest::header::HeaderValue::from_str(&value).map_err(|err| err.to_string())?,
            );
        }
        request = request.headers(header_map);
    }

    let response = request
        .send()
        .await
        .map_err(|err| format_error_chain(&err))?;

    response
        .json::<Value>()
        .await
        .map_err(|err| format_error_chain(&err))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            fetch_json_with_tls,
            pulsar_produce,
            pulsar_read_messages,
            pulsar_check_connection
        ])
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .level_for("pulsar", log::LevelFilter::Error)
                    .level_for("pulsar::connection_manager", log::LevelFilter::Error)
                    .level_for("pulsar::retry_op", log::LevelFilter::Error)
                    .level_for("pulsar::consumer::engine", log::LevelFilter::Error)
                    .targets([
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout)
                            .filter(allow_non_pulsar_metadata),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                            file_name: None,
                        })
                        .filter(allow_non_pulsar_metadata),
                    ])
                    .build(),
            )?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
                let window = window.clone();

                tauri::async_runtime::spawn(async move {
                    sleep(Duration::from_millis(75));
                    let _ = window.show();
                });
            }

            Ok(())
        })
        .plugin(tauri_plugin_keyring::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
