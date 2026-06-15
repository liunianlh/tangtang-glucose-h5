export const STORAGE_KEY = 'glucose-h5-records';
export const UNIT = 'mmol/L';
export const CHART_REFERENCE_LIMIT_STORAGE_KEY = 'glucose-h5-chart-reference-limit';
export const DEFAULT_CHART_REFERENCE_LIMIT = 7.8;

export const PERIODS = ['空腹', '早餐后', '午饭前', '午餐后', '晚饭前', '晚餐后', '睡前', '其他'];

const pad = (value) => String(value).padStart(2, '0');

export function normalizeGlucoseValue(value) {
  const numericValue = Number(value);
  return Number((Math.round((numericValue + Number.EPSILON) * 10) / 10).toFixed(1));
}

export function formatGlucoseValue(value) {
  return normalizeGlucoseValue(value).toFixed(1);
}

export function toLocalInputValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createRecord({
  id,
  value,
  period = '空腹',
  measuredAt = toLocalInputValue(),
  note = '',
  unit = UNIT
}) {
  return {
    id: id || `record-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    value: normalizeGlucoseValue(value),
    unit,
    period,
    measuredAt,
    note: note.trim()
  };
}

export function sortRecordsByTime(records) {
  return [...records].sort((left, right) => new Date(right.measuredAt) - new Date(left.measuredAt));
}

export function getLatestRecord(records) {
  return sortRecordsByTime(records)[0] || null;
}

export function getRecordStats(records) {
  if (!records.length) {
    return {
      count: 0,
      average: 0,
      highest: 0,
      lowest: 0
    };
  }

  const values = records.map((record) => Number(record.value));
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    count: records.length,
    average: Number((total / records.length).toFixed(1)),
    highest: Number(Math.max(...values).toFixed(1)),
    lowest: Number(Math.min(...values).toFixed(1))
  };
}

export function applyRecordMutation(records, nextRecord) {
  const exists = records.some((record) => record.id === nextRecord.id);
  const nextRecords = exists
    ? records.map((record) => (record.id === nextRecord.id ? nextRecord : record))
    : [nextRecord, ...records];

  return sortRecordsByTime(nextRecords);
}

export function deleteRecord(records, id) {
  return sortRecordsByTime(records.filter((record) => record.id !== id));
}

export function createBloodPressureRecord({
  id,
  systolic,
  diastolic,
  pulse = null,
  measuredAt = toLocalInputValue(),
  note = ''
}) {
  const numericPulse = pulse === null || pulse === undefined || pulse === '' ? null : Number(pulse);

  return {
    id: id || `pressure-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    systolic: Number(systolic),
    diastolic: Number(diastolic),
    pulse: numericPulse,
    measuredAt,
    note: note.trim()
  };
}

export function sortBloodPressureRecordsByTime(records) {
  return [...records].sort((left, right) => new Date(right.measuredAt) - new Date(left.measuredAt));
}

export function getLatestBloodPressureRecord(records) {
  return sortBloodPressureRecordsByTime(records)[0] || null;
}

export function getBloodPressureStats(records) {
  if (!records.length) {
    return {
      count: 0,
      averageSystolic: 0,
      averageDiastolic: 0,
      highestSystolic: 0,
      lowestDiastolic: 0,
      averagePulse: 0
    };
  }

  const systolicValues = records.map((record) => Number(record.systolic));
  const diastolicValues = records.map((record) => Number(record.diastolic));
  const pulseValues = records
    .map((record) => record.pulse)
    .filter((pulse) => pulse !== null && pulse !== undefined && pulse !== '')
    .map(Number);

  const average = (values) => Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(0));

  return {
    count: records.length,
    averageSystolic: average(systolicValues),
    averageDiastolic: average(diastolicValues),
    highestSystolic: Math.max(...systolicValues),
    lowestDiastolic: Math.min(...diastolicValues),
    averagePulse: pulseValues.length ? average(pulseValues) : 0
  };
}

export function applyBloodPressureRecordMutation(records, nextRecord) {
  const exists = records.some((record) => record.id === nextRecord.id);
  const nextRecords = exists
    ? records.map((record) => (record.id === nextRecord.id ? nextRecord : record))
    : [nextRecord, ...records];

  return sortBloodPressureRecordsByTime(nextRecords);
}

export function deleteBloodPressureRecord(records, id) {
  return sortBloodPressureRecordsByTime(records.filter((record) => record.id !== id));
}

