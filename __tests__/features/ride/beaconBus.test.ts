import { resolveDetectedBus } from '../../../src/features/ride/components/BleAutoCheckIn';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const fleet =[{ id: 'bus-17a', line: '17', destination: 'Centru' }];

describe('resolveDetectedBus (ESP32 în mock)', () => {
  it('folosește autobuzul din flotă când id-ul există', () => {
    expect(resolveDetectedBus(fleet, 'bus-17a', true)).toEqual(fleet[0]);
    expect(resolveDetectedBus(fleet, 'bus-17a', false)).toEqual(fleet[0]);
  });

  it('în mock, un id necunoscut (ex. minor 101) devine cursa de test', () => {
    expect(resolveDetectedBus(fleet, '101', true)).toEqual({ line: '15', destination: 'Test ESP32' });
  });

  it('în mod real, un id necunoscut este ignorat', () => {
    expect(resolveDetectedBus(fleet, '101', false)).toBeNull();
  });
});
