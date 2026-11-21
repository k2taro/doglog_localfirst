import { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Loader2, RotateCcw, SlidersHorizontal, Users, X } from 'lucide-react';
import {
  DogLog,
  LocalProfile,
  LogCategory,
  NewDogLogInput,
  SyncStatusInfo,
} from './types/dogLog';
import { FamilyContextData } from './types/family';
import {
  DEFAULT_PROFILE,
  addLogAndPersist,
  bootstrapLocalStore,
  deleteLogAndPersist,
  resetLocalLogsAndPersist,
  restoreLogAndPersist,
  saveLocalProfile,
  updateLogAndPersist,
} from './lib/syncEngine';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  fetchMyFamilyContext,
  leaveFamilyGroup,
  loadPendingInviteCode,
  updateMyFamilyDisplayName,
} from './lib/familyService';
import { describeLogTitle, getDateKey } from './lib/formatters';
import { AuthGate } from './components/AuthGate';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { QuickActionPad } from './components/QuickActionPad';
import { TimelineList } from './components/TimelineList';
import { ConfirmLogModal } from './components/ConfirmLogModal';
import { EditLogModal } from './components/EditLogModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const [logs, setLogs] = useState<DogLog[]>([]);
  const [profile, setProfile] = useState<LocalProfile>(DEFAULT_PROFILE);
  const [status, setStatus] = useState<SyncStatusInfo>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    persistenceState: 'loading',
    lastSavedAt: null,
    snapshotBytes: 0,
    logCount: 0,
  });

  // Step 2: Auth & Family Group state
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured);
  const [familyContext, setFamilyContext] = useState<FamilyContextData | null>(null);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [localModeOnly, setLocalModeOnly] = useState(!isSupabaseConfigured);
  const [showAuthGate, setShowAuthGate] = useState(false);

  const [selectedDateKey, setSelectedDateKey] = useState(() => getDateKey(Date.now()));
  const [categoryFilter, setCategoryFilter] = useState<LogCategory | 'all'>('all');
  const [pendingConfirm, setPendingConfirm] = useState<{
    draft: NewDogLogInput;
    fromFoodTray?: boolean;
    fromMedicine?: boolean;
  } | null>(null);
  const [foodTrayResetKey, setFoodTrayResetKey] = useState(0);
  const [medicineResetKey, setMedicineResetKey] = useState(0);
  const [lastSavedCategory, setLastSavedCategory] = useState<string | null>(null);

  const [editingLog, setEditingLog] = useState<DogLog | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deletedUndoLog, setDeletedUndoLog] = useState<DogLog | null>(null);

  // Bootstrap local CRDT store + capture ?invite=XXXX
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [booted, inviteCode] = await Promise.all([
          bootstrapLocalStore(),
          loadPendingInviteCode(),
        ]);
        if (cancelled) return;
        setLogs(booted.logs);
        setProfile(booted.profile);
        setStatus(booted.status);
        setPendingInviteCode(inviteCode);
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to bootstrap local store:', err);
        setInitError(
          err instanceof Error ? err.message : 'ローカルデータベースの初期化に失敗しました',
        );
        setStatus((prev) => ({ ...prev, persistenceState: 'error' }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load family context when user changes
  const refreshFamilyContext = useCallback(async (userId: string) => {
    setFamilyLoading(true);
    try {
      const ctx = await fetchMyFamilyContext(userId);
      setFamilyContext(ctx);
      if (ctx?.membership.display_name) {
        setProfile((prev) => {
          if (prev.authorName === DEFAULT_PROFILE.authorName) {
            const updated = { ...prev, authorName: ctx.membership.display_name! };
            void saveLocalProfile(updated);
            return updated;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Failed to load family context:', err);
    } finally {
      setFamilyLoading(false);
    }
  }, []);

  // Supabase Auth session + listener
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthChecked(true);
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const sessionUser = data.session?.user ?? null;
        setUser(sessionUser);
        setAuthChecked(true);
        if (sessionUser) {
          void refreshFamilyContext(sessionUser.id);
        }
      })
      .catch((err) => {
        console.error('Failed to read Supabase session:', err);
        if (active) setAuthChecked(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setAuthChecked(true);
      if (nextUser) {
        setLocalModeOnly(false);
        void refreshFamilyContext(nextUser.id);
      } else {
        setFamilyContext(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshFamilyContext]);

  useEffect(() => {
    const handleOnline = () => setStatus((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus((prev) => ({ ...prev, isOnline: false }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!deletedUndoLog) return;
    const timer = window.setTimeout(() => {
      setDeletedUndoLog(null);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [deletedUndoLog]);

  useEffect(() => {
    if (!lastSavedCategory) return;
    const timer = window.setTimeout(() => {
      setLastSavedCategory(null);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [lastSavedCategory]);

  const todayWaterTotalMl = useMemo(() => {
    const todayKey = getDateKey(Date.now());
    return logs.reduce((sum, l) => {
      if (l.category === 'water' && getDateKey(l.timestamp) === todayKey) {
        return sum + (l.waterMl ?? 0);
      }
      return sum;
    }, 0);
  }, [logs]);

  const handleRequestConfirm = useCallback(
    (draft: NewDogLogInput, meta?: { fromFoodTray?: boolean; fromMedicine?: boolean }) => {
      setPendingConfirm({
        draft,
        fromFoodTray: meta?.fromFoodTray,
        fromMedicine: meta?.fromMedicine,
      });
    },
    [],
  );

  const handleConfirmSaveLog = useCallback(
    async (finalInput: NewDogLogInput) => {
      const wasFoodTray = pendingConfirm?.fromFoodTray;
      const wasMedicine = pendingConfirm?.fromMedicine;
      setStatus((prev) => ({ ...prev, persistenceState: 'saving' }));
      try {
        const result = await addLogAndPersist(finalInput);
        setLogs(result.logs);
        setSelectedDateKey(getDateKey(result.log.timestamp));
        setStatus((prev) => ({
          ...prev,
          persistenceState: 'saved',
          lastSavedAt: result.savedAt,
          snapshotBytes: result.snapshotBytes,
          logCount: result.logs.length,
        }));
        setLastSavedCategory(finalInput.category);
        if (wasFoodTray) {
          setFoodTrayResetKey((k) => k + 1);
        }
        if (wasMedicine) {
          setMedicineResetKey((k) => k + 1);
        }
        setPendingConfirm(null);
      } catch (err) {
        console.error('Failed to add log:', err);
        setStatus((prev) => ({ ...prev, persistenceState: 'error' }));
      }
    },
    [pendingConfirm],
  );

  const handleSaveEdit = useCallback(async (id: string, patch: Partial<DogLog>) => {
    setStatus((prev) => ({ ...prev, persistenceState: 'saving' }));
    try {
      const result = await updateLogAndPersist(id, patch);
      setLogs(result.logs);
      setStatus((prev) => ({
        ...prev,
        persistenceState: 'saved',
        lastSavedAt: result.savedAt,
        snapshotBytes: result.snapshotBytes,
        logCount: result.logs.length,
      }));
    } catch (err) {
      console.error('Failed to update log:', err);
      setStatus((prev) => ({ ...prev, persistenceState: 'error' }));
    }
  }, []);

  const handleDeleteLog = useCallback(async (log: DogLog) => {
    setStatus((prev) => ({ ...prev, persistenceState: 'saving' }));
    try {
      const result = await deleteLogAndPersist(log.id);
      setLogs(result.logs);
      setDeletedUndoLog(log);
      setStatus((prev) => ({
        ...prev,
        persistenceState: 'saved',
        lastSavedAt: result.savedAt,
        snapshotBytes: result.snapshotBytes,
        logCount: result.logs.length,
      }));
    } catch (err) {
      console.error('Failed to delete log:', err);
      setStatus((prev) => ({ ...prev, persistenceState: 'error' }));
    }
  }, []);

  const handleUndoDelete = useCallback(async () => {
    if (!deletedUndoLog) return;
    const target = deletedUndoLog;
    setDeletedUndoLog(null);
    setStatus((prev) => ({ ...prev, persistenceState: 'saving' }));
    try {
      const result = await restoreLogAndPersist(target);
      setLogs(result.logs);
      setStatus((prev) => ({
        ...prev,
        persistenceState: 'saved',
        lastSavedAt: result.savedAt,
        snapshotBytes: result.snapshotBytes,
        logCount: result.logs.length,
      }));
    } catch (err) {
      console.error('Failed to restore log:', err);
      setStatus((prev) => ({ ...prev, persistenceState: 'error' }));
    }
  }, [deletedUndoLog]);

  const handleSaveProfile = useCallback(
    async (nextProfile: LocalProfile) => {
      setProfile(nextProfile);
      await saveLocalProfile(nextProfile);
      if (user && familyContext && nextProfile.authorName !== familyContext.membership.display_name) {
        try {
          await updateMyFamilyDisplayName(
            familyContext.family.id,
            user.id,
            nextProfile.authorName,
          );
          await refreshFamilyContext(user.id);
        } catch (err) {
          console.error('Failed to sync display name to family:', err);
        }
      }
    },
    [familyContext, refreshFamilyContext, user],
  );

  const handleResetAllLogs = useCallback(async () => {
    setStatus((prev) => ({ ...prev, persistenceState: 'saving' }));
    try {
      const result = await resetLocalLogsAndPersist();
      setLogs(result.logs);
      setDeletedUndoLog(null);
      setStatus((prev) => ({
        ...prev,
        persistenceState: 'saved',
        lastSavedAt: result.savedAt,
        snapshotBytes: result.snapshotBytes,
        logCount: 0,
      }));
    } catch (err) {
      console.error('Failed to reset logs:', err);
      setStatus((prev) => ({ ...prev, persistenceState: 'error' }));
    }
  }, []);

  const handleSeedSampleLogs = useCallback(async () => {
    const now = Date.now();
    const min = 60 * 1000;
    const samples: NewDogLogInput[] = [
      {
        category: 'toilet',
        timestamp: now - 20 * min,
        authorName: profile.authorName,
        toiletType: 'both',
      },
      {
        category: 'water',
        timestamp: now - 40 * min,
        authorName: profile.authorName,
        waterMl: 120,
      },
      {
        category: 'food',
        timestamp: now - 85 * min,
        authorName: profile.authorName,
        foodItems: [
          { foodType: 'dog_food', grams: 60 },
          { foodType: 'goat_milk', volumeMl: 30 },
          { foodType: 'snack', snackKind: 'ささみジャーキー', grams: 10 },
        ],
        note: '完食',
      },
      {
        category: 'weather',
        timestamp: now - 160 * min,
        authorName: profile.authorName,
        locationName: '東京都葛飾区',
        weatherCondition: 'sunny',
        weatherLabel: '晴れ',
        temperatureC: 17.5,
        humidityPct: 48,
      },
    ];

    setStatus((prev) => ({ ...prev, persistenceState: 'saving' }));
    try {
      let latestResult;
      for (const sample of samples) {
        latestResult = await addLogAndPersist(sample);
      }
      if (latestResult) {
        setLogs(latestResult.logs);
        setSelectedDateKey(getDateKey(now));
        setStatus((prev) => ({
          ...prev,
          persistenceState: 'saved',
          lastSavedAt: latestResult.savedAt,
          snapshotBytes: latestResult.snapshotBytes,
          logCount: latestResult.logs.length,
        }));
      }
    } catch (err) {
      console.error('Failed to seed sample logs:', err);
      setStatus((prev) => ({ ...prev, persistenceState: 'error' }));
    }
  }, [profile.authorName]);

  const handleFamilyReady = useCallback((context: FamilyContextData) => {
    setFamilyContext(context);
    setPendingInviteCode(null);
    setLocalModeOnly(false);
    setShowAuthGate(false);
    if (context.membership.display_name) {
      setProfile((prev) => {
        const updated = { ...prev, authorName: context.membership.display_name! };
        void saveLocalProfile(updated);
        return updated;
      });
    }
  }, []);

  const handleContinueLocal = useCallback(() => {
    setLocalModeOnly(true);
    setShowAuthGate(false);
  }, []);

  const handleSignOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setFamilyContext(null);
    setShowAuthGate(false);
  }, []);

  const handleLeaveFamily = useCallback(async () => {
    if (!user || !familyContext) return;
    await leaveFamilyGroup(familyContext.family.id, user.id);
    setFamilyContext(null);
    setSettingsOpen(false);
    setShowAuthGate(true);
  }, [familyContext, user]);

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 p-6 text-center space-y-3">
          <h1 className="text-lg font-bold text-slate-900">起動エラー</h1>
          <p className="text-sm text-slate-600">{initError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[44px] px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  if (!ready || !authChecked || (isSupabaseConfigured && user && familyLoading && !familyContext && !localModeOnly)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <Loader2 className="w-7 h-7 text-slate-700 animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-600">
          {ready ? '家族グループ情報を確認しています...' : 'ローカル記録データを読み込んでいます...'}
        </p>
      </div>
    );
  }

  const shouldShowAuthGate =
    showAuthGate || (isSupabaseConfigured && !localModeOnly && (!user || !familyContext));

  if (shouldShowAuthGate) {
    return (
      <AuthGate
        user={user}
        initialInviteCode={pendingInviteCode}
        defaultDisplayName={profile.authorName}
        onFamilyReady={handleFamilyReady}
        onContinueLocal={handleContinueLocal}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 h-14 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <a
            href={import.meta.env.BASE_URL}
            onClick={(e) => {
              e.preventDefault();
              setSelectedDateKey(getDateKey(Date.now()));
              setCategoryFilter('all');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            WanSync
          </a>

          <div className="flex items-center gap-1.5 shrink-0">
            <SyncStatusBadge status={status} onClick={() => setSettingsOpen(true)} />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="家族設定とプロフィール"
              title="家族設定・招待リンク・保存情報"
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {profile.dogName}のお世話記録
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {familyContext
                ? `家族: ${familyContext.family.name}（${familyContext.members.length}人） · `
                : ''}
              記録者: {profile.authorName} · 東京都葛飾区 · IndexedDB保存
            </p>
          </div>

          <button
            type="button"
            onClick={() => (familyContext ? setSettingsOpen(true) : setShowAuthGate(true))}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>
              {familyContext ? '家族招待・メンバー' : '家族共有・ログイン'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-20">
            <QuickActionPad
              authorName={profile.authorName}
              todayWaterTotalMl={todayWaterTotalMl}
              dailyWaterGoalMl={profile.dailyWaterGoalMl}
              isOnline={status.isOnline}
              foodTrayResetKey={foodTrayResetKey}
              medicineResetKey={medicineResetKey}
              lastSavedCategory={lastSavedCategory}
              onRequestConfirm={handleRequestConfirm}
            />
          </div>

          <div className="lg:col-span-7">
            <TimelineList
              logs={logs}
              selectedDateKey={selectedDateKey}
              onSelectDateKey={setSelectedDateKey}
              categoryFilter={categoryFilter}
              onChangeCategoryFilter={setCategoryFilter}
              dailyWaterGoalMl={profile.dailyWaterGoalMl}
              onEditLog={setEditingLog}
              onDeleteLog={handleDeleteLog}
              onSeedSampleLogs={handleSeedSampleLogs}
            />
          </div>
        </div>
      </main>

      {deletedUndoLog && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-lg flex items-center justify-between gap-3">
          <span className="text-xs sm:text-sm font-medium truncate">
            「{describeLogTitle(deletedUndoLog)}」を削除しました
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleUndoDelete}
              className="min-h-[38px] px-3 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>元に戻す</span>
            </button>
            <button
              type="button"
              onClick={() => setDeletedUndoLog(null)}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {pendingConfirm && (
        <ConfirmLogModal
          draft={pendingConfirm.draft}
          todayWaterTotalMl={todayWaterTotalMl}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={handleConfirmSaveLog}
        />
      )}

      {editingLog && (
        <EditLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSave={handleSaveEdit}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          profile={profile}
          status={status}
          familyContext={familyContext}
          userEmail={user?.email ?? null}
          onSaveProfile={handleSaveProfile}
          onResetAllLogs={handleResetAllLogs}
          onOpenAuthGate={() => setShowAuthGate(true)}
          onSignOut={handleSignOut}
          onLeaveFamily={handleLeaveFamily}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

