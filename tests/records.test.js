import { describe, expect, it } from 'vitest';
import {
  PERIODS,
  applyBloodPressureRecordMutation,
  applyRecordMutation,
  createBloodPressureRecord,
  createRecord,
  deleteBloodPressureRecord,
  deleteRecord,
  formatGlucoseValue,
  getBloodPressureStats,
  getLatestBloodPressureRecord,
  getLatestRecord,
  getRecordStats,
  sortBloodPressureRecordsByTime,
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
