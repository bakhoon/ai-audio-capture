import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages 주소가 https://bakhoon.github.io/ai-audio-capture/ 라서 base 를 맞춤
export default defineConfig({
  base: "/ai-audio-capture/",
  plugins: [react()],
});
