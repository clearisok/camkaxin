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

```bash
docker compose up -d
```

### 2. 安装依赖

```bash
npm run install:all
```

### 3. 配置环境变量

```bash
cp backend/.env.example backend/.env
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
