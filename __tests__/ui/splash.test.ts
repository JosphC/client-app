import { SPLASH_LOGO_DP, splashLayout } from '../../src/ui/BrandSplash/cycle';

/** Node's fs, typed locally (the app tsconfig has no Node types). Paths are relative to the repo root (jest cwd). */
interface FileBytes {
  readUInt32BE(offset: number): number;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as { readFileSync(path: string): FileBytes; readFileSync(path: string, enc: 'utf8'): string };

interface ExpoConfig {
  expo: {
    splash: { image: string; resizeMode: string; backgroundColor: string };
    plugins: (string | [string, Record<string, unknown>])[];
  };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../../app.config.js') as ExpoConfig;
const plugin = config.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as
  | [string, { image: string; imageWidth: number; resizeMode: string; backgroundColor: string }]
  | undefined;

describe('native splash → loading screen hand-over', () => {
  it('native splash uses the same logo size, image, scaling and background as the app', () => {
    expect(plugin).toBeTruthy();
    expect(plugin?.[1].imageWidth).toBe(SPLASH_LOGO_DP);
    expect(plugin?.[1].image).toBe(config.expo.splash.image);
    expect(plugin?.[1].resizeMode).toBe('contain');
    expect(config.expo.splash.resizeMode).toBe('contain');
    expect(plugin?.[1].backgroundColor).toBe('#FFFFFF');
    const brandSplash = fs.readFileSync('src/ui/BrandSplash/BrandSplash.tsx', 'utf8');
    expect(brandSplash).toContain("export const SPLASH_BG = '#FFFFFF'");
  });

  it('logo fits inside the 192 dp circle Android 12+ keeps (no clipped corners)', () => {
    // Farthest artwork point from the box centre is ~130 of 260 units (wheel corners).
    expect((SPLASH_LOGO_DP * 130) / 260).toBeLessThanOrEqual(96);
  });

  it('centres the logo on the physical screen whatever the status bar offset', () => {
    for (const [screenH, width, viewY] of [[2400 / 2.625, 1080 / 2.625, 0], [800, 360, 24], [1366, 1024, 20]] as const) {
      const l = splashLayout(screenH, width, viewY);
      expect(viewY + l.top + l.size / 2).toBeCloseTo(screenH / 2, 5);
      expect(l.left + l.size / 2).toBeCloseTo(width / 2, 5);
      expect(l.size).toBe(SPLASH_LOGO_DP);
      // "contain": the 240×260 artwork fills the box height, centred horizontally.
      expect(l.artWidth).toBeCloseTo((SPLASH_LOGO_DP * 240) / 260, 5);
      expect(l.belowTop).toBeGreaterThan(l.top + l.size);
    }
  });

  it('native image is the square-canvas render of the in-app artwork', () => {
    const png = fs.readFileSync('assets/splash-logo.png');
    expect(png.readUInt32BE(16)).toBe(png.readUInt32BE(20));
    expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(SPLASH_LOGO_DP * 4);
  });
});
