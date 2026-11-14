/**
 * Timeline-ul splash-ului (port 1:1 din varianta web): o singura rulare de
 * 2600 ms. Unda e complet vizibila pana la 40%, se retrage spre dreapta
 * pana la 78%, se redeseneaza de la stanga pana la 100%.
 *
 * ATENTIE worklets: corpurile NU citesc constante din exterior (nici din
 * acest modul — UI thread-ul arunca „Property 'X' doesn't exist"). Lungimea
 * undei (370.57) apare ca literal. Exporturile sunt doar pentru JS thread.
 */

export const SPLASH_MS = 2600;
export const WAVE_L = 370.57;

/**
 * Logo box shared with the native splash (app.config.js → SPLASH_LOGO_DP):
 * a square of this many dp, centred on the physical screen, the 240×260
 * artwork drawn "contain" inside it. Keep both values identical.
 */
export const SPLASH_LOGO_DP = 184;
/** Gap between the logo box and the loading text below it. */
export const SPLASH_TEXT_GAP = 16;

export interface SplashLayout {
  /** Logo box, relative to the splash view. */
  left: number;
  top: number;
  size: number;
  /** Rendered artwork width inside the box (contain, centred). */
  artWidth: number;
  /** Where the text + progress block starts. */
  belowTop: number;
}

/**
 * Same geometry as the native splash: the box is centred on the screen, not on
 * the app view, so a status bar above the view does not move it.
 * `viewY` is the view's top in screen coordinates.
 */
export function splashLayout(screenHeight: number, viewWidth: number, viewY: number): SplashLayout {
  const size = SPLASH_LOGO_DP;
  const top = screenHeight / 2 - viewY - size / 2;
  return { left: (viewWidth - size) / 2, top, size, artWidth: (size * 240) / 260, belowTop: top + size + SPLASH_TEXT_GAP };
}

function sstep(a: number, b: number, x: number): number {
  'worklet';
  if (x <= a) return 0;
  if (x >= b) return 1;
  const t = (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

/** Offset-ul de reveal (dashoffset) pentru unda si canalul de sub ea. */
export function waveOffset(c: number): number {
  'worklet';
  if (c < 0.4) return 0;
  if (c < 0.78) return -(((c - 0.4) / 0.38) * 370.57);
  if (c >= 1) return 0;
  return (1 - (c - 0.78) / 0.22) * 370.57;
}

/**
 * Dintii ascutiti ai corpului dintre vaile undei. Fiecare dinte (intervalul s0..s1 masurat pe lungimea
 * traseului undei) apare doar cat timp unda ii inconjoara complet ambii versanti, deci are mereu conturul
 * alb in jur si varful ascutit; dispare cand coada undei ajunge la el si reapare dupa ce capul undei il
 * depaseste. Astfel dintii urmeaza unda, nu mai sunt vizibili doar cand imaginea sta pe loc.
 */
export function toothOpacity(c: number, s0: number, s1: number): number {
  'worklet';
  const off = waveOffset(c);
  const lo = off < 0 ? -off : 0;
  const hi = off > 0 ? 370.57 - off : 370.57;
  const gone = Math.min(1, Math.max(0, (s0 - lo) / 12));
  const drawn = Math.min(1, Math.max(0, (hi - s1) / 12));
  return Math.min(gone, drawn);
}

export function barAlpha(c: number): number {
  'worklet';
  return 1 - sstep(0.985, 1, c);
}

export function loadAlpha(c: number): number {
  'worklet';
  return 1 - sstep(0.985, 1, c);
}

export function welcomeAlpha(c: number): number {
  'worklet';
  return sstep(0.985, 1, c);
}
