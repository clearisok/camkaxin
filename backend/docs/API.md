# 柬凯报价模块 API 文档

Base URL: `http://localhost:3001/api`

Swagger UI: `http://localhost:3001/api-docs`

## 健康检查

```
GET /api/health
```

## 业务员管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /agents | 获取业务员列表 |
| GET | /agents/:id | 获取单个业务员 |
| POST | /agents | 创建业务员 |
| PUT | /agents/:id | 更新业务员 |
| DELETE | /agents/:id | 删除业务员 |

## 品牌管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /brands | 获取品牌列表（按使用频率排序） |
| GET | /brands/:id | 获取单个品牌 |
| GET | /brands/:id/default-accessories | 获取品牌基础辅料 |
| PUT | /brands/:id/default-accessories | 更新品牌基础辅料 |
| POST | /brands | 创建品牌 |
| PUT | /brands/:id | 更新品牌 |
| POST | /brands/:id/track-usage | 记录品牌使用 |
| DELETE | /brands/:id | 删除品牌 |

## 面料库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /fabrics | 获取活跃面料（按使用频率排序） |
| GET | /fabrics/all | 获取全部面料 |
| POST | /fabrics | 创建面料 |
| PUT | /fabrics/:id | 更新面料 |
| POST | /fabrics/:id/track-usage | 记录面料使用 |
| DELETE | /fabrics/:id | 删除面料 |

## 辅料库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /accessories | 获取活跃辅料（按使用频率排序） |
| GET | /accessories/all | 获取全部辅料 |
| POST | /accessories | 创建辅料 |
| PUT | /accessories/:id | 更新辅料 |
| POST | /accessories/:id/track-usage | 记录辅料使用 |
| DELETE | /accessories/:id | 删除辅料 |

## 系统设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /settings | 获取所有设置 |
| PUT | /settings/exchange-rate | 更新全局汇率 |
| GET | /settings/templates | 获取 Excel 模板列表 |
| POST | /settings/templates | 上传 Excel 模板 |
| DELETE | /settings/templates/:id | 删除模板 |
| POST | /settings/upload | 上传附件（图片/视频/文档） |
| POST | /settings/export-excel | 导出报价单 Excel |

## 报价单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /quotations | 获取报价单列表 |
| GET | /quotations/:id | 获取报价单详情 |
| POST | /quotations | 创建报价单 |
| PUT | /quotations/:id | 更新报价单 |
| POST | /quotations/:id/copy | 复制报价单 |
| DELETE | /quotations/:id | 删除报价单 |
| POST | /quotations/calculate | 实时计算明细行成本 |
| POST | /quotations/items/:itemId/revise | 修订明细行版本 |
| GET | /quotations/items/:itemId/snapshots | 获取版本快照 |

## 计算逻辑

- 毛门幅 = 净门幅 + 5
- 面料单耗(米): ROUND(段长 × (1 + 损耗/100), 2)
- 面料单耗(千克): ROUND(段长 × 毛门幅/10000 × 克重/1000 × (1 + 损耗/100), 2)
- 工价(RMB) = 工价(USD) × 汇率 × 1.13
- 成本小计 = 面料 + 辅料 + 工价(RMB) + 其他 + 运费
- 最终报价(RMB) = 成本小计 × (1 + 利润率/100)
- 最终报价(USD) = (成本小计 / 汇率) × (1 + 利润率/100)
