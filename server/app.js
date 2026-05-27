import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  createAuthToken,
  createCaptchaChallenge,
  hashPassword,
  normalizeUsername,
  publicUser,
  tokenFromAuthorizationHeader,
  verifyAuthToken,
  verifyCaptchaAnswer,
  verifyPassword
} from './lib/auth.js';
import { ALLOWED_FOOD_IMAGE_TYPES, MAX_FOOD_IMAGE_SIZE } from './lib/foodImageStorage.js';

const recordSchema = z.object({
  value: z.coerce.number().gt(0).lte(40),
  period: z.string().trim().min(1).max(20),
  measuredAt: z.string().trim().refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid datetime'),
  note: z.string().trim().max(500).optional().default('')
});
const foodRecordSchema = z.object({
  mealType: z.string().trim().min(1).max(20),
  eatenAt: z.string().trim().refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid datetime'),
  content: z.string().trim().min(1).max(500),
  note: z.string().trim().max(500).optional().default('')
});

const usernameSchema = z.string().trim().min(2).max(24).regex(/^[\p{L}\p{N}_-]+$/u);
const passwordSchema = z.string().min(6).max(72);
const captchaSchema = {
  captchaToken: z.string().trim().min(20).max(1000),
  captchaAnswer: z.string().trim().min(1).max(10)
};
const registerSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(30).optional(),
  password: passwordSchema,
  ...captchaSchema
});
const loginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  ...captchaSchema
});
const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(30)
});

function sendInvalidRecord(response, details) {
  response.status(400).json({
    error: 'INVALID_RECORD',
    details
  });
}

function sendInvalidFoodRecord(response, details) {
  response.status(400).json({
    error: 'INVALID_FOOD_RECORD',
    details
  });
}

function sendInvalidFoodImage(response, message = '图片仅支持 jpg、png、webp，且不能超过 5MB') {
  response.status(400).json({
    error: 'INVALID_FOOD_IMAGE',
    message
  });
}

function sendInvalidAuth(response, details) {
  response.status(400).json({
    error: 'INVALID_AUTH_PAYLOAD',
    details
  });
}

function verifyCaptchaOrSend(response, body, authSecret) {
  const valid = verifyCaptchaAnswer(body.captchaToken, body.captchaAnswer, authSecret);
  if (valid) return true;

  response.status(400).json({ error: 'INVALID_CAPTCHA' });
  return false;
}

async function authenticatedUser(request, response, userRepository, authSecret) {
  const token = tokenFromAuthorizationHeader(request.get('authorization'));
  const payload = verifyAuthToken(token, authSecret);

  if (!payload) {
    response.status(401).json({ error: 'UNAUTHORIZED' });
    return null;
  }

  const user = await userRepository.findById(payload.sub);
  if (!user) {
    response.status(401).json({ error: 'UNAUTHORIZED' });
    return null;
  }

  return user;
}

