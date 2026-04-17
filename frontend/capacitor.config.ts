import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.attendance.tracker',
  appName: 'AttendTrack',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: ["192.168.2.107"]
  }
};

export default config;
