<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { ethers } from "ethers";
import { api } from "@/api";
import { useAuth } from "@/stores/auth";
import { useWallet } from "@/stores/wallet";

const route = useRoute();
const auth = useAuth();
const wallet = useWallet();

const project = ref<any>(null);
const progress = ref<any[]>([]);
const loading = ref(true);
const amount = ref<number>(0.01);
const mode = ref<"demo" | "onchain">("onchain");
const commitEvidence = ref(true);
const submitting = ref(false);
const notice = ref<{ type: "success" | "error" | "info" | "warn"; msg: string } | null>(null);
const result = ref<{ trace_code: string; tx_hash?: string; evidence_tx?: string } | null>(null);

const canDonate = computed(() => project.value?.status === "active");
const pct = computed(() => {
  if (!project.value) return 0;
  const t = Number(project.value.target_amount);
  const r = Number(project.value.raised_amount);
  if (t <= 0) return 0;
  return Math.min(100, Math.round((r / t) * 100));
});

async function load() {
  loading.value = true;
  const { data } = await api.get(`/projects/${route.params.id}`);
  project.value = data.project;
  progress.value = data.progress;
  loading.value = false;
  try {
    await wallet.loadContractInfo();
  } catch {
    /* fallback ok */
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(label)), ms))
  ]);
}

async function donate() {
  notice.value = null;
  result.value = null;

  if (!auth.isLoggedIn) {
    notice.value = { type: "warn", msg: "请先登录后再发起捐赠" };
    return;
  }
  if (!(amount.value > 0)) {
    notice.value = { type: "error", msg: "金额必须大于 0" };
    return;
  }

  submitting.value = true;
  try {
    let txHash: string | null = null;
    let blockNumber: number | null = null;
    let donorAddr: string | null = null;

    if (mode.value === "onchain") {
      if (!window.ethereum) {
        notice.value = { type: "error", msg: "请先安装 MetaMask 插件" };
        submitting.value = false;
        return;
      }
      const { account, chainId } = await wallet.connect();
      donorAddr = account;
      if (wallet.contractInfo && chainId !== wallet.contractInfo.chainId) {
        notice.value = {
          type: "warn",
          msg: `请切换钱包网络至 chainId ${wallet.contractInfo.chainId}（当前 ${chainId}）`
        };
        submitting.value = false;
        return;
      }
      if (!project.value.onchain_project_id) {
        notice.value = {
          type: "warn",
          msg: "该项目尚未在链上注册，可切换为演示模式或联系机构在合约 createProject 后绑定 onchain ID"
        };
        submitting.value = false;
        return;
      }

      const contract = wallet.getContract();
      const value = ethers.utils.parseEther(String(amount.value));
      notice.value = { type: "info", msg: "请在 MetaMask 中确认交易..." };
      const donateTx = (await withTimeout(
        contract.donate(project.value.onchain_project_id, { value, gasLimit: 180000 }),
        45_000,
        "WALLET_CONFIRM_TIMEOUT"
      )) as ethers.ContractTransaction;
      notice.value = { type: "info", msg: "交易已提交，等待打包..." };
      const receipt = await donateTx.wait(1);
      txHash = donateTx.hash;
      blockNumber = receipt.blockNumber;
    } else {
      txHash = "0x" + "0".repeat(64);
    }

    notice.value = { type: "info", msg: "正在生成溯源记录..." };
    const { data: created } = await api.post("/donations", {
      project_id: project.value.id,
      amount: amount.value,
      currency: "ETH",
      donor_address: donorAddr,
      tx_hash: txHash,
      mode: mode.value
    });

    if (mode.value === "onchain" && commitEvidence.value) {
      notice.value = { type: "info", msg: "正在上链存证..." };
      const contract = wallet.getContract();
      const key = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string", "string"], ["donation", created.id])
      );
      const dataHash32 = "0x" + created.data_hash;
      const evTx = (await contract.commitEvidence(key, dataHash32, {
        gasLimit: 120000
      })) as ethers.ContractTransaction;
      const evReceipt = await evTx.wait(1);
      await api.put(`/donations/${created.id}/evidence`, {
        tx_hash: evTx.hash,
        block_number: evReceipt.blockNumber,
        submitter_address: donorAddr
      });
      result.value = { trace_code: created.trace_code, tx_hash: txHash!, evidence_tx: evTx.hash };
    } else {
      result.value = { trace_code: created.trace_code, tx_hash: txHash ?? undefined };
    }
    notice.value = { type: "success", msg: "捐赠成功！请保存好您的溯源码" };
    await load();
  } catch (e: any) {
    const code = e?.code || e?.message || "";
    if (e?.code === 4001 || /denied|reject/i.test(code))
      notice.value = { type: "warn", msg: "您取消了交易" };
    else if (/WALLET_CONFIRM_TIMEOUT/.test(code))
      notice.value = { type: "warn", msg: "钱包确认超时，请重试" };
    else if (/insufficient/i.test(code))
      notice.value = { type: "error", msg: "钱包余额不足" };
    else notice.value = { type: "error", msg: e?.response?.data?.message || e?.message || "捐赠失败" };
  } finally {
    submitting.value = false;
  }
}

