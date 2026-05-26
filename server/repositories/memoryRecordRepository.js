import {
  createRecord,
  deleteRecord as deleteRecordFromList,
  sortRecordsByTime
} from '../../src/lib/records.js';

function cloneRecord(record) {
  return { ...record };
}

export function createMemoryRecordRepository(seedRecords = []) {
  const recordsByUser = new Map();

  return {
    kind: 'memory',

    async listRecords(userId) {
      return sortRecordsByTime(recordsByUser.get(userId) || seedRecords).map(cloneRecord);
    },

    async createRecord(userId, input) {
      const existing = recordsByUser.get(userId) || seedRecords.map(cloneRecord);
      const record = createRecord(input);
      const nextRecords = sortRecordsByTime([record, ...existing]);
      recordsByUser.set(userId, nextRecords);
      return cloneRecord(record);
    },

    async updateRecord(userId, id, input) {
      const existing = recordsByUser.get(userId) || seedRecords.map(cloneRecord);
      const recordIndex = existing.findIndex((record) => record.id === id);
      if (recordIndex === -1) return null;

      const updated = createRecord({ id, ...input });
      const nextRecords = existing.map((record) => (record.id === id ? updated : record));
      recordsByUser.set(userId, sortRecordsByTime(nextRecords));
      return cloneRecord(updated);
    },

    async deleteRecord(userId, id) {
      const existing = recordsByUser.get(userId) || seedRecords.map(cloneRecord);
      const nextRecords = deleteRecordFromList(existing, id);
      if (nextRecords.length === existing.length) return false;

      recordsByUser.set(userId, nextRecords);
      return true;
    },

    async clearRecords(userId) {
      recordsByUser.set(userId, []);
    }
  };
}
