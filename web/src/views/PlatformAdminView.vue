<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/api";

const users = ref<any[]>([]);
const orgs = ref<any[]>([]);
const projects = ref<any[]>([]);
const newReviewer = ref({ email: "", password: "" });
const notice = ref<{ type: string; msg: string } | null>(null);

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
    notice.value = { type: "success", msg: "审核员账号已创建" };
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
    <h2>平台管理</h2>
    <div v-if="notice" :class="`notice ${notice.type}`">{{ notice.msg }}</div>

    <div class="card">
      <h3>创建审核员账号</h3>
      <div class="row">
        <input v-model="newReviewer.email" placeholder="邮箱" />
        <input v-model="newReviewer.password" type="password" placeholder="密码（≥6位）" />
        <button @click="createReviewer">创建</button>
      </div>
    </div>

    <div class="card">
      <h3>用户列表（{{ users.length }}）</h3>
      <table>
        <thead><tr><th>邮箱</th><th>角色</th><th>机构</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.email }}</td>
            <td><span class="tag">{{ u.role }}</span></td>
            <td class="hash muted">{{ u.org_id || '-' }}</td>
            <td>
              <span :class="`tag ${u.disabled ? 'danger' : 'ok'}`">{{ u.disabled ? '禁用' : '正常' }}</span>
            </td>
            <td>
              <button v-if="u.role !== 'admin'" class="ghost" @click="toggleDisable(u)">
                {{ u.disabled ? '启用' : '禁用' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3>机构列表（{{ orgs.length }}）</h3>
      <table>
        <thead><tr><th>名称</th><th>简介</th><th>状态</th><th>创建时间</th></tr></thead>
        <tbody>
          <tr v-for="o in orgs" :key="o.id">
            <td>{{ o.name }}</td>
            <td>{{ o.intro }}</td>
            <td>
              <span :class="`tag ${o.status === 'approved' ? 'ok' : o.status === 'rejected' ? 'danger' : 'warn'}`">
                {{ o.status }}
              </span>
            </td>
            <td>{{ o.created_at }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3>全平台项目（{{ projects.length }}）</h3>
      <table>
        <thead><tr><th>项目</th><th>机构</th><th>状态</th><th>已筹/目标</th><th>链上 ID</th></tr></thead>
        <tbody>
          <tr v-for="p in projects" :key="p.id">
            <td>{{ p.name }}</td>
            <td>{{ p.org_name }}</td>
            <td><span class="tag">{{ p.status }}</span></td>
            <td>{{ p.raised_amount }} / {{ p.target_amount }} ETH</td>
            <td>{{ p.onchain_project_id || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
