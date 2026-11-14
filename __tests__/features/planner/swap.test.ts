import { act, renderHook } from '@testing-library/react-native';
import { useRoutePlanner } from '../../../src/features/home/hooks/useRoutePlanner';
import { makeUserLocationPlace, searchLocalPlaces } from '../../../src/features/map';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const nav = { plan: jest.fn(), notifications: jest.fn() };
const GPS = { lat: 45.7489, lng: 21.2087 }; // un punct din Timișoara, departe de Iulius Mall

function setup() {
  const iulius = searchLocalPlaces('iulius')[0];
  const me = makeUserLocationPlace(GPS);
  const hook = renderHook(() => useRoutePlanner(jest.fn(), nav));
  act(() => {
    hook.result.current.changeOrigin(me, GPS); // „locația mea" → coordonatele GPS ca punct de start
    hook.result.current.changeDestination(iulius);
  });
  return { hook, iulius, me };
}

describe('schimbul origine ↔ destinație (locația mea → Iulius Mall)', () => {
  it('găsește Iulius Mall în căutarea locală', () => {
    expect(searchLocalPlaces('iulius')[0]).toBeDefined();
  });

  it('după schimb, punctul de start precis este Iulius Mall, nu GPS-ul vechi', () => {
    const { hook, iulius, me } = setup();
    act(() => hook.result.current.swap());
    expect(hook.result.current.origin).toBe(iulius);
    expect(hook.result.current.destination).toBe(me);
    expect(hook.result.current.originCoords).toEqual({ lat: iulius.lat, lng: iulius.lng });
    expect(hook.result.current.originCoords).not.toEqual(GPS);
  });

  it('căutarea după schimb trimite spre planificator start = Iulius și destinație = locația mea', () => {
    const { hook, iulius, me } = setup();
    act(() => hook.result.current.swap());
    act(() => hook.result.current.doSearch(iulius, me));
    const [from, to, , startCoords, destCoords] = nav.plan.mock.calls[nav.plan.mock.calls.length - 1];
    expect(from).toBe(iulius);
    expect(to).toBe(me);
    expect(startCoords).toEqual({ lat: iulius.lat, lng: iulius.lng });
    expect(destCoords).toEqual({ lat: me.lat, lng: me.lng });
  });

  it('dublu schimb readuce punctul de start la GPS', () => {
    const { hook, me } = setup();
    act(() => hook.result.current.swap());
    act(() => hook.result.current.swap());
    expect(hook.result.current.origin).toBe(me);
    expect(hook.result.current.originCoords).toEqual({ lat: me.lat, lng: me.lng });
  });
});
