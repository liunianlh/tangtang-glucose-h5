import { toLocalInputValue } from '../../src/lib/records.js';

function cloneRecord(record) {
  return { ...record };
}

function createFoodRecord(input) {
  return {
    id: input.id || `food-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mealType: input.mealType,
    eatenAt: toLocalInputValue(new Date(input.eatenAt)),
    content: input.content.trim(),
    note: input.note?.trim() || '',
    imageKey: input.imageKey || null,
    imageMime: input.imageMime || null,
    imageSize: input.imageSize || null
  };
}

function sortFoodRecords(records) {
  return [...records].sort((left, right) => new Date(right.eatenAt) - new Date(left.eatenAt));
}

export function createMemoryFoodRecordRepository() {
  const recordsByUser = new Map();

  return {
    kind: 'memory',

    async listFoodRecords(userId) {
      return sortFoodRecords(recordsByUser.get(userId) || []).map(cloneRecord);
    },

    async findFoodRecord(userId, id) {
      const record = (recordsByUser.get(userId) || []).find((item) => item.id === id);
      return record ? cloneRecord(record) : null;
    },

    async findFoodRecordByImageKey(userId, imageKey) {
      const record = (recordsByUser.get(userId) || []).find((item) => item.imageKey === imageKey);
      return record ? cloneRecord(record) : null;
    },

    async createFoodRecord(userId, input) {
      const existing = recordsByUser.get(userId) || [];
      const record = createFoodRecord(input);
      recordsByUser.set(userId, sortFoodRecords([record, ...existing]));
      return cloneRecord(record);
    },

    async updateFoodRecord(userId, id, input) {
      const existing = recordsByUser.get(userId) || [];
      const current = existing.find((record) => record.id === id);
      if (!current) return null;

      const updated = createFoodRecord({
        ...current,
        ...input,
        id,
        imageKey: input.imageKey === undefined ? current.imageKey : input.imageKey,
        imageMime: input.imageMime === undefined ? current.imageMime : input.imageMime,
        imageSize: input.imageSize === undefined ? current.imageSize : input.imageSize
      });
      recordsByUser.set(userId, sortFoodRecords(existing.map((record) => (record.id === id ? updated : record))));
      return cloneRecord(updated);
    },

    async deleteFoodRecord(userId, id) {
      const existing = recordsByUser.get(userId) || [];
      const record = existing.find((item) => item.id === id);
      if (!record) return null;

      recordsByUser.set(userId, existing.filter((item) => item.id !== id));
      return cloneRecord(record);
    },

    async clearFoodRecords(userId) {
      const existing = recordsByUser.get(userId) || [];
      recordsByUser.set(userId, []);
      return existing.map(cloneRecord);
    }
  };
}
