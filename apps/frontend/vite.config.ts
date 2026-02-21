import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          // Split third-party deps by package for better cacheability and smaller chunks.
          const packagePath = id.split("node_modules/")[1];
          const packageName = packagePath?.startsWith("@")
            ? packagePath.split("/").slice(0, 2).join("/")
            : packagePath?.split("/")[0];

          if (!packageName) {
            return "vendor";
          }

          return `vendor-${packageName.replace("/", "-")}`;
        },
      },
    },
  },
});
