import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { createFoodImageStorage } from '../server/lib/foodImageStorage.js';
import { createMemoryBloodPressureRecordRepository } from '../server/repositories/memoryBloodPressureRecordRepository.js';
import { createMemoryFoodRecordRepository } from '../server/repositories/memoryFoodRecordRepository.js';
import { createMemoryRecordRepository } from '../server/repositories/memoryRecordRepository.js';
import { createMemoryUserRepository } from '../server/repositories/memoryUserRepository.js';

function makeTestApp(seed = []) {
  const recordRepository = createMemoryRecordRepository(seed);
  const userRepository = createMemoryUserRepository();
  const bloodPressureRecordRepository = createMemoryBloodPressureRecordRepository();
  const foodRecordRepository = createMemoryFoodRecordRepository();
  const foodImageStorage = createFoodImageStorage(mkdtempSync(join(tmpdir(), 'glucose-food-images-')));
  return createApp({
    recordRepository,
    userRepository,
    bloodPressureRecordRepository,
    foodRecordRepository,
    foodImageStorage,
    authSecret: 'test-auth-secret'
  });
}

function solveCaptcha(question) {
  const match = String(question).match(/(\d+)\s*([+-])\s*(\d+)/);
  if (!match) throw new Error(`Unexpected captcha question: ${question}`);

  const left = Number(match[1]);
  const right = Number(match[3]);
  return String(match[2] === '+' ? left + right : left - right);
}

async function getCaptcha(app) {
  const response = await request(app).get('/api/auth/captcha');

  expect(response.status).toBe(200);
  expect(response.body.question).toEqual(expect.any(String));
  expect(response.body.token).toEqual(expect.any(String));

  return {
    captchaToken: response.body.token,
    captchaAnswer: solveCaptcha(response.body.question)
  };
}

async function registerUser(app, username, displayName = username) {
  const captcha = await getCaptcha(app);
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      username,
      displayName,
      password: 'secret123',
      ...captcha
    });

  expect(response.status).toBe(201);
  expect(response.body.token).toEqual(expect.any(String));
  expect(response.body.user).toMatchObject({ username, displayName });
  expect(response.body.user.passwordHash).toBeUndefined();
  return response.body;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

