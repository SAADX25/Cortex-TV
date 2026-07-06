import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { Platform } from "@/shared/types";

export function isElectronPlatform(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent.toLowerCase().includes("electron")
  );
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): Platform {
  if (isElectronPlatform()) return "electron";
  if (Capacitor.getPlatform() === "ios") return "ios";
  if (Capacitor.getPlatform() === "android") return "android";
  return "web";
}

export function configureNativeSystemBars(): void {
  if (!isNativePlatform()) return;

  void Promise.allSettled([
    SystemBars.show({ bar: SystemBarType.StatusBar }),
    SystemBars.setStyle({ style: SystemBarsStyle.Dark, bar: SystemBarType.StatusBar }),
    StatusBar.show(),
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.setBackgroundColor({ color: "#0A192F" }),
    StatusBar.setOverlaysWebView({ overlay: false }),
  ]);
}
