import { expect, test } from '@playwright/test';

const authStorageKey = 'glucose-h5-auth';
let usernameCounter = 0;

function uniqueUsername(prefix) {
  usernameCounter += 1;
  return `${prefix}${Date.now().toString(36)}${usernameCounter}`;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function solveCaptchaQuestion(question) {
  const match = String(question).match(/(\d+)\s*([+-])\s*(\d+)/);
  if (!match) throw new Error(`Unexpected captcha question: ${question}`);

  const left = Number(match[1]);
  const right = Number(match[3]);
  return String(match[2] === '+' ? left + right : left - right);
}

async function getCaptchaByApi(page) {
  const response = await page.request.get('/api/auth/captcha');
  expect(response.status()).toBe(200);
  const body = await response.json();

  return {
    captchaToken: body.token,
    captchaAnswer: solveCaptchaQuestion(body.question)
  };
}

async function registerByApi(page, username = uniqueUsername('wife')) {
  const response = await page.request.post('/api/auth/register', {
    data: {
      username,
      displayName: '我的老婆',
      password: 'secret123',
      ...(await getCaptchaByApi(page))
    }
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  await page.addInitScript(({ key, auth }) => {
    window.localStorage.setItem(key, JSON.stringify(auth));
  }, {
    key: authStorageKey,
    auth: body
  });
  return body;
}

test('locks mobile viewport scale while keeping responsive layout', async ({ page }) => {
  await page.goto('/');
  const viewportContent = await page.locator('meta[name="viewport"]').getAttribute('content');

  expect(viewportContent).toContain('width=device-width');
  expect(viewportContent).toContain('initial-scale=1.0');
  expect(viewportContent).toContain('maximum-scale=1.0');
  expect(viewportContent).toContain('user-scalable=no');
  expect(viewportContent).toContain('viewport-fit=cover');
});

test('supports the full blood glucose record flow', async ({ page }) => {
  const username = uniqueUsername('wife');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '登录糖糖记录本' })).toBeVisible();
  await page.getByRole('button', { name: '注册账号' }).click();
  await page.getByLabel('用户名').fill(username);
  await page.getByLabel('昵称').fill('我的老婆');
  await page.getByLabel('密码', { exact: true }).fill('secret123');
  await page.getByLabel('确认密码').fill('secret123');
  await expect(page.locator('.captcha-question')).toBeVisible();
  await page.getByLabel('验证码答案').fill(solveCaptchaQuestion(await page.locator('.captcha-question').innerText()));
  await page.getByRole('button', { name: '注册并进入' }).click();

  await expect(page.getByRole('button', { name: /记录血糖/ })).toBeVisible();
  const storedAuth = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), authStorageKey);
  expect(storedAuth.token).toEqual(expect.any(String));

  await page.request.delete('/api/records', {
    headers: authHeaders(storedAuth.token)
  });
  await page.request.post('/api/records', {
    headers: authHeaders(storedAuth.token),
    data: {
      value: 5.8,
      period: '早餐后',
      measuredAt: '2026-05-25T08:10',
      note: '早餐后保留记录'
    }
  });
  await page.request.post('/api/records', {
    headers: authHeaders(storedAuth.token),
    data: {
      value: 6.1,
      period: '午餐后',
      measuredAt: '2026-05-25T13:20',
      note: '午餐后保留记录'
    }
  });
  await page.reload();

  await expect(page.getByRole('button', { name: /记录血糖/ })).toBeVisible();
  await expect(page.getByText('最近血糖曲线')).toBeVisible();

  await page.getByRole('button', { name: /记录血糖/ }).click();
  await page.getByLabel(/血糖值/).fill('6.9');
  await page.getByLabel(/测量时段/).selectOption('睡前');
  await page.locator('input[type="datetime-local"]').fill('2026-05-25T20:30');
  await page.getByLabel(/备注/).fill('晚饭后散步 20 分钟');
  await page.getByRole('button', { name: /保存记录/ }).click();

  await expect(page.getByText('记录已保存')).toBeVisible();
  await expect(page.getByText('6.9').first()).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '记录' }).click();
  await expect(page.getByText('睡前').first()).toBeVisible();
  await page.getByText('晚饭后散步 20 分钟').click();
  await expect(page.getByText('记录详情')).toBeVisible();

  await page.getByRole('button', { name: /编辑/ }).click();
  await page.getByLabel(/血糖值/).fill('6.7');
  await page.getByRole('button', { name: /保存记录/ }).click();
  await expect(page.getByText('记录已更新')).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '曲线' }).click();
  await expect(page.getByText('看看最近变化')).toBeVisible();
  await expect(page.locator('.chart-line')).toBeVisible();
  await page.locator('.chart-hit-area').first().hover();
  await expect(page.getByText(/血糖 .*mmol\/L/)).toBeVisible();
  await expect(page.getByText(/记录时间/)).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '导出' }).click();
  await expect(page.getByText('血糖记录汇总')).toBeVisible();

  const imageDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出图片/ }).click();
  await expect((await imageDownload).suggestedFilename()).toMatch(/\.png$/);

  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出 PDF/ }).click();
  await expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);

  await page.locator('.bottom-nav').getByRole('button', { name: '我的' }).click();
  await expect(page.getByText('我的糖糖账户')).toBeVisible();
  await expect(page.getByText('当前使用人')).toBeVisible();
  await expect(page.getByText('我的老婆', { exact: true })).toBeVisible();
  await expect(page.getByText(username, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑资料' }).click();
  await page.getByLabel('昵称').fill('糖糖妈妈');
  await page.getByRole('button', { name: '保存资料' }).click();
  await expect(page.getByText('个人资料已更新')).toBeVisible();
  await expect(page.getByRole('heading', { name: '糖糖妈妈' })).toBeVisible();
  const updatedAuth = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), authStorageKey);
  expect(updatedAuth.user.displayName).toBe('糖糖妈妈');

  await page.locator('.bottom-nav').getByRole('button', { name: '记录' }).click();
  const editedRecord = page.locator('.record-card').filter({ hasText: '晚饭后散步 20 分钟' });
  await editedRecord.getByRole('button', { name: /删除/ }).click();
  await expect(page.getByText('删除这条记录？')).toBeVisible();
  await page.locator('.confirm-box').getByRole('button', { name: '删除' }).click();

  await expect(page.getByText('记录已删除')).toBeVisible();
  await expect(page.getByText('晚饭后散步 20 分钟')).toHaveCount(0);
  await expect(page.getByText('早餐后保留记录')).toBeVisible();
  await expect(page.getByText('午餐后保留记录')).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '首页' }).click();
  await expect(page.locator('.summary-grid article').first()).toContainText('2');
  await expect(page.getByText('晚饭后散步 20 分钟')).toHaveCount(0);

  await page.locator('.bottom-nav').getByRole('button', { name: '曲线' }).click();
  await expect(page.locator('.chart-line')).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '导出' }).click();
  await expect(page.locator('.report-badge')).toHaveText('2 条');
  await expect(page.locator('.report-list')).not.toContainText('6.7 mmol/L');
  await expect(page.locator('.report-list')).toContainText('5.8 mmol/L');
  await expect(page.getByRole('button', { name: /导出图片/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /导出 PDF/ })).toBeEnabled();
});

