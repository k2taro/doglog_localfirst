import { KatsushikaWeatherSnapshot, WeatherCondition } from '../types/dogLog';

// 東京都葛飾区（立石周辺）の座標
const KATSUSHIKA_LAT = 35.7435;
const KATSUSHIKA_LON = 139.8472;
export const KATSUSHIKA_LABEL = '東京都葛飾区';

export function mapWmoCodeToWeather(code: number): {
  condition: WeatherCondition;
  label: string;
} {
  if (code === 0) return { condition: 'sunny', label: '快晴' };
  if (code === 1) return { condition: 'sunny', label: '晴れ' };
  if (code === 2) return { condition: 'partly_cloudy', label: '晴れ時々くもり' };
  if (code === 3) return { condition: 'cloudy', label: 'くもり' };
  if (code === 45 || code === 48) return { condition: 'cloudy', label: '霧' };
  if (code >= 51 && code <= 57) return { condition: 'rain', label: '霧雨' };
  if (code >= 61 && code <= 67) return { condition: 'rain', label: '雨' };
  if (code >= 71 && code <= 77) return { condition: 'snow', label: '雪' };
  if (code >= 80 && code <= 82) return { condition: 'rain', label: 'にわか雨' };
  if (code >= 85 && code <= 86) return { condition: 'snow', label: 'にわか雪' };
  if (code >= 95) return { condition: 'storm', label: '雷雨' };
  return { condition: 'cloudy', label: 'くもり' };
}

export async function fetchKatsushikaWeather(): Promise<KatsushikaWeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${KATSUSHIKA_LAT}&longitude=${KATSUSHIKA_LON}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code` +
    `&timezone=Asia%2FTokyo`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`天気情報の取得に失敗しました (HTTP ${response.status})`);
  }

  const data = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      weather_code?: number;
    };
  };

  const current = data.current;
  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('天気データの形式が不正です');
  }

  const weatherCode = typeof current.weather_code === 'number' ? current.weather_code : 3;
  const mapped = mapWmoCodeToWeather(weatherCode);

  return {
    locationName: KATSUSHIKA_LABEL,
    condition: mapped.condition,
    label: mapped.label,
    weatherCode,
    temperatureC: Math.round(current.temperature_2m * 10) / 10,
    humidityPct:
      typeof current.relative_humidity_2m === 'number'
        ? Math.round(current.relative_humidity_2m)
        : undefined,
    fetchedAt: Date.now(),
  };
}
