import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initializeDemoDefaults } from "./demoDefaults";
import { applyExistingTokenMode, readWindowAppearance } from "./windowAppearance";

initializeDemoDefaults(localStorage, !import.meta.env.DEV);
applyExistingTokenMode(readWindowAppearance());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>,
);