test('prevents duplicate record creation when save is clicked repeatedly', async ({ page }) => {
  const { token } = await registerByApi(page, uniqueUsername('repeat'));
  await page.request.delete('/api/records', {
    headers: authHeaders(token)
  });

  await page.route('**/api/records', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });

  await page.goto('/');
  await page.getByRole('button', { name: /记录血糖/ }).click();
  await page.getByLabel(/血糖值/).fill('6.2');
  await page.getByLabel(/测量时段/).selectOption('早餐后');
  await page.locator('input[type="datetime-local"]').fill('2026-05-26T07:30');
  await page.getByLabel(/备注/).fill('重复点击保护');

  await page.getByRole('button', { name: /保存记录/ }).dblclick();
  await expect(page.getByText('记录已保存')).toBeVisible();

  const response = await page.request.get('/api/records', {
    headers: authHeaders(token)
  });
  const body = await response.json();
  const matchingRecords = body.records.filter((record) => record.note === '重复点击保护');
  expect(matchingRecords).toHaveLength(1);
});

test('supports the food record flow with an uploaded image', async ({ page }) => {
  const { token } = await registerByApi(page, uniqueUsername('food'));
  await page.request.delete('/api/records', {
    headers: authHeaders(token)
  });
  await page.request.delete('/api/food-records', {
    headers: authHeaders(token)
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: /记录血糖/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /记录饮食/ })).toBeVisible();
  await expect(page.locator('.glucose-action svg')).toBeVisible();

  await page.getByRole('button', { name: /记录饮食/ }).click();
  await expect(page.getByRole('heading', { name: '记录饮食' })).toBeVisible();
  await page.getByLabel('餐次').selectOption('早餐');
  await page.getByLabel('饮食时间').fill('2026-05-26T08:15');
  await page.getByLabel('饮食内容').fill('杂粮饼半个，牛奶 250ml');
  await page.getByLabel('备注').fill('饭后散步');
  await page.getByLabel('饮食图片').setInputFiles({
    name: 'breakfast.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake-food-image')
  });
  await page.getByRole('button', { name: /保存饮食/ }).click();

  await expect(page.getByText('饮食已保存')).toBeVisible();
  await page.locator('.bottom-nav').getByRole('button', { name: '记录' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '饮食记录' }).click();
  await expect(page.getByText('杂粮饼半个，牛奶 250ml')).toBeVisible();
  await expect(page.locator('.food-thumb img')).toBeVisible();

  await page.getByText('杂粮饼半个，牛奶 250ml').click();
  await expect(page.getByText('饮食详情')).toBeVisible();
  await page.getByRole('button', { name: /编辑/ }).click();
  await page.getByLabel('饮食内容').fill('杂粮饼半个，鸡蛋一个');
  await page.getByRole('button', { name: /保存饮食/ }).click();
  await expect(page.getByText('饮食已更新')).toBeVisible();
  await expect(page.getByText('杂粮饼半个，鸡蛋一个')).toBeVisible();

  const editedRecord = page.locator('.record-card').filter({ hasText: '杂粮饼半个，鸡蛋一个' });
  await editedRecord.getByRole('button', { name: /删除/ }).click();
  await expect(page.getByText('删除这条饮食？')).toBeVisible();
  await page.locator('.confirm-box').getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('饮食已删除')).toBeVisible();
  await expect(page.getByText('杂粮饼半个，鸡蛋一个')).toHaveCount(0);
  await expect(page.getByText('还没有饮食记录')).toBeVisible();
});

