// 'use client';
import { deletePassword, getPassword, setPassword } from "tauri-plugin-keyring-api";

const SERVICE = "pulsar-client";
const USER = "default";

function hostAccount(hostId: string, scope: "service" | "admin" = "service") {
  return { service: SERVICE, user: `${USER}:${hostId}:${scope}` };
}

export async function getPulsarToken(): Promise<string | null> {
  try {
    const token = await getPassword(SERVICE, USER);
    return token ?? null;
  } catch (error) {
    console.error("Failed to read Pulsar token from keyring", error);
    return null;
  }
}

export async function setPulsarToken(token: string): Promise<void> {
  try {
    await setPassword(SERVICE, USER, token);
  } catch (error) {
    console.error("Failed to store Pulsar token in keyring", error);
    throw error;
  }
}

export async function deletePulsarToken(): Promise<void> {
  try {
    await deletePassword(SERVICE, USER);
  } catch (error) {
    console.warn("Failed to delete Pulsar token from keyring", error);
  }
}

async function getHostToken(hostId: string, scope: "service" | "admin"): Promise<string | null> {
  try {
    const { service, user } = hostAccount(hostId, scope);
    const token = await getPassword(service, user);
    return token ?? null;
  } catch (error) {
    console.error(`Failed to read ${scope} token for host '${hostId}' from keyring`, error);
    return null;
  }
}

async function setHostToken(hostId: string, scope: "service" | "admin", token: string): Promise<void> {
  try {
    const { service, user } = hostAccount(hostId, scope);
    await setPassword(service, user, token);
  } catch (error) {
    console.error(`Failed to store ${scope} token for host '${hostId}' in keyring`, error);
    throw error;
  }
}

async function deleteHostToken(hostId: string, scope: "service" | "admin"): Promise<void> {
  try {
    const { service, user } = hostAccount(hostId, scope);
    await deletePassword(service, user);
  } catch (error) {
    console.warn(`Failed to delete ${scope} token for host '${hostId}' from keyring`, error);
  }
}

export async function getHostServiceToken(hostId: string): Promise<string | null> {
  return getHostToken(hostId, "service");
}

export async function setHostServiceToken(hostId: string, token: string): Promise<void> {
  return setHostToken(hostId, "service", token);
}

export async function deleteHostServiceToken(hostId: string): Promise<void> {
  return deleteHostToken(hostId, "service");
}

export async function getHostAdminToken(hostId: string): Promise<string | null> {
  return getHostToken(hostId, "admin");
}

export async function setHostAdminToken(hostId: string, token: string): Promise<void> {
  return setHostToken(hostId, "admin", token);
}

export async function deleteHostAdminToken(hostId: string): Promise<void> {
  return deleteHostToken(hostId, "admin");
}

export async function deleteAllHostTokens(hostId: string): Promise<void> {
  await Promise.all([
    deleteHostServiceToken(hostId),
    deleteHostAdminToken(hostId),
  ]);
}
