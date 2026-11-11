import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initializeDemoDefaults } from "./demoDefaults";
import { applyExistingTokenMode, readWindowAppearance } from "./windowAppearance";
import { reflectPageActivity } from "./pageActivity";
import { prepareOfficialWallpaperMedia } from "./personalized-home-2-0/themes/officialWallpapers";
import AutoUpdate from './updates/AutoUpdate';

initializeDemoDefaults(localStorage, !import.meta.env.DEV);
applyExistingTokenMode(readWindowAppearance());
reflectPageActivity();
await prepareOfficialWallpaperMedia();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App/>
    <AutoUpdate/>
  </React.StrictMode>,
);
