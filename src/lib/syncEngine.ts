import { get, set } from 'idb-keyval';
import {
  DogLog,
  LocalProfile,
  NewDogLogInput,
  SyncStatusInfo,
} from '../types/dogLog';
import {
  addDogLog,
  clearAllDogLogs,
  deleteDogLog,
  exportCrdtSnapshot,
  getAllDogLogs,
  initCrdtDoc,
  restoreDogLog,
  updateDogLog,
} from './crdtStore';

const SNAPSHOT_KEY = 'wanlog_loro_snapshot_v1';
const PROFILE_KEY = 'wanlog_local_profile_v1';
const LAST_SAVED_KEY = 'wanlog_last_saved_v1';

export const DEFAULT_PROFILE: LocalProfile = {
  dogName: '愛犬',
  authorName: '飼い主',
  dailyWaterGoalMl: 400,
};

export async function bootstrapLocalStore(): Promise<{
  logs: DogLog[];
  profile: LocalProfile;
  status: SyncStatusInfo;
}> {
  const [snapshotBytes, savedProfile, savedAt] = await Promise.all([
    get<Uint8Array>(SNAPSHOT_KEY),
    get<Partial<LocalProfile>>(PROFILE_KEY),
    get<number>(LAST_SAVED_KEY),
  ]);

  await initCrdtDoc(snapshotBytes ?? null);
  const logs = getAllDogLogs();
  const currentBytes = snapshotBytes ?? exportCrdtSnapshot();

  let resolvedSavedAt = savedAt ?? null;
  if (!snapshotBytes) {
    resolvedSavedAt = Date.now();
    await Promise.all([
      set(SNAPSHOT_KEY, currentBytes),
      set(LAST_SAVED_KEY, resolvedSavedAt),
    ]);
  }

  return {
    logs,
    profile: {
      ...DEFAULT_PROFILE,
      ...(savedProfile ?? {}),
    },
    status: {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      persistenceState: 'saved',
      lastSavedAt: resolvedSavedAt,
      snapshotBytes: currentBytes.byteLength,
      logCount: logs.length,
    },
  };
}

export async function persistSnapshotToIndexedDB(): Promise<{
  savedAt: number;
  snapshotBytes: number;
}> {
  const bytes = exportCrdtSnapshot();
  const savedAt = Date.now();
  await Promise.all([set(SNAPSHOT_KEY, bytes), set(LAST_SAVED_KEY, savedAt)]);
  return {
    savedAt,
    snapshotBytes: bytes.byteLength,
  };
}

export async function addLogAndPersist(input: NewDogLogInput): Promise<{
  log: DogLog;
  logs: DogLog[];
  savedAt: number;
  snapshotBytes: number;
}> {
  const log = addDogLog(input);
  const { savedAt, snapshotBytes } = await persistSnapshotToIndexedDB();
  return {
    log,
    logs: getAllDogLogs(),
    savedAt,
    snapshotBytes,
  };
}

export async function updateLogAndPersist(
  id: string,
  patch: Partial<DogLog>,
): Promise<{
  log: DogLog | null;
  logs: DogLog[];
  savedAt: number;
  snapshotBytes: number;
}> {
  const log = updateDogLog(id, patch);
  const { savedAt, snapshotBytes } = await persistSnapshotToIndexedDB();
  return {
    log,
    logs: getAllDogLogs(),
    savedAt,
    snapshotBytes,
  };
}

export async function deleteLogAndPersist(id: string): Promise<{
  logs: DogLog[];
  savedAt: number;
  snapshotBytes: number;
}> {
  deleteDogLog(id);
  const { savedAt, snapshotBytes } = await persistSnapshotToIndexedDB();
  return {
    logs: getAllDogLogs(),
    savedAt,
    snapshotBytes,
  };
}

export async function restoreLogAndPersist(log: DogLog): Promise<{
  logs: DogLog[];
  savedAt: number;
  snapshotBytes: number;
}> {
  restoreDogLog(log);
  const { savedAt, snapshotBytes } = await persistSnapshotToIndexedDB();
  return {
    logs: getAllDogLogs(),
    savedAt,
    snapshotBytes,
  };
}

export async function resetLocalLogsAndPersist(): Promise<{
  logs: DogLog[];
  savedAt: number;
  snapshotBytes: number;
}> {
  clearAllDogLogs();
  const { savedAt, snapshotBytes } = await persistSnapshotToIndexedDB();
  return {
    logs: getAllDogLogs(),
    savedAt,
    snapshotBytes,
  };
}

export async function saveLocalProfile(profile: LocalProfile): Promise<void> {
  await set(PROFILE_KEY, profile);
}