export function createApp({
  recordRepository,
  userRepository,
  foodRecordRepository,
  foodImageStorage,
  authSecret = process.env.AUTH_SECRET || 'glucose-dev-auth-secret'
}) {
  const app = express();
  const uploadFoodImage = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FOOD_IMAGE_SIZE,
      files: 1
    }
  }).single('image');

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      storage: recordRepository.kind
    });
  });

  function parseFoodMultipart(request, response, next) {
    uploadFoodImage(request, response, (error) => {
      if (error) {
        sendInvalidFoodImage(response);
        return;
      }
      if (request.file && !ALLOWED_FOOD_IMAGE_TYPES.includes(request.file.mimetype)) {
        sendInvalidFoodImage(response);
        return;
      }
      next();
    });
  }

  app.get('/api/auth/captcha', (_request, response) => {
    response.json(createCaptchaChallenge(authSecret));
  });

  app.post('/api/auth/register', async (request, response, next) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidAuth(response, parsed.error.flatten());
      return;
    }
    if (!verifyCaptchaOrSend(response, parsed.data, authSecret)) return;

    try {
      const username = normalizeUsername(parsed.data.username);
      const user = await userRepository.createUser({
        username,
        displayName: parsed.data.displayName?.trim() || username,
        passwordHash: hashPassword(parsed.data.password)
      });
      response.status(201).json({
        user: publicUser(user),
        token: createAuthToken(user, authSecret)
      });
    } catch (error) {
      if (error.code === 'DUPLICATE_USERNAME') {
        response.status(409).json({ error: 'USERNAME_TAKEN' });
        return;
      }
      next(error);
    }
  });

  app.post('/api/auth/login', async (request, response, next) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidAuth(response, parsed.error.flatten());
      return;
    }
    if (!verifyCaptchaOrSend(response, parsed.data, authSecret)) return;

    try {
      const user = await userRepository.findByUsername(parsed.data.username);
      if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
        response.status(401).json({ error: 'INVALID_CREDENTIALS' });
        return;
      }

      response.json({
        user: publicUser(user),
        token: createAuthToken(user, authSecret)
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/me', async (request, response, next) => {
    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      response.json({ user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/auth/me', async (request, response, next) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'INVALID_PROFILE',
        details: parsed.error.flatten()
      });
      return;
    }

    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      const updatedUser = await userRepository.updateUserProfile(user.id, {
        displayName: parsed.data.displayName.trim()
      });
      if (!updatedUser) {
        response.status(401).json({ error: 'UNAUTHORIZED' });
        return;
      }

      response.json({
        user: publicUser(updatedUser),
        token: createAuthToken(updatedUser, authSecret)
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/records', async (request, response, next) => {
    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      const records = await recordRepository.listRecords(user.id);
      response.json({ records });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/records', async (request, response, next) => {
    const parsed = recordSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRecord(response, parsed.error.flatten());
      return;
    }

    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      const record = await recordRepository.createRecord(user.id, parsed.data);
      response.status(201).json(record);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/records/:id', async (request, response, next) => {
    const parsed = recordSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidRecord(response, parsed.error.flatten());
      return;
    }

    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      const record = await recordRepository.updateRecord(user.id, request.params.id, parsed.data);
      if (!record) {
        response.status(404).json({ error: 'RECORD_NOT_FOUND' });
        return;
      }
      response.json(record);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/records/:id', async (request, response, next) => {
    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      const deleted = await recordRepository.deleteRecord(user.id, request.params.id);
      if (!deleted) {
        response.status(404).json({ error: 'RECORD_NOT_FOUND' });
        return;
      }
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/records', async (request, response, next) => {
    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      await recordRepository.clearRecords(user.id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/food-records', async (request, response, next) => {
    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      const records = await foodRecordRepository.listFoodRecords(user.id);
      response.json({ records });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/food-records', parseFoodMultipart, async (request, response, next) => {
    const parsed = foodRecordSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidFoodRecord(response, parsed.error.flatten());
      return;
    }

    let savedImage = null;
    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      if (request.file) {
        savedImage = await foodImageStorage.save(request.file);
      }

      const record = await foodRecordRepository.createFoodRecord(user.id, {
        ...parsed.data,
        ...(savedImage || {})
      });
      response.status(201).json(record);
    } catch (error) {
      if (savedImage?.imageKey) await foodImageStorage.delete(savedImage.imageKey);
      if (error.code === 'INVALID_FOOD_IMAGE') {
        sendInvalidFoodImage(response);
        return;
      }
      next(error);
    }
  });

  app.put('/api/food-records/:id', parseFoodMultipart, async (request, response, next) => {
    const parsed = foodRecordSchema.safeParse(request.body);
    if (!parsed.success) {
      sendInvalidFoodRecord(response, parsed.error.flatten());
      return;
    }

    let savedImage = null;
    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      const existing = await foodRecordRepository.findFoodRecord(user.id, request.params.id);
      if (!existing) {
        response.status(404).json({ error: 'FOOD_RECORD_NOT_FOUND' });
        return;
      }

      if (request.file) {
        savedImage = await foodImageStorage.save(request.file);
      }

      const record = await foodRecordRepository.updateFoodRecord(user.id, request.params.id, {
        ...parsed.data,
        ...(savedImage || {})
      });

      if (savedImage?.imageKey && existing.imageKey) {
        await foodImageStorage.delete(existing.imageKey);
      }

      response.json(record);
    } catch (error) {
      if (savedImage?.imageKey) await foodImageStorage.delete(savedImage.imageKey);
      if (error.code === 'INVALID_FOOD_IMAGE') {
        sendInvalidFoodImage(response);
        return;
      }
      next(error);
    }
  });

  app.delete('/api/food-records/:id', async (request, response, next) => {
    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      const deleted = await foodRecordRepository.deleteFoodRecord(user.id, request.params.id);
      if (!deleted) {
        response.status(404).json({ error: 'FOOD_RECORD_NOT_FOUND' });
        return;
      }
      if (deleted.imageKey) {
        await foodImageStorage.delete(deleted.imageKey);
      }
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/food-records', async (request, response, next) => {
    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      const deletedRecords = await foodRecordRepository.clearFoodRecords(user.id);
      await Promise.all(deletedRecords.filter((record) => record.imageKey).map((record) => foodImageStorage.delete(record.imageKey)));
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/food-images/:key', async (request, response, next) => {
    try {
      const user = await authenticatedUser(request, response, userRepository, authSecret);
      if (!user) return;

      const record = await foodRecordRepository.findFoodRecordByImageKey(user.id, request.params.key);
      if (!record) {
        response.status(404).json({ error: 'FOOD_IMAGE_NOT_FOUND' });
        return;
      }

      const stream = await foodImageStorage.open(request.params.key);
      if (!stream) {
        response.status(404).json({ error: 'FOOD_IMAGE_NOT_FOUND' });
        return;
      }

      response.setHeader('Content-Type', record.imageMime);
      response.setHeader('Cache-Control', 'private, max-age=3600');
      stream.pipe(response);
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    response.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  });

  return app;
}
