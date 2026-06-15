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

test('lets guests preview the app before login and asks for auth when saving', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: /记录血糖/ })).toBeVisible();
  await expect(page.getByText('最近血糖曲线')).toBeVisible();
  await expect(page.getByRole('heading', { name: '登录糖糖记录本' })).toHaveCount(0);

  await page.getByRole('button', { name: /记录血糖/ }).click();
  await page.getByLabel(/血糖值/).fill('6.2');
  await page.getByRole('button', { name: /保存记录/ }).click();

  await expect(page.getByRole('heading', { name: '登录糖糖记录本' })).toBeVisible();
  await expect(page.getByText('登录后再保存记录')).toBeVisible();
});

test('supports the full blood glucose record flow', async ({ page }) => {
  const username = uniqueUsername('wife');
  await page.goto('/');
  await page.locator('.bottom-nav').getByRole('button', { name: '我的' }).click();
  await expect(page.getByText('登录后保存记录')).toBeVisible();
  await page.getByRole('button', { name: '注册账号' }).click();
  await expect(page.getByRole('heading', { name: '登录糖糖记录本' })).toBeVisible();
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

test('supports the blood pressure monitoring flow with optional pulse', async ({ page }) => {
  const { token } = await registerByApi(page, uniqueUsername('pressure'));
  await page.request.delete('/api/blood-pressure-records', {
    headers: authHeaders(token)
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: /记录血压/ })).toBeVisible();

  await page.getByRole('button', { name: /记录血压/ }).click();
  await expect(page.getByRole('heading', { name: '记录一次血压' })).toBeVisible();
  await page.getByLabel('收缩压').fill('118');
  await page.getByLabel('舒张压').fill('76');
  await page.getByLabel('测量时间').fill('2026-05-27T07:30');
  await page.locator('.sheet').getByLabel('备注').fill('早起血压');
  await page.getByRole('button', { name: /保存血压/ }).click();

  await expect(page.getByText('血压已保存')).toBeVisible();
  await expect(page.getByText('118/76').first()).toBeVisible();
  await expect(page.getByText('未记录心率').first()).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '首页' }).click();
  await expect(page.getByText('最近血压')).toBeVisible();
  await expect(page.getByRole('heading', { name: '118/76' })).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '记录' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '血压记录' }).click();
  await page.getByText('早起血压').click();
  await expect(page.getByText('血压详情')).toBeVisible();
  await expect(page.locator('.detail-sheet').getByText('未记录心率')).toBeVisible();

  await page.getByRole('button', { name: /编辑/ }).click();
  await page.getByLabel('收缩压').fill('121');
  await page.getByLabel('舒张压').fill('79');
  await page.getByLabel('心率').fill('72');
  await page.getByRole('button', { name: /保存血压/ }).click();
  await expect(page.getByText('血压已更新')).toBeVisible();
  await expect(page.getByText('121/79').first()).toBeVisible();
  await expect(page.getByText('心率 72 bpm').first()).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '曲线' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '血压趋势' }).click();
  await expect(page.locator('.pressure-systolic-line')).toBeVisible();
  await expect(page.locator('.pressure-diastolic-line')).toBeVisible();
  await expect(page.getByText('收缩压', { exact: true })).toBeVisible();
  await expect(page.getByText('舒张压', { exact: true })).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '导出' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '血压报告' }).click();
  await expect(page.getByText('血压记录汇总')).toBeVisible();
  await expect(page.locator('.report-list')).toContainText('121/79 mmHg');

  const imageDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出图片/ }).click();
  await expect((await imageDownload).suggestedFilename()).toMatch(/^血压记录-\d+\.png$/);

  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出 PDF/ }).click();
  await expect((await pdfDownload).suggestedFilename()).toMatch(/^血压记录-\d+\.pdf$/);

  await page.locator('.bottom-nav').getByRole('button', { name: '记录' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '血压记录' }).click();
  const pressureRecord = page.locator('.record-card').filter({ hasText: '早起血压' });
  await pressureRecord.getByRole('button', { name: /删除/ }).click();
  await expect(page.getByText('删除这条血压？')).toBeVisible();
  await page.locator('.confirm-box').getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('血压已删除')).toBeVisible();
  await expect(page.getByText('还没有血压记录')).toBeVisible();
});

