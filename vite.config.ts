import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: "/Reenconstru-o/",

  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        sobre: path.resolve(__dirname, "Sobre.html"),
        flamengo: path.resolve(__dirname, "Flamengo.html"),
        jogo: path.resolve(__dirname, "Jogo.html"),
      },
    },
  },
});