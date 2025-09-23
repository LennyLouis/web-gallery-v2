import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/login", "routes/login.tsx"),
  route("/dashboard", "routes/dashboard.tsx"),
  route("/album/:id", "routes/album.$id.tsx"),
  route("/admin", "routes/admin.tsx"),
  route("/admin/album/:id", "routes/admin.album.$id.tsx"),
] satisfies RouteConfig;
