import {
  createWeightRecord,
  deleteWeightRecord as deleteWeightRecordFromList,
  sortWeightRecordsByTime
} from '../../src/lib/records.js';

function cloneRecord(record) {
  return { ...record };
}

export function createMemoryWeightRecordRepository(seedRecords = []) {
  const recordsByUser = new Map();

  return {
    kind: 'memory',

    async listWeightRecords(userId) {
      return sortWeightRecordsByTime(recordsByUser.get(userId) || seedRecords).map(cloneRecord);
    },

    async createWeightRecord(userId, input) {
      const existing = recordsByUser.get(userId) || seedRecords.map(cloneRecord);
      const record = createWeightRecord(input);
      recordsByUser.set(userId, sortWeightRecordsByTime([record, ...existing]));
      return cloneRecord(record);
    },

    async updateWeightRecord(userId, id, input) {
      const existing = recordsByUser.get(userId) || seedRecords.map(cloneRecord);
      const recordIndex = existing.findIndex((record) => record.id === id);
      if (recordIndex === -1) return null;

      const updated = createWeightRecord({ id, ...input });
      recordsByUser.set(userId, sortWeightRecordsByTime(
        existing.map((record) => (record.id === id ? updated : record))
      ));
      return cloneRecord(updated);
    },

    async deleteWeightRecord(userId, id) {
      const existing = recordsByUser.get(userId) || seedRecords.map(cloneRecord);
      const nextRecords = deleteWeightRecordFromList(existing, id);
      if (nextRecords.length === existing.length) return false;

      recordsByUser.set(userId, nextRecords);
      return true;
    },

    async clearWeightRecords(userId) {
      recordsByUser.set(userId, []);
    }
  };
}
