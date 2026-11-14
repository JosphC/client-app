// Native splash = frame 0 of the in-app loading logo (src/ui/BrandSplash), same
// size and centre so the hand-over shows no jump. Keep SPLASH_LOGO_DP in sync with
// src/ui/BrandSplash/cycle.ts. 184 dp keeps the bus inside Android 12+'s 192 dp
// icon circle (the system clips anything outside it).
const SPLASH_LOGO_DP = 184;
const SPLASH_BG = '#FFFFFF';
const SPLASH_IMAGE = './assets/splash-logo.png';

/**
 * react-native-ble-plx declară BLUETOOTH_SCAN cu `neverForLocation` în manifestul bibliotecii, iar la îmbinare flagul
 * rămâne. Pe Android 12+ sistemul ascunde atunci beaconurile (iBeacon) de aplicație: se văd alte dispozitive BLE, dar
 * nu ESP32. Scoatem flagul explicit (`tools:remove`).
 */
const withBleScanSeesBeacons = (config) => {
  const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Manifest.ensureToolsAvailable(cfg.modResults);
    const perms = cfg.modResults.manifest['uses-permission'] ?? [];
    const scan = perms.find((p) => p.$['android:name'] === 'android.permission.BLUETOOTH_SCAN');
    if (scan) {
      delete scan.$['android:usesPermissionFlags'];
      scan.$['tools:remove'] = 'android:usesPermissionFlags';
    }
    cfg.modResults.manifest['uses-permission'] = perms;
    return cfg;
  });
};

/**
 * Serverul de test al sighting-urilor e pe LAN, în HTTP (ex. http://192.168.1.104:8000). Android blochează HTTP în clar
 * în build-urile release, deci îl permitem DOAR când EXPO_PUBLIC_SIGHTINGS_URL începe cu http://. Scoate-l înainte de producție.
 */
const withCleartextForTestServer = (config) => {
  if (!String(process.env.EXPO_PUBLIC_SIGHTINGS_URL ?? '').startsWith('http://')) return config;
  const { withAndroidManifest } = require('@expo/config-plugins');
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });
};

module.exports = {
  expo: {
    name: 'EchoPass',
    slug: 'echopass-app',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'echopass',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    splash: {
      image: SPLASH_IMAGE,
      resizeMode: 'contain',
      backgroundColor: SPLASH_BG,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'ro.echopass.app',
      icon: './assets/icon.png',
      infoPlist: {
        NSBluetoothAlwaysUsageDescription:
          'EchoPass detectează autobuzul din apropiere prin Bluetooth pentru check-in automat.',
        NSMicrophoneUsageDescription:
          'Microfonul este folosit 3 secunde pentru a confirma prezența în autobuz printr-un cod ultrasonic. Nu se înregistrează vocea.',
        NSUserNotificationUsageDescription: 'EchoPass trimite notificări de plată, sosiri și alerte de trafic.',
        NSLocationWhenInUseUsageDescription: 'EchoPass îți arată poziția pe hartă lângă autobuzele live.',
      },
    },
    android: {
      package: 'ro.echopass.app',
      icon: './assets/icon.png',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      permissions: ['BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT', 'RECORD_AUDIO', 'POST_NOTIFICATIONS', 'ACCESS_FINE_LOCATION'],
    },
    extra: {
      eas: {
        projectId: '0a4cc337-e293-4147-a867-7e2fca9b5959',
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        { image: SPLASH_IMAGE, imageWidth: SPLASH_LOGO_DP, resizeMode: 'contain', backgroundColor: SPLASH_BG },
      ],
      'expo-localization',
      'expo-dev-client',
      '@maplibre/maplibre-react-native',
      [
        'react-native-ble-plx',
        {
          isBackgroundEnabled: true,
          modes: ['central'],
          // Beacons are filtered out of scan results when the scan disclaims location.
          neverForLocation: false,
          bluetoothAlwaysPermission:
            'EchoPass detectează autobuzul din apropiere prin Bluetooth pentru check-in automat.',
        },
      ],
      withBleScanSeesBeacons,
      withCleartextForTestServer,
    ],
  },
};
