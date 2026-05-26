import { expect, test } from '@playwright/test';

const authHeaders = { 'x-user-id': 'wife-user' };

test('supports the full blood glucose record flow', async ({ page }) => {
  await page.request.delete('/api/records', {
    headers: authHeaders
  });
  await page.request.post('/api/records', {
    headers: authHeaders,
    data: {
      value: 5.8,
      period: '早餐后',
      measuredAt: '2026-05-25T08:10',
      note: '早餐后保留记录'
    }
  });
  await page.request.post('/api/records', {
    headers: authHeaders,
    data: {
      value: 6.1,
      period: '午餐后',
      measuredAt: '2026-05-25T13:20',
      note: '午餐后保留记录'
    }
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '糖糖记录本' })).toBeVisible();
  await expect(page.getByText('最近血糖曲线')).toBeVisible();

  await page.getByRole('button', { name: /记录一次血糖/ }).click();
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
  await expect(page.getByText('我的老婆的记录设置')).toBeVisible();
  await expect(page.getByText('使用人')).toBeVisible();
  await expect(page.getByText('我的老婆', { exact: true })).toBeVisible();

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
  await page.request.delete('/api/records', {
    headers: authHeaders
  });

  await page.route('**/api/records', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });

  await page.goto('/');
  await page.getByRole('button', { name: /记录一次血糖/ }).click();
  await page.getByLabel(/血糖值/).fill('6.2');
  await page.getByLabel(/测量时段/).selectOption('早餐后');
  await page.locator('input[type="datetime-local"]').fill('2026-05-26T07:30');
  await page.getByLabel(/备注/).fill('重复点击保护');

  await page.getByRole('button', { name: /保存记录/ }).dblclick();
  await expect(page.getByText('记录已保存')).toBeVisible();

  const response = await page.request.get('/api/records', {
    headers: authHeaders
  });
  const body = await response.json();
  const matchingRecords = body.records.filter((record) => record.note === '重复点击保护');
  expect(matchingRecords).toHaveLength(1);
});
