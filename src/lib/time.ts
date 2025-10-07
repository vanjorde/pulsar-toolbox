export function getPublishMs(m: any): number {
  const cand = [
    m?.publishTime,
    m?.eventTime,
    m?.publishTimestamp,
    m?.eventTimestamp,
    m?.timestamp,
    m?.metadata?.publishTime,
    m?.metadata?.eventTime,
    m?.message?.publishTime,
    m?.message?.eventTime,
    m?.properties?.publishTime,
    m?.properties?.eventTime,
    m?.properties?.timestamp,
    m?.properties?.ts,
    m?.properties?.["publish-time"],
    m?.properties?.["event-time"],
    m?.decoded?.timestamp,
    m?.decoded?.time,
    m?.decoded?.ts,
  ].filter((v) => v != null);

  let ts: number | undefined;

  for (const v of cand) {
    if (typeof v === "number" && Number.isFinite(v)) {
      ts = v;
      break;
    }
    if (typeof v === "bigint") {
      ts = Number(v);
      break;
    }
  }

  if (ts == null) {
    for (const v of cand) {
      if (typeof v === "string") {
        const asNum = Number(v);
        if (Number.isFinite(asNum)) {
          ts = asNum;
          break;
        }
        const asDate = Date.parse(v);
        if (Number.isFinite(asDate)) {
          ts = asDate;
          break;
        }
      }
    }
  }

  if (ts == null) return 0;

  if (ts < 1e11) return ts * 1000;
  if (ts > 1e13 && ts < 1e16) return Math.floor(ts / 1000);
  if (ts >= 1e16) return Math.floor(ts / 1e6);
  return ts;
}
