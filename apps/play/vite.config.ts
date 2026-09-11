import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  /** Host domain'inde /join altında sunulur (Next rewrite); asset yolları buna göre. */
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