test('supports the weight record flow with chart and export', async ({ page }) => {
  const { token } = await registerByApi(page, uniqueUsername('weight'));
  await page.request.delete('/api/weight-records', {
    headers: authHeaders(token)
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: /记录体重/ })).toBeVisible();

  await page.getByRole('button', { name: /记录体重/ }).click();
  await expect(page.getByRole('heading', { name: '记录一次体重' })).toBeVisible();
  await page.locator('.sheet').getByLabel('体重').fill('62.4');
  await page.getByLabel('测量时间').fill('2026-05-27T07:30');
  await page.locator('.sheet').getByLabel('备注').fill('晨起体重');
  await page.getByRole('button', { name: /保存体重/ }).click();

  await expect(page.getByText('体重已保存')).toBeVisible();
  await expect(page.getByText('62.4').first()).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '首页' }).click();
  await expect(page.getByText('最近体重')).toBeVisible();
  await expect(page.getByRole('heading', { name: '62.4 kg' })).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '记录' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '体重记录' }).click();
  await page.getByText('晨起体重').click();
  await expect(page.getByText('体重详情')).toBeVisible();

  await page.getByRole('button', { name: /编辑/ }).click();
  await page.locator('.sheet').getByLabel('体重').fill('61.9');
  await page.getByRole('button', { name: /保存体重/ }).click();
  await expect(page.getByText('体重已更新')).toBeVisible();
  await expect(page.getByText('61.9').first()).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '曲线' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '体重趋势' }).click();
  await expect(page.locator('.weight-line')).toBeVisible();
  await page.locator('.chart-hit-area').first().hover();
  await expect(page.getByText('体重 61.9 kg')).toBeVisible();
  await expect(page.getByText(/记录时间/)).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '导出' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '体重报告' }).click();
  await expect(page.getByText('体重记录汇总')).toBeVisible();
  await expect(page.locator('.report-list')).toContainText('61.9 kg');

  const imageDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出图片/ }).click();
  await expect((await imageDownload).suggestedFilename()).toMatch(/^体重记录-\d+\.png$/);

  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出 PDF/ }).click();
  await expect((await pdfDownload).suggestedFilename()).toMatch(/^体重记录-\d+\.pdf$/);

  await page.locator('.bottom-nav').getByRole('button', { name: '记录' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '体重记录' }).click();
  const weightRecord = page.locator('.record-card').filter({ hasText: '晨起体重' });
  await weightRecord.getByRole('button', { name: /删除/ }).click();
  await expect(page.getByText('删除这条体重？')).toBeVisible();
  await page.locator('.confirm-box').getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('体重已删除')).toBeVisible();
  await expect(page.getByText('还没有体重记录')).toBeVisible();
});

test('opens the system save sheet for image export when file sharing is available', async ({ page }) => {
  const { token } = await registerByApi(page, uniqueUsername('share'));
  await page.request.post('/api/records', {
    headers: authHeaders(token),
    data: {
      value: 6.3,
      period: '早餐后',
      measuredAt: '2026-05-27T08:10',
      note: '保存到相册'
    }
  });
  await page.addInitScript(() => {
    window.__sharedGlucoseImage = null;
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data) => Array.isArray(data?.files) && data.files.length === 1 && data.files[0]?.type === 'image/png'
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        const file = data.files[0];
        window.__sharedGlucoseImage = {
          title: data.title,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        };
      }
    });
  });

  await page.goto('/');
  await page.locator('.bottom-nav').getByRole('button', { name: '导出' }).click();
  await page.getByRole('button', { name: /导出图片/ }).click();
  await page.waitForFunction(() => window.__sharedGlucoseImage?.fileSize > 0);

  const sharedImage = await page.evaluate(() => window.__sharedGlucoseImage);
  expect(sharedImage.title).toBe('血糖记录');
  expect(sharedImage.fileName).toMatch(/^血糖记录-\d+\.png$/);
  expect(sharedImage.fileType).toBe('image/png');
  expect(sharedImage.fileSize).toBeGreaterThan(1000);
  await expect(page.getByText('请在系统面板中选择保存图片')).toBeVisible();
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

  await page.locator('.bottom-nav').getByRole('button', { name: '曲线' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '饮食趋势' }).click();
  await expect(page.getByText('饮食记录频次')).toBeVisible();
  await expect(page.locator('.food-frequency-chart')).toBeVisible();
  await expect(page.getByText('时间轴')).toBeVisible();
  await expect(page.getByText('杂粮饼半个，鸡蛋一个')).toBeVisible();

  await page.locator('.bottom-nav').getByRole('button', { name: '导出' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '饮食报告' }).click();
  await expect(page.getByText('饮食记录汇总')).toBeVisible();
  await expect(page.locator('.food-report-list')).toContainText('杂粮饼半个，鸡蛋一个');
  await expect(page.locator('.food-report-thumb img')).toBeVisible();

  const imageDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出图片/ }).click();
  await expect((await imageDownload).suggestedFilename()).toMatch(/^饮食记录-\d+\.png$/);

  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出 PDF/ }).click();
  await expect((await pdfDownload).suggestedFilename()).toMatch(/^饮食记录-\d+\.pdf$/);

  await page.locator('.bottom-nav').getByRole('button', { name: '记录' }).click();
  await page.locator('.record-switch').getByRole('button', { name: '饮食记录' }).click();
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
