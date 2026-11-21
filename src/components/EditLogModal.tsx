import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  DogLog,
  FoodEntryItem,
  FoodType,
  SpecialEventType,
  ToiletType,
  WeatherCondition,
} from '../types/dogLog';
import {
  getFoodItemsFromLog,
  toDatetimeLocalInput,
  weatherConditionLabel,
} from '../lib/formatters';

interface EditLogModalProps {
  log: DogLog;
  onClose: () => void;
  onSave: (id: string, patch: Partial<DogLog>) => Promise<void>;
}

export function EditLogModal({ log, onClose, onSave }: EditLogModalProps) {
  const [datetimeStr, setDatetimeStr] = useState(() => toDatetimeLocalInput(log.timestamp));
  const [authorName, setAuthorName] = useState(log.authorName || '飼い主');
  const [toiletType, setToiletType] = useState<ToiletType>(log.toiletType ?? 'pee');

  const [foodItems, setFoodItems] = useState<FoodEntryItem[]>(() => {
    const existing = getFoodItemsFromLog(log);
    return existing.length > 0 ? existing : [{ foodType: 'dog_food', grams: 50 }];
  });

  const [waterMl, setWaterMl] = useState<number>(log.waterMl ?? 100);

  const [weatherCondition, setWeatherCondition] = useState<WeatherCondition>(
    log.weatherCondition ?? 'sunny',
  );
  const [temperatureText, setTemperatureText] = useState<string>(
    log.temperatureC !== undefined ? String(log.temperatureC) : '18.0',
  );

  const [eventType, setEventType] = useState<SpecialEventType>(log.eventType ?? 'hospital');
  const [medicineText, setMedicineText] = useState<string>(log.medicineText ?? '');

  const [note, setNote] = useState(log.note ?? '');
  const [saving, setSaving] = useState(false);

  const updateFoodItem = (idx: number, patch: Partial<FoodEntryItem>) => {
    setFoodItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const nextType = patch.foodType ?? item.foodType;
        if (patch.foodType && patch.foodType !== item.foodType) {
          if (nextType === 'dog_food') return { foodType: 'dog_food', grams: 50 };
          if (nextType === 'snack') return { foodType: 'snack', snackKind: '' };
          return { foodType: nextType, volumeMl: 30 };
        }
        return { ...item, ...patch };
      }),
    );
  };

  const addFoodItemRow = () => {
    setFoodItems((prev) => [...prev, { foodType: 'snack', snackKind: '' }]);
  };

  const removeFoodItemRow = (idx: number) => {
    setFoodItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const parsedTimestamp = new Date(datetimeStr).getTime();
      const timestamp = Number.isNaN(parsedTimestamp) ? log.timestamp : parsedTimestamp;

      const patch: Partial<DogLog> = {
        timestamp,
        authorName: authorName.trim() || '飼い主',
        note: note.trim() || undefined,
      };

      if (log.category === 'toilet') {
        patch.toiletType = toiletType;
      } else if (log.category === 'food') {
        const cleanedItems: FoodEntryItem[] = foodItems.map((item) => {
          if (item.foodType === 'dog_food') {
            return { foodType: 'dog_food', grams: Math.max(0, item.grams ?? 0) };
          }
          if (item.foodType === 'snack') {
            return {
              foodType: 'snack',
              snackKind: item.snackKind?.trim() || 'おやつ',
              grams: item.grams && item.grams > 0 ? item.grams : undefined,
            };
          }
          return {
            foodType: item.foodType,
            volumeMl: Math.max(0, item.volumeMl ?? 0),
          };
        });
        patch.foodItems = cleanedItems;
        patch.foodType = undefined;
        patch.grams = undefined;
        patch.snackKind = undefined;
        patch.foodVolumeMl = undefined;
      } else if (log.category === 'water') {
        patch.waterMl = Math.max(0, waterMl);
      } else if (log.category === 'weather') {
        const parsedTemp = Number(temperatureText.trim());
        patch.weatherCondition = weatherCondition;
        patch.weatherLabel = weatherConditionLabel(weatherCondition);
        patch.temperatureC = !Number.isNaN(parsedTemp)
          ? Math.round(parsedTemp * 10) / 10
          : log.temperatureC;
      } else if (log.category === 'event') {
        patch.eventType = eventType;
      } else if (log.category === 'medicine') {
        patch.medicineText = medicineText.trim() || '薬';
      }

      await onSave(log.id, patch);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-log-title"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 id="edit-log-title" className="text-base font-bold text-slate-900">
            記録を編集
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                日時
              </label>
              <input
                type="datetime-local"
                value={datetimeStr}
                onChange={(e) => setDatetimeStr(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm font-mono-num text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                記録者
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {log.category === 'toilet' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                トイレの内容
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: 'pee', label: 'おしっこ' },
                    { key: 'poop', label: 'うんち' },
                    { key: 'both', label: '両方' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setToiletType(item.key)}
                    className={`min-h-[44px] rounded-xl text-xs font-semibold border ${
                      toiletType === item.key
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {log.category === 'food' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">
                  食べた内容（{foodItems.length}品）
                </label>
                <button
                  type="button"
                  onClick={addFoodItemRow}
                  className="min-h-[34px] px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>品目を追加</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {foodItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <select
                        value={item.foodType}
                        onChange={(e) =>
                          updateFoodItem(idx, { foodType: e.target.value as FoodType })
                        }
                        className="flex-1 min-h-[40px] px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-900"
                      >
                        <option value="dog_food">ドッグフード</option>
                        <option value="snack">おやつ</option>
                        <option value="goat_milk">ヤギミルク</option>
                        <option value="amazake">甘酒</option>
                      </select>

                      {foodItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFoodItemRow(idx)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          aria-label="品目を削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {item.foodType === 'dog_food' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={2000}
                          step={5}
                          value={item.grams ?? 0}
                          onChange={(e) =>
                            updateFoodItem(idx, { grams: Number(e.target.value) || 0 })
                          }
                          className="flex-1 min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-sm font-mono-num"
                        />
                        <span className="text-xs font-medium text-slate-600">g</span>
                      </div>
                    )}

                    {item.foodType === 'snack' && (
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={item.snackKind ?? ''}
                          onChange={(e) =>
                            updateFoodItem(idx, { snackKind: e.target.value })
                          }
                          placeholder="おやつの種類"
                          className="col-span-2 min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-xs"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={500}
                            value={item.grams ?? ''}
                            placeholder="g"
                            onChange={(e) =>
                              updateFoodItem(idx, {
                                grams: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            className="w-full min-h-[40px] px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono-num"
                          />
                          <span className="text-xs text-slate-500">g</span>
                        </div>
                      </div>
                    )}

                    {(item.foodType === 'goat_milk' || item.foodType === 'amazake') && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={1000}
                          step={5}
                          value={item.volumeMl ?? 0}
                          onChange={(e) =>
                            updateFoodItem(idx, { volumeMl: Number(e.target.value) || 0 })
                          }
                          className="flex-1 min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-sm font-mono-num"
                        />
                        <span className="text-xs font-medium text-slate-600">ml</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {log.category === 'water' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                飲水量（ml）
              </label>
              <input
                type="number"
                min={0}
                max={3000}
                step={10}
                value={waterMl}
                onChange={(e) => setWaterMl(Number(e.target.value) || 0)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm font-mono-num"
              />
            </div>
          )}

          {log.category === 'weather' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  葛飾区の天気
                </label>
                <select
                  value={weatherCondition}
                  onChange={(e) => setWeatherCondition(e.target.value as WeatherCondition)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="sunny">晴れ</option>
                  <option value="partly_cloudy">晴れ時々くもり</option>
                  <option value="cloudy">くもり</option>
                  <option value="rain">雨</option>
                  <option value="snow">雪</option>
                  <option value="storm">雷雨</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  気温（℃）
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="-20"
                  max="50"
                  value={temperatureText}
                  onChange={(e) => setTemperatureText(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm font-mono-num"
                />
              </div>
            </div>
          )}

          {log.category === 'event' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                特別なイベント
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: 'hospital', label: '病院' },
                    { key: 'acupuncture', label: 'はり灸' },
                    { key: 'trimming', label: 'トリミング' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setEventType(item.key)}
                    className={`min-h-[44px] rounded-xl text-xs font-semibold border ${
                      eventType === item.key
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {log.category === 'medicine' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                薬の内容（自由記述）
              </label>
              <input
                type="text"
                value={medicineText}
                onChange={(e) => setMedicineText(e.target.value)}
                placeholder="薬の名前・量など..."
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              メモ
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="補足メモ..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-[48px] rounded-xl bg-slate-900 hover:bg-slate-800 text-sm font-semibold text-white"
            >
              {saving ? '保存中...' : '変更を保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
