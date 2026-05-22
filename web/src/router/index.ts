import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";
import { useAuth } from "@/stores/auth";

const routes: RouteRecordRaw[] = [
  { path: "/", component: () => import("@/views/HomeView.vue") },
  { path: "/projects/:id", component: () => import("@/views/ProjectDetailView.vue") },
  { path: "/login", component: () => import("@/views/LoginView.vue") },
  { path: "/register", component: () => import("@/views/RegisterView.vue") },
  { path: "/trace", component: () => import("@/views/TraceView.vue") },
  { path: "/trace/:code", component: () => import("@/views/TraceView.vue") },
  { path: "/my-donations", component: () => import("@/views/MyDonationsView.vue"), meta: { auth: true } },
  { path: "/org", component: () => import("@/views/OrgAdminView.vue"), meta: { auth: true, role: "org_admin" } },
  { path: "/review", component: () => import("@/views/ReviewAdminView.vue"), meta: { auth: true, role: "reviewer" } },
  { path: "/admin", component: () => import("@/views/PlatformAdminView.vue"), meta: { auth: true, role: "admin" } }
];

const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach((to) => {
  const auth = useAuth();
  if (to.meta.auth && !auth.isLoggedIn) return "/login";
  if (to.meta.role && auth.user?.role !== to.meta.role && auth.user?.role !== "admin") {
    return "/";
  }
  return true;
});

export default router;
