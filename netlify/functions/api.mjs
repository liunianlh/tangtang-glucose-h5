import { z } from 'zod';
import { createMemoryRecordRepository } from '../../server/repositories/memoryRecordRepository.js';
import { createPrismaRecordRepository } from '../../server/repositories/prismaRecordRepository.js';
import { makeSeedRecords } from '../../src/lib/records.js';

const recordSchema = z.object({
  value: z.coerce.number().gt(0).lte(40),
  period: z.string().trim().min(1).max(20),
  measuredAt: z.string().trim().refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid datetime'),
  note: z.string().trim().max(500).optional().default('')
});

let repository;

function getRuntimeEnv(name, context) {
  const netlifyValue = typeof Netlify !== 'undefined' ? Netlify.env.get(name) || '' : '';
  const contextValue = context?.env?.get?.(name) || '';
  return netlifyValue || contextValue || process.env[name] || '';
}

function getRepository(context) {
  if (repository) return repository;

  const databaseUrl = getRuntimeEnv('DATABASE_URL', context);

  if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
    repository = createPrismaRecordRepository();
  } else {
    repository = createMemoryRecordRepository(makeSeedRecords());
  }

  return repository;
}

function getUserId(request, context) {
  return request.headers.get('x-user-id') || getRuntimeEnv('DEFAULT_USER_ID', context) || 'wife-user';
}

function json(data, init = {}) {
  return Response.json(data, init);
}

async function parseRecord(request) {
  let body = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  return recordSchema.safeParse(body);
}

export default async (request, context) => {
  const repository = getRepository(context);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '/');
  const userId = getUserId(request, context);

  if (request.method === 'GET' && path === '/health') {
    return json({
      ok: true,
      storage: repository.kind,
      databaseConfigured: Boolean(getRuntimeEnv('DATABASE_URL', context))
    });
  }

  if (request.method === 'GET' && path === '/records') {
    const records = await repository.listRecords(userId);
    return json({ records });
  }

  if (request.method === 'POST' && path === '/records') {
    const parsed = await parseRecord(request);
    if (!parsed.success) {
      return json({ error: 'INVALID_RECORD', details: parsed.error.flatten() }, { status: 400 });
    }

    const record = await repository.createRecord(userId, parsed.data);
    return json(record, { status: 201 });
  }

  if (request.method === 'DELETE' && path === '/records') {
    await repository.clearRecords(userId);
    return new Response(null, { status: 204 });
  }

  const recordMatch = path.match(/^\/records\/([^/]+)$/);
  if (recordMatch && request.method === 'PUT') {
    const parsed = await parseRecord(request);
    if (!parsed.success) {
      return json({ error: 'INVALID_RECORD', details: parsed.error.flatten() }, { status: 400 });
    }

    const record = await repository.updateRecord(userId, recordMatch[1], parsed.data);
    if (!record) return json({ error: 'RECORD_NOT_FOUND' }, { status: 404 });
    return json(record);
  }

  if (recordMatch && request.method === 'DELETE') {
    const deleted = await repository.deleteRecord(userId, recordMatch[1]);
    if (!deleted) return json({ error: 'RECORD_NOT_FOUND' }, { status: 404 });
    return new Response(null, { status: 204 });
  }

  return json({ error: 'NOT_FOUND' }, { status: 404 });
};

export const config = {
  path: '/api/*'
};
