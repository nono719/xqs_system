import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "@/api";

export type Role = "donor" | "org_admin" | "reviewer" | "admin";
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  org_id?: string | null;
}

export const useAuth = defineStore("auth", () => {
  const token = ref<string | null>(localStorage.getItem("token"));
  const user = ref<AuthUser | null>(
    localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")!) : null
  );

  const isLoggedIn = computed(() => !!token.value);

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data.user;
  }

  async function register(email: string, password: string, role: "donor" | "org_admin") {
    await api.post("/auth/register", { email, password, role });
    return login(email, password);
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  return { token, user, isLoggedIn, login, register, logout };
});
