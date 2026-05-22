<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "@/api";

const list = ref<any[]>([]);
const loading = ref(true);

onMounted(async () => {
  const { data } = await api.get("/donations/mine");
  list.value = data.donations;
  loading.value = false;
});
</script>

<template>
  <div class="container">
    <h2>我的捐赠</h2>
    <p v-if="loading" class="muted">加载中...</p>
    <div v-else-if="list.length === 0" class="card muted">您还没有捐赠记录。</div>
    <div v-else class="card">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>项目</th>
            <th>金额</th>
            <th>模式</th>
            <th>溯源码</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in list" :key="d.id">
            <td>{{ d.created_at }}</td>
            <td>{{ d.project_name }}</td>
            <td>{{ d.amount }} {{ d.currency }}</td>
            <td><span class="tag">{{ d.mode }}</span></td>
            <td>
              <router-link :to="`/trace/${d.trace_code}`" class="hash">{{ d.trace_code }}</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
