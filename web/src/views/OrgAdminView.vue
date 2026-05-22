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

async function load() {
  const r1 = await api.get("/org/me");
  org.value = r1.data.organization;
  if (org.value) {
    const r2 = await api.get("/org/projects");
    projects.value = r2.data.projects;
  }
  try {
    await wallet.loadContractInfo();
  } catch {
    /* ok */
  }
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
    // 解析 ProjectCreated 事件取 onchain projectId
    const event = receipt.events?.find((e: any) => e.event === "ProjectCreated");
    const onchainId = event ? Number(event.args.projectId) : Number(await contract.projectCount());
    await api.post(`/org/projects/${p.id}/bind-onchain`, { onchain_project_id: onchainId });
    notice.value = { type: "success", msg: `链上 ID ${onchainId} 已绑定，账户 ${account}` };
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
    // 链上存证
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
    <h2>机构后台</h2>
    <div v-if="notice" :class="`notice ${notice.type}`">{{ notice.msg }}</div>

    <div v-if="!org" class="card">
      <h3>提交机构入驻申请</h3>
      <label>机构名称</label>
      <input v-model="applyForm.name" />
      <label>机构简介</label>
      <textarea v-model="applyForm.intro" />
      <button style="margin-top:12px;" @click="applyOrg">提交申请</button>
    </div>

    <div v-else>
      <div class="card">
        <h3>{{ org.name }}
          <span :class="`tag ${org.status === 'approved' ? 'ok' : org.status === 'rejected' ? 'danger' : 'warn'}`">
            {{ org.status }}
          </span>
        </h3>
        <p class="muted">{{ org.intro }}</p>
      </div>

      <div class="card" v-if="org.status === 'approved'">
        <h3>新建项目</h3>
        <label>项目名称</label>
        <input v-model="projForm.name" />
        <label>目标金额 (ETH)</label>
        <input type="number" v-model.number="projForm.target_amount" step="0.01" min="0.01" />
        <label>项目说明</label>
        <textarea v-model="projForm.description" />
        <button style="margin-top:12px;" @click="createProj">创建项目（草稿）</button>
      </div>

      <div class="card">
        <h3>我的项目</h3>
        <p v-if="projects.length === 0" class="muted">还没有项目。</p>
        <div v-for="p in projects" :key="p.id" class="card" style="background:#f8fafc;">
          <div class="row" style="justify-content:space-between;">
            <strong>{{ p.name }}</strong>
            <span class="tag">{{ p.status }}</span>
          </div>
          <p class="muted">{{ p.description }}</p>
          <p class="muted">目标 {{ p.target_amount }} ETH · 已筹 {{ p.raised_amount }} ETH
            <span v-if="p.onchain_project_id" class="tag ok">链上 #{{ p.onchain_project_id }}</span>
          </p>
          <p v-if="p.reject_reason" class="notice error">驳回原因：{{ p.reject_reason }}</p>
          <div class="row" style="margin-top:8px;">
            <button v-if="p.status === 'draft' || p.status === 'rejected'" @click="submitForReview(p.id)">提交审核</button>
            <button v-if="p.status === 'approved'" @click="activate(p.id)">激活上线</button>
            <button v-if="p.status === 'active' && !p.onchain_project_id" class="ghost" @click="bindOnchain(p)">在合约上注册</button>
          </div>

          <div v-if="p.status === 'active'" style="margin-top:12px;border-top:1px dashed var(--border);padding-top:12px;">
            <h4>发布项目进展</h4>
            <input v-model="(progForms[p.id] ??= { title: '', content: '' }).title" placeholder="进展标题" />
            <textarea v-model="progForms[p.id].content" placeholder="进展详情" style="margin-top:8px;" />
            <button style="margin-top:8px;" @click="publishProgress(p)">发布进展（自动上链存证）</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
