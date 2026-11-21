import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cookie,
  CupSoda,
  Droplet,
  Droplets,
  GlassWater,
  HeartPulse,
  Loader2,
  MapPin,
  Minus,
  Pill,
  Plus,
  RefreshCw,
  Scissors,
  Stethoscope,
  Sun,
  Utensils,
  X,
} from 'lucide-react';
import {
  FoodEntryItem,
  FoodType,
  KatsushikaWeatherSnapshot,
  NewDogLogInput,
  SpecialEventType,
  ToiletType,
  WeatherCondition,
} from '../types/dogLog';
import { fetchKatsushikaWeather, KATSUSHIKA_LABEL } from '../lib/weatherService';
import { formatFoodItemLabel, formatTimeHHMM } from '../lib/formatters';

interface QuickActionPadProps {
  authorName: string;
  todayWaterTotalMl: number;
  dailyWaterGoalMl: number;
  isOnline: boolean;
  foodTrayResetKey: number;
  medicineResetKey: number;
  lastSavedCategory: string | null;
  onRequestConfirm: (draft: NewDogLogInput, meta?: { fromFoodTray?: boolean; fromMedicine?: boolean }) => void;
}

const DOG_FOOD_PRESETS = [30, 40, 50, 60, 80, 100];
const WATER_PRESETS = [50, 100, 150, 200, 300];
const LIQUID_FOOD_PRESETS = [20, 30, 50, 80, 100];
const SNACK_QUICK_KINDS = ['ささみジャーキー', 'ボーロ', 'チーズ', '歯みがきガム', 'りんご'];

function WeatherIcon({ condition, className }: { condition: WeatherCondition; className?: string }) {
  switch (condition) {
    case 'sunny':
      return <Sun className={className} aria-hidden="true" />;
    case 'partly_cloudy':
      return <CloudSun className={className} aria-hidden="true" />;
    case 'rain':
      return <CloudRain className={className} aria-hidden="true" />;
    case 'snow':
      return <CloudSnow className={className} aria-hidden="true" />;
    case 'storm':
      return <CloudLightning className={className} aria-hidden="true" />;
    case 'cloudy':
    default:
      return <Cloud className={className} aria-hidden="true" />;
  }
}

