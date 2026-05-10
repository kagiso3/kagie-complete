import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import type { UserRecord } from "@kagie/shared";

const ACCESS_TOKEN_KEY = "kagie_access_token";
const REFRESH_TOKEN_KEY = "kagie_refresh_token";
const CACHED_USER_KEY = "kagie_cached_user";
const DEVICE_DATA_DIRECTORY = `${FileSystem.documentDirectory || ""}kagie-device-cache/`;

export async function saveTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getStoredTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  ]);

  return {
    accessToken,
    refreshToken
  };
}

export async function clearStoredTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
  ]);
}

export async function setSecureJson<T>(key: string, value: T) {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export async function getSecureJson<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    await SecureStore.deleteItemAsync(key);
    return null;
  }
}

export async function deleteSecureValue(key: string) {
  await SecureStore.deleteItemAsync(key);
}

function hasDeviceFileStorage() {
  return Boolean(FileSystem.documentDirectory);
}

function deviceFileUri(key: string) {
  const encodedKey = encodeURIComponent(key);
  return `${DEVICE_DATA_DIRECTORY}${encodedKey}.json`;
}

async function ensureDeviceDataDirectory() {
  if (!hasDeviceFileStorage()) return false;
  const info = await FileSystem.getInfoAsync(DEVICE_DATA_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DEVICE_DATA_DIRECTORY, { intermediates: true });
  }
  return true;
}

export async function setDeviceJson<T>(key: string, value: T) {
  if (!(await ensureDeviceDataDirectory())) {
    await setSecureJson(key, value);
    return;
  }

  await FileSystem.writeAsStringAsync(deviceFileUri(key), JSON.stringify(value));
}

export async function getDeviceJson<T>(key: string): Promise<T | null> {
  if (!hasDeviceFileStorage()) {
    return getSecureJson<T>(key);
  }

  const uri = deviceFileUri(key);
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return null;

  try {
    const raw = await FileSystem.readAsStringAsync(uri);
    return JSON.parse(raw) as T;
  } catch {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    return null;
  }
}

export async function deleteDeviceValue(key: string) {
  if (!hasDeviceFileStorage()) {
    await deleteSecureValue(key);
    return;
  }

  await FileSystem.deleteAsync(deviceFileUri(key), { idempotent: true }).catch(() => {});
}

export async function saveCachedUser(user: UserRecord | null) {
  if (!user) {
    await deleteSecureValue(CACHED_USER_KEY);
    return;
  }
  await setSecureJson(CACHED_USER_KEY, user);
}

export function getCachedUser() {
  return getSecureJson<UserRecord>(CACHED_USER_KEY);
}

export async function clearCachedUser() {
  await deleteSecureValue(CACHED_USER_KEY);
}