function copy(text: string) {
  navigator.clipboard?.writeText(text);
}

onMounted(load);
</script>

<template>
  <div class="container" v-if="!loading && project">
    <div class="split">
      <!-- 左：项目信息 -->
      <div>
        <div class="card">
          <div class="row" style="margin-bottom:10px;justify-content:space-between;">
            <span class="tag info">🏛 {{ project.org_name }}</span>
            <span :class="`tag ${project.status === 'active' ? 'ok' : 'warn'} dot`">
              {{ project.status === 'active' ? '募捐中' : project.status }}
            </span>
          </div>
          <h1>{{ project.name }}</h1>
          <p style="margin:8px 0 20px;color:var(--text-muted);font-size:15px;">{{ project.description }}</p>

          <div class="progress-text">
            <span>已筹 <strong>{{ project.raised_amount }} ETH</strong></span>
            <span>目标 {{ project.target_amount }} ETH（{{ pct }}%）</span>
          </div>
          <div class="progress-bar" style="height:10px;">
            <div class="fill" :style="`width:${pct}%`"></div>
          </div>

          <div class="row" style="margin-top:20px;gap:10px;">
            <span v-if="project.onchain_project_id" class="tag info dot">链上项目 #{{ project.onchain_project_id }}</span>
            <span v-else class="tag warn dot">未绑定链上 ID</span>
            <span class="tag">创建于 {{ new Date(project.created_at).toLocaleDateString() }}</span>
          </div>
          <div style="margin-top:14px;font-size:13px;">
            <span class="muted">项目信息哈希：</span>
            <code class="hash" @click="copy(project.info_hash)" style="cursor:pointer;" title="点击复制">{{ project.info_hash }}</code>
          </div>
        </div>

        <div class="card" v-if="progress.length">
          <h3>📅 项目进展</h3>
          <div class="timeline">
            <div v-for="p in progress" :key="p.id" class="timeline-item progress">
              <div class="title-line">{{ p.title }}</div>
              <div class="time">{{ new Date(p.created_at).toLocaleString() }}</div>
              <div class="panel">
                <p style="margin:0;">{{ p.content }}</p>
                <p style="margin:8px 0 0;font-size:12px;">
                  <span class="muted">进展哈希：</span>
                  <code class="hash">{{ p.progress_hash }}</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右：捐赠面板 -->
      <div>
        <div class="card" v-if="canDonate" style="position:sticky;top:88px;">
          <h3>💝 发起捐赠</h3>
          <label>捐赠金额 (ETH)</label>
          <input type="number" v-model.number="amount" step="0.001" min="0" />
          <div class="row" style="margin-top:8px;gap:6px;">
            <button class="ghost sm" type="button" @click="amount = 0.01">0.01</button>
            <button class="ghost sm" type="button" @click="amount = 0.1">0.1</button>
            <button class="ghost sm" type="button" @click="amount = 0.5">0.5</button>
            <button class="ghost sm" type="button" @click="amount = 1">1</button>
          </div>

          <label>捐赠模式</label>
          <div style="display:grid;gap:8px;">
            <label
              style="margin:0;padding:12px;border:1.5px solid var(--border);border-radius:var(--r);cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .15s;"
              :style="mode === 'onchain' ? 'border-color:var(--primary);background:var(--primary-soft);' : ''"
            >
              <input type="radio" value="onchain" v-model="mode" style="width:auto;margin:0;" />
              <span>
                <strong style="font-size:14px;color:var(--text);">⛓ 真实链上</strong>
                <span class="faint" style="display:block;">通过 MetaMask 发送交易</span>
              </span>
            </label>
            <label
              style="margin:0;padding:12px;border:1.5px solid var(--border);border-radius:var(--r);cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .15s;"
              :style="mode === 'demo' ? 'border-color:var(--primary);background:var(--primary-soft);' : ''"
            >
              <input type="radio" value="demo" v-model="mode" style="width:auto;margin:0;" />
              <span>
                <strong style="font-size:14px;color:var(--text);">🎬 演示模式</strong>
                <span class="faint" style="display:block;">仅入库不上链，便于演示</span>
              </span>
            </label>
          </div>

          <label v-if="mode === 'onchain'" style="display:flex;align-items:center;cursor:pointer;">
            <input type="checkbox" v-model="commitEvidence" /> 同时上链存证（推荐）
          </label>

          <div v-if="notice" :class="`notice ${notice.type}`">{{ notice.msg }}</div>

          <button class="block lg" style="margin-top:16px;" :disabled="submitting" @click="donate">
            {{ submitting ? "处理中..." : `💝 捐赠 ${amount} ETH` }}
          </button>

          <div v-if="result" class="card inset" style="margin-top:14px;padding:14px;">
            <p style="margin:0 0 8px;font-weight:600;color:var(--success);">✓ 捐赠成功</p>
            <p style="margin:0 0 6px;font-size:13px;">您的溯源码：</p>
            <div class="row" style="gap:6px;">
              <code class="hash" style="flex:1;font-size:14px;text-align:center;padding:6px;background:var(--primary-soft);border-color:var(--primary-soft-2);color:var(--primary-active);">{{ result.trace_code }}</code>
              <button class="ghost sm" @click="copy(result.trace_code)">复制</button>
            </div>
            <router-link :to="`/trace/${result.trace_code}`">
              <button class="block sm" style="margin-top:10px;">📜 查看溯源时间轴</button>
            </router-link>
            <p v-if="result.tx_hash && result.tx_hash !== '0x' + '0'.repeat(64)" style="margin:10px 0 0;font-size:12px;">
              <span class="muted">捐赠 tx：</span>
              <code class="hash">{{ result.tx_hash.slice(0, 18) }}...</code>
            </p>
            <p v-if="result.evidence_tx" style="margin:6px 0 0;font-size:12px;">
              <span class="muted">存证 tx：</span>
              <code class="hash">{{ result.evidence_tx.slice(0, 18) }}...</code>
            </p>
          </div>
        </div>

        <div class="card" v-else>
          <div class="empty" style="padding:24px 12px;">
            <div class="icon">⏸</div>
            <p style="margin:0;">项目当前不可捐赠</p>
            <p class="faint" style="margin:6px 0 0;">状态：{{ project.status }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="container">
    <div class="card skeleton" style="height:160px;"></div>
    <div class="card skeleton" style="height:300px;"></div>
  </div>
</template>
