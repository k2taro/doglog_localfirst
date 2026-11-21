import { CheckCircle2, CloudOff, HardDrive, Loader2, AlertCircle } from 'lucide-react';
import { SyncStatusInfo } from '../types/dogLog';
import { formatTimeHHMM } from '../lib/formatters';

interface SyncStatusBadgeProps {
  status: SyncStatusInfo;
  onClick?: () => void;
}

export function SyncStatusBadge({ status, onClick }: SyncStatusBadgeProps) {
  const { isOnline, persistenceState, lastSavedAt } = status;

  let label = 'ローカル保存済み';
  let icon = <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />;

  if (persistenceState === 'loading') {
    label = '読み込み中...';
    icon = <Loader2 className="w-4 h-4 text-slate-500 animate-spin shrink-0" aria-hidden="true" />;
  } else if (persistenceState === 'saving') {
    label = '保存中...';
    icon = <Loader2 className="w-4 h-4 text-sky-600 animate-spin shrink-0" aria-hidden="true" />;
  } else if (persistenceState === 'error') {
    label = '保存エラー';
    icon = <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />;
  } else if (!isOnline) {
    label = 'オフライン · ローカル保存済み';
    icon = <CloudOff className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      title={lastSavedAt ? `最終ローカル保存: ${formatTimeHHMM(lastSavedAt)}` : 'IndexedDB 保存状態'}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{isOnline ? '保存済み' : 'オフライン'}</span>
      {lastSavedAt && (
        <span className="hidden md:inline text-slate-400 tabular-nums">
          · {formatTimeHHMM(lastSavedAt)}
        </span>
      )}
      <HardDrive className="w-3.5 h-3.5 text-slate-400 hidden md:inline shrink-0" aria-hidden="true" />
    </button>
  );
}
