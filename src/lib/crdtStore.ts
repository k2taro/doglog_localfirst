import init, { LoroDoc, LoroMap, Value } from 'loro-crdt/web/loro_wasm.js';
import wasmUrl from 'loro-crdt/web/loro_wasm_bg.wasm?url';
import { DogLog, FoodEntryItem, NewDogLogInput } from '../types/dogLog';

const LOGS_CONTAINER_KEY = 'dog_logs';

let wasmInitPromise: Promise<void> | null = null;
let activeDoc: LoroDoc | null = null;

export async function ensureLoroReady(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = init(wasmUrl).then(() => undefined);
  }
  await wasmInitPromise;
}

export async function initCrdtDoc(snapshotBytes?: Uint8Array | null): Promise<LoroDoc> {
  await ensureLoroReady();
  if (snapshotBytes && snapshotBytes.byteLength > 0) {
    try {
      activeDoc = LoroDoc.fromSnapshot(snapshotBytes);
      return activeDoc;
    } catch (err) {
      console.warn('Failed to restore LoroDoc from snapshot, creating fresh doc:', err);
    }
  }
  activeDoc = new LoroDoc();
  return activeDoc;
}

export function getCrdtDoc(): LoroDoc {
  if (!activeDoc) {
    throw new Error('LoroDoc is not initialized yet. Call initCrdtDoc() first.');
  }
  return activeDoc;
}

function generateLogId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `doglog_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeFoodItems(items: FoodEntryItem[]): Value[] {
  return items.map((item) => {
    const clean: Record<string, Value> = {
      foodType: item.foodType,
    };
    if (item.grams !== undefined) clean.grams = item.grams;
    if (item.snackKind !== undefined) clean.snackKind = item.snackKind;
    if (item.volumeMl !== undefined) clean.volumeMl = item.volumeMl;
    return clean;
  });
}

function writeLogFieldsToMap(entryMap: LoroMap, log: DogLog): void {
  const entries = Object.entries(log) as [keyof DogLog, unknown][];
  for (const [key, value] of entries) {
    if (value === undefined) {
      entryMap.delete(key);
    } else if (key === 'foodItems' && Array.isArray(value)) {
      entryMap.set(key, sanitizeFoodItems(value as FoodEntryItem[]));
    } else {
      entryMap.set(key, value as Value);
    }
  }
}

export function addDogLog(input: NewDogLogInput): DogLog {
  const doc = getCrdtDoc();
  const now = Date.now();
  const log: DogLog = {
    ...input,
    id: generateLogId(),
    createdAt: now,
    updatedAt: now,
  };

  const logsMap = doc.getMap(LOGS_CONTAINER_KEY);
  const entryMap = logsMap.getOrCreateContainer(log.id, new LoroMap());
  writeLogFieldsToMap(entryMap, log);
  doc.commit();

  return log;
}

export function restoreDogLog(log: DogLog): DogLog {
  const doc = getCrdtDoc();
  const logsMap = doc.getMap(LOGS_CONTAINER_KEY);
  const entryMap = logsMap.getOrCreateContainer(log.id, new LoroMap());
  writeLogFieldsToMap(entryMap, { ...log, updatedAt: Date.now() });
  doc.commit();
  return log;
}

export function updateDogLog(id: string, patch: Partial<DogLog>): DogLog | null {
  const doc = getCrdtDoc();
  const existing = getAllDogLogs().find((item) => item.id === id);
  if (!existing) return null;

  const updated: DogLog = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };

  const logsMap = doc.getMap(LOGS_CONTAINER_KEY);
  const entryMap = logsMap.getOrCreateContainer(id, new LoroMap());
  writeLogFieldsToMap(entryMap, updated);
  doc.commit();

  return updated;
}

export function deleteDogLog(id: string): void {
  const doc = getCrdtDoc();
  const logsMap = doc.getMap(LOGS_CONTAINER_KEY);
  logsMap.delete(id);
  doc.commit();
}

export function clearAllDogLogs(): void {
  const doc = getCrdtDoc();
  const logsMap = doc.getMap(LOGS_CONTAINER_KEY);
  logsMap.clear();
  doc.commit();
}

export function getAllDogLogs(): DogLog[] {
  const doc = getCrdtDoc();
  const json = doc.toJSON() as { dog_logs?: Record<string, Partial<DogLog>> };
  const rawLogs = json?.[LOGS_CONTAINER_KEY];
  if (!rawLogs || typeof rawLogs !== 'object') {
    return [];
  }

  return Object.values(rawLogs)
    .filter(
      (item): item is DogLog =>
        Boolean(item && item.id && item.category && typeof item.timestamp === 'number'),
    )
    .sort((a, b) => {
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      return b.createdAt - a.createdAt;
    });
}

export function exportCrdtSnapshot(): Uint8Array {
  const doc = getCrdtDoc();
  return doc.export({ mode: 'snapshot' });
}

export function importCrdtBinary(bytes: Uint8Array): void {
  const doc = getCrdtDoc();
  doc.import(bytes);
}

export function getCrdtMetadata() {
  const doc = getCrdtDoc();
  return {
    peerId: doc.peerIdStr,
    opCount: doc.opCount(),
    changeCount: doc.changeCount(),
  };
}
