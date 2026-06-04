# 血压记录功能设计文档

## 背景

当前应用已经支持登录用户记录血糖和饮食。

现有血糖功能包含：

- JSON 格式的增删改查接口
- 前端记录工具函数
- 首页摘要
- 趋势曲线
- 图片和 PDF 导出报告

现有饮食功能包含：

- 独立饮食记录资源
- 图片上传和图片读取
- 前端列表、详情、编辑、删除

这次新增血压记录功能，需要把血压作为独立的一类健康记录接入，同时不重构现有血糖和饮食功能。

## 目标

- 登录用户可以新增、编辑、删除、查看血压记录。
- 血压数据保存在后端，并和现有记录一样按用户隔离。
- 首页展示最近一次血压。
- 曲线页支持查看血压趋势。
- 导出页支持血压报告，并可导出图片和 PDF。
- 未登录体验和当前血糖、饮食一致：可以先打开表单，保存时要求登录。

## 不做的内容

- 不做医学诊断或血压分级建议。
- 不增加用药、症状、测量姿势、左手右手、测量地点等字段。
- 不做“所有健康记录”的混合时间线。
- 不把现有血糖表重构成通用健康记录表。
- 心率本次只作为血压记录的一部分展示，不单独画第三条趋势线。

## 数据模型

新增 Prisma 模型：`BloodPressureRecord`。

字段：

- `id`：主键
- `userId`：所属用户
- `systolic`：收缩压，单位 `mmHg`
- `diastolic`：舒张压，单位 `mmHg`
- `pulse`：心率，单位 `bpm`，可选
- `measuredAt`：测量时间
- `note`：备注，最多 500 字
- `createdAt`：创建时间
- `updatedAt`：更新时间

关系和索引：

- 归属于 `User`
- 用户删除时级联删除血压记录
- 增加 `[userId, measuredAt]` 索引
- 数据库表名使用 `blood_pressure_records`

字段校验：

- 收缩压：`50-260`
- 舒张压：`30-180`
- 心率：可选；填写时必须是 `30-220`
- 测量时间：必须是合法日期时间
- 备注：可选，去掉首尾空格，最多 500 字

## 后端设计

新增独立血压记录仓库，结构跟现有血糖仓库保持一致。

仓库方法：

- `listBloodPressureRecords(userId)`
- `createBloodPressureRecord(userId, input)`
- `updateBloodPressureRecord(userId, id, input)`
- `deleteBloodPressureRecord(userId, id)`
- `clearBloodPressureRecords(userId)`

新增两个实现：

- `server/repositories/memoryBloodPressureRecordRepository.js`
- `server/repositories/prismaBloodPressureRecordRepository.js`

新增接口：

- `GET /api/blood-pressure-records`
- `POST /api/blood-pressure-records`
- `PUT /api/blood-pressure-records/:id`
- `DELETE /api/blood-pressure-records/:id`
- `DELETE /api/blood-pressure-records`

错误约定：

- 参数不合法：返回 `400 INVALID_BLOOD_PRESSURE_RECORD`
- 未登录：沿用现有 `401 UNAUTHORIZED`
- 编辑或删除别人的记录：返回 `404 BLOOD_PRESSURE_RECORD_NOT_FOUND`

`DELETE /api/records` 仍然只清空血糖记录。个人中心里的“清空全部记录”按钮语义是清空当前用户的全部数据，所以前端需要同时调用清空血糖、血压、饮食三个接口。

## 前端设计

在 `src/lib/api.js` 增加血压接口方法：

- `listBloodPressureRecords`
- `createBloodPressureRecordOnServer`
- `updateBloodPressureRecordOnServer`
- `deleteBloodPressureRecordOnServer`
- `clearBloodPressureRecordsOnServer`

在 `src/lib/records.js` 增加血压记录工具函数：

