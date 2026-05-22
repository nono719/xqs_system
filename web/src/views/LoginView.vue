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
</script>

<template>
  <div class="container" style="max-width:420px;">
    <div class="card">
      <h2>登录</h2>
      <label>邮箱</label>
      <input v-model="email" type="email" />
      <label>密码</label>
      <input v-model="password" type="password" @keyup.enter="submit" />
      <div v-if="error" class="notice error">{{ error }}</div>
      <button style="width:100%;margin-top:16px;" :disabled="loading" @click="submit">
        {{ loading ? "登录中..." : "登录" }}
      </button>
      <p class="muted" style="margin-top:12px;text-align:center;">
        默认管理员：admin@xqs.local / admin123<br />
        没有账号？<router-link to="/register">点此注册</router-link>
      </p>
    </div>
  </div>
</template>
