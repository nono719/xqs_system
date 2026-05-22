<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/api";

const pending = ref<any[]>([]);
const mine = ref<any[]>([]);
const current = ref<{ task: any; detail: any } | null>(null);
const reason = ref("");
const notice = ref<{ type: string; msg: string } | null>(null);

async function load() {
  const r1 = await api.get("/review/tasks");
  pending.value = r1.data.tasks;
  const r2 = await api.get("/review/tasks/mine");
  mine.value = r2.data.tasks;
}

async function claim(id: string) {
  notice.value = null;
  try {
    await api.post(`/review/tasks/${id}/claim`);
    await openTask(id);
    await load();
  } catch (e: any) {
    notice.value = { type: "error", msg: e?.response?.data?.message || "领取失败" };
  }
}

async function openTask(id: string) {
  const { data } = await api.get(`/review/tasks/${id}`);
  current.value = data;
}

async function release(id: string) {
  await api.post(`/review/tasks/${id}/release`);
  current.value = null;
  await load();
}

async function decide(result: "approved" | "rejected") {
  if (!current.value) return;
  if (result === "rejected" && !reason.value.trim()) {
    notice.value = { type: "warn", msg: "驳回必须填写原因" };
    return;
  }
  try {
    await api.post(`/review/tasks/${current.value.task.id}/decide`, {
      result,
      reject_reason: result === "rejected" ? reason.value : undefined
    });
    notice.value = { type: "success", msg: result === "approved" ? "✓ 已通过" : "✗ 已驳回" };
    current.value = null;
    reason.value = "";
    await load();
  } catch (e: any) {
    notice.value = { type: "error", msg: e?.response?.data?.message || "操作失败" };
  }
}

onMounted(load);
</script>

<template>
  <div class="container">
    <div class="row" style="justify-content:space-between;margin-bottom:18px;">
      <h2 style="margin:0;">🔍 审核后台</h2>
      <div class="row" style="gap:8px;">
        <span class="tag warn">{{ pending.length }} 待领取</span>
        <span class="tag">{{ mine.length }} 已处理</span>
      </div>
    </div>

    <div v-if="notice" :class="`notice ${notice.type}`">{{ notice.msg }}</div>

    <div class="card">
      <h3>📥 待领取任务</h3>
      <div v-if="pending.length === 0" class="empty" style="padding:24px;">
        <div class="icon">✨</div>
        <p>暂无待领取任务</p>
      </div>
      <table v-else style="margin-top:8px;">
        <thead>
          <tr><th>提交时间</th><th>类型</th><th>业务 ID</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="t in pending" :key="t.id">
            <td style="color:var(--text-muted);">{{ new Date(t.created_at).toLocaleString() }}</td>
            <td>
              <span :class="`tag ${t.biz_type === 'org' ? 'info' : ''}`">
                {{ t.biz_type === 'org' ? '🏛 机构入驻' : '📋 项目审核' }}
              </span>
            </td>
            <td><code class="hash">{{ t.biz_id.slice(0, 12) }}...</code></td>
            <td><button class="sm" @click="claim(t.id)">领取并查看</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card" v-if="current">
      <h3>📝 处理任务</h3>
      <div class="row" style="margin-bottom:10px;">
        <span :class="`tag ${current.task.biz_type === 'org' ? 'info' : ''} dot`">
          {{ current.task.biz_type === 'org' ? '机构入驻' : '项目审核' }}
        </span>
        <span class="muted">领取于 {{ new Date(current.task.claimed_at).toLocaleString() }}</span>
      </div>

      <div class="card inset" style="padding:14px;font-size:13px;">
        <p v-if="current.task.biz_type === 'org'" style="margin:0;">
          <strong>{{ current.detail.name }}</strong><br />
          <span class="muted">{{ current.detail.intro }}</span>
        </p>
        <template v-else>
          <p style="margin:0 0 6px;"><strong>{{ current.detail.name }}</strong></p>
          <p class="muted" style="margin:0 0 6px;">{{ current.detail.description }}</p>
          <p style="margin:0;font-size:12px;">
            目标 {{ current.detail.target_amount }} ETH ·
            <code class="hash">{{ current.detail.info_hash?.slice(0, 16) }}...</code>
          </p>
        </template>
      </div>

      <label>驳回原因（驳回时必填）</label>
      <textarea v-model="reason" placeholder="如有问题请说明驳回原因..." />

      <div class="row" style="margin-top:14px;gap:8px;">
        <button @click="decide('approved')">✓ 通过</button>
        <button class="danger" @click="decide('rejected')">✗ 驳回</button>
        <button class="ghost" @click="release(current.task.id)">放弃任务</button>
      </div>
    </div>

    <div class="card">
      <h3>📒 我处理过的任务</h3>
      <div v-if="mine.length === 0" class="empty" style="padding:24px;">
        <div class="icon">📋</div>
        <p>暂无处理记录</p>
      </div>
      <table v-else style="margin-top:8px;">
        <thead>
          <tr><th>类型</th><th>结果</th><th>原因</th><th>完成时间</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in mine" :key="t.id">
            <td>
              <span :class="`tag ${t.biz_type === 'org' ? 'info' : ''}`">
                {{ t.biz_type === 'org' ? '🏛 机构' : '📋 项目' }}
              </span>
            </td>
            <td>
              <span :class="`tag ${t.result === 'approved' ? 'ok' : t.result === 'rejected' ? 'danger' : 'warn'} dot`">
                {{ t.result === 'approved' ? '通过' : t.result === 'rejected' ? '驳回' : t.status }}
              </span>
            </td>
            <td>{{ t.reject_reason || '-' }}</td>
            <td style="color:var(--text-muted);">{{ t.completed_at ? new Date(t.completed_at).toLocaleString() : '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
