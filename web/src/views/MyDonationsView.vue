<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { api } from "@/api";

const list = ref<any[]>([]);
const loading = ref(true);

const stats = computed(() => {
  const total = list.value.reduce((s, d) => s + Number(d.amount || 0), 0);
  return { count: list.value.length, total };
});

function copy(text: string) { navigator.clipboard?.writeText(text); }

onMounted(async () => {
  const { data } = await api.get("/donations/mine");
  list.value = data.donations;
  loading.value = false;
});
</script>

<template>
  <div class="container">
    <div class="row" style="justify-content:space-between;margin-bottom:18px;">
      <h2 style="margin:0;">💝 我的捐赠</h2>
      <div class="row" style="gap:12px;">
        <span class="tag info">共 {{ stats.count }} 笔</span>
        <span class="tag ok">累计 {{ stats.total.toFixed(4) }} ETH</span>
      </div>
    </div>

    <p v-if="loading" class="muted">加载中...</p>

    <div v-else-if="list.length === 0" class="card empty">
      <div class="icon">💝</div>
      <p>您还没有捐赠记录</p>
      <p class="faint">前往首页选择项目开始第一笔捐赠</p>
      <router-link to="/" style="display:inline-block;margin-top:12px;">
        <button>浏览项目</button>
      </router-link>
    </div>

    <div v-else class="card" style="padding:0;overflow:hidden;">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>项目</th>
            <th>金额</th>
            <th>模式</th>
            <th>溯源码</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in list" :key="d.id">
            <td style="white-space:nowrap;color:var(--text-muted);">{{ new Date(d.created_at).toLocaleString() }}</td>
            <td><strong>{{ d.project_name }}</strong></td>
            <td><strong style="color:var(--primary);">{{ d.amount }}</strong> {{ d.currency }}</td>
            <td>
              <span :class="`tag ${d.mode === 'onchain' ? 'info' : ''}`">
                {{ d.mode === 'onchain' ? '⛓ 链上' : '🎬 演示' }}
              </span>
            </td>
            <td>
              <div class="row" style="gap:4px;">
                <router-link :to="`/trace/${d.trace_code}`" class="hash" style="background:var(--primary-soft);color:var(--primary-active);">{{ d.trace_code }}</router-link>
                <button class="ghost sm" @click="copy(d.trace_code)" title="复制">⧉</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
