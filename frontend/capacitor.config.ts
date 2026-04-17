import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendance.tracker',
  appName: 'AttendTrack',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: ["100.83.250.58"]
  }
};

export default config;
