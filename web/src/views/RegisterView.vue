<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "@/stores/auth";

const auth = useAuth();
const router = useRouter();
const email = ref("");
const password = ref("");
const role = ref<"donor" | "org_admin">("donor");
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await auth.register(email.value, password.value, role.value);
    router.push("/");
  } catch (e: any) {
    error.value = e?.response?.data?.message || "注册失败";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-shell">
    <div class="auth-card">
      <h2>注册账号</h2>
      <p class="sub">加入 溯善链 SuShanChain</p>

      <label>邮箱</label>
      <input v-model="email" type="email" placeholder="you@example.com" />
      <label>密码（≥6 位）</label>
      <input v-model="password" type="password" placeholder="******" />

      <label>注册类型</label>
      <div class="row" style="gap:10px;">
        <label
          style="margin:0;padding:14px;border:1.5px solid var(--border);border-radius:var(--r);cursor:pointer;flex:1;display:flex;align-items:center;gap:10px;transition:all .15s;"
          :style="role === 'donor' ? 'border-color:var(--primary);background:var(--primary-soft);' : ''"
        >
          <input type="radio" value="donor" v-model="role" style="width:auto;margin:0;" />
          <span>
            <strong style="font-size:14px;color:var(--text);">💝 捐赠者</strong>
            <span class="faint" style="display:block;">浏览项目并发起捐款</span>
          </span>
        </label>
        <label
          style="margin:0;padding:14px;border:1.5px solid var(--border);border-radius:var(--r);cursor:pointer;flex:1;display:flex;align-items:center;gap:10px;transition:all .15s;"
          :style="role === 'org_admin' ? 'border-color:var(--primary);background:var(--primary-soft);' : ''"
        >
          <input type="radio" value="org_admin" v-model="role" style="width:auto;margin:0;" />
          <span>
            <strong style="font-size:14px;color:var(--text);">🏛 机构管理员</strong>
            <span class="faint" style="display:block;">提交入驻并发布项目</span>
          </span>
        </label>
      </div>

      <div v-if="error" class="notice error">{{ error }}</div>

      <button class="block lg" style="margin-top:20px;" :disabled="loading" @click="submit">
        {{ loading ? "注册中..." : "立即注册" }}
      </button>

      <p class="muted" style="margin-top:18px;text-align:center;">
        已有账号？<router-link to="/login">前往登录</router-link>
      </p>
    </div>
  </div>
</template>
