import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import App from "./App";
import "./index.css";

if (Capacitor.isNativePlatform()) {
  void Promise.allSettled([
    SystemBars.show({ bar: SystemBarType.StatusBar }),
    SystemBars.setStyle({ style: SystemBarsStyle.Dark, bar: SystemBarType.StatusBar }),
    StatusBar.show(),
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.setBackgroundColor({ color: "#0A192F" }),
    StatusBar.setOverlaysWebView({ overlay: false }),
  ]);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
