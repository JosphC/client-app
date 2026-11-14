import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../../../../core/i18n';
import { useTheme } from '../../../../core/theme/useTheme';
import type { LatLng, LocationPlace, Station } from '../../../map';
import { StationResults, type PlaceResultItem } from '../../../map/components/overlays/StationResults';
import type { MapMode } from '../../../map/components/overlays/StationBar';
import { BleSimulationBar } from '../../../ride';
import { usePlaceSearch } from '../../hooks/usePlaceSearch';
import { HomeDirectionsHeader } from './HomeDirectionsHeader';
import { MapModeChips } from './MapModeChips';
import type { PlaceOrStation } from '../planner/PlannerCard';
import type { SheetViewMode } from './HomeBottomSheet';
import { styles } from './homeMapStyles';

interface HomeMapOverlayProps {
  station: Station | null;
  mode: MapMode;
  sheetMode: SheetViewMode;
  userName: string | null;
  origin: PlaceOrStation | null;
  destination: PlaceOrStation | null;
  onMode: (mode: MapMode) => void;
  onPickStation: (station: Station) => void;
  onPickDestination: (place: LocationPlace) => void;
  onClear: () => void;
  onNotifications: () => void;
  onOriginChange: (place: PlaceOrStation | null, coords: LatLng | null) => void;
  onDestinationChange: (place: PlaceOrStation | null) => void;
  onSwap: () => void;
  onCloseDirections: () => void;
  onLocateOrigin: () => void;
  locating?: boolean;
  onSearchRoute?: () => void;
  onHeaderHeightChange?: (height: number) => void;
  /** Bumped by the parent when the map is tapped: hides suggestions (Google Maps behaviour). */
  dismissSearchSignal?: number;
  /** True cât timp lista de sugestii e deschisă: părintele ascunde panoul de jos și taburile. */
  onSearchingChange?: (searching: boolean) => void;
}

export function HomeMapOverlay({
  station, mode, sheetMode, userName, origin, destination, onMode, onPickStation, onPickDestination, onClear,
  onNotifications, onOriginChange, onDestinationChange, onSwap, onCloseDirections, onLocateOrigin, locating,
  onSearchRoute, onHeaderHeightChange, dismissSearchSignal = 0, onSearchingChange
}: HomeMapOverlayProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  // Tapping the map dismisses suggestions (text is kept, like Google Maps).
  const firstSignal = useRef(true);
  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    inputRef.current?.blur();
    setFocused(false);
  }, [dismissSearchSignal]);

  const results = usePlaceSearch(query);

  const showResults = focused && query.trim().length >= 2;
  const searching = showResults && sheetMode !== 'planner';
  useEffect(() => {
    onSearchingChange?.(searching);
  }, [searching, onSearchingChange]);
  const initial = userName ? userName.charAt(0).toUpperCase() : 'U';

  function handlePick(next: PlaceResultItem): void {
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
    if ('station' in next && next.station) {
      onPickStation(next.station);
    } else if ('lines' in next) {
      onPickStation(next);
    } else if ('kind' in next && next.kind === 'station') {
      onPickStation({ id: next.id, name: next.name, lat: next.lat, lng: next.lng, lines: [] });
    } else {
      onPickDestination(next);
    }
  }

  function handleClear(): void {
    setQuery('');
    if (query === '') onClear();
  }

  if (sheetMode === 'planner') {
    return (
      <View style={[styles.topOverlayFullBleed, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
        <HomeDirectionsHeader
          origin={origin}
          destination={destination}
          onOriginChange={onOriginChange}
          onDestinationChange={onDestinationChange}
          onSwap={onSwap}
          onBack={onCloseDirections}
          onLocateOrigin={onLocateOrigin}
          locating={locating}
          onSearch={onSearchRoute}
          onHeightChange={onHeaderHeightChange}
          onSearchingChange={onSearchingChange}
        />
      </View>
    );
  }

  return (
    <View style={[styles.topOverlay, { top: insets.top + 4 }]} pointerEvents="box-none">
      {/* Google Maps style floating search pill */}
      <View style={[styles.searchBar, { backgroundColor: colors.searchBar }]} pointerEvents="auto">
        <Ionicons name="search-outline" size={21} color={colors.textMuted} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder={t('home.searchAll')}
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={[styles.searchField, { color: colors.text }]}
          onFocus={() => setFocused(true)}
        />
        {query !== '' || station ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.clear')} onPress={handleClear} hitSlop={8}>
            <Ionicons name="close-circle" size={19} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.profile')} onPress={onNotifications} style={[styles.avatarBtn, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.onPrimary }]}>{initial}</Text>
        </Pressable>
      </View>

      {showResults ? <StationResults results={results} onPick={handlePick} floating style={styles.resultsInFlow} /> : null}

      {/* Google Maps style horizontally scrollable category chips */}
      {!showResults ? (
        <MapModeChips mode={mode} onMode={onMode} />
      ) : null}

      {!showResults ? <BleSimulationBar /> : null}
    </View>
  );
}
