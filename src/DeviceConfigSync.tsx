import { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';
import { firebaseDb } from './firebase';
import { sanitizeMac } from './components/DeviceBinding';
import type { DeviceConfig } from './config/defaultConfig';

export type FrostToastDetail = {
  type: 'warning' | 'error' | 'success';
  message: string;
};

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

export async function saveDailyGoal(uid: string, macAddress: string, dailyGoalMl: number): Promise<void> {
  await setDoc(deviceDocument(uid, macAddress), { dailyGoalMl: Math.max(0, Math.round(dailyGoalMl)) }, { merge: true });
}

export async function saveDeviceConfig(macAddress: string, config: DeviceConfig, uid: string, email: string): Promise<void> {
  const sanitizedMac = sanitizeMac(macAddress);
  try {
    const currentWrite = setDoc(configDocument(uid, macAddress), {
      macAddress,
      config,
      lastSyncedAt: serverTimestamp(),
      lastSyncedBy: uid,
      lastSyncedByEmail: email,
    }, { merge: true });
    // Audit history is write-only for now; a future useDeviceConfigHistory hook can read it.
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
  const [loading, setLoading] = useState(Boolean(macAddress));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let cancelled = false;
    let unsubscribeConfig: (() => void) | undefined;
    let unsubscribeDevice: (() => void) | undefined;
    let latestConfigData: DeviceConfigDocument | undefined;
    let latestDeviceData: { dailyGoalMl?: number } | undefined;

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
        setLoading(false);
        return;
      }

      const mergedConfig = withStoredDailyGoal(latestConfigData.config);
      setConfig(mergedConfig);
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
        latestDeviceData = snapshot.data() as { dailyGoalMl?: number } | undefined;
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

  return { config, lastSyncedAt, loading, error };
}
