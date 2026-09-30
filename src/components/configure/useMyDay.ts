import { useSyncExternalStore } from 'react';
import type { MyDayStore, Snapshot } from './store';

/** Subscribes a component to the My day model (schedule + tracker). */
export function useMyDay(store: MyDayStore): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
