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

const typeMeta: Record<string, { icon: string; klass: string }> = {
  donation_created: { icon: "💝", klass: "donation" },
  evidence_committed: { icon: "⛓", klass: "evidence" },
  project_progress: { icon: "📋", klass: "progress" }
};

async function search() {
  if (!code.value) return;
  error.value = "";
  result.value = null;
  loading.value = true;
  try {
    const { data } = await api.get(`/trace/${code.value.trim()}`);
    result.value = data;
    router.replace(`/trace/${code.value.trim()}`);
  } catch (e: any) {
    error.value = e?.response?.data?.message || "查询失败";
  } finally {
    loading.value = false;
  }
}

function copy(text: string) {
  navigator.clipboard?.writeText(text);
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
  <div class="container" style="max-width:840px;">
    <div class="hero" style="padding:36px 32px;">
      <h1 style="font-size:26px;">🔎 溯源查询</h1>
      <p>输入您的 12 位溯源码，看见每一分善款的完整去向。</p>
      <div class="row" style="margin-top:24px;gap:8px;">
        <input
          v-model="code"
          placeholder="例如：CfHRqCPBfQ3D"
          style="flex:1;padding:14px 18px;font-size:16px;border:0;color:var(--text);background:rgba(255,255,255,0.95);"
          @keyup.enter="search"
        />
        <button class="lg" style="background:rgba(255,255,255,0.2);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.3);" @click="search" :disabled="loading">
          {{ loading ? "查询中..." : "查询" }}
        </button>
      </div>
    </div>

    <div v-if="error" class="notice error">{{ error }}</div>

    <div v-if="result" class="card fade-in">
      <div class="row" style="justify-content:space-between;margin-bottom:14px;">
        <div>
          <h3 style="margin:0;">{{ result.project?.name }}</h3>
          <p class="muted" style="margin:4px 0 0;">🏛 {{ result.project?.org_name }}</p>
        </div>
        <div style="text-align:right;">
          <span class="muted" style="font-size:12px;">溯源码</span>
          <div class="row" style="gap:6px;margin-top:4px;">
            <code class="hash" style="font-size:14px;background:var(--primary-soft);color:var(--primary-active);border-color:var(--primary-soft-2);">{{ result.trace_code }}</code>
            <button class="ghost sm" @click="copy(result.trace_code)">复制</button>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <h4 style="margin:0 0 14px;">事件时间轴</h4>
      <div class="timeline">
        <div v-for="(item, i) in result.timeline" :key="i" :class="`timeline-item ${typeMeta[item.type]?.klass || ''}`">
          <div class="title-line">
            <span style="font-size:16px;">{{ typeMeta[item.type]?.icon || '•' }}</span>
            <span>{{ item.title }}</span>
          </div>
          <div class="time">{{ new Date(item.time).toLocaleString() }}</div>
          <div class="panel">
            <template v-if="item.type === 'donation_created'">
              <p style="margin:0 0 8px;">
                <strong style="font-size:20px;color:var(--primary);">{{ item.data.amount }}</strong>
                <span class="muted"> {{ item.data.currency }}</span>
                <span class="tag" style="margin-left:8px;">{{ item.data.mode === 'demo' ? '演示' : '链上' }}</span>
              </p>
              <p v-if="item.data.donor_address" style="margin:4px 0;font-size:13px;">
                <span class="muted">捐款地址：</span>
                <code class="hash">{{ item.data.donor_address }}</code>
              </p>
              <p v-if="item.data.tx_hash && item.data.tx_hash !== '0x' + '0'.repeat(64)" style="margin:4px 0;font-size:13px;">
                <span class="muted">捐赠 tx：</span>
                <code class="hash">{{ item.data.tx_hash }}</code>
              </p>
            </template>
            <template v-if="item.type === 'evidence_committed'">
              <p style="margin:0 0 6px;font-size:13px;">
                <span class="muted">数据哈希：</span>
                <code class="hash">{{ item.data.data_hash }}</code>
              </p>
              <p v-if="item.data.tx_hash" style="margin:4px 0;font-size:13px;">
                <span class="muted">存证 tx：</span>
                <code class="hash">{{ item.data.tx_hash }}</code>
              </p>
              <p v-if="item.data.block_number" style="margin:4px 0;font-size:13px;">
                <span class="tag info">区块 #{{ item.data.block_number }}</span>
              </p>
              <p v-if="!item.data.tx_hash" class="muted" style="margin:4px 0;font-size:13px;">
                ⏳ 仅链下记账（演示模式或链上回写未完成）
              </p>
            </template>
            <template v-if="item.type === 'project_progress'">
              <p style="margin:0 0 6px;">{{ item.data.content }}</p>
              <p style="margin:4px 0;font-size:13px;">
                <span class="muted">进展哈希：</span>
                <code class="hash">{{ item.data.progress_hash }}</code>
              </p>
              <p v-if="item.data.tx_hash" style="margin:4px 0;font-size:13px;">
                <span class="tag info">存证 tx 已上链</span>
                <span class="tag" style="margin-left:6px;">区块 #{{ item.data.block_number }}</span>
              </p>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!result && !loading && !error" class="card empty">
      <div class="icon">🔍</div>
      <p>输入溯源码以查看完整时间轴</p>
      <p class="faint">捐赠成功后您会获得一个 12 位的溯源码</p>
    </div>
  </div>
</template>
