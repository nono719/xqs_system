<script setup lang="ts">
import { useAuth } from "@/stores/auth";
import { useRouter } from "vue-router";

const auth = useAuth();
const router = useRouter();

function logout() {
  auth.logout();
  router.push("/");
}

const roleLabel: Record<string, string> = {
  donor: "捐赠者",
  org_admin: "机构",
  reviewer: "审核员",
  admin: "管理员"
};
</script>

<template>
  <header class="app-header">
    <div class="inner">
      <router-link to="/" class="brand">
        <span class="brand-icon">⛓</span>
        <span>XQS 公益溯源</span>
      </router-link>
      <router-link to="/" class="nav-link">首页</router-link>
      <router-link to="/trace" class="nav-link">溯源查询</router-link>
      <router-link v-if="auth.isLoggedIn" to="/my-donations" class="nav-link">我的捐赠</router-link>
      <router-link v-if="auth.user?.role === 'org_admin'" to="/org" class="nav-link">机构后台</router-link>
      <router-link v-if="auth.user?.role === 'reviewer' || auth.user?.role === 'admin'" to="/review" class="nav-link">审核后台</router-link>
      <router-link v-if="auth.user?.role === 'admin'" to="/admin" class="nav-link">平台管理</router-link>
      <span class="spacer"></span>
      <template v-if="auth.isLoggedIn">
        <span class="tag info dot">{{ roleLabel[auth.user!.role] || auth.user!.role }}</span>
        <span class="muted" style="font-size:13px;">{{ auth.user?.email }}</span>
        <button class="ghost sm" @click="logout">退出</button>
      </template>
      <template v-else>
        <router-link to="/login"><button class="ghost sm">登录</button></router-link>
        <router-link to="/register"><button class="sm">注册</button></router-link>
      </template>
    </div>
  </header>
  <main class="fade-in">
    <router-view />
  </main>
</template>
