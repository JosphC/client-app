import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pushPlanRoute } from '../navigation';
import { useRoutePlanner } from './useRoutePlanner';
import { useRoutePreview } from './useRoutePreview';
import { useSheetDrag } from './useSheetDrag';
import {
  makeUserLocationPlace,
  resolveUserLocationPlace,
  useLiveMap,
  type LocationPlace,
  type MapMode,
  type Station,
} from '../../map';
import { useWalletItems } from '../../wallet';
import { useBoardLines } from '../stores/boardLines';
import type { SheetSnapIndex, SheetViewMode } from '../components/map/HomeBottomSheet';

/** Starea și acțiunile ecranului Explorează (hartă + panou + planner); vizualul e în `HomeScreenView`. */
export function useHomeScreen() {
  const router = useRouter();
  const live = useLiveMap();
  const items = useWalletItems().items;
  const holder = items.find((i) => i.kind === 'card')?.holder.split(' ')[0] ?? null;
  const sheet = useSheetDrag();
  const insets = useSafeAreaInsets();

  const [mapMode, setMapMode] = useState<MapMode>('stations');
  const [sheetMode, setSheetMode] = useState<SheetViewMode>('station');
  const [headerHeight, setHeaderHeight] = useState(130);
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [dismissSearch, setDismissSearch] = useState(0);
  const [searching, setSearching] = useState(false);
  // Ca în Google Maps: albastru doar cât harta e centrată pe utilizator (gri după ce o mută).
  const [centered, setCentered] = useState(false);
  const [locating, setLocating] = useState(false);
  const centerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { sheetHeight, setContentCap } = sheet;

  function clearCentered(): void {
    if (centerTimer.current) clearTimeout(centerTimer.current);
    centerTimer.current = null;
    setCentered(false);
  }
  useEffect(() => () => {
    if (centerTimer.current) clearTimeout(centerTimer.current);
  }, []);

  // Sugestiile de căutare au nevoie de tot ecranul: ascundem și bara de taburi (vezi CenteredTabBar).
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: searching ? { display: 'none' } : undefined });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [navigation, searching]);

  // Total top obstruction = status bar inset + header card height, so the
  // fitted route never slides under the header (Google Maps behaviour).
  const headerObstruction = headerHeight + insets.top + 4;

  const routeEdgePadding = useMemo(
    () => ({
      top: Math.max(150, headerObstruction + 12),
      right: 48,
      bottom: Math.max(200, sheetHeight + 24),
      left: 48,
    }),
    [headerObstruction, sheetHeight],
  );

  // Keeps Google Maps controls (compass, logo) visible above the sheet.
  // In explore mode the header is the floating search (~120px tall).
  const mapPadding = useMemo(
    () => ({
      top: sheetMode === 'planner' ? headerObstruction : insets.top + 124,
      right: 0,
      bottom: sheetHeight,
      left: 0,
    }),
    [sheetMode, headerObstruction, insets.top, sheetHeight],
  );

  const planner = useRoutePlanner(live.pickStation, {
    plan: (from, to, option, c, dc) => pushPlanRoute(router, from, to, option, c, dc),
    notifications: () => router.push('/notifications'),
  });
  const { origin, originCoords, destination, changeOrigin, changeDestination } = planner;

  // Planificare fără origine sau destinație: nu e nimic de arătat în panou, deci îl ascundem (harta rămâne liberă).
  const plannerEmpty = sheetMode === 'planner' && !(origin && destination);
  // În planificare cu rute, panoul urmează înălțimea listei (+ mâner); altfel folosește punctele de oprire standard.
  useEffect(() => {
    setContentCap(plannerEmpty ? 0 : null);
  }, [plannerEmpty, sheetMode, setContentCap]);

  const routePreview = useRoutePreview({
    origin,
    originCoords,
    destination,
    markers: live.allMarkers,
    active: sheetMode === 'planner',
  });

  // Stație aleasă: vehiculele care vin spre ea (`useLiveMap`), doar pe liniile bifate în panou, dacă sunt.
  const boardLines = useBoardLines((s) => s.lines);
  const stationMarkers = boardLines.length > 0 ? live.markers.filter((m) => boardLines.includes(m.bus.line)) : live.markers;
  const markers =
    mapMode === 'vehicles'
      ? live.allMarkers
      : mapMode === 'favorites'
        ? (live.tracked ? [live.tracked] : [])
        : stationMarkers;

  function handleMode(next: MapMode): void {
    setMapMode(next);
    if (next !== 'stations') live.pickStation(null);
  }

  // Map dot taps open the stop's schedule half-way (snap 1); search picks peek.
  function handlePickStation(st: Station, snap: SheetSnapIndex = 0): void {
    setMapMode('stations');
    setSheetMode('station');
    clearCentered();
    live.pickStation(st);
    sheet.snapTo(snap);
  }

  /** Destinație nouă, plecare din poziția curentă (numele real al locului vine asincron). */
  function planFromHere(dest: Station | LocationPlace): void {
    changeDestination(dest);
    changeOrigin(makeUserLocationPlace(live.coords), live.coords);
    setSheetMode('planner');
    sheet.snapTo(1);
    if (live.coords) void resolveUserLocationPlace(live.coords).then((real) => changeOrigin(real, live.coords));
  }

  function handleDirections(): void {
    if (live.arrivalStation) planFromHere(live.arrivalStation);
  }

  async function handleLocateOrigin(): Promise<void> {
    await live.locate();
    if (live.coords) {
      changeOrigin(makeUserLocationPlace(live.coords), live.coords);
      const real = await resolveUserLocationPlace(live.coords);
      changeOrigin(real, live.coords);
    }
  }

  async function handleLocate(): Promise<void> {
    if (locating) return;
    clearCentered();
    setLocating(true);
    const found = await live.locate();
    setLocating(false);
    if (!found) return; // fără poziție reală nu mutăm harta și nu devine albastru
    setCenterTrigger((prev) => prev + 1);
    // Albastru abia când camera a ajuns la tine (zborul durează 500 ms, vezi useLiveMapCamera).
    centerTimer.current = setTimeout(() => setCentered(true), 550);
  }

  function handleSearchRoute(): void {
    if (origin && destination) {
      setSheetMode('planner');
      sheet.snapTo(1);
    }
  }

  // Google Maps: tapping empty map dismisses the vehicle card (not the sheet)
  // and collapses the search suggestions (text is kept).
  function handleMapPress(): void {
    if (live.selected) live.select(null);
    setDismissSearch((prev) => prev + 1);
  }

  function closeDirections(): void {
    setSheetMode('station');
    sheet.snapTo(0);
  }

  return {
    live, holder, sheet, planner, routePreview, markers,
    mapMode, sheetMode, centerTrigger, dismissSearch, searching, centered, locating, plannerEmpty,
    routeEdgePadding, mapPadding,
    setHeaderHeight, setSearching, clearCentered,
    handleMode, handlePickStation, handleDirections, handleLocateOrigin, handleLocate,
    handleSearchRoute, handleMapPress, closeDirections, handlePickDestination: planFromHere,
  };
}
