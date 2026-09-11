
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import type { FrostBleClient } from './ble';
import { sanitizeMac } from './components/DeviceBinding';
import { firebaseDb } from './firebase';

export type StatisticsMode = 'today' | 'history';
export type ReminderStatEntry = { ack: number; miss: number; [key: string]: number };
export type DeviceStatistics = {
  date: string;
  deviceDate: string;
  hyd_ml: number;
  hyd_goal_ml: number;
  hyd_ack: number;
  hyd_miss: number;
  str_ack: number;
  str_miss: number;
  eye_ack: number;
  eye_miss: number;
  walk_ack: number;
  walk_miss: number;
  medit_ack: number;
  medit_miss: number;
  med_ack: number;
  med_miss: number;
  cust_ack: number;
  cust_miss: number;
  medEntries: ReminderStatEntry[];
  custEntries: ReminderStatEntry[];
  updatedAt?: unknown;
};

const numberValue = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDate = (value: string) => {
  const compact = value.trim().replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  return /^\d{4}-\d{2}-\d{2}$/.test(compact) ? compact : '';
};

const emptyStats = (date: string): DeviceStatistics => ({
  date,
  deviceDate: date,
  hyd_ml: 0,
  hyd_goal_ml: 0,
  hyd_ack: 0,
  hyd_miss: 0,
  str_ack: 0,
  str_miss: 0,
  eye_ack: 0,
  eye_miss: 0,
  walk_ack: 0,
  walk_miss: 0,
  medit_ack: 0,
  medit_miss: 0,
  med_ack: 0,
  med_miss: 0,
  cust_ack: 0,
  cust_miss: 0,
  medEntries: [],
  custEntries: [],
});

const metricMarkers = /^(DAY|HYD|STR|EYE|WALK|MEDIT|MED|CUSTOM)\b/i;

const splitMetricValues = (payload: string) => {
  const namedValues: Record<string, number> = {};
  for (const match of payload.matchAll(/(?:^|[\s,;|])([a-z]+)\s*[:=]\s*(-?\d+(?:\.\d+)?)/gi)) {
    const key = match[1].toLowerCase();
    if (['ml', 'goal', 'ack', 'miss', 'value'].includes(key)) {
      namedValues[key] = numberValue(match[2]);
    }
  }
  if (Object.keys(namedValues).length) return namedValues;
  return (payload.match(/-?\d+(?:\.\d+)?/g) ?? []).map((token) => numberValue(token));
};

