import { defineConfig } from "vite";
export default defineConfig({
  base: "/drum-metronome/",
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: { usePolling: true, interval: 500 },
  },
});
