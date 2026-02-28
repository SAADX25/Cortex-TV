import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.SAADX25.cortextv',
  appName: 'Cortex TV',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: false, // This is the magic bullet!
      backgroundColor: '#0f172a', // A dark color to match the app header
      style: 'DARK' // Ensures white text for battery/time
    }
  }
};

export default config;
