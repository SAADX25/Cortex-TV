import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/app/App";
import { configureNativeSystemBars } from "@/shared/lib/platformAdapter";
import "./index.css";

configureNativeSystemBars();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
