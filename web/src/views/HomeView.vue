<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { api } from "@/api";

const projects = ref<any[]>([]);
const loading = ref(true);
const error = ref("");

const stats = computed(() => {
  const total = projects.value.length;
  const raised = projects.value.reduce((s, p) => s + Number(p.raised_amount || 0), 0);
  const target = projects.value.reduce((s, p) => s + Number(p.target_amount || 0), 0);
  return { total, raised, target };
});

const emojis = ["📚", "🏥", "🌳", "🐾", "🍚", "🏠", "💧", "🎓", "❤️", "🌍"];
function emojiFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return emojis[h % emojis.length];
}

function pct(p: any) {
  const t = Number(p.target_amount || 0);
  const r = Number(p.raised_amount || 0);
  if (t <= 0) return 0;
  return Math.min(100, Math.round((r / t) * 100));
}

onMounted(async () => {
  try {
    const { data } = await api.get("/projects");
    projects.value = data.projects;
  } catch (e: any) {
    error.value = e?.response?.data?.message || "加载失败";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="container">
    <section class="hero">
      <h1>溯善链 · SuShanChain</h1>
      <p>面向公益捐赠的区块链溯源平台 — 链下业务承载 · 链上摘要锚定 · 一码全程溯源</p>
      <div class="stats">
        <div class="stat">
          <div class="v">{{ stats.total }}</div>
          <div class="l">进行中项目</div>
        </div>
        <div class="stat">
          <div class="v">{{ stats.raised.toFixed(2) }} ETH</div>
          <div class="l">累计筹款</div>
        </div>
        <div class="stat">
          <div class="v">{{ stats.target.toFixed(2) }} ETH</div>
          <div class="l">目标总额</div>
        </div>
      </div>
    </section>

    <div class="row" style="margin-bottom:18px;justify-content:space-between;">
      <h2 style="margin:0;">正在募捐的项目</h2>
      <router-link to="/trace">
        <button class="ghost sm">🔎 溯源查询</button>
      </router-link>
    </div>

    <div v-if="loading" class="grid">
      <div v-for="i in 3" :key="i" class="card">
        <div class="skeleton" style="height:80px;margin-bottom:12px;"></div>
        <div class="skeleton" style="height:18px;width:60%;margin-bottom:8px;"></div>
        <div class="skeleton" style="height:14px;width:90%;"></div>
      </div>
    </div>

    <div v-if="error" class="notice error">{{ error }}</div>

    <div v-if="!loading && projects.length === 0" class="card empty">
      <div class="icon">🌱</div>
      <p>目前还没有正在募捐的项目。</p>
      <p class="faint">机构管理员登录后台后即可创建项目。</p>
    </div>

    <div v-if="!loading && projects.length" class="grid">
      <router-link v-for="p in projects" :key="p.id" :to="`/projects/${p.id}`" style="text-decoration:none;color:inherit;">
        <div class="proj-card">
          <div class="cover">
            <span>{{ emojiFor(p.id) }}</span>
          </div>
          <div class="body">
            <h3>{{ p.name }}</h3>
            <p class="org">🏛 {{ p.org_name }}</p>
            <p>{{ p.description?.slice(0, 80) }}{{ p.description?.length > 80 ? '...' : '' }}</p>
            <div class="progress-text">
              <span><strong>{{ p.raised_amount }} ETH</strong> 已筹</span>
              <span>/ {{ p.target_amount }} ETH</span>
            </div>
            <div class="progress-bar">
              <div class="fill" :style="`width:${pct(p)}%`"></div>
            </div>
            <div class="row" style="margin-top:12px;justify-content:space-between;">
              <span class="tag ok dot">{{ pct(p) }}% 完成</span>
              <span v-if="p.onchain_project_id" class="tag info dot">链上 #{{ p.onchain_project_id }}</span>
              <span v-else class="tag warn">未上链</span>
            </div>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>
