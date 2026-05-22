<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "@/stores/auth";

const auth = useAuth();
const router = useRouter();
const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push("/");
  } catch (e: any) {
    error.value = e?.response?.data?.message || "登录失败";
  } finally {
    loading.value = false;
  }
}

function fillAdmin() {
  email.value = "admin@xqs.local";
  password.value = "admin123";
}
</script>

<template>
  <div class="auth-shell">
    <div class="auth-card">
      <h2>欢迎回来</h2>
      <p class="sub">登录账号继续使用 溯善链 SuShanChain</p>

      <label>邮箱</label>
      <input v-model="email" type="email" placeholder="you@example.com" />
      <label>密码</label>
      <input v-model="password" type="password" placeholder="******" @keyup.enter="submit" />

      <div v-if="error" class="notice error">{{ error }}</div>

      <button class="block lg" style="margin-top:20px;" :disabled="loading" @click="submit">
        {{ loading ? "登录中..." : "登录" }}
      </button>

      <div class="divider"></div>

      <div class="card inset" style="margin:0;padding:14px;font-size:13px;">
        <p style="margin:0 0 6px;font-weight:600;">💡 演示账号</p>
        <p class="muted" style="margin:0 0 8px;">默认管理员：admin@xqs.local / admin123</p>
        <button class="ghost sm" @click="fillAdmin">一键填入</button>
      </div>

      <p class="muted" style="margin-top:18px;text-align:center;">
        没有账号？<router-link to="/register">立即注册</router-link>
      </p>
    </div>
  </div>
</template>
