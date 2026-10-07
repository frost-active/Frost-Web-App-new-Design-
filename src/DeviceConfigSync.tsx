import { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';
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

export async function saveDndStatus(uid: string, macAddress: string | null, dndEnabled: boolean): Promise<void> {
  const resolvedMac = macAddress || (await resolveBoundMacAddress(uid));
  if (!resolvedMac) return;
  await setDoc(deviceDocument(uid, resolvedMac), { dndEnabled: Boolean(dndEnabled) }, { merge: true });
}

export async function saveDeviceConfig(macAddress: string, config: DeviceConfig, uid: string, email: string): Promise<void> {
  const sanitizedMac = sanitizeMac(macAddress);
  try {
    const ownershipCheck = await ensureDeviceBindingMatchesUser(macAddress, uid);
    if (!ownershipCheck.allowed) {
      window.dispatchEvent(new CustomEvent<FrostToastDetail>('frost:toast', {
        detail: { type: 'warning', message: ownershipCheck.message },
      }));
      return;
    }

    const currentWrite = setDoc(configDocument(uid, macAddress), {
      macAddress,
      config,
      lastSyncedAt: serverTimestamp(),
      lastSyncedBy: uid,
      lastSyncedByEmail: email,
    }, { merge: true });
    // Keep each saved schedule so Statistics can count slots active at their scheduled time.
    const historyWrite = addDoc(historyCollection(uid, macAddress), {
      macAddress,
      sanitizedMac,
      config,
      syncedBy: uid,
      syncedByEmail: email,
      syncedAt: serverTimestamp(),
    });
    const results = await Promise.allSettled([currentWrite, historyWrite]);
    const currentResult = results[0];
    const historyResult = results[1];
    if (currentResult.status === 'rejected') throw currentResult.reason;
    window.dispatchEvent(new CustomEvent('frost-device-config-saved'));
    if (historyResult.status === 'rejected') {
      console.error('Unable to save the FROST device configuration history.', historyResult.reason);
    }
  } catch (error) {
    console.error('Unable to save the synced FROST device configuration.', error);
    window.dispatchEvent(new CustomEvent<FrostToastDetail>('frost:toast', {
      detail: { type: 'warning', message: "Synced to device, but couldn't save backup config" },
    }));
  }
}

export function useDeviceConfig(macAddress: string | null, uid: string) {
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [dndEnabled, setDndEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(Boolean(macAddress));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let cancelled = false;
    let unsubscribeConfig: (() => void) | undefined;
    let unsubscribeDevice: (() => void) | undefined;
    let latestConfigData: DeviceConfigDocument | undefined;
    let latestDeviceData: { dailyGoalMl?: number; dndEnabled?: boolean } | undefined;

    const withStoredDailyGoal = (baseConfig: DeviceConfig | null): DeviceConfig | null => {
      if (!baseConfig) return null;
      const persistedGoal = Number(latestDeviceData?.dailyGoalMl);
      const goalMl = Number.isFinite(persistedGoal) && persistedGoal > 0 ? persistedGoal : 0;

      return {
        ...baseConfig,
        reminders: {
          ...baseConfig.reminders,
          hydration: {
            ...baseConfig.reminders.hydration,
            goal_ml: Math.max(0, Math.round(goalMl)) as any,
          },
        },
      } as DeviceConfig;
    };

    const applyConfigState = () => {
      if (!latestConfigData) {
        setConfig(null);
        setLastSyncedAt(null);
        setDndEnabled(false);
        setLoading(false);
        return;
      }

      const mergedConfig = withStoredDailyGoal(latestConfigData.config);
      setConfig(mergedConfig);
      setDndEnabled(Boolean(latestDeviceData?.dndEnabled));
      setLastSyncedAt(latestConfigData.lastSyncedAt instanceof Timestamp ? latestConfigData.lastSyncedAt.toDate() : null);
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
        setConfig(null); setLastSyncedAt(null); setLoading(false); return;
      }

      unsubscribeConfig = onSnapshot(configDocument(uid, resolvedMac), (snapshot) => {
        latestConfigData = snapshot.data() as DeviceConfigDocument | undefined;
        applyConfigState();
      }, (snapshotError) => {
        setConfig(null); setLastSyncedAt(null); setLoading(false);
        setError(snapshotError instanceof Error ? snapshotError : new Error('Unable to load the saved device configuration.'));
      });

      unsubscribeDevice = onSnapshot(deviceDocument(uid, resolvedMac), (snapshot) => {
        latestDeviceData = snapshot.data() as { dailyGoalMl?: number; dndEnabled?: boolean } | undefined;
        applyConfigState();
      }, (snapshotError) => {
        setConfig(null); setLastSyncedAt(null); setLoading(false);
        setError(snapshotError instanceof Error ? snapshotError : new Error('Unable to load the saved device configuration.'));
      });
    };

    void subscribe().catch((snapshotError: unknown) => {
      if (cancelled) return;
      setConfig(null); setLastSyncedAt(null); setLoading(false);
      setError(snapshotError instanceof Error ? snapshotError : new Error('Unable to load the saved device configuration.'));
    });
    return () => {
      cancelled = true;
      unsubscribeConfig?.();
      unsubscribeDevice?.();
    };
  }, [macAddress, uid]);

  return { config, lastSyncedAt, dndEnabled, loading, error };
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