export function parseStatisticsLines(lines: string[]): DeviceStatistics[] {
  const output = new Map<string, DeviceStatistics>();
  let current: DeviceStatistics | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^(STATS_BEGIN|STATS_END|HISTORY_END|DAY_END)/.test(line)) {
      if (line === 'DAY_END') current = null;
      continue;
    }

    const match = line.match(metricMarkers);
    if (!match) continue;

    const marker = match[1].toUpperCase();
    const payload = line.slice(match[0].length).replace(/^\s*[:=,|]\s*/, '').trim();

    if (marker === 'DAY') {
      const date = normalizeDate(payload);
      if (!date) {
        current = null;
        continue;
      }
      current = output.get(date) ?? emptyStats(date);
      current.deviceDate = payload;
      output.set(date, current);
      continue;
    }

    if (!current || !marker) continue;

    const values = splitMetricValues(payload);

    if (marker === 'HYD') {
      const numbers = Array.isArray(values) ? values : [];
      if (typeof values === 'object' && !Array.isArray(values)) {
        current.hyd_ml = numberValue(String(values.ml ?? values.value ?? 0));
        current.hyd_goal_ml = numberValue(String(values.goal ?? 0));
        current.hyd_ack = numberValue(String(values.ack ?? 0));
        current.hyd_miss = numberValue(String(values.miss ?? 0));
      } else if (numbers.length >= 4) {
        current.hyd_ml = numbers[0] ?? 0;
        current.hyd_goal_ml = numbers[1] ?? 0;
        current.hyd_ack = numbers[2] ?? 0;
        current.hyd_miss = numbers[3] ?? 0;
      } else if (numbers.length >= 3) {
        current.hyd_ml = numbers[0] ?? 0;
        current.hyd_goal_ml = 0;
        current.hyd_ack = numbers[1] ?? 0;
        current.hyd_miss = numbers[2] ?? 0;
      }
    } else if (marker === 'STR') {
      if (typeof values === 'object' && !Array.isArray(values)) {
        current.str_ack = numberValue(String(values.ack ?? 0));
        current.str_miss = numberValue(String(values.miss ?? 0));
      } else {
        const numbers = Array.isArray(values) ? values : [];
        [current.str_ack, current.str_miss] = numbers.slice(0, 2).map((n) => numberValue(String(n)));
      }
    } else if (marker === 'EYE') {
      if (typeof values === 'object' && !Array.isArray(values)) {
        current.eye_ack = numberValue(String(values.ack ?? 0));
        current.eye_miss = numberValue(String(values.miss ?? 0));
      } else {
        const numbers = Array.isArray(values) ? values : [];
        [current.eye_ack, current.eye_miss] = numbers.slice(0, 2).map((n) => numberValue(String(n)));
      }
    } else if (marker === 'WALK') {
      if (typeof values === 'object' && !Array.isArray(values)) {
        current.walk_ack = numberValue(String(values.ack ?? 0));
        current.walk_miss = numberValue(String(values.miss ?? 0));
      } else {
        const numbers = Array.isArray(values) ? values : [];
        [current.walk_ack, current.walk_miss] = numbers.slice(0, 2).map((n) => numberValue(String(n)));
      }
    } else if (marker === 'MEDIT') {
      if (typeof values === 'object' && !Array.isArray(values)) {
        current.medit_ack = numberValue(String(values.ack ?? 0));
        current.medit_miss = numberValue(String(values.miss ?? 0));
      } else {
        const numbers = Array.isArray(values) ? values : [];
        [current.medit_ack, current.medit_miss] = numbers.slice(0, 2).map((n) => numberValue(String(n)));
      }
    } else if (marker === 'MED' || marker === 'CUSTOM') {
      let ack = 0;
      let miss = 0;
      if (typeof values === 'object' && !Array.isArray(values)) {
        ack = numberValue(String(values.ack ?? 0));
        miss = numberValue(String(values.miss ?? 0));
      } else {
        const numbers = Array.isArray(values) ? values : [];
        ack = numberValue(String(numbers[0] ?? 0));
        miss = numberValue(String(numbers[1] ?? 0));
      }
      const entry = { ack, miss };
      const entries = marker === 'MED' ? current.medEntries : current.custEntries;
      entries.push(entry);
      if (marker === 'MED') {
        current.med_ack = entries.reduce((sum, item) => sum + item.ack, 0);
        current.med_miss = entries.reduce((sum, item) => sum + item.miss, 0);
      } else {
        current.cust_ack = entries.reduce((sum, item) => sum + item.ack, 0);
        current.cust_miss = entries.reduce((sum, item) => sum + item.miss, 0);
      }
    }
  }

  return [...output.values()].map((record) => ({
    ...record,
    hyd_ml: numberValue(String(record.hyd_ml)),
    hyd_goal_ml: numberValue(String(record.hyd_goal_ml)),
    hyd_ack: numberValue(String(record.hyd_ack)),
    hyd_miss: numberValue(String(record.hyd_miss)),
    str_ack: numberValue(String(record.str_ack)),
    str_miss: numberValue(String(record.str_miss)),
    eye_ack: numberValue(String(record.eye_ack)),
    eye_miss: numberValue(String(record.eye_miss)),
    walk_ack: numberValue(String(record.walk_ack)),
    walk_miss: numberValue(String(record.walk_miss)),
    medit_ack: numberValue(String(record.medit_ack)),
    medit_miss: numberValue(String(record.medit_miss)),
    med_ack: numberValue(String(record.med_ack)),
    med_miss: numberValue(String(record.med_miss)),
    cust_ack: numberValue(String(record.cust_ack)),
    cust_miss: numberValue(String(record.cust_miss)),
  }));
}

async function collectProtocol(client: FrostBleClient, mode: StatisticsMode): Promise<string[]> {
  const lines: string[] = [];
  let response = await client.sendAndRead(mode === 'today' ? 'STATS:TODAY' : 'STATS:HISTORY');
  for (let index = 0; index < 256; index += 1) {
    lines.push(...response.split(/\r?\n/));
    if (mode === 'today' ? response.includes('STATS_END') : response.includes('HISTORY_END')) return lines;
    response = await client.sendAndRead(mode === 'today' ? 'STATS:NEXT' : 'STATS:HISTORY_NEXT');
  }
  throw new Error('Statistics protocol did not reach its end marker.');
}

