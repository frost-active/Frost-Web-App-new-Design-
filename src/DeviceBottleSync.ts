import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore';
import { firebaseDb } from './firebase';
import { sanitizeMac } from './components/DeviceBinding';

export type DeviceBottleStatus = {
  calibrated: boolean;
  learningEnabled: boolean;
};

export type DeviceBottleSettings = {
  bottleCalibrationStatus?: 'calibrated';
  bottleName?: 'IN USE';
  bottleLearningEnabled?: boolean;
};

const deviceDocument = (uid: string, macAddress: string) =>
  doc(firebaseDb, 'users', uid, 'devices', sanitizeMac(macAddress));

async function resolveBoundMacAddress(uid: string): Promise<string | null> {
  const bindings = await getDocs(query(collection(firebaseDb, 'deviceBindings'), where('boundUid', '==', uid)));
  const latest = bindings.docs
    .map((binding) => binding.data() as { macAddress?: string; boundAt?: Timestamp | null })
    .filter((binding): binding is { macAddress: string; boundAt?: Timestamp | null } => Boolean(binding.macAddress))
    .sort((left, right) => (right.boundAt?.toMillis() ?? 0) - (left.boundAt?.toMillis() ?? 0))[0];

  return latest?.macAddress ?? null;
}

export function subscribeDeviceBottleStatus(
  uid: string,
  macAddress: string | null,
  onChange: (status: DeviceBottleStatus) => void,
  onError: (error: Error) => void,
): () => void {
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;

  void (async () => {
    try {
      const resolvedMac = macAddress?.trim() || await resolveBoundMacAddress(uid);
      if (cancelled) return;
      if (!resolvedMac) {
        onChange({ calibrated: false, learningEnabled: false });
        return;
      }

      unsubscribe = onSnapshot(deviceDocument(uid, resolvedMac), (snapshot) => {
        const data = snapshot.data();
        onChange({
          calibrated: data?.bottleCalibrationStatus === 'calibrated',
          learningEnabled: data?.bottleLearningEnabled === true,
        });
      }, onError);
    } catch (error) {
      if (!cancelled) onError(error instanceof Error ? error : new Error('Unable to load bottle status.'));
    }
  })();

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function saveDeviceBottleSettings(
  uid: string,
  macAddress: string,
  settings: DeviceBottleSettings,
): Promise<void> {
  if (!uid || !macAddress.trim()) throw new Error('A signed-in user and device MAC address are required.');

  await setDoc(deviceDocument(uid, macAddress), {
    ...settings,
    ...(settings.bottleCalibrationStatus === 'calibrated' ? { bottleCalibratedAt: serverTimestamp() } : {}),
    bottleUpdatedAt: serverTimestamp(),
  }, { merge: true });
}
