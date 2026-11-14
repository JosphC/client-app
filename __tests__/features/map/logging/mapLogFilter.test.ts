import { isTransientMapLog } from '../../../../src/features/map/mapLogFilter';

jest.mock('@maplibre/maplibre-react-native', () => ({ Logger: { setLogCallback: jest.fn() } }));

describe('isTransientMapLog', () => {
  it('swallows tile/style network failures (offline, DNS)', () => {
    expect(
      isTransientMapLog({
        level: 'error',
        tag: 'Mbgl',
        message: '{ro.echopass.app}[Style]: Failed to load source openmaptiles: Unable to resolve host "tiles.openfreemap.org": No address associated with hostname',
      }),
    ).toBe(true);
    expect(isTransientMapLog({ level: 'error', tag: 'Mbgl-HttpRequest', message: 'Request failed: Connection timed out' })).toBe(true);
  });

  it('swallows a missing last location (emulator without GPS)', () => {
    expect(isTransientMapLog({ level: 'error', tag: 'Mbgl-LocationComponent', message: 'Failed to obtain last location update' })).toBe(true);
  });

  it('keeps real map errors and non-error levels visible', () => {
    expect(isTransientMapLog({ level: 'error', tag: 'Mbgl', message: '{ro.echopass.app}[Style]: Failed to parse style JSON' })).toBe(false);
    expect(isTransientMapLog({ level: 'error', tag: 'Other', message: 'Unable to resolve host' })).toBe(false);
    expect(isTransientMapLog({ level: 'warning', tag: 'Mbgl', message: 'Unable to resolve host' })).toBe(false);
  });
});