test('exports every record and lets the chart reference line be configured', async ({ page }) => {
  const { token } = await registerByApi(page, uniqueUsername('export'));
  await page.request.delete('/api/records', {
    headers: authHeaders(token)
  });

  const periods = ['空腹', '早餐后', '午饭前', '午餐后', '晚饭前', '晚餐后'];
  for (let index = 0; index < periods.length; index += 1) {
    await page.request.post('/api/records', {
      headers: authHeaders(token),
      data: {
        value: 5.2 + index * 0.3,
        period: periods[index],
        measuredAt: `2026-05-${20 + index}T08:10`,
        note: `全量导出记录 ${index + 1}`
      }
    });
  }

  await page.goto('/');
  await page.getByRole('button', { name: /记录血糖/ }).click();
  await expect(page.getByLabel(/测量时段/).locator('option')).toHaveText([
    '空腹',
    '早餐后',
    '午饭前',
    '午餐后',
    '晚饭前',
    '晚餐后',
    '睡前',
    '其他'
  ]);
  const sheetBox = await page.locator('.sheet').boundingBox();
  const measuredAtBox = await page.locator('input[type="datetime-local"]').boundingBox();
  const viewport = page.viewportSize();
  expect(sheetBox).not.toBeNull();
  expect(measuredAtBox).not.toBeNull();
  expect(measuredAtBox.x + measuredAtBox.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width + 1);
  expect(sheetBox.x + sheetBox.width).toBeLessThanOrEqual(viewport.width + 1);
  await page.getByRole('button', { name: '关闭' }).click();

  await page.locator('.bottom-nav').getByRole('button', { name: '导出' }).click();
  await expect(page.locator('.report-list > div')).toHaveCount(periods.length);
  await expect(page.locator('.report-list')).toContainText('全量导出记录 1');
  await expect(page.locator('.report-list')).toContainText('全量导出记录 6');

  await page.locator('.bottom-nav').getByRole('button', { name: '我的' }).click();
  await page.getByLabel('图表参考上限').fill('6.7');
  await page.getByLabel('图表参考上限').blur();
  await page.locator('.bottom-nav').getByRole('button', { name: '曲线' }).click();
  await expect(page.locator('.full-chart-card .chart-axis')).toContainText('参考上限 6.7');

  await page.reload();
  await page.locator('.bottom-nav').getByRole('button', { name: '曲线' }).click();
  await expect(page.locator('.full-chart-card .chart-axis')).toContainText('参考上限 6.7');
});
