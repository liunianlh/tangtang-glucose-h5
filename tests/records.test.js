import { describe, expect, it } from 'vitest';
import {
  PERIODS,
  applyBloodPressureRecordMutation,
  applyRecordMutation,
  applyWeightRecordMutation,
  createBloodPressureRecord,
  createRecord,
  createWeightRecord,
  deleteBloodPressureRecord,
  deleteRecord,
  deleteWeightRecord,
  formatGlucoseValue,
  formatWeightValue,
  getBloodPressureStats,
  getFoodImageCount,
  getFoodMealTypeStats,
  getLatestBloodPressureRecord,
  getLatestRecord,
  getLatestWeightRecord,
  getRecentFoodDailyCounts,
  getRecordStats,
  getTodayFoodRecordCount,
  getWeightStats,
  sortBloodPressureRecordsByTime,
  sortFoodRecordsByTime,
  sortWeightRecordsByTime,
  sortRecordsByTime
} from '../src/lib/records.js';

describe('blood glucose record utilities', () => {
  const records = [
    createRecord({ id: 'old', value: 5.8, period: '空腹', measuredAt: '2026-05-19T07:20', note: '早起' }),
    createRecord({ id: 'new', value: 7.2, period: '早餐后', measuredAt: '2026-05-25T09:30', note: '早餐后散步' }),
    createRecord({ id: 'mid', value: 6.4, period: '睡前', measuredAt: '2026-05-21T22:00', note: '' })
  ];

  it('offers the requested pre-meal measurement periods', () => {
    expect(PERIODS).toEqual([
      '空腹',
      '早餐后',
      '午饭前',
      '午餐后',
      '晚饭前',
      '晚餐后',
      '睡前',
      '其他'
    ]);
  });

  it('sorts records from newest to oldest and returns the latest entry', () => {
    const sorted = sortRecordsByTime(records);

    expect(sorted.map((record) => record.id)).toEqual(['new', 'mid', 'old']);
    expect(getLatestRecord(records).id).toBe('new');
  });

  it('computes summary stats for current records', () => {
    expect(getRecordStats(records)).toEqual({
      count: 3,
      average: 6.5,
      highest: 7.2,
      lowest: 5.8
    });
  });

  it('keeps glucose values to one decimal place', () => {
    expect(createRecord({ value: 6.26 }).value).toBe(6.3);
    expect(formatGlucoseValue(6)).toBe('6.0');
    expect(formatGlucoseValue(6.26)).toBe('6.3');
  });

  it('adds, edits, and deletes records without mutating the original array', () => {
    const added = applyRecordMutation(records, createRecord({
      id: 'added',
      value: 6.1,
      period: '午餐后',
      measuredAt: '2026-05-26T13:15',
      note: '午饭后'
    }));

    expect(records).toHaveLength(3);
    expect(getLatestRecord(added).id).toBe('added');

    const edited = applyRecordMutation(added, { ...added[0], value: 6.6, note: '已调整' });
    expect(edited.find((record) => record.id === 'added').value).toBe(6.6);
    expect(edited.find((record) => record.id === 'added').note).toBe('已调整');

    expect(deleteRecord(edited, 'added').map((record) => record.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('blood pressure record utilities', () => {
  const records = [
    createBloodPressureRecord({ id: 'old', systolic: 128, diastolic: 82, measuredAt: '2026-05-19T07:20', note: '早起' }),
    createBloodPressureRecord({ id: 'new', systolic: 118, diastolic: 76, pulse: 72, measuredAt: '2026-05-25T09:30', note: '早餐后' }),
    createBloodPressureRecord({ id: 'mid', systolic: 122, diastolic: 80, pulse: 75, measuredAt: '2026-05-21T22:00', note: '' })
  ];

  it('creates pressure records with optional pulse and sorts newest first', () => {
    expect(records[0].pulse).toBeNull();
    expect(sortBloodPressureRecordsByTime(records).map((record) => record.id)).toEqual(['new', 'mid', 'old']);
    expect(getLatestBloodPressureRecord(records).id).toBe('new');
  });

  it('computes blood pressure summary stats without requiring pulse on every record', () => {
    expect(getBloodPressureStats(records)).toEqual({
      count: 3,
      averageSystolic: 123,
      averageDiastolic: 79,
      highestSystolic: 128,
      lowestDiastolic: 76,
      averagePulse: 74
    });
  });

  it('adds, edits, and deletes pressure records without mutating the original array', () => {
    const added = applyBloodPressureRecordMutation(records, createBloodPressureRecord({
      id: 'added',
      systolic: 116,
      diastolic: 74,
      measuredAt: '2026-05-26T13:15',
      note: '午后'
    }));

    expect(records).toHaveLength(3);
    expect(getLatestBloodPressureRecord(added).id).toBe('added');

    const edited = applyBloodPressureRecordMutation(added, { ...added[0], systolic: 119, pulse: 70 });
    expect(edited.find((record) => record.id === 'added').systolic).toBe(119);
    expect(edited.find((record) => record.id === 'added').pulse).toBe(70);

    expect(deleteBloodPressureRecord(edited, 'added').map((record) => record.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('weight record utilities', () => {
  const records = [
    createWeightRecord({ id: 'old', weight: 63.2, measuredAt: '2026-05-19T07:20', note: '早起' }),
    createWeightRecord({ id: 'new', weight: 62.4, measuredAt: '2026-05-25T09:30', note: '早餐后' }),
    createWeightRecord({ id: 'mid', weight: 62.8, measuredAt: '2026-05-21T22:00', note: '' })
  ];

  it('keeps weight values to one decimal place and sorts newest first', () => {
    expect(createWeightRecord({ weight: 62.46 }).weight).toBe(62.5);
    expect(formatWeightValue(62)).toBe('62.0');
    expect(formatWeightValue(62.46)).toBe('62.5');
    expect(sortWeightRecordsByTime(records).map((record) => record.id)).toEqual(['new', 'mid', 'old']);
    expect(getLatestWeightRecord(records).id).toBe('new');
  });

  it('computes weight summary stats', () => {
    expect(getWeightStats(records)).toEqual({
      count: 3,
      average: 62.8,
      highest: 63.2,
      lowest: 62.4
    });
  });

  it('adds, edits, and deletes weight records without mutating the original array', () => {
    const added = applyWeightRecordMutation(records, createWeightRecord({
      id: 'added',
      weight: 62.1,
      measuredAt: '2026-05-26T13:15',
      note: '午后'
    }));

    expect(records).toHaveLength(3);
    expect(getLatestWeightRecord(added).id).toBe('added');

    const edited = applyWeightRecordMutation(added, { ...added[0], weight: 61.9, note: '已调整' });
    expect(edited.find((record) => record.id === 'added').weight).toBe(61.9);
    expect(edited.find((record) => record.id === 'added').note).toBe('已调整');

    expect(deleteWeightRecord(edited, 'added').map((record) => record.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('food record utilities', () => {
  const records = [
    { id: 'old', mealType: '早餐', eatenAt: '2026-05-20T08:10', content: '牛奶', note: '', imageKey: 'old-image' },
    { id: 'new', mealType: '午餐', eatenAt: '2026-05-26T12:20', content: '米饭半碗', note: '饭后散步', imageKey: null },
    { id: 'mid', mealType: '晚餐', eatenAt: '2026-05-25T18:30', content: '青菜和鱼', note: '', imageKey: 'mid-image' },
    { id: 'same-day', mealType: '加餐', eatenAt: '2026-05-26T16:00', content: '坚果', note: '', imageKey: null }
  ];

  it('sorts food records from newest to oldest', () => {
    expect(sortFoodRecordsByTime(records).map((record) => record.id)).toEqual(['same-day', 'new', 'mid', 'old']);
  });

  it('counts food records for today and recent days', () => {
    const now = new Date('2026-05-26T21:00');

    expect(getTodayFoodRecordCount(records, now)).toBe(2);
    expect(getRecentFoodDailyCounts(records, now).map((item) => item.count)).toEqual([1, 0, 0, 0, 0, 1, 2]);
  });

  it('summarizes meal types and image records', () => {
    expect(getFoodImageCount(records)).toBe(2);
    expect(getFoodMealTypeStats(records)).toEqual({
      早餐: 1,
      午餐: 1,
      晚餐: 1,
      加餐: 1
    });
  });
});
