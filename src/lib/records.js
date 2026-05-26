export const STORAGE_KEY = 'glucose-h5-records';
export const UNIT = 'mmol/L';

export const PERIODS = ['空腹', '早餐后', '午餐后', '晚餐后', '睡前', '其他'];

const pad = (value) => String(value).padStart(2, '0');

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
    value: Number(value),
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

export function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
