import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cookie,
  Droplet,
  Droplets,
  GlassWater,
  HeartPulse,
  PawPrint,
  Pencil,
  Pill,
  Scissors,
  Sparkles,
  Stethoscope,
  Sun,
  Trash2,
  Utensils,
} from 'lucide-react';
import { DogLog, LogCategory } from '../types/dogLog';
import {
  describeLogTitle,
  formatFoodItemLabel,
  formatRelativeElapsed,
  formatTimeHHMM,
  getDateKey,
  getDateLabel,
  getFoodItemsFromLog,
} from '../lib/formatters';

interface TimelineListProps {
  logs: DogLog[];
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
  categoryFilter: LogCategory | 'all';
  onChangeCategoryFilter: (category: LogCategory | 'all') => void;
  dailyWaterGoalMl: number;
  onEditLog: (log: DogLog) => void;
  onDeleteLog: (log: DogLog) => void;
  onSeedSampleLogs?: () => void;
}

const FILTER_OPTIONS: { key: LogCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'toilet', label: 'トイレ' },
  { key: 'food', label: 'ご飯' },
  { key: 'water', label: '水' },
  { key: 'weather', label: '天気' },
  { key: 'event', label: 'イベント' },
  { key: 'medicine', label: '薬' },
];

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  return getDateKey(date.getTime());
}

function getCategoryVisual(log: DogLog) {
  switch (log.category) {
    case 'toilet':
      if (log.toiletType === 'poop') {
        return {
          icon: <Cookie className="w-4 h-4 text-amber-700" aria-hidden="true" />,
          bg: 'bg-amber-50 border-amber-200/70',
        };
      }
      if (log.toiletType === 'both') {
        return {
          icon: <Droplets className="w-4 h-4 text-teal-700" aria-hidden="true" />,
          bg: 'bg-teal-50 border-teal-200/70',
        };
      }
      return {
        icon: <Droplet className="w-4 h-4 text-sky-600" aria-hidden="true" />,
        bg: 'bg-sky-50 border-sky-200/70',
      };
    case 'food':
      return {
        icon: <Utensils className="w-4 h-4 text-orange-600" aria-hidden="true" />,
        bg: 'bg-orange-50 border-orange-200/70',
      };
    case 'water':
      return {
        icon: <GlassWater className="w-4 h-4 text-cyan-600" aria-hidden="true" />,
        bg: 'bg-cyan-50 border-cyan-200/70',
      };
    case 'weather':
    default: {
      const cond = log.weatherCondition;
      const icon =
        cond === 'sunny' ? (
          <Sun className="w-4 h-4 text-indigo-600" aria-hidden="true" />
        ) : cond === 'partly_cloudy' ? (
          <CloudSun className="w-4 h-4 text-indigo-600" aria-hidden="true" />
        ) : cond === 'rain' ? (
          <CloudRain className="w-4 h-4 text-indigo-600" aria-hidden="true" />
        ) : cond === 'snow' ? (
          <CloudSnow className="w-4 h-4 text-indigo-600" aria-hidden="true" />
        ) : cond === 'storm' ? (
          <CloudLightning className="w-4 h-4 text-indigo-600" aria-hidden="true" />
        ) : (
          <Cloud className="w-4 h-4 text-indigo-600" aria-hidden="true" />
        );
      return {
        icon,
        bg: 'bg-indigo-50 border-indigo-200/70',
      };
    }
    case 'event': {
      const icon =
        log.eventType === 'trimming' ? (
          <Scissors className="w-4 h-4 text-violet-600" aria-hidden="true" />
        ) : log.eventType === 'acupuncture' ? (
          <HeartPulse className="w-4 h-4 text-violet-600" aria-hidden="true" />
        ) : (
          <Stethoscope className="w-4 h-4 text-violet-600" aria-hidden="true" />
        );
      return {
        icon,
        bg: 'bg-violet-50 border-violet-200/70',
      };
    }
    case 'medicine':
      return {
        icon: <Pill className="w-4 h-4 text-emerald-600" aria-hidden="true" />,
        bg: 'bg-emerald-50 border-emerald-200/70',
      };
  }
}

