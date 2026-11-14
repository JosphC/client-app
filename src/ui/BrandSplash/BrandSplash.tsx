import { useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SplashBusSvg, playSplashOnce, stopSplashLoop } from './SplashBusSvg';
import { barAlpha, loadAlpha, splashLayout, welcomeAlpha, type SplashLayout } from './cycle';

export const SPLASH_BG = '#FFFFFF';
/** Material 3 linear progress: thin rounded track, one solid brand colour (the logo's blue). */
const BAR_FILL = '#1E62B5';
const BAR_TRACK = '#E8EAED';
const TEXT_MUTED = '#5F6368';
const LOADING_LABEL = 'Aplicația se încarcă...';
const WELCOME_LABEL = 'Welcome, sunteți conectați!';

interface BrandSplashProps {
  testID?: string;
  /** Called once the logo sits exactly where the native splash draws it (safe to hide the native one). */
  onReady?: () => void;
  /** Start the loading animation (after the native splash is gone, so frame 0 is what hands over). */
  play?: boolean;
}

/**
 * Loading screen in the Google style: the logo (same place and size as the
 * native splash), a thin linear progress bar under it and one quiet line of
 * text. One 2600 ms run, then the welcome line replaces the loading one.
 */
export function BrandSplash({ testID, onReady, play = true }: BrandSplashProps) {
  const cyc = useSharedValue(0);
  const rootRef = useRef<View>(null);
  const { width: winW } = useWindowDimensions();
  const [layout, setLayout] = useState<SplashLayout | null>(null);
  const barW = Math.min(winW * 0.45, 168);

  useEffect(() => {
    if (!play) return undefined;
    playSplashOnce(cyc);
    return () => {
      stopSplashLoop(cyc);
    };
  }, [cyc, play]);

  useEffect(() => {
    if (!layout || !onReady) return undefined;
    // One frame after the logo is placed, so it is on screen before the native splash goes.
    const frame = requestAnimationFrame(() => onReady());
    return () => cancelAnimationFrame(frame);
  }, [layout, onReady]);

  const measure = (viewWidth: number) => {
    rootRef.current?.measureInWindow((_x, y) => {
      // Android reports y below the status bar (an edge-to-edge view at the very top gives
      // -statusBar); the native splash is centred on the whole screen, so convert to screen y.
      const statusBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
      const screenY = (Number.isFinite(y) ? y : 0) + statusBar;
      setLayout(splashLayout(Dimensions.get('screen').height, viewWidth, screenY));
    });
  };

  const loadStyle = useAnimatedStyle(() => ({ opacity: loadAlpha(cyc.value) }));
  const welcomeStyle = useAnimatedStyle(() => ({ opacity: welcomeAlpha(cyc.value) }));
  const barStyle = useAnimatedStyle(() => ({ opacity: barAlpha(cyc.value) }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.min(cyc.value, 1) * 100}%` }));

  return (
    <View ref={rootRef} testID={testID} style={styles.root} onLayout={(e) => measure(e.nativeEvent.layout.width)}>
      {layout ? (
        <>
          {/* Same box, size and centre as the native splash image ("contain"). */}
          <View style={[styles.logoBox, { left: layout.left, top: layout.top, width: layout.size, height: layout.size }]}>
            <SplashBusSvg cyc={cyc} size={layout.artWidth} testID="brand-splash-logo" />
          </View>
          <View style={[styles.below, { top: layout.belowTop }]}>
            <Animated.View
              style={[styles.track, { width: barW }, barStyle]}
              testID="splash-progress"
              accessibilityRole="progressbar"
              accessibilityLabel={LOADING_LABEL}
            >
              <Animated.View style={[styles.fill, fillStyle]} />
            </Animated.View>
            <View style={styles.slot}>
              <Animated.View style={[styles.centered, loadStyle]} testID="splash-loading-text">
                <Text style={styles.status}>{LOADING_LABEL}</Text>
              </Animated.View>
              <Animated.View style={[styles.centered, welcomeStyle]} testID="splash-welcome-text">
                <Text style={styles.status}>{WELCOME_LABEL}</Text>
              </Animated.View>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_BG, flex: 1 },
  logoBox: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  below: { alignItems: 'center', left: 0, position: 'absolute', right: 0, paddingTop: 16 },
  track: { backgroundColor: BAR_TRACK, borderRadius: 2, height: 4, overflow: 'hidden' },
  fill: { backgroundColor: BAR_FILL, borderRadius: 2, height: '100%' },
  slot: { alignItems: 'center', height: 22, justifyContent: 'center', marginTop: 16, alignSelf: 'stretch' },
  centered: { position: 'absolute' },
  status: { color: TEXT_MUTED, fontSize: 14, letterSpacing: 0.1, textAlign: 'center' },
});
