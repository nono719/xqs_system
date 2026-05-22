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
    notice.value = { type: "success", msg: result === "approved" ? "已通过" : "已驳回" };
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
    <h2>审核后台</h2>
    <div v-if="notice" :class="`notice ${notice.type}`">{{ notice.msg }}</div>

    <div class="card">
      <h3>待领取任务（{{ pending.length }}）</h3>
      <table v-if="pending.length">
        <thead>
          <tr><th>提交时间</th><th>类型</th><th>业务 ID</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="t in pending" :key="t.id">
            <td>{{ t.created_at }}</td>
            <td><span class="tag">{{ t.biz_type }}</span></td>
            <td class="hash">{{ t.biz_id }}</td>
            <td><button @click="claim(t.id)">领取</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">暂无待领取任务。</p>
    </div>

    <div class="card" v-if="current">
      <h3>处理任务</h3>
      <p><strong>{{ current.task.biz_type === 'org' ? '机构入驻' : '项目审核' }}</strong></p>
      <pre style="background:#f1f5f9;padding:12px;border-radius:6px;overflow:auto;">{{ JSON.stringify(current.detail, null, 2) }}</pre>
      <label>驳回原因（驳回时必填）</label>
      <textarea v-model="reason" />
      <div class="row" style="margin-top:12px;">
        <button @click="decide('approved')">通过</button>
        <button class="danger" @click="decide('rejected')">驳回</button>
        <button class="ghost" @click="release(current.task.id)">放弃任务</button>
      </div>
    </div>

    <div class="card">
      <h3>我处理过的任务（{{ mine.length }}）</h3>
      <table v-if="mine.length">
        <thead>
          <tr><th>类型</th><th>结果</th><th>原因</th><th>完成时间</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in mine" :key="t.id">
            <td>{{ t.biz_type }}</td>
            <td>
              <span :class="`tag ${t.result === 'approved' ? 'ok' : 'danger'}`">{{ t.result || t.status }}</span>
            </td>
            <td>{{ t.reject_reason || '-' }}</td>
            <td>{{ t.completed_at || t.claimed_at }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">暂无处理记录。</p>
    </div>
  </div>
</template>
