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
  <div class="container" style="max-width:420px;">
    <div class="card">
      <h2>注册</h2>
      <label>邮箱</label>
      <input v-model="email" type="email" />
      <label>密码（≥6位）</label>
      <input v-model="password" type="password" />
      <label>注册类型</label>
      <select v-model="role">
        <option value="donor">捐赠者</option>
        <option value="org_admin">机构管理员</option>
      </select>
      <div v-if="error" class="notice error">{{ error }}</div>
      <button style="width:100%;margin-top:16px;" :disabled="loading" @click="submit">
        {{ loading ? "注册中..." : "立即注册" }}
      </button>
    </div>
  </div>
</template>