describe('records API', () => {
  it('responds to health checks', async () => {
    const response = await request(makeTestApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true });
  });

  it('registers, logs in, and returns the current authenticated user', async () => {
    const app = makeTestApp();
    const registered = await registerUser(app, 'wife', '我的老婆');

    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'wife',
        displayName: '重复',
        password: 'secret123',
        ...(await getCaptcha(app))
      });
    expect(duplicate.status).toBe(409);

    const badLogin = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'wife',
        password: 'wrong-password',
        ...(await getCaptcha(app))
      });
    expect(badLogin.status).toBe(401);

    const login = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'wife',
        password: 'secret123',
        ...(await getCaptcha(app))
      });
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));
    expect(login.body.user).toMatchObject({ username: 'wife', displayName: '我的老婆' });

    const me = await request(app)
      .get('/api/auth/me')
      .set(authHeader(registered.token));
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ username: 'wife', displayName: '我的老婆' });
  });

  it('updates the current user profile', async () => {
    const app = makeTestApp();
    const registered = await registerUser(app, 'wife', '我的老婆');

    const updated = await request(app)
      .patch('/api/auth/me')
      .set(authHeader(registered.token))
      .send({ displayName: '糖糖妈妈' });

    expect(updated.status).toBe(200);
    expect(updated.body.token).toEqual(expect.any(String));
    expect(updated.body.user).toMatchObject({
      username: 'wife',
      displayName: '糖糖妈妈'
    });

    const me = await request(app)
      .get('/api/auth/me')
      .set(authHeader(updated.body.token));
    expect(me.body.user).toMatchObject({ username: 'wife', displayName: '糖糖妈妈' });

    const invalid = await request(app)
      .patch('/api/auth/me')
      .set(authHeader(updated.body.token))
      .send({ displayName: '' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe('INVALID_PROFILE');
  });

  it('requires a valid captcha for registration and login', async () => {
    const app = makeTestApp();
    const captcha = await getCaptcha(app);

    const missingCaptcha = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'wife',
        displayName: '我的老婆',
        password: 'secret123'
      });
    expect(missingCaptcha.status).toBe(400);
    expect(missingCaptcha.body.error).toBe('INVALID_AUTH_PAYLOAD');

    const wrongCaptcha = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'wife',
        displayName: '我的老婆',
        password: 'secret123',
        captchaToken: captcha.captchaToken,
        captchaAnswer: '999'
      });
    expect(wrongCaptcha.status).toBe(400);
    expect(wrongCaptcha.body.error).toBe('INVALID_CAPTCHA');

    const registered = await registerUser(app, 'wife', '我的老婆');

    const badLoginCaptcha = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'wife',
        password: 'secret123',
        captchaToken: captcha.captchaToken,
        captchaAnswer: '999'
      });
    expect(badLoginCaptcha.status).toBe(400);
    expect(badLoginCaptcha.body.error).toBe('INVALID_CAPTCHA');

    expect(registered.token).toEqual(expect.any(String));
  });

  it('requires authentication for record data', async () => {
    const app = makeTestApp();

    const response = await request(app).get('/api/records');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('UNAUTHORIZED');
  });

  it('creates, lists, updates, and deletes glucose records for the current user', async () => {
    const app = makeTestApp();
    const { token } = await registerUser(app, 'wife', '我的老婆');

    const created = await request(app)
      .post('/api/records')
      .set(authHeader(token))
      .send({
        value: 6.34,
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

    const listed = await request(app)
      .get('/api/records')
      .set(authHeader(token));
    expect(listed.status).toBe(200);
    expect(listed.body.records).toHaveLength(1);
    expect(listed.body.records[0].id).toBe(created.body.id);

    const updated = await request(app)
      .put(`/api/records/${created.body.id}`)
      .set(authHeader(token))
      .send({
        value: 6.86,
        period: '睡前',
        measuredAt: '2026-05-25T22:10',
        note: '睡前复测'
      });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: created.body.id,
      value: 6.9,
      period: '睡前',
      note: '睡前复测'
    });

    const deleted = await request(app)
      .delete(`/api/records/${created.body.id}`)
      .set(authHeader(token));
    expect(deleted.status).toBe(204);

    const afterDelete = await request(app)
      .get('/api/records')
      .set(authHeader(token));
    expect(afterDelete.body.records).toEqual([]);
  });

  it('keeps glucose records isolated between users', async () => {
    const app = makeTestApp();
    const wife = await registerUser(app, 'wife', '我的老婆');
    const husband = await registerUser(app, 'husband', '我');

    await request(app)
      .post('/api/records')
      .set(authHeader(wife.token))
      .send({
        value: 5.9,
        period: '空腹',
        measuredAt: '2026-05-25T07:20',
        note: '老婆的记录'
      });

    await request(app)
      .post('/api/records')
      .set(authHeader(husband.token))
      .send({
        value: 6.6,
        period: '睡前',
        measuredAt: '2026-05-25T22:10',
        note: '我的记录'
      });

    const wifeRecords = await request(app)
      .get('/api/records')
      .set(authHeader(wife.token));
    const husbandRecords = await request(app)
      .get('/api/records')
      .set(authHeader(husband.token));

    expect(wifeRecords.body.records).toHaveLength(1);
    expect(wifeRecords.body.records[0].note).toBe('老婆的记录');
    expect(husbandRecords.body.records).toHaveLength(1);
    expect(husbandRecords.body.records[0].note).toBe('我的记录');
  });

  it('rejects invalid record payloads', async () => {
    const app = makeTestApp();
    const { token } = await registerUser(app, 'wife', '我的老婆');

    const response = await request(app)
      .post('/api/records')
      .set(authHeader(token))
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

describe('blood pressure records API', () => {
  it('requires authentication for blood pressure data', async () => {
    const app = makeTestApp();

    const response = await request(app).get('/api/blood-pressure-records');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('UNAUTHORIZED');
  });

  it('creates, lists, updates, and deletes pressure records with optional pulse', async () => {
    const app = makeTestApp();
    const { token } = await registerUser(app, 'wife', '我的老婆');

    const created = await request(app)
      .post('/api/blood-pressure-records')
      .set(authHeader(token))
      .send({
        systolic: 118,
        diastolic: 76,
        measuredAt: '2026-05-25T09:35',
        note: '早餐后测量'
      });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      systolic: 118,
      diastolic: 76,
      pulse: null,
      measuredAt: '2026-05-25T09:35',
      note: '早餐后测量'
    });

    const listed = await request(app)
      .get('/api/blood-pressure-records')
      .set(authHeader(token));
    expect(listed.status).toBe(200);
    expect(listed.body.records).toHaveLength(1);
    expect(listed.body.records[0].id).toBe(created.body.id);

    const updated = await request(app)
      .put(`/api/blood-pressure-records/${created.body.id}`)
      .set(authHeader(token))
      .send({
        systolic: 121,
        diastolic: 79,
        pulse: 72,
        measuredAt: '2026-05-25T22:10',
        note: '睡前复测'
      });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: created.body.id,
      systolic: 121,
      diastolic: 79,
      pulse: 72,
      note: '睡前复测'
    });

    const deleted = await request(app)
      .delete(`/api/blood-pressure-records/${created.body.id}`)
      .set(authHeader(token));
    expect(deleted.status).toBe(204);

    const afterDelete = await request(app)
      .get('/api/blood-pressure-records')
      .set(authHeader(token));
    expect(afterDelete.body.records).toEqual([]);
  });

  it('keeps pressure records isolated between users', async () => {
    const app = makeTestApp();
    const wife = await registerUser(app, 'wife', '我的老婆');
    const husband = await registerUser(app, 'husband', '我');

    const created = await request(app)
      .post('/api/blood-pressure-records')
      .set(authHeader(wife.token))
      .send({
        systolic: 125,
        diastolic: 82,
        pulse: 74,
        measuredAt: '2026-05-25T07:20',
        note: '老婆的血压'
      });

    expect(created.status).toBe(201);

    const husbandRecords = await request(app)
      .get('/api/blood-pressure-records')
      .set(authHeader(husband.token));
    expect(husbandRecords.body.records).toEqual([]);

    const husbandUpdate = await request(app)
      .put(`/api/blood-pressure-records/${created.body.id}`)
      .set(authHeader(husband.token))
      .send({
        systolic: 120,
        diastolic: 78,
        measuredAt: '2026-05-26T08:10',
        note: '不能改别人的'
      });
    expect(husbandUpdate.status).toBe(404);
    expect(husbandUpdate.body.error).toBe('BLOOD_PRESSURE_RECORD_NOT_FOUND');
  });

  it('rejects invalid blood pressure payloads', async () => {
    const app = makeTestApp();
    const { token } = await registerUser(app, 'wife', '我的老婆');

    const invalidPressure = await request(app)
      .post('/api/blood-pressure-records')
      .set(authHeader(token))
      .send({
        systolic: 300,
        diastolic: 10,
        measuredAt: 'not-a-date',
        note: ''
      });
    expect(invalidPressure.status).toBe(400);
    expect(invalidPressure.body.error).toBe('INVALID_BLOOD_PRESSURE_RECORD');

    const invalidPulse = await request(app)
      .post('/api/blood-pressure-records')
      .set(authHeader(token))
      .send({
        systolic: 120,
        diastolic: 80,
        pulse: 300,
        measuredAt: '2026-05-26T08:15',
        note: ''
      });
    expect(invalidPulse.status).toBe(400);
    expect(invalidPulse.body.error).toBe('INVALID_BLOOD_PRESSURE_RECORD');
  });
});

