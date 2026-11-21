import { useState } from 'react';
import {
  Check,
  Clock,
  Cloud,
  Droplets,
  GlassWater,
  HeartPulse,
  Pill,
  RotateCcw,
  Scissors,
  Stethoscope,
  Utensils,
  X,
} from 'lucide-react';
import { NewDogLogInput } from '../types/dogLog';
import {
  describeLogTitle,
  formatDateTimeJP,
  formatFoodItemLabel,
  getFoodItemsFromLog,
  toDatetimeLocalInput,
} from '../lib/formatters';

interface ConfirmLogModalProps {
  draft: NewDogLogInput;
  todayWaterTotalMl: number;
  onCancel: () => void;
  onConfirm: (finalInput: NewDogLogInput) => Promise<void>;
}

const QUICK_MINUTE_OFFSETS = [
  { label: '-5分', deltaMin: -5 },
  { label: '-15分', deltaMin: -15 },
  { label: '-30分', deltaMin: -30 },
  { label: '-1時間', deltaMin: -60 },
];

export function ConfirmLogModal({
  draft,
  todayWaterTotalMl,
  onCancel,
  onConfirm,
}: ConfirmLogModalProps) {
  const [timestamp, setTimestamp] = useState<number>(() => draft.timestamp || Date.now());
  const [note, setNote] = useState<string>(draft.note ?? '');
  const [saving, setSaving] = useState(false);

  const foodItems = draft.category === 'food' ? getFoodItemsFromLog(draft) : [];
  const title = describeLogTitle(draft);

  const renderCategoryIcon = () => {
    switch (draft.category) {
      case 'toilet':
        return <Droplets className="w-5 h-5 text-sky-600" aria-hidden="true" />;
      case 'food':
        return <Utensils className="w-5 h-5 text-orange-600" aria-hidden="true" />;
      case 'water':
        return <GlassWater className="w-5 h-5 text-cyan-600" aria-hidden="true" />;
      case 'event':
        if (draft.eventType === 'trimming') {
          return <Scissors className="w-5 h-5 text-violet-600" aria-hidden="true" />;
        }
        if (draft.eventType === 'acupuncture') {
          return <HeartPulse className="w-5 h-5 text-violet-600" aria-hidden="true" />;
        }
        return <Stethoscope className="w-5 h-5 text-violet-600" aria-hidden="true" />;
      case 'medicine':
        return <Pill className="w-5 h-5 text-emerald-600" aria-hidden="true" />;
      case 'weather':
      default:
        return <Cloud className="w-5 h-5 text-indigo-600" aria-hidden="true" />;
    }
  };

  const shiftMinutes = (deltaMin: number) => {
    setTimestamp((prev) => prev + deltaMin * 60 * 1000);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onConfirm({
        ...draft,
        timestamp,
        note: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-log-title"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 id="confirm-log-title" className="text-base font-bold text-slate-900">
            記録内容と時刻の確認
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0">
                {renderCategoryIcon()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 break-words">{title}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  記録者: {draft.authorName}
                </div>
              </div>
            </div>

            {draft.category === 'food' && foodItems.length > 0 && (
              <ul className="pt-2 border-t border-slate-200/70 space-y-1">
                {foodItems.map((item, idx) => (
                  <li
                    key={`${item.foodType}-${idx}`}
                    className="text-xs font-medium text-slate-700 flex items-center justify-between"
                  >
                    <span>・{formatFoodItemLabel(item)}</span>
                  </li>
                ))}
              </ul>
            )}

            {draft.category === 'water' && (
              <div className="pt-2 border-t border-slate-200/70 text-xs text-slate-600 tabular-nums">
                保存後の今日の飲水合計:{' '}
                <strong className="font-bold text-cyan-700 font-mono-num">
                  {todayWaterTotalMl + (draft.waterMl ?? 0)} ml
                </strong>
              </div>
            )}

            {draft.category === 'weather' && draft.humidityPct !== undefined && (
              <div className="pt-2 border-t border-slate-200/70 text-xs text-slate-600 tabular-nums">
                湿度 {draft.humidityPct}%
              </div>
            )}
          </div>

          {/* Timestamp adjustment */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="confirm-datetime-input"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700"
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>記録する日時・時刻</span>
              </label>
              <span className="text-xs font-semibold text-sky-700 font-mono-num">
                {formatDateTimeJP(timestamp)}
              </span>
            </div>

            <input
              id="confirm-datetime-input"
              type="datetime-local"
              value={toDatetimeLocalInput(timestamp)}
              onChange={(e) => {
                const parsed = new Date(e.target.value).getTime();
                if (!Number.isNaN(parsed)) {
                  setTimestamp(parsed);
                }
              }}
              className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 bg-white text-sm font-mono-num font-semibold text-slate-900 focus:border-sky-500 focus:outline-none"
            />

            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_MINUTE_OFFSETS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => shiftMinutes(item.deltaMin)}
                  className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 tabular-nums transition-colors"
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTimestamp(Date.now())}
                className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 transition-colors ml-auto"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>現在時刻</span>
              </button>
            </div>
          </div>

          {/* Optional memo (skip extra memo label confusion for medicine free-text, or allow extra remark) */}
          <div>
            <label
              htmlFor="confirm-note-input"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              {draft.category === 'event'
                ? 'メモ（病院名・診察内容など・任意）'
                : 'メモ（任意）'}
            </label>
            <input
              id="confirm-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                draft.category === 'event'
                  ? '例：診察、爪切り、先生のコメントなど...'
                  : '気になったことや様子をメモ...'
              }
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 min-h-[48px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              戻る
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-2 min-h-[48px] px-5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>{saving ? '保存中...' : 'この時刻で保存する'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