export function normalizeWeightValue(value) {
  const numericValue = Number(value);
  return Number((Math.round((numericValue + Number.EPSILON) * 10) / 10).toFixed(1));
}

export function formatWeightValue(value) {
  return normalizeWeightValue(value).toFixed(1);
}

export function createWeightRecord({
  id,
  weight,
  measuredAt = toLocalInputValue(),
  note = ''
}) {
  return {
    id: id || `weight-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    weight: normalizeWeightValue(weight),
    measuredAt,
    note: note.trim()
  };
}

export function sortWeightRecordsByTime(records) {
  return [...records].sort((left, right) => new Date(right.measuredAt) - new Date(left.measuredAt));
}

export function getLatestWeightRecord(records) {
  return sortWeightRecordsByTime(records)[0] || null;
}

export function getWeightStats(records) {
  if (!records.length) {
    return {
      count: 0,
      average: 0,
      highest: 0,
      lowest: 0
    };
  }

  const values = records.map((record) => Number(record.weight));
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    count: records.length,
    average: Number((total / records.length).toFixed(1)),
    highest: Number(Math.max(...values).toFixed(1)),
    lowest: Number(Math.min(...values).toFixed(1))
  };
}

export function applyWeightRecordMutation(records, nextRecord) {
  const exists = records.some((record) => record.id === nextRecord.id);
  const nextRecords = exists
    ? records.map((record) => (record.id === nextRecord.id ? nextRecord : record))
    : [nextRecord, ...records];

  return sortWeightRecordsByTime(nextRecords);
}

export function deleteWeightRecord(records, id) {
  return sortWeightRecordsByTime(records.filter((record) => record.id !== id));
}

export function sortFoodRecordsByTime(records) {
  return [...records].sort((left, right) => new Date(right.eatenAt) - new Date(left.eatenAt));
}

export function getFoodImageCount(records) {
  return records.filter((record) => record.imageKey).length;
}

export function getTodayFoodRecordCount(records, now = new Date()) {
  const todayKey = dateKey(now);
  return records.filter((record) => dateKey(record.eatenAt) === todayKey).length;
}

export function getFoodMealTypeStats(records) {
  return records.reduce((stats, record) => ({
    ...stats,
    [record.mealType]: (stats[record.mealType] || 0) + 1
  }), {});
}

export function getRecentFoodDailyCounts(records, now = new Date(), days = 7) {
  const endDate = new Date(now);
  endDate.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_item, index) => {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - (days - index - 1));
    const key = dateKey(date);

    return {
      key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      count: records.filter((record) => dateKey(record.eatenAt) === key).length
    };
  });
}

export function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function normalizeChartReferenceLimit(value, fallback = DEFAULT_CHART_REFERENCE_LIMIT) {
  const numericValue = Number(value);
  const fallbackValue = Number(fallback);
  const safeFallback = Number.isFinite(fallbackValue) && fallbackValue > 0 && fallbackValue <= 40
    ? fallbackValue
    : DEFAULT_CHART_REFERENCE_LIMIT;

  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 40) {
    return Number(safeFallback.toFixed(1));
  }

  return Number(numericValue.toFixed(1));
}

export function formatGlucoseLimit(value) {
  return String(normalizeChartReferenceLimit(value));
}

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function makeSeedRecords(now = new Date()) {
  const daysAgo = (days, hour, minute) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    date.setHours(hour, minute, 0, 0);
    return toLocalInputValue(date);
  };

  return sortRecordsByTime([
    createRecord({ id: 'seed-1', value: 6.2, period: '早餐后', measuredAt: daysAgo(0, 9, 35), note: '早餐后散步 15 分钟' }),
    createRecord({ id: 'seed-2', value: 5.4, period: '空腹', measuredAt: daysAgo(2, 7, 20), note: '早起测量' }),
    createRecord({ id: 'seed-3', value: 7.8, period: '午餐后', measuredAt: daysAgo(5, 13, 18), note: '午餐米饭偏多' }),
    createRecord({ id: 'seed-4', value: 6.8, period: '睡前', measuredAt: daysAgo(7, 22, 4), note: '晚饭后散步' }),
    createRecord({ id: 'seed-5', value: 5.9, period: '空腹', measuredAt: daysAgo(11, 7, 12), note: '' }),
    createRecord({ id: 'seed-6', value: 8.1, period: '晚餐后', measuredAt: daysAgo(14, 20, 36), note: '饭后甜点' })
  ]);
}