describe('food records API', () => {
  it('creates, lists, updates, reads images, and deletes food records', async () => {
    const app = makeTestApp();
    const { token } = await registerUser(app, 'wife', '我的老婆');

    const created = await request(app)
      .post('/api/food-records')
      .set(authHeader(token))
      .field('mealType', '早餐')
      .field('eatenAt', '2026-05-26T08:15')
      .field('content', '杂粮饼半个，牛奶 250ml')
      .field('note', '吃完散步')
      .attach('image', Buffer.from('fake-png-image'), {
        filename: 'breakfast.png',
        contentType: 'image/png'
      });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      mealType: '早餐',
      eatenAt: '2026-05-26T08:15',
      content: '杂粮饼半个，牛奶 250ml',
      note: '吃完散步',
      imageMime: 'image/png',
      imageSize: Buffer.byteLength('fake-png-image')
    });
    expect(created.body.imageKey).toEqual(expect.any(String));

    const image = await request(app)
      .get(`/api/food-images/${created.body.imageKey}`)
      .set(authHeader(token));
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toContain('image/png');
    expect(image.body.toString()).toBe('fake-png-image');

    const listed = await request(app)
      .get('/api/food-records')
      .set(authHeader(token));
    expect(listed.status).toBe(200);
    expect(listed.body.records).toHaveLength(1);
    expect(listed.body.records[0].id).toBe(created.body.id);

    const updated = await request(app)
      .put(`/api/food-records/${created.body.id}`)
      .set(authHeader(token))
      .field('mealType', '午餐')
      .field('eatenAt', '2026-05-26T12:35')
      .field('content', '米饭半碗，青菜，鸡蛋')
      .field('note', '替换了照片')
      .attach('image', Buffer.from('fake-webp-image'), {
        filename: 'lunch.webp',
        contentType: 'image/webp'
      });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: created.body.id,
      mealType: '午餐',
      content: '米饭半碗，青菜，鸡蛋',
      note: '替换了照片',
      imageMime: 'image/webp',
      imageSize: Buffer.byteLength('fake-webp-image')
    });
    expect(updated.body.imageKey).not.toBe(created.body.imageKey);

    const oldImage = await request(app)
      .get(`/api/food-images/${created.body.imageKey}`)
      .set(authHeader(token));
    expect(oldImage.status).toBe(404);

    const deleted = await request(app)
      .delete(`/api/food-records/${created.body.id}`)
      .set(authHeader(token));
    expect(deleted.status).toBe(204);

    const afterDeleteImage = await request(app)
      .get(`/api/food-images/${updated.body.imageKey}`)
      .set(authHeader(token));
    expect(afterDeleteImage.status).toBe(404);
  });

  it('keeps food records and images isolated between users', async () => {
    const app = makeTestApp();
    const wife = await registerUser(app, 'wife', '我的老婆');
    const husband = await registerUser(app, 'husband', '我');

    const created = await request(app)
      .post('/api/food-records')
      .set(authHeader(wife.token))
      .field('mealType', '晚餐')
      .field('eatenAt', '2026-05-26T18:30')
      .field('content', '鱼汤，青菜')
      .field('note', '')
      .attach('image', Buffer.from('wife-food'), {
        filename: 'food.jpg',
        contentType: 'image/jpeg'
      });

    expect(created.status).toBe(201);

    const husbandList = await request(app)
      .get('/api/food-records')
      .set(authHeader(husband.token));
    expect(husbandList.body.records).toEqual([]);

    const husbandImage = await request(app)
      .get(`/api/food-images/${created.body.imageKey}`)
      .set(authHeader(husband.token));
    expect(husbandImage.status).toBe(404);
  });

  it('rejects empty food content and unsupported images', async () => {
    const app = makeTestApp();
    const { token } = await registerUser(app, 'wife', '我的老婆');

    const emptyContent = await request(app)
      .post('/api/food-records')
      .set(authHeader(token))
      .field('mealType', '早餐')
      .field('eatenAt', '2026-05-26T08:15')
      .field('content', '')
      .field('note', '');
    expect(emptyContent.status).toBe(400);
    expect(emptyContent.body.error).toBe('INVALID_FOOD_RECORD');

    const badImage = await request(app)
      .post('/api/food-records')
      .set(authHeader(token))
      .field('mealType', '早餐')
      .field('eatenAt', '2026-05-26T08:15')
      .field('content', '白粥')
      .field('note', '')
      .attach('image', Buffer.from('plain text'), {
        filename: 'food.txt',
        contentType: 'text/plain'
      });
    expect(badImage.status).toBe(400);
    expect(badImage.body.error).toBe('INVALID_FOOD_IMAGE');
  });
});
