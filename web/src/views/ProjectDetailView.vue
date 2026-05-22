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
    notice.value = { type: "warn", msg: "请先登录" };
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
      // 论文 §6.2.4 真实链上模式
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
          msg: "该项目尚未在链上注册（机构管理员需先在合约 createProject 并绑定 onchain_project_id），可改为演示模式"
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

    // 调用后端创建捐赠 + 计算 data_hash + 建立存证占位
    notice.value = { type: "info", msg: "正在记录捐赠..." };
    const { data: created } = await api.post("/donations", {
      project_id: project.value.id,
      amount: amount.value,
      currency: "ETH",
      donor_address: donorAddr,
      tx_hash: txHash,
      mode: mode.value
    });

    // 链上存证
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
      result.value = {
        trace_code: created.trace_code,
        tx_hash: txHash!,
        evidence_tx: evTx.hash
      };
    } else {
      result.value = { trace_code: created.trace_code, tx_hash: txHash ?? undefined };
    }
    notice.value = { type: "success", msg: "捐赠完成，请保存您的溯源码！" };
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

onMounted(load);
</script>

<template>
  <div class="container" v-if="!loading && project">
    <div class="card">
      <h2 style="margin:0 0 8px;">{{ project.name }}</h2>
      <p class="muted">{{ project.org_name }}</p>
      <p>{{ project.description }}</p>
      <div class="row" style="margin-top:12px;">
        <span class="tag">状态：{{ project.status }}</span>
        <span class="tag ok">已筹 {{ project.raised_amount }} ETH</span>
        <span class="tag">目标 {{ project.target_amount }} ETH</span>
        <span v-if="project.onchain_project_id" class="tag ok">链上 ID #{{ project.onchain_project_id }}</span>
        <span v-else class="tag warn">未绑定链上 ID</span>
      </div>
      <p class="muted hash" style="margin-top:8px;">info_hash: {{ project.info_hash }}</p>
    </div>

    <div class="card" v-if="canDonate">
      <h3>发起捐赠</h3>
      <label>捐赠金额 (ETH)</label>
      <input type="number" v-model.number="amount" step="0.001" min="0" />
      <label>捐赠模式</label>
      <select v-model="mode">
        <option value="onchain">真实链上捐赠（MetaMask）</option>
        <option value="demo">演示模式（不上链）</option>
      </select>
      <label v-if="mode === 'onchain'">
        <input type="checkbox" v-model="commitEvidence" /> 同时上链存证（推荐）
      </label>
      <div v-if="notice" :class="`notice ${notice.type}`">{{ notice.msg }}</div>
      <button style="margin-top:16px;" :disabled="submitting" @click="donate">
        {{ submitting ? "处理中..." : "立即捐赠" }}
      </button>

      <div v-if="result" class="notice success" style="margin-top:16px;">
        <p><strong>✓ 捐赠成功！</strong></p>
        <p>溯源码：<strong class="hash">{{ result.trace_code }}</strong>
          <router-link :to="`/trace/${result.trace_code}`" style="margin-left:8px;">查看时间轴 →</router-link>
        </p>
        <p v-if="result.tx_hash" class="hash muted">捐赠 tx: {{ result.tx_hash }}</p>
        <p v-if="result.evidence_tx" class="hash muted">存证 tx: {{ result.evidence_tx }}</p>
      </div>
    </div>

    <div class="card" v-if="progress.length">
      <h3>项目进展</h3>
      <div class="timeline">
        <div v-for="p in progress" :key="p.id" class="timeline-item">
          <strong>{{ p.title }}</strong>
          <p class="muted" style="margin:4px 0;">{{ p.created_at }}</p>
          <p style="margin:0;">{{ p.content }}</p>
          <p class="hash muted" style="margin-top:4px;">hash: {{ p.progress_hash }}</p>
        </div>
      </div>
    </div>
  </div>
  <p v-else class="container muted">加载中...</p>
</template>
