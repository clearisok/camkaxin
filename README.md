# 柬凯内部管理系统 - 报价模块

服装贸易报价管理系统，支持品牌/面料/辅料管理、混合币种报价计算、Excel 模板导出。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Ant Design |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | PostgreSQL |
| 文件存储 | 本地存储（支持图片 Sharp 压缩） |
| Excel | exceljs 模板填充 |

## 快速开始

### 1. 启动 PostgreSQL

项目 Docker 数据库映射到本机 **5433** 端口（容器内仍为 5432），用于避免与 Windows 本机 PostgreSQL 默认的 **5432** 端口冲突。

```bash
docker compose up -d
```

若提示容器名 `jiankai-postgres` 已存在，可先删除旧容器再启动：

```bash
docker rm -f jiankai-postgres
docker compose up -d
```

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
jiankai-quotation/
├── backend/                 # Express 后端
│   ├── src/
│   │   ├── config/          # 数据库配置
│   │   ├── db/              # Schema、种子数据
│   │   ├── middleware/      # 文件上传
│   │   ├── routes/          # API 路由
│   │   ├── services/        # 业务逻辑
│   │   └── utils/           # 计算函数、字段元数据
│   ├── docs/API.md          # API 文档
│   └── uploads/             # 上传文件目录
├── frontend/                # React 前端
│   └── src/
│       ├── api/             # API 客户端
│       ├── components/      # 通用组件
│       ├── layouts/         # 布局
│       ├── pages/           # 页面
│       ├── types/           # 类型定义
│       └── utils/           # 前端计算逻辑
└── docker-compose.yml       # PostgreSQL
```

## 核心功能

- **基础配置**: 品牌、业务员、面料库、辅料库、品牌基础辅料、全局汇率
- **报价单管理**: 创建/编辑/复制/版本修订，混合币种计算
- **智能排序**: 品牌/面料/辅料按最近使用优先
- **Excel 导出**: 模板占位符填充，支持分 Sheet 导出
- **权限预留**: 所有字段带 `field_code`，`FieldPermission` 组件控制

## 计算规则

- 毛门幅 = 净门幅 + 5
- 面料单耗(米) = 段长 × (1 + 损耗%)
- 面料单耗(kg) = 段长 × 毛门幅/10000 × 克重/1000 × (1 + 损耗%)
- 工价(RMB) = 工价(USD) × 汇率 × 1.13
- 最终报价 = 成本小计 × (1 + 利润率%)

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
   ```

**说明**

- 项目已在 `docker-compose.yml` 中将数据库暴露为 `5433:5432`，`backend/.env.example` 默认使用 5433。
- 若必须从其他工具连接本机数据库，请使用端口 **5433**，账号 `jiankai`，密码 `jiankai123`，数据库名 `jiankai_quotation`。

### Docker 提示容器名 `jiankai-postgres` 已被占用

表示之前已创建过同名容器。可执行 `docker start jiankai-postgres` 直接启动；若需按当前 `docker-compose.yml` 重建（例如更换端口映射），则先 `docker rm -f jiankai-postgres` 再 `docker compose up -d`。删除容器不会删除 `postgres_data` 数据卷中的数据。

## 运行测试

```bash
cd backend && npm test
```

## 种子数据

初始化后包含：
- 3 名业务员（张三、李四、王五）
- 5 个品牌（ZARA、H&M、UNIQLO、GAP、Mango）
- 5 种面料、8 种辅料示例
- 全局汇率 6.8000
- ZARA 品牌基础辅料配置
