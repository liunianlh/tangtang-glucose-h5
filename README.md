# 糖糖记录本

血糖、血压和饮食记录 H5 应用。当前前端为 Vue 3 + Vite，后端为 Node.js + Express，正式数据层预留 MySQL + Prisma。

## 技术栈

- 前端：Vue 3、Vite、SVG 自绘血糖/血压曲线、html2canvas、jsPDF
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
AUTH_SECRET="please-change-this-to-a-long-random-string"
FOOD_UPLOAD_DIR="uploads/food-images"
```

`AUTH_SECRET` 用来签发登录令牌，线上部署时请换成足够长的随机字符串。
`FOOD_UPLOAD_DIR` 是饮食图片的服务器本地保存目录，默认会放在项目下的 `uploads/food-images`，请不要提交到 Git。

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
- `GET /api/auth/captcha`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/records`
- `POST /api/records`
- `PUT /api/records/:id`
- `DELETE /api/records/:id`
- `DELETE /api/records`
- `GET /api/blood-pressure-records`
- `POST /api/blood-pressure-records`
- `PUT /api/blood-pressure-records/:id`
- `DELETE /api/blood-pressure-records/:id`
- `DELETE /api/blood-pressure-records`
- `GET /api/food-records`
- `POST /api/food-records`
- `PUT /api/food-records/:id`
- `DELETE /api/food-records/:id`
- `DELETE /api/food-records`
- `GET /api/food-images/:key`

注册示例：

```json
{
  "username": "tangtang",
  "password": "12345678",
  "displayName": "糖糖",
  "captchaToken": "<GET /api/auth/captcha 返回的 token>",
  "captchaAnswer": "8"
}
```

注册和登录前先调用 `GET /api/auth/captcha` 获取题目和 `captchaToken`，提交账号信息时带上用户填写的 `captchaAnswer`。登录成功后会返回 `token`。血糖、血压和饮食记录接口需要带上：

```text
Authorization: Bearer <token>
```

## 验证

```bash
npm test
npm run build
npm run test:e2e
```

## 宝塔部署

见 [docs/baota-deploy.md](docs/baota-deploy.md)。
