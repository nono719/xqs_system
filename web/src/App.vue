<script setup lang="ts">
import { useAuth } from "@/stores/auth";
import { useRouter } from "vue-router";

const auth = useAuth();
const router = useRouter();

function logout() {
  auth.logout();
  router.push("/");
}
</script>

<template>
  <header style="background:white;border-bottom:1px solid var(--border);padding:12px 24px;">
    <div style="max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:16px;">
      <strong style="color:var(--primary);font-size:18px;">🔗 XQS 公益溯源</strong>
      <router-link to="/">首页</router-link>
      <router-link to="/trace">溯源查询</router-link>
      <router-link v-if="auth.isLoggedIn" to="/my-donations">我的捐赠</router-link>
      <router-link v-if="auth.user?.role === 'org_admin'" to="/org">机构后台</router-link>
      <router-link v-if="auth.user?.role === 'reviewer' || auth.user?.role === 'admin'" to="/review">审核后台</router-link>
      <router-link v-if="auth.user?.role === 'admin'" to="/admin">平台管理</router-link>
      <span style="flex:1;"></span>
      <template v-if="auth.isLoggedIn">
        <span class="muted">{{ auth.user?.email }} ({{ auth.user?.role }})</span>
        <button class="ghost" @click="logout">退出</button>
      </template>
      <template v-else>
        <router-link to="/login"><button class="ghost">登录</button></router-link>
        <router-link to="/register"><button>注册</button></router-link>
      </template>
    </div>
  </header>
  <main>
    <router-view />
  </main>
</template>