- `createBloodPressureRecord`
- `sortBloodPressureRecordsByTime`
- `getLatestBloodPressureRecord`
- `getBloodPressureStats`
- `applyBloodPressureRecordMutation`
- `deleteBloodPressureRecord`

血压统计包含：

- 记录数
- 平均收缩压
- 平均舒张压
- 最高收缩压
- 最低舒张压
- 平均心率（仅统计已填写心率的记录）

## 首页

首页增加“最近血压”摘要区。

展示内容：

- 最近一次读数，例如 `120/80`
- 单位 `mmHg`
- 心率；已填写时展示 `心率 72 bpm`，未填写时不展示
- 测量时间
- 有备注时展示备注，没有备注时展示空状态文案

首页操作区增加 `记录血压` 按钮，和现有 `记录血糖`、`记录饮食` 放在一起。视觉风格沿用现有按钮样式，不做新的设计体系。

## 记录页

记录类型切换从：

- `血糖记录`
- `饮食记录`

扩展为：

- `血糖记录`
- `血压记录`
- `饮食记录`

血压记录列表展示：

- 日期和时间
- 血压值，例如 `120/80 mmHg`
- 心率；未填写时展示 `未记录心率`
- 备注

血压详情弹层展示：

- 血压值
- 心率（可选）
- 测量时间
- 备注
- 编辑按钮
- 删除按钮

血压表单字段：

- 收缩压
- 舒张压
- 心率（可选）
- 测量时间
- 备注

保存逻辑和血糖一致：未登录时弹出登录窗口，并保留当前表单内容。

## 曲线页

曲线页增加图表类型切换：

- `血糖趋势`
- `血压趋势`

血压趋势图展示两条线：

- 收缩压
- 舒张压

横轴使用测量时间。

提示浮层展示：

- 收缩压
- 舒张压
- 心率
- 测量时间

当前血糖参考线只保留在血糖图上。血压图本次不加医学阈值线，避免误导。

## 导出页

导出页增加报告类型切换：

- `血糖报告`
- `血压报告`

血压报告内容：

- 使用人
- 血压记录数
- 平均收缩压和平均舒张压
- 平均心率（没有心率数据时展示为空状态）
- 血压趋势图
- 全部血压记录列表

导出逻辑继续复用现有 `html2canvas` 和 `jsPDF` 流程，只是根据当前报告类型渲染不同报告内容。

血压导出文件名：

- 图片：`血压记录-<timestamp>.png`
- PDF：`血压记录-<timestamp>.pdf`

## 测试计划

单元测试：

- 创建血压记录
- 按时间排序
- 获取最近一次血压
- 计算血压统计
- 新增和编辑记录时不修改原数组
- 删除血压记录

API 测试：

- 血压接口需要登录
- 当前用户可以新增、查看、编辑、删除血压记录
- 不同用户之间血压记录隔离
- 不合法血压参数会被拒绝

端到端测试：

- 完整血压记录流程：新增、查看详情、编辑、删除
- 首页能看到最近血压摘要
- 曲线页能看到血压趋势图的两条线
- 导出页能导出血压图片和 PDF
- 未登录保存血压时弹出登录窗口

回归验证：

- 原有血糖完整流程仍然通过
- 原有饮食流程仍然通过
- 构建仍然通过

## 迁移和部署

Prisma schema 变更后，正式环境需要生成并执行数据库迁移。

本地开发仍可继续使用内存仓库，不要求本地必须配置 MySQL。

新增血压表不会修改现有血糖和饮食数据。

## 改动范围

这次实现应该沿用现有项目模式，避免大范围重构。

预计改动文件：

- `prisma/schema.prisma`
- `server/app.js`
- `server/index.js`
- 新增血压记录仓库文件
- `src/lib/api.js`
- `src/lib/records.js`
- `src/App.vue`
- `src/styles.css`
- `tests/records.test.js`
- `tests/api.test.js`
- `e2e/app-flow.spec.js`
- `README.md`