export function QuickActionPad({
  authorName,
  todayWaterTotalMl,
  dailyWaterGoalMl,
  isOnline,
  foodTrayResetKey,
  medicineResetKey,
  lastSavedCategory,
  onRequestConfirm,
}: QuickActionPadProps) {
  // ご飯（複数品目まとめ用トレイ）
  const [foodTab, setFoodTab] = useState<FoodType>('dog_food');
  const [dogFoodGrams, setDogFoodGrams] = useState<number>(50);
  const [snackKind, setSnackKind] = useState<string>('');
  const [snackGramsText, setSnackGramsText] = useState<string>('');
  const [liquidFoodMl, setLiquidFoodMl] = useState<number>(30);
  const [foodNote, setFoodNote] = useState<string>('');
  const [foodTray, setFoodTray] = useState<FoodEntryItem[]>([]);

  // 水 state
  const [waterMl, setWaterMl] = useState<number>(100);

  // 天気（葛飾区）state
  const [weather, setWeather] = useState<KatsushikaWeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [manualWeatherMode, setManualWeatherMode] = useState<boolean>(false);
  const [manualCondition, setManualCondition] = useState<WeatherCondition>('sunny');
  const [manualTempText, setManualTempText] = useState<string>('18.0');

  // 薬（自由記述のみ）
  const [medicineText, setMedicineText] = useState<string>('');

  useEffect(() => {
    if (foodTrayResetKey > 0) {
      setFoodTray([]);
      setFoodNote('');
    }
  }, [foodTrayResetKey]);

  useEffect(() => {
    if (medicineResetKey > 0) {
      setMedicineText('');
    }
  }, [medicineResetKey]);

  const loadWeather = useCallback(async () => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const snapshot = await fetchKatsushikaWeather();
      setWeather(snapshot);
      setManualWeatherMode(false);
    } catch (err) {
      setWeatherError(
        err instanceof Error ? err.message : '葛飾区の天気情報を取得できませんでした',
      );
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOnline) {
      void loadWeather();
    }
  }, [isOnline, loadWeather]);

  // 現在のタブから1品目を作成
  const buildCurrentFoodItem = (): FoodEntryItem | null => {
    if (foodTab === 'dog_food') {
      if (dogFoodGrams <= 0) return null;
      return {
        foodType: 'dog_food',
        grams: dogFoodGrams,
      };
    }
    if (foodTab === 'snack') {
      const trimmed = snackKind.trim();
      if (!trimmed) return null;
      const parsedGrams = snackGramsText.trim() ? Number(snackGramsText.trim()) : undefined;
      return {
        foodType: 'snack',
        snackKind: trimmed,
        grams:
          parsedGrams !== undefined && !Number.isNaN(parsedGrams) && parsedGrams > 0
            ? parsedGrams
            : undefined,
      };
    }
    if (liquidFoodMl <= 0) return null;
    return {
      foodType: foodTab,
      volumeMl: liquidFoodMl,
    };
  };

  const currentFoodItemValid = buildCurrentFoodItem() !== null;

  const handleAddToFoodTray = () => {
    const item = buildCurrentFoodItem();
    if (!item) return;
    setFoodTray((prev) => [...prev, item]);
    if (foodTab === 'snack') {
      setSnackKind('');
      setSnackGramsText('');
    }
  };

  const handleRemoveFromFoodTray = (index: number) => {
    setFoodTray((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmFoodMeal = () => {
    const itemsToSave =
      foodTray.length > 0
        ? foodTray
        : (() => {
            const single = buildCurrentFoodItem();
            return single ? [single] : [];
          })();

    if (itemsToSave.length === 0) return;

    onRequestConfirm(
      {
        category: 'food',
        timestamp: Date.now(),
        authorName,
        foodItems: itemsToSave,
        note: foodNote.trim() || undefined,
      },
      { fromFoodTray: true },
    );
  };

  // 1. トイレ（確認画面へ）
  const handleRequestToilet = (toiletType: ToiletType) => {
    onRequestConfirm({
      category: 'toilet',
      timestamp: Date.now(),
      authorName,
      toiletType,
    });
  };

  // 3. 水（確認画面へ）
  const handleRequestWater = () => {
    if (waterMl <= 0) return;
    onRequestConfirm({
      category: 'water',
      timestamp: Date.now(),
      authorName,
      waterMl,
    });
  };

  // 4. 天気（葛飾区ワンクリック -> 確認画面へ）
  const handleRequestWeather = () => {
    if (!weather) return;
    onRequestConfirm({
      category: 'weather',
      timestamp: Date.now(),
      authorName,
      locationName: weather.locationName,
      weatherCondition: weather.condition,
      weatherLabel: weather.label,
      weatherCode: weather.weatherCode,
      temperatureC: weather.temperatureC,
      humidityPct: weather.humidityPct,
    });
  };

  const handleRequestManualWeather = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTemp = Number(manualTempText.trim());
    if (Number.isNaN(parsedTemp)) return;

    const labelMap: Record<WeatherCondition, string> = {
      sunny: '晴れ',
      partly_cloudy: '晴れ時々くもり',
      cloudy: 'くもり',
      rain: '雨',
      snow: '雪',
      storm: '雷雨',
    };

    onRequestConfirm({
      category: 'weather',
      timestamp: Date.now(),
      authorName,
      locationName: KATSUSHIKA_LABEL,
      weatherCondition: manualCondition,
      weatherLabel: labelMap[manualCondition],
      temperatureC: Math.round(parsedTemp * 10) / 10,
    });
    setManualWeatherMode(false);
  };

  // 5. 特別なイベント（病院 / はり灸 / トリミング）
  const handleRequestEvent = (eventType: SpecialEventType) => {
    onRequestConfirm({
      category: 'event',
      timestamp: Date.now(),
      authorName,
      eventType,
    });
  };

  // 6. 薬（自由記述のみ）
  const handleRequestMedicine = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = medicineText.trim();
    if (!trimmed) return;
    onRequestConfirm(
      {
        category: 'medicine',
        timestamp: Date.now(),
        authorName,
        medicineText: trimmed,
      },
      { fromMedicine: true },
    );
  };

  const waterProgressPct =
    dailyWaterGoalMl > 0
      ? Math.min(100, Math.round((todayWaterTotalMl / dailyWaterGoalMl) * 100))
      : 0;

  return (
    <section aria-label="クイック記録パッド" className="space-y-4">
      {/* 1. トイレ（おしっこ / うんち / 両方） */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-sky-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">トイレ</h2>
          </div>
          {lastSavedCategory === 'toilet' && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              保存しました
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleRequestToilet('pee')}
            className="min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl bg-sky-50 hover:bg-sky-100/80 active:scale-[0.97] text-sky-900 border border-sky-200/80 transition-all px-2 py-2.5"
          >
            <Droplet className="w-5 h-5 text-sky-600" aria-hidden="true" />
            <span className="text-sm font-semibold whitespace-nowrap">おしっこ</span>
          </button>

          <button
            type="button"
            onClick={() => handleRequestToilet('poop')}
            className="min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl bg-amber-50 hover:bg-amber-100/80 active:scale-[0.97] text-amber-950 border border-amber-200/80 transition-all px-2 py-2.5"
          >
            <Cookie className="w-5 h-5 text-amber-700" aria-hidden="true" />
            <span className="text-sm font-semibold whitespace-nowrap">うんち</span>
          </button>

          <button
            type="button"
            onClick={() => handleRequestToilet('both')}
            className="min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl bg-teal-50 hover:bg-teal-100/80 active:scale-[0.97] text-teal-950 border border-teal-200/80 transition-all px-2 py-2.5"
          >
            <Plus className="w-5 h-5 text-teal-700" aria-hidden="true" />
            <span className="text-sm font-semibold whitespace-nowrap">両方</span>
          </button>
        </div>
      </div>

      {/* 2. ご飯・おやつ（複数品目を1回としてまとめて保存） */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-orange-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">ご飯・おやつ（複数まとめ可）</h2>
          </div>
          {lastSavedCategory === 'food' && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              保存しました
            </span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
          {(
            [
              { key: 'dog_food', label: 'フード' },
              { key: 'snack', label: 'おやつ' },
              { key: 'goat_milk', label: 'ヤギミルク' },
              { key: 'amazake', label: '甘酒' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFoodTab(tab.key)}
              className={`min-h-[38px] px-1.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate ${
                foodTab === tab.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {foodTab === 'dog_food' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              {DOG_FOOD_PRESETS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setDogFoodGrams(g)}
                  className={`min-h-[42px] rounded-xl text-sm font-semibold font-mono-num border transition-all ${
                    dogFoodGrams === g
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  {g} g
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setDogFoodGrams((v) => Math.max(5, v - 5))}
                  className="min-h-[46px] min-w-[42px] flex items-center justify-center hover:bg-slate-100 text-slate-700"
                  aria-label="5g減らす"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex items-baseline px-2">
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    step={5}
                    value={dogFoodGrams}
                    onChange={(e) => setDogFoodGrams(Math.max(0, Number(e.target.value) || 0))}
                    className="w-14 text-center font-mono-num text-base font-bold focus:outline-none"
                    aria-label="ドッグフード量（g）"
                  />
                  <span className="text-xs text-slate-500 font-medium">g</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDogFoodGrams((v) => Math.min(2000, v + 5))}
                  className="min-h-[46px] min-w-[42px] flex items-center justify-center hover:bg-slate-100 text-slate-700"
                  aria-label="5g増やす"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToFoodTray}
                disabled={!currentFoodItemValid}
                className="flex-1 min-h-[46px] px-3 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100/80 disabled:opacity-40 text-orange-900 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>今回のリストに追加</span>
              </button>
            </div>
          </div>
        )}

        {foodTab === 'snack' && (
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                おやつの種類を入力
              </label>
              <input
                type="text"
                value={snackKind}
                onChange={(e) => setSnackKind(e.target.value)}
                placeholder="例：ささみジャーキー、ボーロ、チーズ..."
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-orange-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SNACK_QUICK_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setSnackKind(kind)}
                    className={`min-h-[34px] px-2.5 rounded-lg text-xs font-medium border transition-colors ${
                      snackKind === kind
                        ? 'bg-orange-50 border-orange-300 text-orange-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center border border-slate-200 rounded-xl px-3 min-h-[46px] bg-slate-50/50 w-28">
                <input
                  type="number"
                  min={0}
                  max={500}
                  placeholder="任意"
                  value={snackGramsText}
                  onChange={(e) => setSnackGramsText(e.target.value)}
                  className="w-full bg-transparent font-mono-num text-sm font-semibold text-slate-900 focus:outline-none"
                  aria-label="おやつ量（g・任意）"
                />
                <span className="text-xs text-slate-500">g</span>
              </div>
              <button
                type="button"
                onClick={handleAddToFoodTray}
                disabled={!currentFoodItemValid}
                className="flex-1 min-h-[46px] px-3 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100/80 disabled:opacity-40 text-orange-900 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>今回のリストに追加</span>
              </button>
            </div>
          </div>
        )}

        {(foodTab === 'goat_milk' || foodTab === 'amazake') && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CupSoda className="w-3.5 h-3.5 text-orange-600 shrink-0" aria-hidden="true" />
              <span>
                {foodTab === 'goat_milk' ? 'ヤギミルク' : '甘酒'}の量（ml）を選んで追加できます
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {LIQUID_FOOD_PRESETS.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  onClick={() => setLiquidFoodMl(ml)}
                  className={`min-h-[40px] rounded-xl text-xs font-semibold font-mono-num border transition-all ${
                    liquidFoodMl === ml
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  {ml}ml
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setLiquidFoodMl((v) => Math.max(5, v - 10))}
                  className="min-h-[46px] min-w-[40px] flex items-center justify-center hover:bg-slate-100 text-slate-700"
                  aria-label="10ml減らす"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex items-baseline px-1.5">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step={5}
                    value={liquidFoodMl}
                    onChange={(e) => setLiquidFoodMl(Math.max(0, Number(e.target.value) || 0))}
                    className="w-12 text-center font-mono-num text-base font-bold focus:outline-none"
                    aria-label="量（ml）"
                  />
                  <span className="text-xs text-slate-500">ml</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLiquidFoodMl((v) => Math.min(1000, v + 10))}
                  className="min-h-[46px] min-w-[40px] flex items-center justify-center hover:bg-slate-100 text-slate-700"
                  aria-label="10ml増やす"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToFoodTray}
                disabled={!currentFoodItemValid}
                className="flex-1 min-h-[46px] px-3 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100/80 disabled:opacity-40 text-orange-900 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>今回のリストに追加</span>
              </button>
            </div>
          </div>
        )}

        {/* 追加済みの今回のご飯リスト（複数品目を1回として保存） */}
        {foodTray.length > 0 && (
          <div className="rounded-xl bg-orange-50/60 border border-orange-200/80 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-orange-950">
              <span>今回の記録リスト（{foodTray.length}品）</span>
              <button
                type="button"
                onClick={() => setFoodTray([])}
                className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
              >
                すべてクリア
              </button>
            </div>
            <ul className="space-y-1.5">
              {foodTray.map((item, idx) => (
                <li
                  key={`${item.foodType}-${idx}`}
                  className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-1.5 border border-orange-200/60 text-xs font-medium text-slate-800"
                >
                  <span className="truncate">{formatFoodItemLabel(item)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFromFoodTray(idx)}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    aria-label={`${formatFoodItemLabel(item)} を削除`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <input
          type="text"
          value={foodNote}
          onChange={(e) => setFoodNote(e.target.value)}
          placeholder="食いつきや完食状況のメモ（任意）"
          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200/80 bg-slate-50/50 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none"
        />

        <button
          type="button"
          onClick={handleConfirmFoodMeal}
          disabled={foodTray.length === 0 && !currentFoodItemValid}
          className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] disabled:opacity-40 text-white text-sm font-semibold transition-all"
        >
          {foodTray.length > 0
            ? `${foodTray.length}品を1回のご飯・おやつとして記録`
            : 'この内容で記録を確認する'}
        </button>
      </div>

      {/* 3. 水（飲食量をml単位で入力・1日合計を表示） */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GlassWater className="w-4 h-4 text-cyan-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">お水（飲水量）</h2>
          </div>
          {lastSavedCategory === 'water' ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              保存しました
            </span>
          ) : (
            <span className="text-xs text-slate-500 tabular-nums">
              今日合計{' '}
              <strong className="text-sm font-bold text-cyan-700 font-mono-num">
                {todayWaterTotalMl} ml
              </strong>
              {dailyWaterGoalMl > 0 && ` / ${dailyWaterGoalMl} ml`}
            </span>
          )}
        </div>

        {dailyWaterGoalMl > 0 && (
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-600 transition-all duration-300"
              style={{ width: `${waterProgressPct}%` }}
            />
          </div>
        )}

        <div className="grid grid-cols-5 gap-1.5">
          {WATER_PRESETS.map((ml) => (
            <button
              key={ml}
              type="button"
              onClick={() => setWaterMl(ml)}
              className={`min-h-[42px] rounded-xl text-xs font-semibold font-mono-num border transition-all ${
                waterMl === ml
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              {ml}ml
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setWaterMl((v) => Math.max(10, v - 10))}
              className="min-h-[48px] min-w-[44px] flex items-center justify-center hover:bg-slate-100 text-slate-700"
              aria-label="10ml減らす"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex items-baseline px-2">
              <input
                type="number"
                min={1}
                max={3000}
                step={10}
                value={waterMl}
                onChange={(e) => setWaterMl(Math.max(0, Number(e.target.value) || 0))}
                className="w-14 text-center font-mono-num text-base font-bold focus:outline-none"
                aria-label="飲水量（ml）"
              />
              <span className="text-xs text-slate-500 font-medium">ml</span>
            </div>
            <button
              type="button"
              onClick={() => setWaterMl((v) => Math.min(3000, v + 10))}
              className="min-h-[48px] min-w-[44px] flex items-center justify-center hover:bg-slate-100 text-slate-700"
              aria-label="10ml増やす"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleRequestWater}
            disabled={waterMl <= 0}
            className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-[0.98] disabled:opacity-40 text-white text-sm font-semibold transition-all whitespace-nowrap"
          >
            お水 {waterMl} ml を記録
          </button>
        </div>
      </div>

      {/* 4. 天気（東京都葛飾区の天気・気温をネット取得してワンクリック記録） */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">葛飾区の天気・気温</h2>
          </div>

          <div className="flex items-center gap-1">
            {lastSavedCategory === 'weather' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 mr-1">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                保存しました
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadWeather()}
              disabled={weatherLoading || !isOnline}
              className="min-h-[38px] min-w-[38px] px-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 transition-colors"
              title="葛飾区の最新天気を取得"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${weatherLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>更新</span>
            </button>
          </div>
        </div>

        {weatherLoading && !weather ? (
          <div className="min-h-[56px] rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>葛飾区の天気・気温を取得中...</span>
          </div>
        ) : weather && !manualWeatherMode ? (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleRequestWeather}
              className="w-full min-h-[60px] px-4 py-3 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/80 active:scale-[0.98] border border-indigo-200/80 flex items-center justify-between gap-3 transition-all text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200/70 flex items-center justify-center shrink-0">
                  <WeatherIcon condition={weather.condition} className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>{weather.label}</span>
                    <span className="font-mono-num text-indigo-700">
                      {weather.temperatureC.toFixed(1)}℃
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 tabular-nums">
                    {weather.locationName}
                    {weather.humidityPct !== undefined ? ` · 湿度 ${weather.humidityPct}%` : ''}
                    {` · ${formatTimeHHMM(weather.fetchedAt)} 取得`}
                  </div>
                </div>
              </div>

              <span className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold whitespace-nowrap shrink-0">
                ワンクリック記録
              </span>
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Open-Meteo（東京都葛飾区）より自動取得</span>
              <button
                type="button"
                onClick={() => setManualWeatherMode(true)}
                className="min-h-[32px] px-1.5 text-slate-600 hover:text-slate-900 underline underline-offset-2"
              >
                手動で修正して記録
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRequestManualWeather} className="space-y-2.5">
            {weatherError && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2">
                {!isOnline
                  ? 'オフラインのためネット取得できません。手動で天気・気温を記録できます。'
                  : weatherError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={manualCondition}
                onChange={(e) => setManualCondition(e.target.value as WeatherCondition)}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900"
                aria-label="天気を選択"
              >
                <option value="sunny">晴れ</option>
                <option value="partly_cloudy">晴れ時々くもり</option>
                <option value="cloudy">くもり</option>
                <option value="rain">雨</option>
                <option value="snow">雪</option>
                <option value="storm">雷雨</option>
              </select>

              <div className="flex items-center border border-slate-200 rounded-xl px-3 min-h-[44px] bg-white">
                <input
                  type="number"
                  step="0.1"
                  min="-20"
                  max="50"
                  value={manualTempText}
                  onChange={(e) => setManualTempText(e.target.value)}
                  className="w-full font-mono-num text-sm font-semibold text-slate-900 focus:outline-none"
                  aria-label="気温（℃）"
                />
                <span className="text-xs text-slate-500">℃</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
              >
                葛飾区の天気を確認して記録
              </button>
              {weather && (
                <button
                  type="button"
                  onClick={() => setManualWeatherMode(false)}
                  className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600"
                >
                  自動取得に戻す
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* 5. 特別なイベント（病院 / はり灸 / トリミング） */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-violet-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">特別なイベント</h2>
          </div>
          {lastSavedCategory === 'event' && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              保存しました
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleRequestEvent('hospital')}
            className="min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl bg-violet-50 hover:bg-violet-100/80 active:scale-[0.97] text-violet-950 border border-violet-200/80 transition-all px-2 py-2.5"
          >
            <Stethoscope className="w-5 h-5 text-violet-600" aria-hidden="true" />
            <span className="text-sm font-semibold whitespace-nowrap">病院</span>
          </button>

          <button
            type="button"
            onClick={() => handleRequestEvent('acupuncture')}
            className="min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl bg-violet-50 hover:bg-violet-100/80 active:scale-[0.97] text-violet-950 border border-violet-200/80 transition-all px-2 py-2.5"
          >
            <HeartPulse className="w-5 h-5 text-violet-600" aria-hidden="true" />
            <span className="text-sm font-semibold whitespace-nowrap">はり灸</span>
          </button>

          <button
            type="button"
            onClick={() => handleRequestEvent('trimming')}
            className="min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl bg-violet-50 hover:bg-violet-100/80 active:scale-[0.97] text-violet-950 border border-violet-200/80 transition-all px-2 py-2.5"
          >
            <Scissors className="w-5 h-5 text-violet-600" aria-hidden="true" />
            <span className="text-sm font-semibold whitespace-nowrap">トリミング</span>
          </button>
        </div>
      </div>

      {/* 6. 薬（自由記述のみ） */}
      <form
        onSubmit={handleRequestMedicine}
        className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">薬（自由記述）</h2>
          </div>
          {lastSavedCategory === 'medicine' && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              保存しました
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={medicineText}
            onChange={(e) => setMedicineText(e.target.value)}
            placeholder="薬の名前・量などを入力（例：整腸剤 1錠、目薬）..."
            className="flex-1 min-h-[46px] px-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!medicineText.trim()}
            className="min-h-[46px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-40 text-white text-sm font-semibold transition-all whitespace-nowrap shrink-0"
          >
            確認して記録
          </button>
        </div>
      </form>
    </section>
  );
}
