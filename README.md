# 面向公益捐赠的区块链溯源平台 (XQS System)

> 成都信息工程大学 · 人工智能学院 · 区块链工程 · 本科毕业设计
> 作者：向青松 (2022131059) · 指导教师：黄源源 副教授

基于"**链下业务承载，链上摘要锚定**"思想构建的公益捐赠溯源平台。每一笔捐赠生成 12 位溯源码，关键字段经 SHA-256 摘要后调用智能合约存证；普通用户输入溯源码即可获得从捐款 → 上链 → 项目进展的统一时间轴。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 智能合约 | Solidity ^0.8.20 + Hardhat（支持本地 Hardhat Network 与 **Ethereum Sepolia** 测试网） |
| 后端 | Node.js + Express + better-sqlite3 + JWT + bcryptjs + zod + nanoid + ethers v5 |
| 前端 | Vue 3 + TypeScript + Vite + Pinia + Vue Router + Axios + ethers v5 + MetaMask |
| 数据库 | SQLite |

---

## 工程结构（Monorepo）

```
xqs_system/
├── contracts/                # 智能合约（Hardhat）
│   ├── contracts/CharityPlatform.sol
│   ├── scripts/deploy.ts             # 部署脚本：本地 / Sepolia 通用
│   ├── scripts/smoke-onchain.ts      # 链上冒烟测试
│   ├── test/CharityPlatform.test.ts  # 11 个单元测试用例
│   ├── hardhat.config.ts             # localhost + sepolia 双网络
│   └── .env.example
├── api/                      # 后端（Express + SQLite）
│   ├── src/server.ts
│   ├── src/db/{index,migrate}.ts     # 8 张核心表 schema + 默认 admin 种子
│   ├── src/middlewares/{auth,rbac,validate}.ts
│   ├── src/routes/{auth,org,review,admin,projects,donations,trace,chain}.ts
│   └── src/services/hash.ts          # SHA-256（论文 §6.2.2 / §6.3 固定字段顺序）
├── web/                      # 前端（Vue 3 + Vite）
│   ├── src/views/                    # 9 个视图（含三类后台）
│   ├── src/stores/{auth,wallet}.ts
│   └── src/router/index.ts
└── redme/                    # 项目文档
```

---

## 论文落地对照

| 论文章节 | 实现位置 |
|---|---|
| §3.4.2 捐赠溯源主流程时序图 | `web/src/views/ProjectDetailView.vue` + `api/src/routes/donations.ts` + `api/src/routes/trace.ts` |
| §4.3 8 张核心表 | `api/src/db/migrate.ts` |
| §4.4 JWT + RBAC + bcrypt + zod | `api/src/middlewares/{auth,rbac,validate}.ts` |
| §5.1 CharityPlatform 合约（createProject / donate / setProjectActive / commitEvidence + 3 个事件） | `contracts/contracts/CharityPlatform.sol` |
| §5.4.1 项目状态机（draft → pending_review → approved → active → closed） | `api/src/routes/{org,review}.ts` |
| §5.4.2 审核任务状态机（pending → claimed → done） | `api/src/routes/review.ts` |
| §6.2.2 后端捐赠：trace_code + data_hash + 存证占位 + tx_hash 回写 | `api/src/routes/donations.ts` |
| §6.2.3 溯源时间轴聚合 | `api/src/routes/trace.ts` |
| §6.2.4 前端链上交互（演示/真实双模式 + commitEvidence + gasLimit 180000） | `web/src/views/ProjectDetailView.vue` |
| §6.3 trace_code 用 nanoid 12 位、data_hash 固定字段顺序 | `api/src/services/hash.ts` + `donations.ts` |

---

## 快速开始

### 0. 准备
- Node.js ≥ 18
- npm
- (可选) MetaMask 浏览器插件

### 1. 安装依赖

```bash
npm install --workspaces
```

或单独装：

```bash
(cd contracts && npm install)
(cd api && npm install)
(cd web && npm install)
```

### 2. 启动本地链 + 部署合约

终端 A：

```bash
cd contracts
npx hardhat node              # 本地链 (chainId 31337, RPC http://127.0.0.1:8545)
```

终端 B：

```bash
cd contracts
npx hardhat run --network localhost scripts/deploy.ts
# 自动写出 deployments/localhost.json 并同步 ABI 到 web/ 与 api/
```

### 3. 启动后端

```bash
cd api
cp .env.example .env          # 按需修改
npx tsx src/server.ts         # 默认 :3001
# 首次启动会自动迁移 schema 并种子默认管理员 admin@xqs.local / admin123
```

### 4. 启动前端

```bash
cd web
npm run dev                   # http://localhost:5173 (vite 代理 /api → :3001)
```

### 5. (可选) 部署到 Sepolia

```bash
cd contracts
cp .env.example .env
# 填入 SEPOLIA_RPC_URL 与 PRIVATE_KEY（需有 Sepolia 测试币）
npx hardhat run --network sepolia scripts/deploy.ts
```

部署完成后 `deployments/sepolia.json` 会写出合约地址；ABI 会同步到 `web/src/abis/` 与 `api/src/abis/`，前端的钱包需切换到 Sepolia 网络（chainId 11155111）。

---

## 端到端流程演示

1. 访问 http://localhost:5173 → 注册「机构管理员」账号 → 提交机构入驻申请
2. 用默认管理员 `admin@xqs.local / admin123` 登录 → 创建审核员账号
3. 审核员登录 → 审核后台领取机构入驻任务 → 通过
4. 机构管理员登录 → 创建项目（草稿）→ 提交审核
5. 审核员通过项目 → 机构管理员激活项目 → 在合约上注册（绑定 onchain ID）
6. 任意捐赠者登录 → 项目详情页 → 演示模式或链上模式捐赠 → 获得 12 位溯源码
7. 任意访客（无需登录）→ 溯源查询页 → 输入溯源码 → 查看完整时间轴

---

## 测试

### 合约单元测试

```bash
cd contracts && npx hardhat test
# 11 passing
```

### 后端 happy path（脚本化）

参见 `redme/SMOKE.md`。

---

## 关键设计约束

1. **`data_hash` 字段顺序固定**（论文 §6.3）：`donationId → projectId → amount → currency → donorAddress → createdAt`。`api/src/services/hash.ts` 严格按此顺序构造 JSON。
2. **`trace_code` 用 nanoid(12)** 自定义字符集，避免 0/O、1/l 等易混淆字符，无法从中推断业务量。
3. **演示模式** 使用伪 tx_hash `0x0000…0000`，后端正常入库但不触发链上调用。
4. **commitEvidence key** 采用 `keccak256(abi.encode("biz_type", "biz_id"))`，统一支持 donation / progress / project / org 四类业务对象（论文 §2.3.2「biz_type + biz_id」）。
5. **链上链下绑定**：链下数据库存明细，链上仅存 SHA-256 摘要；任何数据库篡改导致重算哈希与链上不符，从而可被检测。

---

## 致谢

代码实现严格遵循论文《面向公益捐赠的区块链溯源平台设计与实现》（成都信息工程大学 2026 届本科毕业论文）的需求、架构与算法描述。