async function collectFallback(client: FrostBleClient): Promise<string[]> {
  const lines: string[] = [];
  let response = await client.sendAndRead('STATS:GET');
  for (let index = 0; index < 256; index += 1) {
    lines.push(...response.split(/\r?\n/));
    if (response.includes('STATS_END') || response.includes('DAY_END')) return lines;
    response = await client.readStatus();
  }
  return lines;
}

const statisticsCollection = (macAddress: string) =>
  collection(firebaseDb, 'devices', sanitizeMac(macAddress), 'statistics');

const deviceDocument = (uid: string, macAddress: string) =>
  doc(firebaseDb, 'users', uid, 'devices', sanitizeMac(macAddress));

async function resolveBoundMacAddress(uid?: string): Promise<string | null> {
  if (!uid) return null;
  const bindings = await getDocs(query(collection(firebaseDb, 'deviceBindings'), where('boundUid', '==', uid)));
  const latest = bindings.docs
    .map((binding) => binding.data() as { macAddress?: string; boundAt?: { toMillis?: () => number } | null })
    .filter((binding): binding is { macAddress: string; boundAt?: { toMillis?: () => number } | null } =>
      Boolean(binding.macAddress)
    )
    .sort((left, right) => (right.boundAt?.toMillis?.() ?? 0) - (left.boundAt?.toMillis?.() ?? 0))[0];

  return latest?.macAddress ?? null;
}

export async function syncDeviceStatistics(
  client: FrostBleClient,
  macAddress: string,
  mode: StatisticsMode = 'today',
  uid?: string
): Promise<DeviceStatistics[]> {
  let lines: string[];
  try {
    lines = await collectProtocol(client, mode);
  } catch {
    lines = await collectFallback(client);
  }

  const parsed = parseStatisticsLines(lines);
  const storedGoal = uid ? Number((await getDoc(deviceDocument(uid, macAddress))).data()?.dailyGoalMl) : 0;

  for (const record of parsed) {
    const reference = doc(statisticsCollection(macAddress), record.date);
    const existing = await getDoc(reference);
    const existingGoal = Number(existing.data()?.hyd_goal_ml);
    const nextGoal =
      storedGoal > 0
        ? storedGoal
        : Number.isFinite(existingGoal) && existingGoal > 0
          ? existingGoal
          : record.hyd_goal_ml;

    record.hyd_goal_ml = Number.isFinite(nextGoal) && nextGoal > 0 ? nextGoal : 0;
    await setDoc(reference, { ...record, updatedAt: serverTimestamp() }, { merge: true });
  }

  return parsed;
}

export function subscribeDeviceStatistics(
  macAddress: string | null,
  onChange: (records: DeviceStatistics[]) => void,
  onError?: (error: Error) => void,
  uid?: string
): () => void {
  let cancelled = false;
  let unsubscribe: () => void = () => undefined;

  const start = async () => {
    const resolvedMac = macAddress || (await resolveBoundMacAddress(uid));
    if (cancelled || !resolvedMac) {
      if (!cancelled) onChange([]);
      return;
    }

    unsubscribe = onSnapshot(
      statisticsCollection(resolvedMac),
      (snapshot) => {
        const records = snapshot.docs
          .map((item) => item.data() as DeviceStatistics)
          .sort((left, right) => left.date.localeCompare(right.date));
        onChange(records);
      },
      (error) => {
        onError?.(error instanceof Error ? error : new Error('Unable to load device statistics.'));
        if (!cancelled) onChange([]);
      }
    );
  };

  void start();

  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export function useDeviceStatistics(macAddress: string | null) {
  const [records, setRecords] = useState<DeviceStatistics[]>([]);
  const [loading, setLoading] = useState(Boolean(macAddress));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(Boolean(macAddress));
    setError(null);
    const unsubscribe = subscribeDeviceStatistics(
      macAddress,
      (next) => {
        setRecords(next);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [macAddress]);

  return { records, loading, error };
}
