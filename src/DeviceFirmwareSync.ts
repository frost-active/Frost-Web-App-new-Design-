import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';
import type { FrostBleClient } from './ble';
import { firebaseDb } from './firebase';

export interface DeviceFirmwareInfo {
  firmware_version?: string | null;
  latest_firmware_version?: string | null;
  firmware_update_available?: boolean;
  firmware_last_checked_at?: number | null;
  firmware_info_synced?: boolean;
  firmware_ota_busy?: boolean;
}

export interface DeviceFirmwareSyncResult extends DeviceFirmwareInfo {
  rawResponse?: string;
}

const VERSION_MANIFEST_URL = 'https://raw.githubusercontent.com/Jeevuppendra/frost-ota/refs/heads/main/version.json';
const OTA_VERSION_REGEX = /version\s*=\s*v?(\d+(?:\.\d+){0,2})/i;
const OTA_BUSY_REGEX = /busy\s*=\s*(yes|no|true|false|1|0)/i;

function deviceDocument(uid: string, macAddress: string) {
  return doc(firebaseDb, 'users', uid, 'devices', macAddress.replace(/:/g, '-'));
}

async function resolveBoundMacAddress(uid: string): Promise<string | null> {
  const bindings = await getDocs(query(collection(firebaseDb, 'deviceBindings'), where('boundUid', '==', uid)));
  const latest = bindings.docs
    .map((binding) => binding.data() as { macAddress?: string; boundAt?: Timestamp | null })
    .filter((binding): binding is { macAddress: string; boundAt?: Timestamp | null } => Boolean(binding.macAddress))
    .sort((left, right) => (right.boundAt?.toMillis() ?? 0) - (left.boundAt?.toMillis() ?? 0))[0];

  return latest?.macAddress ?? null;
}

export function subscribeStoredFirmwareInfo(
  uid: string,
  macAddress: string | null,
  onChange: (info: DeviceFirmwareInfo) => void,
): () => void {
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;

  void (async () => {
    try {
      const resolvedMac = macAddress?.trim() || await resolveBoundMacAddress(uid);
      if (cancelled || !resolvedMac) return;

      unsubscribe = onSnapshot(deviceDocument(uid, resolvedMac), (snapshot) => {
        onChange(snapshot.exists() ? snapshot.data() as DeviceFirmwareInfo : {});
      }, (error) => {
        console.warn('[DeviceFirmwareSync] Stored firmware metadata could not be read.', error);
      });
    } catch (error) {
      if (!cancelled) console.warn('[DeviceFirmwareSync] Bound device firmware metadata could not be resolved.', error);
    }
  })();

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

function parseSemver(value: string): [number, number, number] | null {
  const match = /^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?\s*$/.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? '0'), Number(match[3] ?? '0')];
}

export function compareFirmwareVersions(remote: string | null | undefined, local: string | null | undefined): number {
  if (!remote || !local) return 0;
  const remoteParts = parseSemver(remote);
  const localParts = parseSemver(local);
  if (!remoteParts || !localParts) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (remoteParts[index] !== localParts[index]) return remoteParts[index] > localParts[index] ? 1 : -1;
  }
  return 0;
}

function normalizeVersion(value: string): string {
  const parts = value.split('.');
  while (parts.length < 3) parts.push('0');
  return parts.slice(0, 3).join('.');
}

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function readFirmwareInfo(client: FrostBleClient): Promise<DeviceFirmwareSyncResult> {
  let lastResponse = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await client.otaInfo();
      lastResponse = response;
      const version = OTA_VERSION_REGEX.exec(response)?.[1];
      if (version) {
        const busy = OTA_BUSY_REGEX.exec(response)?.[1]?.toLowerCase();
        return {
          firmware_version: normalizeVersion(version),
          firmware_info_synced: true,
          firmware_ota_busy: busy === 'yes' || busy === 'true' || busy === '1',
          firmware_last_checked_at: Date.now(),
          rawResponse: response,
        };
      }
    } catch (error) {
      lastResponse = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 2) await delay(600);
  }
  return {
    firmware_info_synced: false,
    firmware_ota_busy: false,
    firmware_last_checked_at: Date.now(),
    rawResponse: lastResponse,
  };
}

async function getLatestFirmwareVersion(): Promise<string | null> {
  try {
    const response = await fetch(VERSION_MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) return null;
    const manifest: unknown = await response.json();
    if (!manifest || typeof manifest !== 'object' || !('version' in manifest) || typeof manifest.version !== 'string') return null;
    return parseSemver(manifest.version) ? manifest.version : null;
  } catch (error) {
    console.warn('[DeviceFirmwareSync] Latest firmware manifest unavailable.', error);
    return null;
  }
}

export async function syncFirmwareInfoToFirestore(
  uid: string,
  macAddress: string,
  client: FrostBleClient,
): Promise<DeviceFirmwareSyncResult> {
  const normalizedMac = macAddress.trim();
  if (!uid || !normalizedMac) throw new Error('A signed-in user and device MAC address are required.');

  const info = await readFirmwareInfo(client);
  const freshLatest = await getLatestFirmwareVersion();
  let current: DeviceFirmwareInfo = {};
  try {
    const snapshot = await getDoc(deviceDocument(uid, normalizedMac));
    if (snapshot.exists()) current = snapshot.data() as DeviceFirmwareInfo;
  } catch (error) {
    console.warn('[DeviceFirmwareSync] Existing firmware metadata could not be read.', error);
  }

  const firmwareVersion = info.firmware_version ?? current.firmware_version ?? null;
  const latestVersion = freshLatest ?? current.latest_firmware_version ?? null;
  const result: DeviceFirmwareSyncResult = {
    ...info,
    firmware_version: firmwareVersion,
    latest_firmware_version: latestVersion,
    firmware_update_available: compareFirmwareVersions(latestVersion, firmwareVersion) > 0,
  };

  try {
    await setDoc(deviceDocument(uid, normalizedMac), {
      firmware_info_synced: info.firmware_info_synced ?? false,
      firmware_ota_busy: info.firmware_ota_busy ?? current.firmware_ota_busy ?? false,
      firmware_last_checked_at: info.firmware_last_checked_at ?? Date.now(),
      firmware_update_available: result.firmware_update_available,
      ...(firmwareVersion ? { firmware_version: firmwareVersion } : {}),
      ...(latestVersion ? { latest_firmware_version: latestVersion } : {}),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('[DeviceFirmwareSync] Firmware metadata could not be saved.', error);
  }

  return result;
}