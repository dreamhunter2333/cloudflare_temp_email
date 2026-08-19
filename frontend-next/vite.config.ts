import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/open_api": "http://127.0.0.1:8787",
      "/user_api": "http://127.0.0.1:8787",
      "/telegram": "http://127.0.0.1:8787",
    },
  },
})
