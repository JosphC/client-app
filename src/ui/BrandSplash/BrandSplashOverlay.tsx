import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { BrandSplash, SPLASH_BG } from './BrandSplash';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash-ul nativ era deja ascuns — cel de brand acoperă ecranul oricum.
});

// 2600 ms loading + 1000 ms bun venit, apoi fade ca in varianta web.
const BRAND_SPLASH_MS = 3600;
const FADE_MS = 450;

/**
 * Hand-over without a visible jump: the native splash stays up until the
 * in-app logo is laid out at the exact same size and screen position (frame 0
 * of the animation = the native image); only then is the native one hidden
 * and the loading animation started.
 */
export function BrandSplashOverlay() {
  const [done, setDone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  const handleReady = useCallback(() => {
    SplashScreen.hideAsync()
      .catch(() => {
        // Deja ascuns — continuăm cu splash-ul de brand.
      })
      .finally(() => setPlaying(true));
  }, []);

  // Safety net: never keep the native splash up if layout never reports.
  useEffect(() => {
    const timer = setTimeout(handleReady, 3000);
    return () => clearTimeout(timer);
  }, [handleReady]);

  useEffect(() => {
    if (!playing) return undefined;
    let mounted = true;
    const timer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(({ finished }) => {
        if (finished && mounted) setDone(true);
      });
    }, BRAND_SPLASH_MS);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [playing, fade]);

  if (done) {
    return null;
  }
  return (
    <Animated.View style={[styles.overlay, { opacity: fade }]}>
      <BrandSplash testID="brand-splash" onReady={handleReady} play={playing} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BG,
  },
});
