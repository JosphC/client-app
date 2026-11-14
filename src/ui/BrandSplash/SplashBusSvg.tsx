import { useId } from 'react';
import Animated, { Easing, cancelAnimation, useAnimatedProps, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Circle, ClipPath, Defs, G, LinearGradient, Mask, Path, Rect, Stop, Svg } from 'react-native-svg';
import { SPLASH_MS, WAVE_L, toothOpacity, waveOffset } from './cycle';

export const SPLASH_BG = '#FFFFFF';

// Geometria urmărește iconița aplicației (assets/icon.png). Unda are contur alb uniform; sub ea corpul
// rămâne cu vârfuri ascuțite ("dinți") între văile undei. Viewbox 240×260, ca în splash-ul nativ.
const PULSE_D =
  'M32 139.25L66.23 139.25Q71.25 139.25 73.72 134.88L84.13 116.52Q86.6 112.15 88.33 116.86L100.27 149.49Q102 154.2 103.28 149.35' +
  'L118.87 90.05Q120.15 85.2 121.3 90.09L137.85 160.46Q139 165.35 140.38 160.52L152.62 117.73Q154 112.9 156.56 117.22' +
  'L167.09 134.93Q169.65 139.25 174.67 139.25L208 139.25';
/**
 * Zona de sub undă; din ea, fără contur, rămân dinții. Coboară puțin sub banda tăiată (151.25), ca marginea ei să nu
 * fie tangentă cu marginea conturului alb (altfel apar linii subțiri deschise la anti-aliasing).
 */
const TEETH_D = `${PULSE_D}L208 156L32 156Z`;
const SHIELD_D = 'M46.59 151.25L51.25 67Q51.25 55.75 62.5 55.75L177.5 55.75Q188.75 55.75 188.75 67L193.41 151.25Z';
const PILLAR_L = 'M-10 0L51.25 0L51.25 67L47.46 135.38L-10 135.38Z';
const PILLAR_R = 'M250 0L188.75 0L188.75 67L192.54 135.38L250 135.38Z';
const OUTER_D =
  'M68 20C100 15 140 15 172 20C194 24 203 38 205 60L210 202.5C210 213.27 201.27 222 190.5 222L191 222L191 234.75Q191 242.75 183 242.75' +
  'L170 242.75Q162 242.75 162 234.75L162 222L78 222L78 234.75Q78 242.75 70 242.75L57 242.75Q49 242.75 49 234.75L49 222L49.5 222' +
  'C38.73 222 30 213.27 30 202.5L35 60C37 38 46 24 68 20Z';

const APath = Animated.createAnimatedComponent(Path);

/** Dintii: fasia verticala (x0..x1) si intervalul lor pe traseul undei (lungime de arc, in unitati de viewBox). */
const TEETH = [
  { x0: 70, x1: 103.28, s0: 38.11, s1: 111.62 },
  { x0: 103.28, x1: 140.38, s0: 111.62, s1: 256.58 },
  { x0: 140.38, x1: 170, s0: 256.58, s1: 332.35 },
] as const;

interface ToothProps {
  cyc: SharedValue<number>;
  clipId: string;
  s0: number;
  s1: number;
}

/** Un dinte: aceeasi zona de sub unda, decupata la fasia lui, cu opacitatea legata de pozitia undei. */
function Tooth({ cyc, clipId, s0, s1 }: ToothProps) {
  const props = useAnimatedProps(() => ({ opacity: toothOpacity(cyc.value, s0, s1) }));
  return <APath animatedProps={props} d={TEETH_D} fill="white" clipPath={`url(#${clipId})`} />;
}

export function playSplashLoop(cyc: SharedValue<number>): void {
  cyc.value = withRepeat(
    withSequence(
      withTiming(1, { duration: SPLASH_MS, easing: Easing.linear }),
      withTiming(0, { duration: 0 }),
    ),
    -1,
    false,
  );
}

export function playSplashOnce(cyc: SharedValue<number>): void {
  cyc.value = withTiming(1, { duration: SPLASH_MS, easing: Easing.linear });
}

export function stopSplashLoop(cyc: SharedValue<number>): void {
  cancelAnimation(cyc);
  cyc.value = 0;
}

interface SplashBusSvgProps {
  cyc: SharedValue<number>;
  size?: number;
  testID?: string;
}

/** Pictograma autobuz (masca + unda cu reveal pe dash), aceeași formă ca iconița aplicației. */
export function SplashBusSvg({ cyc, size = 210, testID }: SplashBusSvgProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradId = `busGradient${uid}`;
  const maskId = `busCutoutMask${uid}`;
  const teethId = `busTeethMask${uid}`;
  const clipId = `busOuterContour${uid}`;

  const waveProps = useAnimatedProps(() => ({ strokeDashoffset: waveOffset(cyc.value) }));

  // Conturul alb din jurul undei: același traseu, desenat/șters odată cu unda.
  const halo = (
    <APath
      animatedProps={waveProps}
      d={PULSE_D}
      fill="none"
      stroke="black"
      strokeWidth={24}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={[WAVE_L]}
      strokeDashoffset={0}
    />
  );

  return (
    <Svg height={(size * 260) / 240} viewBox="0 0 240 260" width={size} testID={testID}>
      <Defs>
        <LinearGradient id={gradId} x1="30" y1="20" x2="205" y2="235" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#1d56d8" />
          <Stop offset="48%" stopColor="#1982b8" />
          <Stop offset="100%" stopColor="#14b092" />
        </LinearGradient>
        <Mask id={maskId}>
          <Rect x={0} y={0} width={240} height={260} fill="white" />
          <Rect x={78.25} y={31.75} width={83.5} height={11.25} rx={5.625} fill="black" />
          <Path d={SHIELD_D} fill="black" />
          <Rect x={-10} y={134.18} width={260} height={17.07} fill="black" />
          {halo}
          <Path d={PILLAR_L} fill="white" />
          <Path d={PILLAR_R} fill="white" />
          <Circle cx={62} cy={186.25} r={12} fill="black" />
          <Circle cx={178} cy={186.25} r={12} fill="black" />
        </Mask>
        <Mask id={teethId}>
          <Rect x={0} y={0} width={240} height={260} fill="black" />
          {TEETH.map((tooth, i) => (
            <Tooth key={tooth.x0} cyc={cyc} clipId={`${teethId}${i}`} s0={tooth.s0} s1={tooth.s1} />
          ))}
          {halo}
        </Mask>
        {TEETH.map((tooth, i) => (
          <ClipPath key={tooth.x0} id={`${teethId}${i}`}>
            <Rect x={tooth.x0} y={0} width={tooth.x1 - tooth.x0} height={260} />
          </ClipPath>
        ))}
        <ClipPath id={clipId}>
          <Path d={OUTER_D} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Rect x={0} y={0} width={240} height={260} fill={`url(#${gradId})`} mask={`url(#${maskId})`} testID="splash-bus-body" />
        <Rect
          x={0}
          y={0}
          width={240}
          height={260}
          fill={`url(#${gradId})`}
          mask={`url(#${teethId})`}
          testID="splash-bus-teeth"
        />
        <APath
          animatedProps={waveProps}
          d={PULSE_D}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={10.15}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[WAVE_L]}
          strokeDashoffset={0}
          testID="splash-pulse"
        />
      </G>
    </Svg>
  );
}
