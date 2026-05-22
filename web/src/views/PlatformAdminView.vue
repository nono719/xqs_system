<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { api } from "@/api";

const users = ref<any[]>([]);
const orgs = ref<any[]>([]);
const projects = ref<any[]>([]);
const newReviewer = ref({ email: "", password: "" });
const notice = ref<{ type: string; msg: string } | null>(null);
const tab = ref<"users" | "orgs" | "projects">("users");

const stats = computed(() => ({
  users: users.value.length,
  orgs: orgs.value.length,
  orgsApproved: orgs.value.filter((o) => o.status === "approved").length,
  projects: projects.value.length,
  projectsActive: projects.value.filter((p) => p.status === "active").length
}));

const roleColor: Record<string, string> = {
  admin: "danger",
  reviewer: "warn",
  org_admin: "info",
  donor: ""
};

async function load() {
  const r1 = await api.get("/admin/users");
  users.value = r1.data.users;
  const r2 = await api.get("/admin/organizations");
  orgs.value = r2.data.organizations;
  const r3 = await api.get("/admin/projects");
  projects.value = r3.data.projects;
}

async function createReviewer() {
  notice.value = null;
  try {
    await api.post("/admin/reviewers", newReviewer.value);
    notice.value = { type: "success", msg: "✓ 审核员账号已创建" };
    newReviewer.value = { email: "", password: "" };
    await load();
  } catch (e: any) {
    notice.value = { type: "error", msg: e?.response?.data?.message || "创建失败" };
  }
}

async function toggleDisable(u: any) {
  await api.post(`/admin/users/${u.id}/disable`, { disabled: !u.disabled });
  await load();
}

onMounted(load);
</script>

<template>
  <div class="container">
    <h2>⚙️ 平台管理</h2>

    <!-- 统计卡片 -->
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:18px;">
      <div class="card" style="margin:0;">
        <p class="muted" style="margin:0 0 4px;font-size:13px;">用户总数</p>
        <p style="margin:0;font-size:26px;font-weight:700;">{{ stats.users }}</p>
      </div>
      <div class="card" style="margin:0;">
        <p class="muted" style="margin:0 0 4px;font-size:13px;">机构</p>
        <p style="margin:0;font-size:26px;font-weight:700;">
          {{ stats.orgsApproved }}<span class="muted" style="font-size:14px;font-weight:400;"> / {{ stats.orgs }}</span>
        </p>
      </div>
      <div class="card" style="margin:0;">
        <p class="muted" style="margin:0 0 4px;font-size:13px;">项目</p>
        <p style="margin:0;font-size:26px;font-weight:700;">
          {{ stats.projectsActive }}<span class="muted" style="font-size:14px;font-weight:400;"> / {{ stats.projects }} 活跃</span>
        </p>
      </div>
    </div>

    <div v-if="notice" :class="`notice ${notice.type}`">{{ notice.msg }}</div>

    <div class="card">
      <h3>➕ 创建审核员账号</h3>
      <div class="row" style="gap:8px;align-items:flex-end;">
        <div style="flex:2;">
          <label style="margin-top:0;">邮箱</label>
          <input v-model="newReviewer.email" placeholder="reviewer@xqs.local" />
        </div>
        <div style="flex:2;">
          <label style="margin-top:0;">密码（≥6 位）</label>
          <input v-model="newReviewer.password" type="password" placeholder="******" />
        </div>
        <button style="height:42px;" @click="createReviewer">创建</button>
      </div>
    </div>

    <div class="card">
      <div class="row" style="gap:4px;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:0;">
        <button :class="tab === 'users' ? '' : 'ghost'" class="sm" @click="tab = 'users'">👥 用户 ({{ users.length }})</button>
        <button :class="tab === 'orgs' ? '' : 'ghost'" class="sm" @click="tab = 'orgs'">🏛 机构 ({{ orgs.length }})</button>
        <button :class="tab === 'projects' ? '' : 'ghost'" class="sm" @click="tab = 'projects'">📋 项目 ({{ projects.length }})</button>
      </div>

      <table v-if="tab === 'users'">
        <thead>
          <tr><th>邮箱</th><th>角色</th><th>机构</th><th>状态</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.email }}</td>
            <td><span :class="`tag ${roleColor[u.role] || ''}`">{{ u.role }}</span></td>
            <td><code v-if="u.org_id" class="hash">{{ u.org_id.slice(0,12) }}...</code><span v-else class="faint">-</span></td>
            <td>
              <span :class="`tag ${u.disabled ? 'danger' : 'ok'} dot`">{{ u.disabled ? '禁用' : '正常' }}</span>
            </td>
            <td>
              <button v-if="u.role !== 'admin'" class="ghost sm" @click="toggleDisable(u)">
                {{ u.disabled ? '启用' : '禁用' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <table v-if="tab === 'orgs'">
        <thead><tr><th>名称</th><th>简介</th><th>状态</th><th>创建时间</th></tr></thead>
        <tbody>
          <tr v-for="o in orgs" :key="o.id">
            <td><strong>{{ o.name }}</strong></td>
            <td class="muted" style="max-width:340px;">{{ o.intro }}</td>
            <td>
              <span :class="`tag ${o.status === 'approved' ? 'ok' : o.status === 'rejected' ? 'danger' : 'warn'} dot`">
                {{ o.status }}
              </span>
            </td>
            <td class="muted">{{ new Date(o.created_at).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>

      <table v-if="tab === 'projects'">
        <thead><tr><th>项目</th><th>机构</th><th>状态</th><th>已筹/目标</th><th>链上 ID</th></tr></thead>
        <tbody>
          <tr v-for="p in projects" :key="p.id">
            <td><strong>{{ p.name }}</strong></td>
            <td>{{ p.org_name }}</td>
            <td><span class="tag dot">{{ p.status }}</span></td>
            <td><strong>{{ p.raised_amount }}</strong> / {{ p.target_amount }} ETH</td>
            <td>
              <span v-if="p.onchain_project_id" class="tag info">#{{ p.onchain_project_id }}</span>
              <span v-else class="faint">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
