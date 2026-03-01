import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.SAADX25.cortextv',
  appName: 'Cortex TV',
  webDir: 'dist',
  android: {
    // Spoof the WebView's global User-Agent so even top-level navigations
    // and requests outside hls.js xhrSetup look like a desktop browser.
    overrideUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  plugins: {
    CapacitorHttp: {
      enabled: false // Disabled — native HTTP bridge can't handle large .ts chunk ArrayBuffers
    },
    StatusBar: {
      overlaysWebView: false, // This is the magic bullet!
      backgroundColor: '#0f172a', // A dark color to match the app header
      style: 'DARK' // Ensures white text for battery/time
    }
  }
};

export default config;
