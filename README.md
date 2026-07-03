# 柬凯内部管理系统

服装贸易内部管理系统，包含 **报价模块** 与 **排产模块**（款式预警、生产排单、关账管理）。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Ant Design + Recharts |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | PostgreSQL |
| 文件存储 | 本地存储（支持图片 Sharp 压缩） |
| Excel | exceljs 模板填充 |

## 快速开始

### 1. 启动 PostgreSQL

项目 Docker 数据库映射到本机 **5433** 端口（容器内仍为 5432），用于避免与 Windows 本机 PostgreSQL 默认的 **5432** 端口冲突。

```bash
docker ps -a | grep jiankai-postgres   # 已有容器则 docker start，无需重复 up -d
docker compose up -d                  # 仅首次或容器不存在时
```

若提示容器名 `jiankai-postgres` 已被占用，说明容器已存在，**先启动而非删除**：

```bash
docker ps -a | grep jiankai-postgres
docker start jiankai-postgres        # 或：docker compose start
```

仅当必须重建容器时：`docker rm -f jiankai-postgres && docker compose up -d`（数据卷一般保留）。详见 **[服务器运维命令速查](#服务器运维命令速查)**。

启动后可用 `docker ps` 确认端口映射为 `0.0.0.0:5433->5432/tcp`。

### 2. 安装依赖

```bash
npm run install:all
```

### 3. 配置环境变量

```bash
cp backend/.env.example backend/.env
```

确认 `backend/.env` 中 `DATABASE_URL` 使用端口 **5433**：

```
DATABASE_URL=postgresql://jiankai:jiankai123@localhost:5433/jiankai_quotation
```

### 4. 初始化数据库

```bash
npm run db:init
npm run db:seed
npm run db:migrate
```

可选：排产演示数据、权限种子

```bash
npm run db:seed-scheduling
npm run db:seed-auth
```

### 5. 启动开发服务

```bash
npm run dev
```

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001
- Swagger 文档: http://localhost:3001/api-docs

## 项目结构

```
camkaxin/
├── backend/                 # Express 后端
│   ├── migrations/          # 数据库增量迁移（含关账锁定等）
│   ├── src/
│   │   ├── config/          # 数据库配置
│   │   ├── db/              # Schema、种子数据
│   │   ├── middleware/      # 认证、文件上传
│   │   ├── routes/          # API 路由
│   │   ├── services/        # 业务逻辑
│   │   └── utils/           # 计算函数、字段元数据
│   ├── docs/API.md          # API 文档
│   └── uploads/             # 上传文件目录
├── frontend/                # React 前端
│   └── src/
│       ├── api/             # API 客户端
│       ├── components/      # 通用组件、排产组件
│       ├── layouts/         # 布局
│       ├── pages/
│       │   ├── quotations/  # 报价单
│       │   ├── scheduling/  # 排产（预警 / 排单 / 关账）
│       │   └── config/      # 系统配置
│       ├── types/           # 类型定义
│       └── utils/           # 前端计算、列偏好、关账工具
└── docker-compose.yml       # PostgreSQL
```

## 核心功能

### 报价模块

- **基础配置**: 品牌、业务员、面料库、辅料库、品牌基础辅料、全局汇率
- **报价单管理**: 创建 / 编辑 / 复制 / 版本修订，混合币种计算
- **智能排序**: 品牌 / 面料 / 辅料按最近使用优先
- **Excel 导出**: 模板占位符填充，支持分 Sheet 导出
- **权限**: RBAC 角色权限、字段级权限（`FieldPermission`）

### 排产模块

排产入口：`/scheduling`，含三个 Tab。

#### 款式预警

- **关账月区间筛选**：关账开始月 / 关账结束月，默认上个月起共 6 个月
- **搜索模式**：局部（当前筛选内）、全局（忽略关账月区间）、累计（勾选后模糊搜下一款）
- **字段筛选**、仅未排单、列设置、拖拽调宽、导出选中
- **款式详情**：从款号跳转编辑

#### 生产排单

- 待排单 / 生产组 / 外发 / 已下线 分区管理
- 上下线、所需天数联动，同组顺延
- 下线通知：下线日已过即提醒
- Tab 切换时：有待排单才展开待排单区，否则全折叠
- 列设置、拖拽调宽

#### 关账管理

- **柱状图**：区间内未关账 + 已关账月份销售产值（堆叠：正常订单 + 外发）；已关账月份更深蓝色；均值线标注含年度产值
- **月份区间**：关账开始月 / 关账结束月，默认 6 个月
- **搜索**：局部（区间内）/ 全局（全库未关账款式）
- **视图**：卡片 / 表格双视图；按关账月分组、产值降序
- **表格编辑**：关账月份、加工单价可改；复选框批量变更关账月
- **撤销 / 应用**：编辑步骤可撤销，确认后批量应用
- **关账锁定**：锁定后该月从主视图消失；「查看已关账」Drawer 可浏览并恢复
- **列设置**：与预警相同的全部字段 + 订单状态四态（外发 / 未上线 / 已上线 / 已下线）；列宽可拖拽，偏好持久化至 localStorage

## 常用 npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 前后端开发模式 |
| `npm run build:all` | 构建前后端 |
| `npm run start:prod` | 生产模式启动（后端托管前端） |
| `npm run db:init` | 初始化数据库 Schema |
| `npm run db:seed` | 报价模块种子数据 |
| `npm run db:migrate` | 执行增量迁移（**升级后必跑**） |
| `npm run db:seed-scheduling` | 排产演示款式 |
| `npm run db:seed-auth` | 用户与权限种子 |
| `npm test` | 后端 + 前端单元/集成测试 |
| `npm run test:backend` | 仅后端测试 |
| `npm run test:frontend` | 仅前端测试 |
| `npm run test:e2e` | Playwright 端到端测试（需数据库与 dev 服务） |

## 服务器运维命令速查

以下命令适用于 Linux 生产机（如宝塔 `/www/wwwroot/154.198.42.71` 或 `/opt/jiankai/camkaxin`）。**先将 `PROJECT_DIR` 换成你的实际项目路径。**

```bash
export PROJECT_DIR=/www/wwwroot/154.198.42.71
cd "$PROJECT_DIR"
```

### 何时需要 `docker compose up -d`

| 场景 | 是否需要 |
|------|----------|
| 首次部署 | ✅ 必须（创建数据库容器） |
| 日常发版（`git pull` + `build` + `pm2 restart`） | ❌ 容器已在跑则不需要 |
| 服务器重启后 | ⚠️ 先 `docker ps` 检查；容器未运行再执行 |
| 仅 `npm run build:all` | ❌ 不需要（构建不连库） |

### 首次部署 / 重新部署（全量）

```bash
cd "$PROJECT_DIR"

# 1. 数据库（见下文「数据库问题」若报容器名冲突）
docker compose up -d
docker ps    # 确认 jiankai-postgres，端口 5433->5432

# 2. 环境变量（首次必做）
cp backend/.env.example backend/.env
# 编辑 backend/.env：DATABASE_URL 端口 5433、CORS_ORIGIN、JWT_SECRET、ADMIN_INITIAL_PASSWORD 等

# 3. 依赖与库表
npm run install:all
npm run db:init
npm run db:seed
npm run db:migrate
npm run db:seed-auth
# 可选：npm run db:seed-scheduling

# 4. 构建
npm run build:all

# 5. 启动（PM2，首次）
cd backend
pm2 start dist/index.js --name jiankai-api
pm2 save
pm2 startup    # 按提示执行，实现开机自启

# 6. 验证
curl http://127.0.0.1:3001/api/health
pm2 logs jiankai-api --lines 30
```

生产 `backend/.env` 关键项示例：

```env
PORT=3001
DATABASE_URL=postgresql://jiankai:jiankai123@127.0.0.1:5433/jiankai_quotation
TZ=Asia/Shanghai
UPLOAD_DIR=./uploads
CORS_ORIGIN=http://你的域名或IP
STATIC_DIR=../frontend/dist
JWT_SECRET=至少32位随机字符串
ADMIN_INITIAL_PASSWORD=强密码
```

### 日常更新（已有环境，发新版）

```bash
cd "$PROJECT_DIR"

# 先确认数据库在跑（不在跑则 docker start jiankai-postgres 或 docker compose up -d）
docker ps | grep jiankai-postgres

git pull
npm run install:all
npm run db:migrate
npm run build:all

pm2 restart jiankai-api --update-env
```

**一行版：**

```bash
cd /www/wwwroot/154.198.42.71 && git pull && npm run install:all && npm run db:migrate && npm run build:all && pm2 restart jiankai-api --update-env
```

### 服务器重启后

```bash
cd "$PROJECT_DIR"

docker ps -a | grep jiankai-postgres
# 若状态为 Exited：
docker start jiankai-postgres
# 或：
docker compose start

pm2 restart jiankai-api --update-env
curl http://127.0.0.1:3001/api/health
```

### 数据库问题排查与修复

**1. 检查容器状态**

```bash
docker ps -a | grep jiankai-postgres
docker logs jiankai-postgres --tail 50
docker port jiankai-postgres
```

| 状态 | 处理 |
|------|------|
| `Up` | 正常，无需 `docker compose up -d` |
| `Exited` | `docker start jiankai-postgres` |
| 不存在 | `docker compose up -d` |

**2. 容器名冲突（`jiankai-postgres is already in use`）**

表示同名容器已存在，**不要重复 `up -d` 创建**。先查状态：

```bash
docker ps -a | grep jiankai-postgres
```

- 已在跑或已停止 → `docker start jiankai-postgres` 或 `docker compose start`
- 必须按当前 compose 重建容器时（会保留数据卷，一般不丢数据）：

```bash
docker rm -f jiankai-postgres
cd "$PROJECT_DIR"
docker compose up -d
```

> ⚠️ 切勿执行 `docker volume rm` 删除 `postgres_data`，否则会清空数据库。

**3. 应用连不上库（`28P01` 密码错误 / 连接失败）**

```bash
# 确认 .env 端口为 5433（不是 5432）
grep DATABASE_URL backend/.env

# 确认容器与健康
docker ps | grep jiankai-postgres
docker exec jiankai-postgres pg_isready -U jiankai
```

`DATABASE_URL` 须为：`postgresql://jiankai:jiankai123@127.0.0.1:5433/jiankai_quotation`（密码若已改须与 `docker-compose.yml` 一致）。

**4. 重新初始化库（⚠️ 会清空业务数据，仅空库或开发机）**

```bash
cd "$PROJECT_DIR"
docker compose down    # 不删 volume 则数据仍在；要彻底清空需 docker volume rm（慎用）
docker compose up -d
npm run db:init
npm run db:seed
npm run db:migrate
npm run db:seed-auth
```

**5. 备份与恢复**

```bash
# 备份
docker exec jiankai-postgres pg_dump -U jiankai jiankai_quotation > backup_$(date +%F).sql
tar -czf uploads_$(date +%F).tar.gz -C "$PROJECT_DIR/backend" uploads
cp "$PROJECT_DIR/backend/.env" ~/jiankai.env.backup

# 恢复（示例）
cat backup_2026-07-03.sql | docker exec -i jiankai-postgres psql -U jiankai jiankai_quotation
```

**6. `build:all` 失败（与数据库无关时）**

```bash
node -v    # 建议 >= 20
npm run install:all
export NODE_OPTIONS="--max-old-space-size=2048"   # 内存不足时
npm run build:all
```

### 部署后验证

| 步骤 | 命令 | 预期 |
|------|------|------|
| 数据库 | `docker ps \| grep jiankai-postgres` | `Up`，`5433->5432` |
| API | `curl http://127.0.0.1:3001/api/health` | `"status":"ok"` |
| 进程 | `pm2 status` | `jiankai-api` online |
| 日志 | `pm2 logs jiankai-api --lines 30` | 无持续报错 |


### 报价

- 毛门幅 = 净门幅 + 5
- 面料单耗(米) = 段长 × (1 + 损耗%)
- 面料单耗(kg) = 段长 × 毛门幅/10000 × 克重/1000 × (1 + 损耗%)
- 工价(RMB) = 工价(USD) × 汇率 × 1.13
- 最终报价 = 成本小计 × (1 + 利润率%)

### 排产 / 关账

- 销售产值、加工产值由数量 × 单价自动计算
- 工作日历、假期影响排产天数与上下线推算
- 已关账月份（`closing_month_locks`）内款式不可编辑，直至恢复关账

## 常见问题

### 报错：`用户 "jiankai" Password 验证失败`（或乱码 `û "jiankai" Password ֤ʧ`）

**现象**

- 执行 `npm run db:init`、`npm run dev` 或访问 API 时出现数据库认证失败
- 错误码为 `28P01`
- 错误信息可能是乱码，例如：`û "jiankai" Password ֤ʧ`

**原因**

1. **连错了数据库实例**：`backend/.env` 中 `DATABASE_URL` 若使用 `localhost:5432`，在 Windows 上通常会连到**本机已安装的 PostgreSQL**，而不是项目 Docker 容器。本机 PostgreSQL 没有 `jiankai / jiankai123` 账号，因此返回密码认证失败（`28P01`）。
2. **乱码是编码问题**：Windows 中文版 PostgreSQL 的错误信息使用 **GBK** 编码，而 Node.js `pg` 驱动按 **UTF-8** 解析，中文会显示为乱码。出现乱码往往说明连接的是本机 PostgreSQL，而非 Docker 数据库（Docker 容器错误信息为英文）。

**如何区分连到了哪个数据库**

| 连接端口 | 实际目标 | 典型表现 |
|----------|----------|----------|
| 5432 | Windows 本机 PostgreSQL | `28P01` 认证失败，中文乱码 |
| 5433 | 项目 Docker 容器 | 连接成功，版本信息含 `linux-musl` |

**解决步骤**

1. 确认 `backend/.env` 中端口为 **5433**（与 `docker-compose.yml` 一致）
2. 启动 Docker 数据库：
   ```bash
   docker rm -f jiankai-postgres   # 仅在容器名冲突时执行
   docker compose up -d
   ```
3. 确认容器运行且端口正确：`docker ps` 应显示 `5433->5432`
4. 重新初始化：
   ```bash
   npm run db:init
   npm run db:seed
   npm run db:migrate
   ```

**说明**

- 项目已在 `docker-compose.yml` 中将数据库暴露为 `5433:5432`，`backend/.env.example` 默认使用 5433。
- 若必须从其他工具连接本机数据库，请使用端口 **5433**，账号 `jiankai`，密码 `jiankai123`，数据库名 `jiankai_quotation`。

### Docker 提示容器名 `jiankai-postgres` 已被占用

表示同名容器**已存在**。先 `docker ps -a | grep jiankai-postgres`；若已停止则 `docker start jiankai-postgres`。完整说明见 **[数据库问题排查与修复](#数据库问题排查与修复)**。

### 关账功能报错或锁定无效

拉取新代码后请执行迁移并重启后端：

```bash
npm run db:migrate
npm run dev
```

迁移 `016_closing_month_locks.sql` 会创建关账锁定表。

## CentOS 服务器部署

以下以 **CentOS 7 / 8 / Stream**（及兼容的 Rocky Linux、AlmaLinux）为例，将系统部署到 Linux 生产服务器。推荐架构：**Docker 跑 PostgreSQL + Node 跑应用 + Nginx 反向代理**。

### 一、服务器与软件要求

| 项目 | 建议 |
|------|------|
| 系统 | CentOS 7.9+ / CentOS Stream 8+ / Rocky 8+ |
| CPU / 内存 | 2 核 / 4 GB 及以上（Sharp 图片处理略占内存） |
| 磁盘 | 20 GB 及以上（含数据库、上传文件） |
| 开放端口 | 80、443（对外）；3001、5433 仅本机（不对外暴露） |

**需要安装的工具**

| 工具 | 用途 | 版本建议 |
|------|------|----------|
| Git | 拉取代码 | 2.x |
| Node.js | 运行前后端构建产物 | **20 LTS**（最低 18） |
| npm | 依赖安装与构建 | 随 Node 自带 |
| Docker | 运行 PostgreSQL 容器 | 20.x+ |
| Docker Compose | 编排数据库 | v2（插件）或 docker-compose 1.x |
| Nginx | 反向代理、HTTPS | 1.18+ |
| PM2 或 systemd | 守护 Node 进程 | 二选一 |
| gcc-c++ / make | 编译 Sharp 等原生模块 | 首次 `npm install` 需要 |

### 二、安装基础环境（CentOS 8 / Stream / Rocky，root 或 sudo）

```bash
# 1. 系统更新
sudo dnf update -y

# 2. 开发工具（Sharp、node-gyp 编译依赖）
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y git curl gcc-c++ make

# 3. 安装 Node.js 20（NodeSource）
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v   # 应 >= v20
npm -v

# 4. 安装 Docker
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker

# 5. 安装 Nginx
sudo dnf install -y nginx
sudo systemctl enable nginx

# 6. 安装 PM2（可选，推荐）
sudo npm install -g pm2
```

**CentOS 7** 将上述 `dnf` 换为 `yum`；Docker Compose 若无插件，可额外安装：

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### 三、部署应用

#### 1. 创建部署目录并拉代码

```bash
sudo mkdir -p /opt/jiankai
sudo chown "$USER":"$USER" /opt/jiankai
cd /opt/jiankai

# 方式 A：Git 克隆
git clone <你的仓库地址> camkaxin
cd camkaxin

# 方式 B：本地上传 zip 后解压到 /opt/jiankai/camkaxin
```

#### 2. 启动 PostgreSQL（Docker）

```bash
cd /opt/jiankai/camkaxin
docker ps -a | grep jiankai-postgres   # 已有容器则 docker start，无需重复 up -d
docker compose up -d                  # 仅首次或容器不存在时

docker ps   # 确认 jiankai-postgres 运行，端口 5433->5432
```

完整命令见 **[服务器运维命令速查](#服务器运维命令速查)**。
```

#### 3. 配置生产环境变量

```bash
cp backend/.env.example backend/.env
vi backend/.env
```

生产环境建议至少修改以下项（将 `your-domain.com` 换成实际域名或服务器 IP）：

```env
PORT=3001
DATABASE_URL=postgresql://jiankai:jiankai123@127.0.0.1:5433/jiankai_quotation
TZ=Asia/Shanghai
UPLOAD_DIR=./uploads
CORS_ORIGIN=http://your-domain.com
STATIC_DIR=../frontend/dist
JWT_SECRET=请替换为至少32位随机字符串
JWT_ACCESS_TTL=8h
ADMIN_INITIAL_PASSWORD=请设置强密码
```

> **安全提示**：生产环境务必修改 `POSTGRES_PASSWORD`（需同步改 `docker-compose.yml` 与 `DATABASE_URL`）、`JWT_SECRET`、管理员初始密码，且不要将 `.env` 提交到 Git。

若修改了数据库密码，编辑 `docker-compose.yml` 后重建容器：

```bash
docker compose down
docker compose up -d
```

#### 4. 安装依赖、初始化数据库、构建

```bash
cd /opt/jiankai/camkaxin

npm run install:all

# 首次部署
npm run db:init
npm run db:seed
npm run db:migrate
npm run db:seed-auth

# 可选演示数据
# npm run db:seed-scheduling

# 构建前后端（生产必做）
npm run build:all
```

构建成功后应存在：
- `backend/dist/` — 后端编译产物
- `frontend/dist/` — 前端静态资源

#### 5. 启动 Node 应用

**方式 A：PM2（推荐）**

```bash
cd /opt/jiankai/camkaxin/backend
pm2 start dist/index.js --name jiankai-api
pm2 save
pm2 startup    # 按提示执行命令，实现开机自启

# 常用命令
pm2 status
pm2 logs jiankai-api
pm2 restart jiankai-api
```

**方式 B：systemd**

创建 `/etc/systemd/system/jiankai-api.service`：

```ini
[Unit]
Description=Jiankai Internal Management API
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/jiankai/camkaxin/backend
Environment=NODE_ENV=production
Environment=TZ=Asia/Shanghai
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now jiankai-api
sudo systemctl status jiankai-api
```

启动后本机验证：

```bash
curl http://127.0.0.1:3001/api/health
# 应返回 {"status":"ok",...}
```

浏览器本机访问：http://127.0.0.1:3001

#### 6. 配置 Nginx 反向代理

```bash
sudo vi /etc/nginx/conf.d/jiankai.conf
```

示例（HTTP，域名请替换）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**HTTPS（推荐）**：安装 certbot 后执行：

```bash
# CentOS 8 / Stream
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

配置 HTTPS 后，将 `backend/.env` 中 `CORS_ORIGIN` 改为 `https://your-domain.com` 并重启应用。

#### 7. 防火墙

```bash
# firewalld（CentOS 默认）
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# 不要对公网开放 3001、5433
```

云服务器还需在**安全组**中放行 80 / 443。

### 四、部署后验证清单

| 步骤 | 命令 / 地址 | 预期 |
|------|-------------|------|
| 数据库 | `docker ps` | `jiankai-postgres` 运行中 |
| 健康检查 | `curl http://127.0.0.1:3001/api/health` | `status: ok` |
| 前端页面 | 浏览器打开 `http://your-domain.com` | 登录页正常 |
| 登录 | 使用 `db:seed-auth` 创建的管理员账号 | 可进入系统 |
| 上传 | 报价单 / 款式图上传 | `backend/uploads` 有文件 |
| API 文档 | `http://your-domain.com/api-docs` | Swagger 可访问 |

### 五、版本升级（已有环境）

与 **[服务器运维命令速查 → 日常更新](#日常更新已有环境发新版)** 相同：

```bash
cd /opt/jiankai/camkaxin   # 或 /www/wwwroot/154.198.42.71
docker ps | grep jiankai-postgres

git pull
npm run install:all
npm run db:migrate
npm run build:all

pm2 restart jiankai-api --update-env
```

### 六、备份建议

定期备份以下内容：

```bash
# 1. 数据库（示例）
docker exec jiankai-postgres pg_dump -U jiankai jiankai_quotation > backup_$(date +%F).sql

# 2. 上传文件
tar -czf uploads_$(date +%F).tar.gz -C /opt/jiankai/camkaxin/backend uploads

# 3. 环境配置
cp /opt/jiankai/camkaxin/backend/.env ~/jiankai.env.backup
```

### 七、常见问题（CentOS）

数据库与容器问题优先查阅 **[服务器运维命令速查 → 数据库问题排查与修复](#数据库问题排查与修复)**。

**npm install 失败（Sharp / node-gyp）**

```bash
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y gcc-c++ make python3
rm -rf node_modules backend/node_modules frontend/node_modules
npm run install:all
```

**无法连接数据库**

- 确认 `DATABASE_URL` 主机为 `127.0.0.1`，端口 **5433**
- 确认 `docker ps` 中 Postgres 容器正常
- 查看日志：`docker logs jiankai-postgres`

**页面能开但 API 401 / 跨域**

- 检查 `CORS_ORIGIN` 是否与浏览器地址栏一致（含 `http`/`https`、域名、端口）
- 修改 `.env` 后重启 PM2 / systemd

**Nginx 502 Bad Gateway**

- 确认 Node 已启动：`curl http://127.0.0.1:3001/api/health`
- 查看应用日志：`pm2 logs jiankai-api`

**SELinux 导致 Nginx 代理失败（CentOS 常见）**

```bash
sudo setsebool -P httpd_can_network_connect 1
```

---

## 生产环境部署（本机快速验证）

开发模式（`npm run dev`）较慢，本机正式试用可构建后以生产模式运行：

```bash
docker compose up -d
npm run build:all
npm run start:prod
```

浏览器访问 **http://localhost:3001**（后端同时托管前端静态资源）。

确认 `backend/.env` 中：
- `DATABASE_URL` 使用端口 **5433**
- `STATIC_DIR=../frontend/dist`（构建后生效）

生产服务器请优先参考上文 **[CentOS 服务器部署](#centos-服务器部署)**，使用 PM2/systemd + Nginx。

## 运行测试

```bash
npm run install:all
npm test                  # 后端 + 前端单元/集成测试
npm run test:backend      # 仅后端（Vitest + supertest）
npm run test:frontend     # 仅前端
npm run test:e2e          # E2E（需数据库、默认账号 admin/admin123）
```

## 种子数据

初始化后包含：
- 3 名业务员（张三、李四、王五）
- 5 个品牌（ZARA、H&M、UNIQLO、GAP、Mango）
- 5 种面料、8 种辅料示例
- 全局汇率 6.8000
- ZARA 品牌基础辅料配置

执行 `npm run db:seed-scheduling` 可额外导入排产演示款式；`npm run db:seed-auth` 可初始化登录账号与角色权限。
