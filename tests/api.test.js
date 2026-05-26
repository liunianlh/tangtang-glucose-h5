import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { createMemoryRecordRepository } from '../server/repositories/memoryRecordRepository.js';

function makeTestApp(seed = []) {
  const repository = createMemoryRecordRepository(seed);
  return createApp({ recordRepository: repository, defaultUserId: 'test-user' });
}

describe('records API', () => {
  it('responds to health checks', async () => {
    const response = await request(makeTestApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true });
  });

  it('creates, lists, updates, and deletes glucose records for the current user', async () => {
    const app = makeTestApp();

    const created = await request(app)
      .post('/api/records')
      .send({
        value: 6.3,
        period: '早餐后',
        measuredAt: '2026-05-25T09:35',
        note: '早餐后散步'
      });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      value: 6.3,
      unit: 'mmol/L',
      period: '早餐后',
      measuredAt: '2026-05-25T09:35',
      note: '早餐后散步'
    });

    const listed = await request(app).get('/api/records');
    expect(listed.status).toBe(200);
    expect(listed.body.records).toHaveLength(1);
    expect(listed.body.records[0].id).toBe(created.body.id);

    const updated = await request(app)
      .put(`/api/records/${created.body.id}`)
      .send({
        value: 6.8,
        period: '睡前',
        measuredAt: '2026-05-25T22:10',
        note: '睡前复测'
      });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: created.body.id,
      value: 6.8,
      period: '睡前',
      note: '睡前复测'
    });

    const deleted = await request(app).delete(`/api/records/${created.body.id}`);
    expect(deleted.status).toBe(204);

    const afterDelete = await request(app).get('/api/records');
    expect(afterDelete.body.records).toEqual([]);
  });

  it('rejects invalid record payloads', async () => {
    const response = await request(makeTestApp())
      .post('/api/records')
      .send({
        value: -1,
        period: '',
        measuredAt: 'not-a-date',
        note: ''
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_RECORD');
  });
});
