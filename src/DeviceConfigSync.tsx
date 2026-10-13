import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocFromServer, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';
import { firebaseDb } from './firebase';
import { sanitizeMac } from './components/DeviceBinding';
import type { DeviceConfig } from './config/defaultConfig';

export type FrostToastDetail = {
  type: 'warning' | 'error' | 'success';
  message: string;
};

export type DeviceConfigHistoryEntry = { config: DeviceConfig; syncedAt: Date };

type DeviceConfigDocument = {
  macAddress: string;
  config: DeviceConfig;
  lastSyncedAt?: Timestamp | null;
  lastSyncedBy: string;
  lastSyncedByEmail: string;
};

const configDocument = (uid: string, macAddress: string) => doc(firebaseDb, 'users', uid, 'devices', sanitizeMac(macAddress), 'configs', 'current');
const deviceDocument = (uid: string, macAddress: string) => doc(firebaseDb, 'users', uid, 'devices', sanitizeMac(macAddress));
const historyCollection = (uid: string, macAddress: string) => collection(firebaseDb, 'users', uid, 'devices', sanitizeMac(macAddress), 'configHistory');
const bindingDocument = (macAddress: string) => doc(firebaseDb, 'deviceBindings', sanitizeMac(macAddress));

const ACCOUNT_MISMATCH_MESSAGE = 'This Frost device is linked to another account. Sign in with the registered account to sync.';

export async function ensureDeviceBindingMatchesUser(macAddress: string, uid: string): Promise<{ allowed: boolean; message: string }> {
  const strippedMac = (macAddress || '').trim();
  if (!strippedMac) return { allowed: false, message: 'Connect your Frost device before syncing.' };
  const bindingSnap = await getDoc(bindingDocument(strippedMac));
  if (!bindingSnap.exists()) {
    return { allowed: false, message: 'This Frost device is not bound to your account yet. Bind the device before syncing.' };
  }
  const binding = bindingSnap.data() as { boundUid?: string };
  if (binding.boundUid && binding.boundUid !== uid) {
    return { allowed: false, message: ACCOUNT_MISMATCH_MESSAGE };
  }
  return { allowed: true, message: '' };
}

const resolveBoundMacAddress = async (uid: string): Promise<string | null> => {
  const bindings = await getDocs(query(collection(firebaseDb, 'deviceBindings'), where('boundUid', '==', uid)));
  const latest = bindings.docs
    .map((binding) => binding.data() as { macAddress?: string; boundAt?: Timestamp | null })
    .filter((binding): binding is { macAddress: string; boundAt?: Timestamp | null } => Boolean(binding.macAddress))
    .sort((left, right) => (right.boundAt?.toMillis() ?? 0) - (left.boundAt?.toMillis() ?? 0))[0];

  return latest?.macAddress ?? null;
};

export async function saveDailyGoal(uid: string, macAddress: string, dailyGoalMl: number): Promise<void> {
  await setDoc(deviceDocument(uid, macAddress), { dailyGoalMl: Math.max(0, Math.round(dailyGoalMl)) }, { merge: true });
}

export type SaveDeviceNameResult = { ok: true } | { ok: false; message: string };

