import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.sevagis.app',
  appName: 'SEVA.GIS',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true,
    url: 'https://sevagis.dpdns.org',
    allowNavigation: [
      'sevagis.dpdns.org',
      'open-meteo.com',
      '*.open-meteo.com',
      'planetarycomputer.microsoft.com',
      '*.tile.openstreetmap.org',
      'server.arcgisonline.com',
      'earthengine.googleapis.com',
    ],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#07110c',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
