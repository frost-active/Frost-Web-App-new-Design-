import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
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

type MetricKey = keyof DeviceStatistics;
const numericKeys: MetricKey[] = ['hyd_ml', 'hyd_goal_ml', 'hyd_ack', 'hyd_miss', 'str_ack', 'str_miss', 'eye_ack', 'eye_miss', 'walk_ack', 'walk_miss', 'medit_ack', 'medit_miss', 'med_ack', 'med_miss', 'cust_ack', 'cust_miss'];
const numberValue = (value: string | undefined) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const normalizeDate = (value: string) => { const compact = value.trim().replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'); return /^\d{4}-\d{2}-\d{2}$/.test(compact) ? compact : ''; };
const emptyStats = (date: string): DeviceStatistics => ({ date, deviceDate: date, hyd_ml: 0, hyd_goal_ml: 0, hyd_ack: 0, hyd_miss: 0, str_ack: 0, str_miss: 0, eye_ack: 0, eye_miss: 0, walk_ack: 0, walk_miss: 0, medit_ack: 0, medit_miss: 0, med_ack: 0, med_miss: 0, cust_ack: 0, cust_miss: 0, medEntries: [], custEntries: [] });

export function parseStatisticsLines(lines: string[]): DeviceStatistics[] {
  const output = new Map<string, DeviceStatistics>();
  let current: DeviceStatistics | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^(STATS_BEGIN|STATS_END|HISTORY_END|DAY_END)/.test(line)) { if (line === 'DAY_END') current = null; continue; }
    const parts = line.split(':');
    const marker = parts.shift()?.trim().toUpperCase();
    if (marker === 'DAY') {
      const date = normalizeDate(parts.join(':'));
      if (!date) { current = null; continue; }
      current = output.get(date) ?? emptyStats(date); current.deviceDate = parts.join(':').trim(); output.set(date, current); continue;
    }
    if (!current || !marker) continue;
    const values = parts.join(':').split(',').map((value) => value.trim());
    if (marker === 'HYD') [current.hyd_ml, current.hyd_goal_ml, current.hyd_ack, current.hyd_miss] = values.slice(0, 4).map(numberValue);
    else if (marker === 'STR') [current.str_ack, current.str_miss] = values.slice(0, 2).map(numberValue);
    else if (marker === 'EYE') [current.eye_ack, current.eye_miss] = values.slice(0, 2).map(numberValue);
    else if (marker === 'WALK') [current.walk_ack, current.walk_miss] = values.slice(0, 2).map(numberValue);
    else if (marker === 'MEDIT') [current.medit_ack, current.medit_miss] = values.slice(0, 2).map(numberValue);
    else if (marker === 'MED' || marker === 'CUSTOM') {
      const entry = { ack: numberValue(values[0]), miss: numberValue(values[1]) };
      const entries = marker === 'MED' ? current.medEntries : current.custEntries;
      entries.push(entry);
      const prefix = marker === 'MED' ? ['med_ack', 'med_miss'] : ['cust_ack', 'cust_miss'];
      current[prefix[0] as MetricKey] = entries.reduce((sum, item) => sum + item.ack, 0);
      current[prefix[1] as MetricKey] = entries.reduce((sum, item) => sum + item.miss, 0);
    }
  }
  return [...output.values()].map((record) => { for (const key of numericKeys) record[key] = numberValue(String(record[key] ?? 0)); return record; });
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

const statisticsCollection = (macAddress: string) => collection(firebaseDb, 'devices', sanitizeMac(macAddress), 'statistics');

export async function syncDeviceStatistics(client: FrostBleClient, macAddress: string, mode: StatisticsMode = 'today'): Promise<DeviceStatistics[]> {
  let lines: string[];
  try { lines = await collectProtocol(client, mode); } catch { lines = await collectFallback(client); }
  const parsed = parseStatisticsLines(lines);
  for (const record of parsed) {
    const reference = doc(statisticsCollection(macAddress), record.date);
    const existing = await getDoc(reference);
    const existingGoal = Number(existing.data()?.hyd_goal_ml);
    if (record.hyd_goal_ml === 0 && Number.isFinite(existingGoal) && existingGoal > 0) record.hyd_goal_ml = existingGoal;
    await setDoc(reference, { ...record, updatedAt: serverTimestamp() }, { merge: true });
  }
  return parsed;
}

export function subscribeDeviceStatistics(macAddress: string | null, onChange: (records: DeviceStatistics[]) => void, onError?: (error: Error) => void): () => void {
  if (!macAddress) { onChange([]); return () => undefined; }
  return onSnapshot(statisticsCollection(macAddress), (snapshot) => {
    const records = snapshot.docs.map((item) => item.data() as DeviceStatistics).sort((left, right) => left.date.localeCompare(right.date));
    onChange(records);
  }, (error) => onError?.(error instanceof Error ? error : new Error('Unable to load device statistics.')));
}

export function useDeviceStatistics(macAddress: string | null) {
  const [records, setRecords] = useState<DeviceStatistics[]>([]);
  const [loading, setLoading] = useState(Boolean(macAddress));
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    setLoading(Boolean(macAddress)); setError(null);
    const unsubscribe = subscribeDeviceStatistics(macAddress, (next) => { setRecords(next); setLoading(false); }, (nextError) => { setError(nextError); setLoading(false); });
    return () => unsubscribe();
  }, [macAddress]);
  return { records, loading, error };
}
