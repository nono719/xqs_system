<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ethers } from "ethers";
import { api } from "@/api";
import { useWallet } from "@/stores/wallet";

const wallet = useWallet();
const org = ref<any>(null);
const projects = ref<any[]>([]);
const notice = ref<{ type: string; msg: string } | null>(null);

const applyForm = ref({ name: "", intro: "" });
const projForm = ref({ name: "", target_amount: 1, description: "" });
const progForms = ref<Record<string, { title: string; content: string }>>({});

const statusLabel: Record<string, { text: string; klass: string }> = {
  draft: { text: "📝 草稿", klass: "" },
  pending_review: { text: "⏳ 审核中", klass: "warn" },
  approved: { text: "✓ 审核通过", klass: "info" },
  rejected: { text: "✗ 已驳回", klass: "danger" },
  active: { text: "🟢 募捐中", klass: "ok" },
  closed: { text: "⏸ 已关闭", klass: "" }
};

async function load() {
  const r1 = await api.get("/org/me");
  org.value = r1.data.organization;
  if (org.value) {
    const r2 = await api.get("/org/projects");
    projects.value = r2.data.projects;
  }
  try { await wallet.loadContractInfo(); } catch { /* ok */ }
}

async function applyOrg() {
  notice.value = null;
  try {
    await api.post("/org/apply", applyForm.value);
    notice.value = { type: "success", msg: "已提交，等待平台管理员审批" };
    applyForm.value = { name: "", intro: "" };
    await load();
  } catch (e: any) {
    notice.value = { type: "error", msg: e?.response?.data?.message || "提交失败" };
  }
}

async function createProj() {
  notice.value = null;
  try {
    await api.post("/org/projects", projForm.value);
    projForm.value = { name: "", target_amount: 1, description: "" };
    notice.value = { type: "success", msg: "项目已创建（草稿）" };
    await load();
  } catch (e: any) {
    notice.value = { type: "error", msg: e?.response?.data?.message || "创建失败" };
  }
}

async function submitForReview(id: string) {
  await api.post(`/org/projects/${id}/submit`);
  await load();
}

async function activate(id: string) {
  await api.post(`/org/projects/${id}/activate`);
  await load();
}

async function bindOnchain(p: any) {
  notice.value = null;
  try {
    const { account, chainId } = await wallet.connect();
    if (wallet.contractInfo && chainId !== wallet.contractInfo.chainId) {
      notice.value = { type: "warn", msg: `请切换钱包至 chainId ${wallet.contractInfo.chainId}` };
      return;
    }
    const contract = wallet.getContract();
    const target = ethers.utils.parseEther(String(p.target_amount));
    const infoHash32 = "0x" + p.info_hash;
    const tx = await contract.createProject(target, infoHash32, { gasLimit: 200000 });
    notice.value = { type: "info", msg: "交易已提交，等待确认..." };
    const receipt = await tx.wait(1);
    const event = receipt.events?.find((e: any) => e.event === "ProjectCreated");
    const onchainId = event ? Number(event.args.projectId) : Number(await contract.projectCount());
    await api.post(`/org/projects/${p.id}/bind-onchain`, { onchain_project_id: onchainId });
    notice.value = { type: "success", msg: `链上 ID #${onchainId} 已绑定（账户 ${account.slice(0,10)}...）` };
    await load();
  } catch (e: any) {
    notice.value = { type: "error", msg: e?.message || "上链失败" };
  }
}

async function publishProgress(p: any) {
  const form = progForms.value[p.id];
  if (!form?.title) return;
  notice.value = null;
  try {
    const { data: created } = await api.post(`/org/projects/${p.id}/progress`, form);
    if (wallet.contractInfo?.address) {
      try {
        await wallet.connect();
        const contract = wallet.getContract();
        const key = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(["string", "string"], ["progress", created.id])
        );
        const dataHash32 = "0x" + created.progress_hash;
        const tx = await contract.commitEvidence(key, dataHash32, { gasLimit: 120000 });
        const receipt = await tx.wait(1);
        await api.put(`/org/progress/${created.id}/evidence`, {
          tx_hash: tx.hash,
          block_number: receipt.blockNumber
        });
        notice.value = { type: "success", msg: "进展已发布并上链存证" };
      } catch (e: any) {
        notice.value = { type: "warn", msg: "进展已保存，但上链存证失败：" + (e?.message ?? "") };
      }
    } else {
      notice.value = { type: "success", msg: "进展已保存" };
    }
    progForms.value[p.id] = { title: "", content: "" };
    await load();
  } catch (e: any) {
    notice.value = { type: "error", msg: e?.response?.data?.message || "发布失败" };
  }
}

