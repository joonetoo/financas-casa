import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

// `vite build --mode beta` gera a versão de teste: outro nome no ícone e na
// aba do navegador, pra nunca confundir com o app de verdade.
function nomeBeta(mode) {
  return {
    name: "nome-beta",
    transformIndexHtml(html) {
      return mode === "beta" ? html.replace(/<title>.*?<\/title>/, "<title>Oink BETA</title>") : html;
    },
    closeBundle() {
      if (mode !== "beta") return;
      const p = path.resolve("dist/manifest.json");
      if (!fs.existsSync(p)) return;
      const m = JSON.parse(fs.readFileSync(p, "utf8"));
      m.name = "Oink BETA";
      m.short_name = "Oink BETA";
      m.description = "Versão de teste do Oink";
      fs.writeFileSync(p, JSON.stringify(m, null, 2));
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), nomeBeta(mode)],
}));
