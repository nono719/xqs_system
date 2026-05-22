<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/api";

const projects = ref<any[]>([]);
const loading = ref(true);
const error = ref("");

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
    <div class="banner">
      <h1>面向公益捐赠的区块链溯源平台</h1>
      <p style="margin:4px 0 0;opacity:0.9;">链下业务承载 · 链上摘要锚定 · 一码溯源</p>
    </div>

    <h2>正在募捐的项目</h2>
    <p v-if="loading" class="muted">加载中...</p>
    <div v-if="error" class="notice error">{{ error }}</div>

    <div v-if="!loading && projects.length === 0" class="card">
      <p class="muted">暂时没有正在募捐的项目。</p>
    </div>

    <div class="grid">
      <router-link v-for="p in projects" :key="p.id" :to="`/projects/${p.id}`" style="text-decoration:none;color:inherit;">
        <div class="card" style="cursor:pointer;">
          <h3 style="margin:0 0 8px;">{{ p.name }}</h3>
          <p class="muted" style="margin:0 0 12px;">{{ p.org_name }}</p>
          <p style="margin:0 0 12px;">{{ p.description?.slice(0, 60) }}{{ p.description?.length > 60 ? '...' : '' }}</p>
          <div class="row" style="justify-content:space-between;">
            <span class="tag ok">已筹 {{ p.raised_amount }} ETH</span>
            <span class="tag">目标 {{ p.target_amount }} ETH</span>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>
