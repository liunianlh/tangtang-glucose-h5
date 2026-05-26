import 'dotenv/config';
import { createApp } from './app.js';
import { createMemoryRecordRepository } from './repositories/memoryRecordRepository.js';
import { createPrismaRecordRepository } from './repositories/prismaRecordRepository.js';
import { makeSeedRecords } from '../src/lib/records.js';

const port = Number(process.env.PORT || 3001);
const useMemoryRepository = process.env.USE_MEMORY_DB === 'true' || !process.env.DATABASE_URL;

const recordRepository = useMemoryRepository
  ? createMemoryRecordRepository(makeSeedRecords())
  : createPrismaRecordRepository();

const app = createApp({
  recordRepository,
  defaultUserId: process.env.DEFAULT_USER_ID || 'wife-user'
});

app.listen(port, () => {
  console.log(`Glucose API listening on http://localhost:${port} (${recordRepository.kind})`);
});
