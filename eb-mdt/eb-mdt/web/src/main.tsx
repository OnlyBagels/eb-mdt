import React from "react";
import ReactDOM from "react-dom/client";
import { VisibilityProvider } from "./providers/VisibilityProvider";
import MDTApp from "./components/MDTapp";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <VisibilityProvider componentName="MDT">
      <MDTApp />
    </VisibilityProvider>
  </React.StrictMode>
);
