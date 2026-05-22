# 后端 API 路由速查

所有需要鉴权的接口（标 🔒）须在 Header 携带 `Authorization: Bearer <JWT>`。

## /auth — 认证

| Method | Path | 权限 | 说明 |
|---|---|---|---|
| POST | `/auth/register` | - | `{ email, password, role: 'donor' \| 'org_admin' }` |
| POST | `/auth/login` | - | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | 🔒 | 当前登录用户 |

## /org — 机构（org_admin）

| Method | Path | 权限 | 说明 |
|---|---|---|---|
| POST | `/org/apply` | 🔒 org_admin | 提交机构入驻申请 |
| GET | `/org/me` | 🔒 org_admin | 当前机构信息 |
| POST | `/org/projects` | 🔒 org_admin | 创建项目（草稿） |
| GET | `/org/projects` | 🔒 org_admin | 本机构项目列表 |
| PUT | `/org/projects/:id` | 🔒 org_admin | 修改草稿/驳回的项目 |
| POST | `/org/projects/:id/submit` | 🔒 org_admin | 提交审核 |
| POST | `/org/projects/:id/activate` | 🔒 org_admin | 审核通过后激活上线 |
| POST | `/org/projects/:id/close` | 🔒 org_admin | 关闭项目 |
| POST | `/org/projects/:id/bind-onchain` | 🔒 org_admin | 绑定链上 projectId |
| POST | `/org/projects/:id/progress` | 🔒 org_admin | 发布项目进展 |
| PUT | `/org/progress/:id/evidence` | 🔒 org_admin | 回写进展存证 tx_hash |

## /review — 审核（reviewer/admin）

| Method | Path | 权限 | 说明 |
|---|---|---|---|
| GET | `/review/tasks` | 🔒 reviewer/admin | 待领取任务 |
| GET | `/review/tasks/mine` | 🔒 reviewer/admin | 我领取的任务 |
| GET | `/review/tasks/:id` | 🔒 reviewer/admin | 任务详情 + 业务对象 |
| POST | `/review/tasks/:id/claim` | 🔒 reviewer/admin | 领取任务 |
| POST | `/review/tasks/:id/release` | 🔒 reviewer/admin | 放弃任务 |
| POST | `/review/tasks/:id/decide` | 🔒 reviewer/admin | `{ result, reject_reason? }` |

## /admin — 平台管理（admin）

| Method | Path | 权限 | 说明 |
|---|---|---|---|
| POST | `/admin/reviewers` | 🔒 admin | 创建审核员账号 |
| GET | `/admin/users` | 🔒 admin | 全部用户 |
| POST | `/admin/users/:id/disable` | 🔒 admin | 禁用 / 启用账号 |
| GET | `/admin/organizations` | 🔒 admin | 全部机构 |
| GET | `/admin/projects` | 🔒 admin | 全平台项目（审计） |

## /projects — 公开项目（无需登录）

| Method | Path | 说明 |
|---|---|---|
| GET | `/projects?status=active` | 列出指定状态项目 |
| GET | `/projects/:id` | 项目详情 + 进展列表 |

## /donations — 捐赠

| Method | Path | 权限 | 说明 |
|---|---|---|---|
| POST | `/donations` | 🔒 | 创建捐赠 → 生成 trace_code + data_hash + 存证占位 |
| PUT | `/donations/:id/evidence` | 🔒 | 回写链上 tx_hash + block_number |
| GET | `/donations/mine` | 🔒 | 我的捐赠 |

## /trace — 溯源（公开）

| Method | Path | 说明 |
|---|---|---|
| GET | `/trace/:code` | 按溯源码返回统一时间轴 |

## /chain — 链上信息（公开）

| Method | Path | 说明 |
|---|---|---|
| GET | `/chain/contract` | `{ address, chainId, rpcUrl, abi }` |
