export type LogCategory = 'toilet' | 'food' | 'water' | 'weather' | 'event' | 'medicine';

export type ToiletType = 'pee' | 'poop' | 'both';

export type FoodType = 'dog_food' | 'snack' | 'goat_milk' | 'amazake';

export interface FoodEntryItem {
  foodType: FoodType;
  grams?: number;      // ドッグフードのg数（おやつにも任意で可）
  snackKind?: string;  // おやつの種類
  volumeMl?: number;   // ヤギミルク・甘酒のml
}

export type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'storm';

export type SpecialEventType = 'hospital' | 'acupuncture' | 'trimming';

export interface DogLog {
  id: string;
  category: LogCategory;
  timestamp: number;
  createdAt: number;
  updatedAt: number;
  authorName: string;
  note?: string;

  // トイレ
  toiletType?: ToiletType;

  // ご飯（複数品目を1回として保存）
  foodItems?: FoodEntryItem[];
  // 単一品目互換フィールド
  foodType?: FoodType;
  grams?: number;
  snackKind?: string;
  foodVolumeMl?: number;

  // 水
  waterMl?: number;    // 飲水量（ml）

  // 天気（葛飾区）
  locationName?: string;
  weatherCondition?: WeatherCondition;
  weatherLabel?: string;
  weatherCode?: number;
  temperatureC?: number;
  humidityPct?: number;

  // 特別なイベント（病院・はり灸・トリミング）
  eventType?: SpecialEventType;

  // 薬（自由記述のみ）
  medicineText?: string;
}

export type NewDogLogInput = Omit<DogLog, 'id' | 'createdAt' | 'updatedAt'>;

export interface KatsushikaWeatherSnapshot {
  locationName: string;
  condition: WeatherCondition;
  label: string;
  weatherCode: number;
  temperatureC: number;
  humidityPct?: number;
  fetchedAt: number;
}

export interface LocalProfile {
  dogName: string;
  authorName: string;
  dailyWaterGoalMl: number;
}

export type LocalPersistenceState = 'loading' | 'saved' | 'saving' | 'error';

export interface SyncStatusInfo {
  isOnline: boolean;
  persistenceState: LocalPersistenceState;
  lastSavedAt: number | null;
  snapshotBytes: number;
  logCount: number;
}
