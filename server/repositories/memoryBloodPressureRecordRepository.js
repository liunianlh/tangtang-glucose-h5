import {
  createBloodPressureRecord,
  deleteBloodPressureRecord as deleteBloodPressureRecordFromList,
  sortBloodPressureRecordsByTime
} from '../../src/lib/records.js';

function cloneRecord(record) {
  return { ...record };
}

export function createMemoryBloodPressureRecordRepository(seedRecords = []) {
  const recordsByUser = new Map();

  return {
    kind: 'memory',

    async listBloodPressureRecords(userId) {
      return sortBloodPressureRecordsByTime(recordsByUser.get(userId) || seedRecords).map(cloneRecord);
    },

    async createBloodPressureRecord(userId, input) {
      const existing = recordsByUser.get(userId) || seedRecords.map(cloneRecord);
      const record = createBloodPressureRecord(input);
      recordsByUser.set(userId, sortBloodPressureRecordsByTime([record, ...existing]));
      return cloneRecord(record);
    },

    async updateBloodPressureRecord(userId, id, input) {
      const existing = recordsByUser.get(userId) || seedRecords.map(cloneRecord);
      const recordIndex = existing.findIndex((record) => record.id === id);
      if (recordIndex === -1) return null;

      const updated = createBloodPressureRecord({ id, ...input });
      recordsByUser.set(userId, sortBloodPressureRecordsByTime(
        existing.map((record) => (record.id === id ? updated : record))
      ));
      return cloneRecord(updated);
    },

    async deleteBloodPressureRecord(userId, id) {
      const existing = recordsByUser.get(userId) || seedRecords.map(cloneRecord);
      const nextRecords = deleteBloodPressureRecordFromList(existing, id);
      if (nextRecords.length === existing.length) return false;

      recordsByUser.set(userId, nextRecords);
      return true;
    },

    async clearBloodPressureRecords(userId) {
      recordsByUser.set(userId, []);
    }
  };
}
