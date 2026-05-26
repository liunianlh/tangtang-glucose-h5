import cors from 'cors';
import express from 'express';
import { z } from 'zod';

const recordSchema = z.object({
  value: z.coerce.number().gt(0).lte(40),
  period: z.string().trim().min(1).max(20),
  measuredAt: z.string().trim().refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid datetime'),
  note: z.string().trim().max(500).optional().default('')
});

function userIdFromRequest(request, defaultUserId) {
  return request.get('x-user-id') || defaultUserId;
}

function sendInvalidRecord(response, details) {
  response.status(400).json({
    error: 'INVALID_RECORD',
    details
  });
}

export function createApp({ recordRepository, defaultUserId = 'wife-user' }) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      storage: recordRepository.kind
    });
  });

  app.get('/api/records', async (request, response, next) => {
    try {
      const records = await recordRepository.listRecords(userIdFromRequest(request, defaultUserId));
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
      const record = await recordRepository.createRecord(userIdFromRequest(request, defaultUserId), parsed.data);
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
      const record = await recordRepository.updateRecord(userIdFromRequest(request, defaultUserId), request.params.id, parsed.data);
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
      const deleted = await recordRepository.deleteRecord(userIdFromRequest(request, defaultUserId), request.params.id);
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
      await recordRepository.clearRecords(userIdFromRequest(request, defaultUserId));
      response.status(204).end();
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