onMounted(load);
</script>

<template>
  <div class="container">
    <h2>🏛 机构后台</h2>
    <div v-if="notice" :class="`notice ${notice.type}`">{{ notice.msg }}</div>

    <!-- 未入驻 -->
    <div v-if="!org" class="card">
      <h3>提交机构入驻申请</h3>
      <p class="muted" style="margin:-4px 0 8px;">填写后等待平台管理员审批，通过后即可发布公益项目。</p>
      <label>机构名称</label>
      <input v-model="applyForm.name" placeholder="如：希望工程基金会" />
      <label>机构简介</label>
      <textarea v-model="applyForm.intro" placeholder="介绍机构使命、资质等..." />
      <button class="lg" style="margin-top:16px;" @click="applyOrg">📤 提交申请</button>
    </div>

    <!-- 已入驻 -->
    <div v-else>
      <div class="card">
        <div class="row" style="justify-content:space-between;">
          <div>
            <h3 style="margin:0 0 6px;">{{ org.name }}</h3>
            <p class="muted" style="margin:0;">{{ org.intro }}</p>
          </div>
          <span :class="`tag ${org.status === 'approved' ? 'ok' : org.status === 'rejected' ? 'danger' : 'warn'} dot`">
            {{ org.status === 'approved' ? '已认证' : org.status === 'rejected' ? '已驳回' : '审批中' }}
          </span>
        </div>
      </div>

      <div v-if="org.status === 'pending'" class="notice info">
        申请正在审批中，审核员处理完毕后方可创建项目。
      </div>

      <div class="card" v-if="org.status === 'approved'">
        <h3>➕ 新建项目</h3>
        <label>项目名称</label>
        <input v-model="projForm.name" placeholder="如：山区儿童读书计划" />
        <label>目标金额 (ETH)</label>
        <input type="number" v-model.number="projForm.target_amount" step="0.01" min="0.01" />
        <label>项目说明</label>
        <textarea v-model="projForm.description" placeholder="项目背景、资金用途..." />
        <button class="lg" style="margin-top:16px;" @click="createProj">创建项目（草稿）</button>
      </div>

      <h3 style="margin-top:24px;">📋 我的项目</h3>
      <p v-if="projects.length === 0" class="muted">还没有项目。</p>
      <div v-for="p in projects" :key="p.id" class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:8px;">
          <strong style="font-size:16px;">{{ p.name }}</strong>
          <span :class="`tag ${statusLabel[p.status]?.klass || ''} dot`">{{ statusLabel[p.status]?.text || p.status }}</span>
        </div>
        <p class="muted" style="margin:0 0 10px;">{{ p.description }}</p>
        <div class="progress-text">
          <span>已筹 <strong>{{ p.raised_amount }} ETH</strong></span>
          <span>目标 {{ p.target_amount }} ETH</span>
        </div>
        <div class="progress-bar">
          <div class="fill" :style="`width:${Math.min(100, (p.raised_amount/p.target_amount)*100)}%`"></div>
        </div>
        <p v-if="p.onchain_project_id" class="muted" style="margin:10px 0 0;font-size:13px;">
          <span class="tag info dot">链上 #{{ p.onchain_project_id }}</span>
        </p>
        <div v-if="p.reject_reason" class="notice error" style="margin-top:10px;">
          驳回原因：{{ p.reject_reason }}
        </div>

        <div class="row" style="margin-top:14px;gap:8px;">
          <button v-if="p.status === 'draft' || p.status === 'rejected'" @click="submitForReview(p.id)">提交审核</button>
          <button v-if="p.status === 'approved'" @click="activate(p.id)">🚀 激活上线</button>
          <button v-if="p.status === 'active' && !p.onchain_project_id" class="ghost" @click="bindOnchain(p)">⛓ 在合约上注册</button>
        </div>

        <div v-if="p.status === 'active'" class="card inset" style="margin:14px 0 0;padding:14px;">
          <h4 style="margin:0 0 8px;">📅 发布项目进展</h4>
          <input v-model="(progForms[p.id] ??= { title: '', content: '' }).title" placeholder="进展标题" />
          <textarea v-model="progForms[p.id].content" placeholder="进展详情..." style="margin-top:8px;" />
          <button class="sm" style="margin-top:8px;" @click="publishProgress(p)">📤 发布（自动上链存证）</button>
        </div>
      </div>
    </div>
  </div>
</template>
