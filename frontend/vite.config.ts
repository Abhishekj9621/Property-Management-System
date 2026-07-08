import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE_PATH lets this app be built to run under a sub-path — e.g.
// `VITE_BASE_PATH=/admin/ npm run build` for local testing where a single
// combined server serves this app at localhost:XXXX/admin alongside the
// public website at localhost:XXXX/. Leave unset for normal deployment at
// its own subdomain (management.curatdconcepts.com), which is the default.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
