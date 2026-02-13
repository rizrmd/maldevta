import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("install", "routes/install.tsx"),
	route("login", "routes/login.tsx"),
	route("subclient-login", "routes/subclient-login.tsx"),
] satisfies RouteConfig;
