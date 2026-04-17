import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendance.tracker',
  appName: 'AttendTrack',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: ["10.18.187.159"]
  }
};

export default config;