export async function saveDeviceName(uid: string, macAddress: string, deviceName: string): Promise<SaveDeviceNameResult> {
  const name = deviceName.trim();
  if (!name || name.length > 32) return { ok: false, message: 'Enter a device name between 1 and 32 characters.' };
  try {
    const ownershipCheck = await ensureDeviceBindingMatchesUser(macAddress, uid);
    if (!ownershipCheck.allowed) return { ok: false, message: ownershipCheck.message };
    await setDoc(deviceDocument(uid, macAddress), { deviceName: name, deviceNameUpdatedAt: serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (error) {
    console.error('Unable to save the FROST device name.', error);
    return { ok: false, message: 'The device was renamed, but its name could not be saved to your account.' };
  }
}

export async function saveDndStatus(uid: string, macAddress: string | null, dndEnabled: boolean): Promise<void> {
  const resolvedMac = macAddress || (await resolveBoundMacAddress(uid));
  if (!resolvedMac) return;
  await setDoc(deviceDocument(uid, resolvedMac), { dndEnabled: Boolean(dndEnabled) }, { merge: true });
}

export type SaveDeviceConfigResult = { ok: true } | { ok: false; message: string };

export async function getSavedDeviceConfig(uid: string, macAddress: string): Promise<DeviceConfig | null> {
  const snapshot = await getDocFromServer(configDocument(uid, macAddress));
  if (!snapshot.exists()) return null;
  const config = (snapshot.data() as Partial<DeviceConfigDocument>).config;
  return config && typeof config === 'object' ? config : null;
}

/** How long a save may take before it is reported as failed instead of hanging (for example when the connection dropped). */
const SAVE_TIMEOUT_MS = 20000;

/**
 * Saves the configuration that was just sent to the device as the new "last synced" configuration.
 * Resolves `ok: true` only once the server has committed it; on any failure the previously saved
 * configuration is left exactly as it was, so the app keeps showing the last successful sync.
 */
export async function saveDeviceConfig(macAddress: string, config: DeviceConfig, uid: string, email: string): Promise<SaveDeviceConfigResult> {
  const sanitizedMac = sanitizeMac(macAddress);
  try {
    const ownershipCheck = await ensureDeviceBindingMatchesUser(macAddress, uid);
    if (!ownershipCheck.allowed) return { ok: false, message: ownershipCheck.message };

    // One atomic commit: the current configuration and its history entry are stored together or not at all.
    // Unlike a plain write, a transaction is never queued while offline, so success means the server has it.
    const commit = runTransaction(firebaseDb, async (transaction) => {
      transaction.set(configDocument(uid, macAddress), {
        macAddress,
        config,
        lastSyncedAt: serverTimestamp(),
        lastSyncedBy: uid,
        lastSyncedByEmail: email,
      });
      // Keep each saved schedule so Statistics can count slots active at their scheduled time.
      transaction.set(doc(historyCollection(uid, macAddress)), {
        macAddress,
        sanitizedMac,
        config,
        syncedBy: uid,
        syncedByEmail: email,
        syncedAt: serverTimestamp(),
      });
    });
    commit.catch(() => undefined);   // a late failure after the timeout below has already been reported
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Saving the configuration timed out.')), SAVE_TIMEOUT_MS); });
    try {
      await Promise.race([commit, timeout]);
    } finally {
      clearTimeout(timer);
    }
    window.dispatchEvent(new CustomEvent('frost-device-config-saved'));
    return { ok: true };
  } catch (error) {
    console.error('Unable to save the synced FROST device configuration.', error);
    return { ok: false, message: "Sent to Aura, but couldn't save it to your account. Press Sync again to retry." };
  }
}

export function useDeviceConfig(macAddress: string | null, uid: string) {
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [dndEnabled, setDndEnabled] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let cancelled = false;
    let configLoaded = false;
    let unsubscribeConfig: (() => void) | undefined;
    let unsubscribeDevice: (() => void) | undefined;
    let latestConfigData: DeviceConfigDocument | undefined;
    let latestDeviceData: { dailyGoalMl?: number; dndEnabled?: boolean; deviceName?: string } | undefined;
    setDeviceName(null);

    const fail = (reason: unknown) => {
      if (cancelled) return;
      setConfig(null); setLastSyncedAt(null); setLoading(false);
      setError(reason instanceof Error ? reason : new Error('Unable to load the saved device configuration.'));
    };

    const withStoredDailyGoal = (baseConfig: DeviceConfig | null): DeviceConfig | null => {
      if (!baseConfig) return null;
      const persistedGoal = Number(latestDeviceData?.dailyGoalMl);
      // No separately saved goal: keep the one that was saved with the synced configuration.
      if (!(Number.isFinite(persistedGoal) && persistedGoal > 0)) return baseConfig;

      return {
        ...baseConfig,
        reminders: {
          ...baseConfig.reminders,
          hydration: {
            ...baseConfig.reminders.hydration,
            goal_ml: Math.max(0, Math.round(persistedGoal)) as any,
          },
        },
      } as DeviceConfig;
    };

    const applyConfigState = () => {
      // The device document alone says nothing about the configuration: wait until it has answered too.
      if (!configLoaded) return;
      if (!latestConfigData) {
        setConfig(null);
        setLastSyncedAt(null);
        setDndEnabled(false);
        setError(null);
        setLoading(false);
        return;
      }

      const mergedConfig = withStoredDailyGoal(latestConfigData.config);
      setConfig(mergedConfig);
      setDndEnabled(Boolean(latestDeviceData?.dndEnabled));
      setLastSyncedAt(latestConfigData.lastSyncedAt instanceof Timestamp ? latestConfigData.lastSyncedAt.toDate() : null);
      setError(null);
      setLoading(false);
    };

    const subscribe = async () => {
      let resolvedMac = macAddress;
      if (!resolvedMac) {
        const bindings = await getDocs(query(collection(firebaseDb, 'deviceBindings'), where('boundUid', '==', uid)));
        // Accounts are expected to have one binding; if legacy data has more, use the newest boundAt.
        const latest = bindings.docs
          .map((binding) => binding.data() as { macAddress?: string; boundAt?: Timestamp | null })
          .filter((binding): binding is { macAddress: string; boundAt?: Timestamp | null } => Boolean(binding.macAddress))
          .sort((left, right) => (right.boundAt?.toMillis() ?? 0) - (left.boundAt?.toMillis() ?? 0))[0];
        resolvedMac = latest?.macAddress ?? null;
      }
      if (cancelled) return;
      if (!resolvedMac) {
        setConfig(null); setLastSyncedAt(null); setDeviceName(null); setLoading(false); return;
      }

      unsubscribeConfig = onSnapshot(configDocument(uid, resolvedMac), (snapshot) => {
        if (!snapshot.exists() && snapshot.metadata.fromCache) {
          // Nothing cached and no answer from the server yet (offline) is not the same thing as "never synced".
          fail(new Error('You appear to be offline, so your last synced schedule could not be checked.'));
          return;
        }
        configLoaded = true;
        latestConfigData = snapshot.data() as DeviceConfigDocument | undefined;
        applyConfigState();
      }, fail);

      unsubscribeDevice = onSnapshot(deviceDocument(uid, resolvedMac), (snapshot) => {
        latestDeviceData = snapshot.data() as { dailyGoalMl?: number; dndEnabled?: boolean; deviceName?: string } | undefined;
        setDeviceName(typeof latestDeviceData?.deviceName === 'string' ? latestDeviceData.deviceName : null);
        applyConfigState();
      }, fail);
    };

    void subscribe().catch(fail);
    return () => {
      cancelled = true;
      unsubscribeConfig?.();
      unsubscribeDevice?.();
    };
  }, [macAddress, uid, attempt]);

  return { config, lastSyncedAt, dndEnabled, deviceName, loading, error, reload };
}

export function useDeviceConfigHistory(macAddress: string | null, uid: string) {
  const [history, setHistory] = useState<DeviceConfigHistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setHistory([]);

    const subscribe = async () => {
      const resolvedMac = macAddress || await resolveBoundMacAddress(uid);
      if (cancelled || !resolvedMac) return;
      unsubscribe = onSnapshot(historyCollection(uid, resolvedMac), (snapshot) => {
        const entries = snapshot.docs.flatMap((item) => {
          const data = item.data() as { config?: DeviceConfig; syncedAt?: Timestamp };
          return data.config && data.syncedAt instanceof Timestamp
            ? [{ config: data.config, syncedAt: data.syncedAt.toDate() }]
            : [];
        }).sort((left, right) => left.syncedAt.getTime() - right.syncedAt.getTime());
        setHistory(entries);
      }, (error) => {
        console.error('Unable to load the synced FROST configuration history.', error);
      });
    };

    void subscribe().catch((error: unknown) => {
      if (!cancelled) console.error('Unable to subscribe to FROST configuration history.', error);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [macAddress, uid]);

  return history;
}
