import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { createFoodImageStorage } from './lib/foodImageStorage.js';
import { createMemoryFoodRecordRepository } from './repositories/memoryFoodRecordRepository.js';
import { createMemoryRecordRepository } from './repositories/memoryRecordRepository.js';
import { createMemoryUserRepository } from './repositories/memoryUserRepository.js';
import { createPrismaFoodRecordRepository } from './repositories/prismaFoodRecordRepository.js';
import { createPrismaRecordRepository } from './repositories/prismaRecordRepository.js';
import { createPrismaUserRepository } from './repositories/prismaUserRepository.js';

const port = Number(process.env.PORT || 3001);
const useMemoryRepository = process.env.USE_MEMORY_DB === 'true' || !process.env.DATABASE_URL;
const prisma = useMemoryRepository ? null : new PrismaClient();

const recordRepository = useMemoryRepository
  ? createMemoryRecordRepository()
  : createPrismaRecordRepository(prisma);
const userRepository = useMemoryRepository
  ? createMemoryUserRepository()
  : createPrismaUserRepository(prisma);
const foodRecordRepository = useMemoryRepository
  ? createMemoryFoodRecordRepository()
  : createPrismaFoodRecordRepository(prisma);
const foodImageStorage = createFoodImageStorage(process.env.FOOD_UPLOAD_DIR);

const app = createApp({
  recordRepository,
  userRepository,
  foodRecordRepository,
  foodImageStorage,
  authSecret: process.env.AUTH_SECRET
});

app.listen(port, () => {
  console.log(`Glucose API listening on http://localhost:${port} (${recordRepository.kind})`);
});