export function TimelineList({
  logs,
  selectedDateKey,
  onSelectDateKey,
  categoryFilter,
  onChangeCategoryFilter,
  dailyWaterGoalMl,
  onEditLog,
  onDeleteLog,
  onSeedSampleLogs,
}: TimelineListProps) {
  const todayKey = getDateKey(Date.now());
  const isToday = selectedDateKey === todayKey;

  const dayLogs = logs.filter((log) => getDateKey(log.timestamp) === selectedDateKey);
  const filteredLogs =
    categoryFilter === 'all'
      ? dayLogs
      : dayLogs.filter((log) => log.category === categoryFilter);

  // Daily summary metrics
  const waterLogs = dayLogs.filter((l) => l.category === 'water');
  const totalWaterMl = waterLogs.reduce((sum, l) => sum + (l.waterMl ?? 0), 0);

  const foodLogs = dayLogs.filter((l) => l.category === 'food');
  const totalDogFoodGrams = foodLogs.reduce((sum, log) => {
    const items = getFoodItemsFromLog(log);
    return (
      sum +
      items.reduce(
        (itemSum, item) =>
          item.foodType === 'dog_food' ? itemSum + (item.grams ?? 0) : itemSum,
        0,
      )
    );
  }, 0);

  const peeCount = dayLogs.filter(
    (l) => l.category === 'toilet' && (l.toiletType === 'pee' || l.toiletType === 'both'),
  ).length;
  const poopCount = dayLogs.filter(
    (l) => l.category === 'toilet' && (l.toiletType === 'poop' || l.toiletType === 'both'),
  ).length;

  const latestWeatherLog = dayLogs.find((l) => l.category === 'weather');

  return (
    <section aria-label="お世話タイムライン" className="space-y-4">
      {/* Daily Metrics Strip */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectDateKey(shiftDateKey(selectedDateKey, -1))}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="前の日"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900 px-1">
              {getDateLabel(selectedDateKey)}の集計・記録
            </h2>
            <button
              type="button"
              onClick={() => onSelectDateKey(shiftDateKey(selectedDateKey, 1))}
              disabled={isToday}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 disabled:opacity-30 text-slate-600 transition-colors"
              aria-label="次の日"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {!isToday && (
            <button
              type="button"
              onClick={() => onSelectDateKey(todayKey)}
              className="min-h-[36px] px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap"
            >
              今日に戻る
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
          <div className="pt-2">
            <div className="text-xs text-slate-500">1日の飲水量</div>
            <div className="text-lg font-bold text-cyan-700 tabular-nums mt-0.5">
              {totalWaterMl} ml
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              {waterLogs.length}回
              {dailyWaterGoalMl > 0
                ? ` · 目標 ${Math.round((totalWaterMl / dailyWaterGoalMl) * 100)}%`
                : ''}
            </div>
          </div>

          <div className="pt-2">
            <div className="text-xs text-slate-500">フード合計</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
              {totalDogFoodGrams} g
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              ご飯・おやつ計 {foodLogs.length}回
            </div>
          </div>

          <div className="pt-2">
            <div className="text-xs text-slate-500">トイレ</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
              {peeCount + poopCount}回
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              尿 {peeCount} · 便 {poopCount}
            </div>
          </div>

          <div className="pt-2">
            <div className="text-xs text-slate-500">葛飾区の天気</div>
            <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5 truncate">
              {latestWeatherLog && latestWeatherLog.temperatureC !== undefined
                ? `${latestWeatherLog.temperatureC.toFixed(1)}℃`
                : '—'}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {latestWeatherLog ? latestWeatherLog.weatherLabel : '未記録'}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto max-w-full">
            {FILTER_OPTIONS.map((opt) => {
              const active = categoryFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onChangeCategoryFilter(opt.key)}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
            {filteredLogs.length}件
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <PawPrint className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-900">
              {dayLogs.length === 0
                ? `${getDateLabel(selectedDateKey)}の記録はまだありません`
                : 'このカテゴリの記録はありません'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              トイレ・ご飯（複数まとめ可）・お水・葛飾区の天気を記録できます。保存前に時刻の調整もできます。
            </p>
            {logs.length === 0 && onSeedSampleLogs && (
              <button
                type="button"
                onClick={onSeedSampleLogs}
                className="mt-4 inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                <span>サンプル記録を追加して試す</span>
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const visual = getCategoryVisual(log);
              const title = describeLogTitle(log);
              const foodItems = log.category === 'food' ? getFoodItemsFromLog(log) : [];

              const detailParts: string[] = [];
              if (log.category === 'food' && foodItems.length > 1) {
                detailParts.push(foodItems.map((item) => formatFoodItemLabel(item)).join(' · '));
              }
              if (log.category === 'weather' && log.humidityPct !== undefined) {
                detailParts.push(`湿度 ${log.humidityPct}%`);
              }
              if (log.note) {
                detailParts.push(log.note);
              }

              return (
                <li
                  key={log.id}
                  className="px-4 py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${visual.bg}`}
                    >
                      {visual.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 leading-snug">
                        {title}
                      </div>

                      {detailParts.length > 0 && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed break-words">
                          {detailParts.join(' · ')}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 tabular-nums">
                        <span className="font-medium text-slate-700">
                          {formatTimeHHMM(log.timestamp)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{log.authorName || '飼い主'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeElapsed(log.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditLog(log)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                      aria-label={`${title} を編集`}
                      title="編集"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteLog(log)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      aria-label={`${title} を削除`}
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
