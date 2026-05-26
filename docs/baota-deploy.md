# 宝塔部署说明

## 推荐架构

- Nginx：托管 `dist` 静态前端，并把 `/api` 反向代理到 Node API。
- Node API：用 PM2 常驻运行 `server/index.js`，监听 `127.0.0.1:3001`。
- MySQL：如果数据库就在同一台服务器，`DATABASE_URL` 主机建议用 `127.0.0.1`，不要走公网 IP。

## 宝塔准备

在宝塔软件商店安装：

- Nginx
- PM2 管理器
- Node.js 20 或 22
- MySQL（如果数据库也放这台服务器）

安全组/防火墙只开放：

- `80`
- `443`

不要对公网开放 `3001`，它只给 Nginx 反向代理访问。

## 上传项目

建议目录：

```bash
/www/wwwroot/tangtang-glucose-h5
```

进入项目目录：

```bash
cd /www/wwwroot/tangtang-glucose-h5
npm install
```

创建 `.env`：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
DATABASE_URL="mysql://数据库用户名:数据库密码@127.0.0.1:3306/tang"
PORT=3001
DEFAULT_USER_ID="wife-user"
```

如果 MySQL 不在同一台服务器，把 `127.0.0.1` 换成真实数据库主机。

## 同步数据库表

如果数据库用户没有 `CREATE DATABASE` 权限，用：

```bash
npm run db:push
```

如果数据库用户有完整迁移权限，可以用：

```bash
npm run db:migrate
```

## 构建前端

```bash
npm run build
```

宝塔网站根目录设置为：

```bash
/www/wwwroot/tangtang-glucose-h5/dist
```

## 启动 Node API

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs --env production
pm2 save
```

检查：

```bash
curl http://127.0.0.1:3001/api/health
```

应返回：

```json
{"ok":true,"storage":"mysql"}
```

## 配置 Nginx

在宝塔：

1. 网站
2. 选择站点
3. 配置文件
4. 把 `deploy/nginx-baota.conf` 里的两个 `location` 块放进当前 `server { ... }` 中
5. 保存并重载 Nginx

检查线上：

```bash
curl https://你的域名/api/health
```

## 更新发布

每次上传新代码后：

```bash
cd /www/wwwroot/tangtang-glucose-h5
npm install
npm run db:push
npm run build
pm2 restart tangtang-glucose-api
```

## 注意

- 数据库密码只放 `.env` 或宝塔环境变量，不要提交到代码。
- 如果之前把数据库密码发到多人可见的地方，建议在宝塔/数据库里更换一次密码。
- 如果 Node API 和 MySQL 部署在同一台服务器，使用 `127.0.0.1` 通常比公网 IP 更快、更稳。
