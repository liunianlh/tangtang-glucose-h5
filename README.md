# 糖糖记录本

血糖记录 H5 应用。当前前端为 Vue 3 + Vite，后端为 Node.js + Express，正式数据层预留 MySQL + Prisma。

## 技术栈

- 前端：Vue 3、Vite、SVG 自绘曲线、html2canvas、jsPDF
- 后端：Node.js、Express、Zod
- 数据库：MySQL 8 推荐，Prisma ORM
- 测试：Vitest、Playwright

## 本地开发

安装依赖：

```bash
npm install
```

启动前端和 API：

```bash
npm run dev:full
```

访问：

```text
http://localhost:5173/
```

说明：`dev:full` 默认使用内存数据仓库，方便没有配置 MySQL 时也能开发前端和 API。

## 连接 MySQL

复制环境变量示例：

```bash
cp .env.example .env
```

修改 `.env`：

```env
DATABASE_URL="mysql://glucose_user:glucose_password@localhost:3306/glucose_records"
PORT=3001
DEFAULT_USER_ID="wife-user"
```

生成 Prisma Client：

```bash
npm run db:generate
```

创建/更新数据库表：

```bash
npm run db:migrate
```

启动 MySQL API：

```bash
npm run api
```

再启动前端：

```bash
npm run dev -- --port 5173
```

## API

- `GET /api/health`
- `GET /api/records`
- `POST /api/records`
- `PUT /api/records/:id`
- `DELETE /api/records/:id`
- `DELETE /api/records`

请求头暂时使用：

```text
x-user-id: wife-user
```

后续接账号登录后会替换成真实鉴权上下文。

## 验证

```bash
npm test
npm run build
npm run test:e2e
```

## 宝塔部署

见 [docs/baota-deploy.md](docs/baota-deploy.md)。
