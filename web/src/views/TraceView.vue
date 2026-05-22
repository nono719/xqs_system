<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "@/api";

const route = useRoute();
const router = useRouter();
const code = ref<string>((route.params.code as string) || "");
const result = ref<any>(null);
const loading = ref(false);
const error = ref("");

async function search() {
  if (!code.value) return;
  error.value = "";
  result.value = null;
  loading.value = true;
  try {
    const { data } = await api.get(`/trace/${code.value}`);
    result.value = data;
    router.replace(`/trace/${code.value}`);
  } catch (e: any) {
    error.value = e?.response?.data?.message || "查询失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (route.params.code) search();
});

watch(
  () => route.params.code,
  (c) => {
    if (c && c !== code.value) {
      code.value = c as string;
      search();
    }
  }
);
</script>

<template>
  <div class="container" style="max-width:760px;">
    <div class="card">
      <h2>溯源查询</h2>
      <p class="muted">输入您的 12 位溯源码，查看从捐赠到上链再到项目进展的完整时间线。</p>
      <div class="row" style="margin-top:12px;">
        <input v-model="code" placeholder="例如：xjK9mN2pQr5s" style="flex:1;" @keyup.enter="search" />
        <button @click="search" :disabled="loading">{{ loading ? "查询中..." : "查询" }}</button>
      </div>
      <div v-if="error" class="notice error">{{ error }}</div>
    </div>

    <div v-if="result" class="card">
      <h3>{{ result.project?.name }}</h3>
      <p class="muted">{{ result.project?.org_name }} · 溯源码 {{ result.trace_code }}</p>
      <div class="timeline" style="margin-top:16px;">
        <div v-for="(item, i) in result.timeline" :key="i" class="timeline-item">
          <strong>{{ item.title }}</strong>
          <p class="muted" style="margin:4px 0;">{{ item.time }}</p>
          <div class="card" style="margin:8px 0;background:#f8fafc;">
            <p v-if="item.type === 'donation_created'" style="margin:0;">
              金额 <strong>{{ item.data.amount }} {{ item.data.currency }}</strong>
              <span class="tag" style="margin-left:8px;">{{ item.data.mode }}</span>
            </p>
            <p v-if="item.data.donor_address" class="hash muted">捐款地址: {{ item.data.donor_address }}</p>
            <p v-if="item.data.tx_hash" class="hash muted">交易 hash: {{ item.data.tx_hash }}</p>
            <p v-if="item.data.data_hash" class="hash muted">数据 hash: {{ item.data.data_hash }}</p>
            <p v-if="item.data.block_number" class="muted">区块: #{{ item.data.block_number }}</p>
            <p v-if="item.data.content" style="margin:0;">{{ item.data.content }}</p>
            <p v-if="item.data.progress_hash" class="hash muted">进展 hash: {{ item.data.progress_hash }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
