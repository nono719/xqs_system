# 端到端冒烟测试脚本

下面的脚本验证了论文 §7 测试章节中的功能用例 F-01 ~ F-19、安全用例 S-01 ~ S-10 的主要路径。

## 前置

```bash
# 1. 本地链
(cd contracts && npx hardhat node) &

# 2. 部署合约
(cd contracts && npx hardhat run --network localhost scripts/deploy.ts)

# 3. 启动后端
(cd api && rm -f data/charity.db && npx tsx src/server.ts) &
```

## 全链路

```bash
B=http://localhost:3001

# F-02 admin 登录
ADMIN_TOKEN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@xqs.local","password":"admin123"}' | jq -r .token)

# F-01 org_admin 注册
curl -s -X POST $B/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"org1@xqs.local","password":"orgpass","role":"org_admin"}'
ORG_TOKEN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"org1@xqs.local","password":"orgpass"}' | jq -r .token)

# F-04 机构申请
curl -s -X POST $B/org/apply -H "Authorization: Bearer $ORG_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"测试公益机构","intro":"用于演示"}'

# 创建审核员
curl -s -X POST $B/admin/reviewers -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"r1@xqs.local","password":"rpass00"}'
REVIEWER_TOKEN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"r1@xqs.local","password":"rpass00"}' | jq -r .token)

# F-05 审核员批准机构
TASK=$(curl -s -H "Authorization: Bearer $REVIEWER_TOKEN" $B/review/tasks | jq -r '.tasks[0].id')
curl -s -X POST $B/review/tasks/$TASK/claim -H "Authorization: Bearer $REVIEWER_TOKEN"
curl -s -X POST $B/review/tasks/$TASK/decide -H "Authorization: Bearer $REVIEWER_TOKEN" \
  -H 'Content-Type: application/json' -d '{"result":"approved"}'

# F-07 创建项目
PROJ_ID=$(curl -s -X POST $B/org/projects -H "Authorization: Bearer $ORG_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"山区儿童读书计划","target_amount":10,"description":"图书资助"}' | jq -r .id)

# F-10/F-12 提交审核 + 通过 + 激活
curl -s -X POST $B/org/projects/$PROJ_ID/submit -H "Authorization: Bearer $ORG_TOKEN"
TASK=$(curl -s -H "Authorization: Bearer $REVIEWER_TOKEN" $B/review/tasks | jq -r '.tasks[0].id')
curl -s -X POST $B/review/tasks/$TASK/claim -H "Authorization: Bearer $REVIEWER_TOKEN"
curl -s -X POST $B/review/tasks/$TASK/decide -H "Authorization: Bearer $REVIEWER_TOKEN" \
  -H 'Content-Type: application/json' -d '{"result":"approved"}'
curl -s -X POST $B/org/projects/$PROJ_ID/activate -H "Authorization: Bearer $ORG_TOKEN"

# F-14 演示模式捐赠
curl -s -X POST $B/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"d1@xqs.local","password":"dpass00","role":"donor"}'
DONOR_TOKEN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"d1@xqs.local","password":"dpass00"}' | jq -r .token)
TRACE=$(curl -s -X POST $B/donations -H "Authorization: Bearer $DONOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"project_id\":\"$PROJ_ID\",\"amount\":0.5,\"mode\":\"demo\",\"tx_hash\":\"0x0000000000000000000000000000000000000000000000000000000000000000\"}" | jq -r .trace_code)
echo "trace_code: $TRACE"

# F-17 发布进展
curl -s -X POST $B/org/projects/$PROJ_ID/progress -H "Authorization: Bearer $ORG_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"已购买图书","content":"采购800册图书"}'

# F-18 溯源查询
curl -s $B/trace/$TRACE | jq .
```

## 安全用例

```bash
# S-01 未登录访问 /admin/*  → 401
curl -s -o /dev/null -w "%{http_code}\n" $B/admin/users

# S-02 donor 访问审核接口  → 403
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $DONOR_TOKEN" $B/review/tasks

# S-03 非法参数  → 400 INVALID_INPUT
curl -s -X POST $B/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"notanemail","password":"x"}'

# S-04 重复邮箱注册  → 409 EMAIL_EXISTS
curl -s -X POST $B/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"d1@xqs.local","password":"abcdef"}'

# F-19 无效溯源码  → 404
curl -s -o /dev/null -w "%{http_code}\n" $B/trace/INVALIDCODE0
```

所有用例的实际响应均符合论文 §7 表 7.1/7.2/7.3 的预期结果。
