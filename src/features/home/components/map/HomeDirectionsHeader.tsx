import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { t } from '../../../../core/i18n';
import { useTheme } from '../../../../core/theme/useTheme';
import { StationResults, type LatLng, type LocationPlace } from '../../../map';
import type { PlaceOrStation } from '../planner/PlannerCard';
import { StationField } from '../planner/StationField';
import { SwapButton } from '../planner/parts/SwapButton';
import { DirectionsSummary } from './DirectionsSummary';
import { styles } from './homeMapStyles';

interface HomeDirectionsHeaderProps {
  origin: PlaceOrStation | null;
  destination: PlaceOrStation | null;
  onOriginChange: (place: PlaceOrStation | null, coords: LatLng | null) => void;
  onDestinationChange: (place: PlaceOrStation | null) => void;
  onSwap: () => void;
  onBack: () => void;
  onLocateOrigin: () => void;
  locating?: boolean;
  onSearch?: () => void;
  onHeightChange?: (height: number) => void;
  /** True cât timp se scrie într-un câmp și apar sugestii: părintele ascunde panoul de jos și taburile. */
  onSearchingChange?: (searching: boolean) => void;
}

type OpenField = 'origin' | 'dest' | null;

export function HomeDirectionsHeader({
  origin, destination, onOriginChange, onDestinationChange, onSwap, onBack, onLocateOrigin, locating, onSearch,
  onHeightChange, onSearchingChange
}: HomeDirectionsHeaderProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState<OpenField>(null);
  const [activeResults, setActiveResults] = useState<LocationPlace[]>([]);
  const [activeTyping, setActiveTyping] = useState(false);
  const searching = open !== null && activeTyping;
  useEffect(() => {
    onSearchingChange?.(searching);
    return () => onSearchingChange?.(false);
  }, [searching, onSearchingChange]);
  // Google Maps behaviour: once the route is set, the two input fields
  // collapse into a compact one-line summary bar so the map stays visible.
  // Tapping the summary expands the fields again for editing.
  const [editing, setEditing] = useState(!(origin && destination));

  useEffect(() => {
    if (!origin || !destination) setEditing(true);
  }, [origin, destination]);

  const canSearch = origin !== null && destination !== null && origin.id !== destination.id;

  function handleSearchPress(): void {
    Keyboard.dismiss();
    if (canSearch) setEditing(false);
    onSearch?.();
  }

  function handlePick(place: LocationPlace): void {
    const willHaveBoth = open === 'origin' ? destination !== null : origin !== null;
    if (open === 'origin') onOriginChange(place, { lat: place.lat, lng: place.lng });
    else onDestinationChange(place);
    setActiveResults([]);
    setActiveTyping(false);
    setOpen(null);
    if (willHaveBoth) {
      Keyboard.dismiss();
      setEditing(false);
    }
  }

  function reportHeight(h: number): void {
    if (h > 0) onHeightChange?.(h);
  }

  function activate(field: OpenField): void {
    setOpen(field);
    setActiveResults([]);
    setActiveTyping(false);
  }

  const trackSearch = (field: OpenField) => (state: { results: LocationPlace[]; typing: boolean }) => {
    if (open === field) {
      setActiveResults(state.results);
      setActiveTyping(state.typing);
    }
  };

  if (!editing && origin && destination) {
    return (
      <DirectionsSummary
        origin={origin}
        destination={destination}
        onBack={onBack}
        onEdit={() => setEditing(true)}
        onSwap={onSwap}
        onHeight={reportHeight}
      />
    );
  }

  return (
    <View
      onLayout={(e) => reportHeight(e.nativeEvent.layout.height)}
      style={[styles.directionsCard, { backgroundColor: colors.card }]}
    >
      <View style={styles.dirNavRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.backToMap')}
          onPress={onBack}
          hitSlop={8}
          style={[styles.backBtn, { backgroundColor: colors.fill }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.dirNavTitle, { color: colors.text }]}>{t('home.plannerTitle')}</Text>
      </View>

      <View style={styles.dirBodyRow}>
        <View style={styles.dirTrackCol}>
          <View style={[styles.dirOriginDot, { backgroundColor: colors.primary }]} />
          <View style={[styles.dirRail, { backgroundColor: colors.rail }]} />
          <Ionicons name="location-sharp" size={18} color={colors.danger} />
        </View>

        <View style={styles.dirInputsCol}>
          <StationField
            value={origin}
            placeholder={locating && !origin ? t('home.locating') : t('home.from')}
            active={open === 'origin'}
            renderResultsInline={false}
            onActivate={() => activate('origin')}
            onPick={handlePick}
            onSearchStateChange={trackSearch('origin')}
            onClear={() => onOriginChange(null, null)}
            showLocate
            locating={locating}
            onLocate={onLocateOrigin}
            onSearch={handleSearchPress}
          />

          <StationField
            value={destination}
            placeholder={t('home.to')}
            active={open === 'dest'}
            renderResultsInline={false}
            onActivate={() => activate('dest')}
            onPick={handlePick}
            onSearchStateChange={trackSearch('dest')}
            onClear={() => onDestinationChange(null)}
            onSearch={handleSearchPress}
          />
        </View>

        <SwapButton
          onSwap={onSwap}
          style={styles.dirSwapBtn}
          iconColor={colors.primary}
          hitSlop={10}
          feedback="fade"
        />
      </View>

      {open !== null && activeTyping && (
        <StationResults results={activeResults} onPick={handlePick} floating style={styles.dirResults} />
      )}
    </View>
  );
}
