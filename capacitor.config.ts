import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bouncymelody.app',
  appName: 'Bouncy Melody',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#1a0a2e'
  }
};

export default config;
