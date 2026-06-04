# 血压监测模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有血糖记录网站增加登录用户可用的血压监测模块，心率字段可选。

**Architecture:** 血压作为独立资源接入，不重构血糖和饮食记录。后端新增仓库、Prisma 模型和 `/api/blood-pressure-records` 接口；前端新增血压工具函数、API 封装、表单、列表、首页摘要、趋势图和导出报告。

**Tech Stack:** Vue 3、Vite、Express、Zod、Prisma、Vitest、Supertest、Playwright。

---

### Task 1: 血压记录工具函数

**Files:**
- Modify: `src/lib/records.js`
- Test: `tests/records.test.js`

- [ ] **Step 1: Write the failing test**

```js
import {
  applyBloodPressureRecordMutation,
  createBloodPressureRecord,
  deleteBloodPressureRecord,
  getBloodPressureStats,
  getLatestBloodPressureRecord,
  sortBloodPressureRecordsByTime
} from '../src/lib/records.js';

it('creates, sorts, summarizes, edits, and deletes blood pressure records with optional pulse', () => {
  const records = [
    createBloodPressureRecord({ id: 'old', systolic: 128, diastolic: 82, measuredAt: '2026-05-19T07:20', note: '早起' }),
    createBloodPressureRecord({ id: 'new', systolic: 118, diastolic: 76, pulse: 72, measuredAt: '2026-05-25T09:30', note: '早餐后' }),
    createBloodPressureRecord({ id: 'mid', systolic: 122, diastolic: 80, pulse: 75, measuredAt: '2026-05-21T22:00', note: '' })
  ];

  expect(sortBloodPressureRecordsByTime(records).map((record) => record.id)).toEqual(['new', 'mid', 'old']);
  expect(getLatestBloodPressureRecord(records).id).toBe('new');
  expect(getBloodPressureStats(records)).toEqual({
    count: 3,
    averageSystolic: 121,
    averageDiastolic: 79,
    highestSystolic: 128,
    lowestDiastolic: 76,
    averagePulse: 74
  });

  const added = applyBloodPressureRecordMutation(records, createBloodPressureRecord({
    id: 'added',
    systolic: 116,
    diastolic: 74,
    measuredAt: '2026-05-26T13:15',
    note: '午后'
  }));

  expect(records).toHaveLength(3);
  expect(getLatestBloodPressureRecord(added).id).toBe('added');
  expect(deleteBloodPressureRecord(added, 'added').map((record) => record.id)).toEqual(['new', 'mid', 'old']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/records.test.js`

Expected: FAIL because blood pressure utility exports do not exist.

- [ ] **Step 3: Write minimal implementation**

Add blood pressure create, sort, latest, stats, mutation, delete helpers to `src/lib/records.js`. `pulse` should become `null` when omitted.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/records.test.js`

Expected: PASS.

### Task 2: 后端血压 API

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `server/app.js`
- Modify: `server/index.js`
- Create: `server/repositories/memoryBloodPressureRecordRepository.js`
- Create: `server/repositories/prismaBloodPressureRecordRepository.js`
- Test: `tests/api.test.js`

- [ ] **Step 1: Write failing API tests**

Add tests for auth requirement, create/list/update/delete, user isolation, invalid payload rejection, and optional pulse under `/api/blood-pressure-records`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api.test.js`

Expected: FAIL with missing route or missing repository wiring.

- [ ] **Step 3: Write minimal implementation**

Add `BloodPressureRecord` Prisma model; add memory and Prisma repositories; wire `bloodPressureRecordRepository` into `createApp`; add Zod schema with `pulse` optional and numeric range validation when provided.

- [ ] **Step 4: Run API test to verify it passes**

Run: `npm test -- tests/api.test.js`

Expected: PASS.

### Task 3: 前端 API 和界面接入

**Files:**
- Modify: `src/lib/api.js`
- Modify: `src/App.vue`
- Modify: `src/styles.css`

- [ ] **Step 1: Add client API wrappers**

Add list/create/update/delete/clear wrappers for `/blood-pressure-records`.

- [ ] **Step 2: Add UI state and load flow**

Load `bloodPressureRecords` with existing records and food records; clear it on auth failures and logout.

- [ ] **Step 3: Add visible module entry points**

Add home summary, `记录血压` action, records tab option, blood pressure list/detail/form, chart type switch, and export report switch.

- [ ] **Step 4: Preserve guest save behavior**

Saving a blood pressure form while logged out opens the existing auth modal and keeps form values.

### Task 4: E2E and final verification

**Files:**
- Modify: `e2e/app-flow.spec.js`
- Modify: `README.md`

- [ ] **Step 1: Write e2e coverage**

Add a full blood pressure flow: register, create record without pulse, see home summary, open list detail, edit with pulse, see blood pressure chart, export report, delete.

- [ ] **Step 2: Run e2e to verify it fails before full UI wiring**

Run: `npm run test:e2e -- e2e/app-flow.spec.js`

Expected: FAIL until UI wiring is complete.

- [ ] **Step 3: Update README**

Document blood pressure records as a supported feature.

- [ ] **Step 4: Final verification**

Run:

```bash
npm test
npm run build
npm run test:e2e -- e2e/app-flow.spec.js
```

Expected: all PASS.
