import {
  DogLog,
  FoodEntryItem,
  FoodType,
  SpecialEventType,
  ToiletType,
  WeatherCondition,
} from '../types/dogLog';

export function formatTimeHHMM(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDateTimeJP(timestamp: number): string {
  const d = new Date(timestamp);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}月${day}日（${weekdays[d.getDay()]}） ${hh}:${mm}`;
}

export function formatRelativeElapsed(fromTimestamp: number, now = Date.now()): string {
  const diffMs = now - fromTimestamp;
  if (diffMs < 0) return '予定';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const hours = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (hours < 24) {
    return remMin > 0 ? `${hours}時間${remMin}分前` : `${hours}時間前`;
  }
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

export function getDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDateLabel(dateKey: string): string {
  const todayKey = getDateKey(Date.now());
  const yesterdayKey = getDateKey(Date.now() - 86400000);
  if (dateKey === todayKey) return '今日';
  if (dateKey === yesterdayKey) return '昨日';

  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return `${m}月${d}日（${weekdays[date.getDay()]}）`;
}

export function toDatetimeLocalInput(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function toiletLabel(type?: ToiletType): string {
  switch (type) {
    case 'pee':
      return 'おしっこ';
    case 'poop':
      return 'うんち';
    case 'both':
      return '両方（おしっこ＋うんち）';
    default:
      return 'トイレ';
  }
}

export function foodTypeLabel(type?: FoodType): string {
  switch (type) {
    case 'dog_food':
      return 'ドッグフード';
    case 'snack':
      return 'おやつ';
    case 'goat_milk':
      return 'ヤギミルク';
    case 'amazake':
      return '甘酒';
    default:
      return 'ご飯';
  }
}

export function specialEventLabel(type?: SpecialEventType): string {
  switch (type) {
    case 'hospital':
      return '病院';
    case 'acupuncture':
      return 'はり灸';
    case 'trimming':
      return 'トリミング';
    default:
      return '特別なイベント';
  }
}

export function formatFoodItemLabel(item: FoodEntryItem): string {
  if (item.foodType === 'dog_food') {
    return item.grams !== undefined && item.grams > 0
      ? `ドッグフード ${item.grams} g`
      : 'ドッグフード';
  }
  if (item.foodType === 'snack') {
    const kind = item.snackKind?.trim();
    const gramsText =
      item.grams !== undefined && item.grams > 0 ? `（${item.grams} g）` : '';
    return kind ? `おやつ（${kind}）${gramsText}` : `おやつ${gramsText}`;
  }
  if (item.foodType === 'goat_milk') {
    return item.volumeMl !== undefined && item.volumeMl > 0
      ? `ヤギミルク ${item.volumeMl} ml`
      : 'ヤギミルク';
  }
  if (item.foodType === 'amazake') {
    return item.volumeMl !== undefined && item.volumeMl > 0
      ? `甘酒 ${item.volumeMl} ml`
      : '甘酒';
  }
  return foodTypeLabel(item.foodType);
}

export function getFoodItemsFromLog(
  log: Pick<DogLog, 'foodItems' | 'foodType' | 'grams' | 'snackKind' | 'foodVolumeMl'>,
): FoodEntryItem[] {
  if (Array.isArray(log.foodItems) && log.foodItems.length > 0) {
    return log.foodItems;
  }
  if (log.foodType) {
    return [
      {
        foodType: log.foodType,
        grams: log.grams,
        snackKind: log.snackKind,
        volumeMl: log.foodVolumeMl,
      },
    ];
  }
  return [];
}

export function weatherConditionLabel(condition?: WeatherCondition): string {
  switch (condition) {
    case 'sunny':
      return '晴れ';
    case 'partly_cloudy':
      return '晴れ時々くもり';
    case 'cloudy':
      return 'くもり';
    case 'rain':
      return '雨';
    case 'snow':
      return '雪';
    case 'storm':
      return '雷雨';
    default:
      return 'くもり';
  }
}

export function describeLogTitle(
  log: Pick<
    DogLog,
    | 'category'
    | 'toiletType'
    | 'foodItems'
    | 'foodType'
    | 'grams'
    | 'snackKind'
    | 'foodVolumeMl'
    | 'waterMl'
    | 'locationName'
    | 'weatherLabel'
    | 'weatherCondition'
    | 'temperatureC'
    | 'eventType'
    | 'medicineText'
  >,
): string {
  if (log.category === 'toilet') {
    return `トイレ · ${toiletLabel(log.toiletType)}`;
  }

  if (log.category === 'food') {
    const items = getFoodItemsFromLog(log);
    if (items.length === 0) return 'ご飯・おやつ';
    if (items.length === 1) {
      return formatFoodItemLabel(items[0]);
    }
    return `ご飯・おやつ（${items.length}品）`;
  }

  if (log.category === 'water') {
    return `お水 ${log.waterMl ?? 0} ml`;
  }

  if (log.category === 'weather') {
    const loc = log.locationName || '葛飾区';
    const label = log.weatherLabel || weatherConditionLabel(log.weatherCondition);
    const temp =
      log.temperatureC !== undefined ? ` ${log.temperatureC.toFixed(1)}℃` : '';
    return `${loc} · ${label}${temp}`;
  }

  if (log.category === 'event') {
    return `特別なイベント · ${specialEventLabel(log.eventType)}`;
  }

  if (log.category === 'medicine') {
    const med = log.medicineText?.trim();
    return med ? `薬 · ${med}` : '薬';
  }

  return '記録';
}
