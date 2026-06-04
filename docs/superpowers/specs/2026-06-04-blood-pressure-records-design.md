# Blood Pressure Records Design

## Context

The app currently records blood glucose and food entries for authenticated users. Blood glucose uses JSON CRUD endpoints, local utility helpers, trend charts, and PNG/PDF report export. Food records use a separate resource with multipart image upload.

This feature adds blood pressure records as a first-class health record type while keeping the existing blood glucose and food flows intact.

## Goals

- Let logged-in users create, edit, delete, and view blood pressure records.
- Store blood pressure data on the server with the same per-user isolation as existing records.
- Show the latest blood pressure reading on the home page.
- Add a blood pressure trend chart.
- Add a blood pressure export report with image and PDF export.
- Keep guest behavior consistent with current glucose and food flows: users may open the form, but saving requires login.

## Non-Goals

- No medical diagnosis or blood pressure grading advice.
- No medication, symptoms, posture, arm side, or measurement location fields.
- No combined "all health records" timeline.
- No rewrite of the existing glucose record model into a generic health record model.
- No pulse-only chart line in this iteration.

## Data Model

Add a Prisma model named `BloodPressureRecord`.

Fields:

- `id`: string primary key
- `userId`: owning user id
- `systolic`: integer, mmHg
- `diastolic`: integer, mmHg
- `pulse`: integer, bpm
- `measuredAt`: datetime
- `note`: string, max 500 characters
- `createdAt`: datetime
- `updatedAt`: datetime

Relations and indexes:

- Belongs to `User`
- Cascade delete with user
- Index on `[userId, measuredAt]`
- Database table name: `blood_pressure_records`

Validation:

- `systolic`: 50 to 260
- `diastolic`: 30 to 180
- `pulse`: 30 to 220
- `measuredAt`: valid datetime string
- `note`: optional, trimmed, max 500 characters

## Backend Design

Add an independent blood pressure repository, matching existing glucose repository patterns.

Repository methods:

- `listBloodPressureRecords(userId)`
- `createBloodPressureRecord(userId, input)`
- `updateBloodPressureRecord(userId, id, input)`
- `deleteBloodPressureRecord(userId, id)`
- `clearBloodPressureRecords(userId)`

Implement both:

- `server/repositories/memoryBloodPressureRecordRepository.js`
- `server/repositories/prismaBloodPressureRecordRepository.js`

Add routes:

- `GET /api/blood-pressure-records`
- `POST /api/blood-pressure-records`
- `PUT /api/blood-pressure-records/:id`
- `DELETE /api/blood-pressure-records/:id`
- `DELETE /api/blood-pressure-records`

Errors:

- Invalid payload returns `400` with `INVALID_BLOOD_PRESSURE_RECORD`
- Missing auth returns existing `401 UNAUTHORIZED`
- Updating or deleting another user's record returns `404 BLOOD_PRESSURE_RECORD_NOT_FOUND`

`DELETE /api/records` continues to clear only glucose records. The existing profile "清空全部记录" action should call glucose, blood pressure, and food clear endpoints because its UI meaning is account-wide cleanup.

## Frontend Design

Add blood pressure API helpers to `src/lib/api.js`:

- `listBloodPressureRecords`
- `createBloodPressureRecordOnServer`
- `updateBloodPressureRecordOnServer`
- `deleteBloodPressureRecordOnServer`
- `clearBloodPressureRecordsOnServer`

Add blood pressure utility helpers to `src/lib/records.js`:

- `createBloodPressureRecord`
- `sortBloodPressureRecordsByTime`
- `getLatestBloodPressureRecord`
- `getBloodPressureStats`
- `applyBloodPressureRecordMutation`
- `deleteBloodPressureRecord`

Stats should include:

- `count`
- average systolic
- average diastolic
- highest systolic
- lowest diastolic
- average pulse

### Home

Add a "最近血压" summary area near the existing health summary content.

Display:

- latest reading as `120/80`
- unit `mmHg`
- pulse as `心率 72 bpm`
- measured time and note if present

Add a `记录血压` action beside existing `记录血糖` and `记录饮食` actions. Use the existing button and icon style so the page still feels like the same app.

### Records

Change record type switch from:

- `血糖记录`
- `饮食记录`

to:

- `血糖记录`
- `血压记录`
- `饮食记录`

For blood pressure records:

- List card shows date/time, `120/80 mmHg`, `心率 72 bpm`, and note.
- Detail sheet shows the same reading, pulse, time, note, edit, and delete.
- Form fields are systolic, diastolic, pulse, measuredAt, note.
- Save behavior matches glucose: if not logged in, show login modal and preserve the form.

### Chart

Add a chart type switch:

- `血糖趋势`
- `血压趋势`

Blood pressure chart:

- Two line series: systolic and diastolic.
- Shared x-axis by `measuredAt`.
- Tooltip shows systolic, diastolic, pulse, and measured time.
- Empty state says records will appear after adding blood pressure readings.

The current glucose reference line remains only on the glucose chart. Blood pressure chart will not add medical threshold lines in this iteration.

### Export

Add a report type switch:

- `血糖报告`
- `血压报告`

Blood pressure report includes:

- user display name or guest preview label
- record count
- average systolic/diastolic
- average pulse
- blood pressure trend chart
- all blood pressure records

Existing export functions can stay generic by rendering the selected report area with `html2canvas` and `jsPDF`. File names should use `血压记录-<timestamp>.png` and `血压记录-<timestamp>.pdf` for blood pressure exports.

## Testing Plan

Unit tests:

- blood pressure helper creation, sorting, latest record, stats, mutation, deletion

API tests:

- authentication required for blood pressure endpoints
- create, list, update, delete for current user
- records isolated between users
- invalid blood pressure payload rejected

E2E tests:

- full blood pressure record flow: create, edit, detail, delete
- blood pressure appears on home summary
- blood pressure chart renders with two line series
- blood pressure report exports PNG/PDF
- guest save opens login modal

Regression checks:

- existing glucose flow still passes
- existing food flow still passes
- build still passes

## Migration and Deployment

Prisma schema change requires generating and applying a database migration before production deploy.

Local development can still use the memory repository without MySQL. Existing glucose and food data are not modified by the new schema.

## Scope Control

This implementation should follow existing project patterns and avoid a broad architecture rewrite. The main expected touch points are:

- `prisma/schema.prisma`
- `server/app.js`
- `server/index.js`
- new blood pressure repositories
- `src/lib/api.js`
- `src/lib/records.js`
- `src/App.vue`
- `src/styles.css`
- `tests/records.test.js`
- `tests/api.test.js`
- `e2e/app-flow.spec.js`
- `README.md`

