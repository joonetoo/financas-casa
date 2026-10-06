import React from "react";
import ReactDOM from "react-dom/client";
import Shell from "./Shell.jsx";
import { Porteiro } from "./Entrar.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Porteiro>
      <Shell />
    </Porteiro>
  </React.StrictMode>
);

// Nível 1 do offline: guarda uma cópia do app (não dos dados) pra ele abrir
// mesmo sem internet. Só em produção — no servidor de teste/dev isso só
// atrapalharia (nunca quer cache velho enquanto se está editando o código).
if (!import.meta.env.DEV && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
