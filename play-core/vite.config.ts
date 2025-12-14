import { defineConfig } from "vite";

export default defineConfig({
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
  },
});
