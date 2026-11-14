import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text } from 'react-native';
import { t } from '../../../../core/i18n';
import { useTheme } from '../../../../core/theme/useTheme';
import type { MapMode } from '../../../map/components/overlays/StationBar';
import { styles } from './homeMapStyles';

const MODES: { mode: MapMode; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'stations', icon: 'location-outline', activeIcon: 'location-sharp' },
  { mode: 'vehicles', icon: 'bus-outline', activeIcon: 'bus' },
  { mode: 'favorites', icon: 'star-outline', activeIcon: 'star' },
];

function modeLabel(mode: MapMode): string {
  return mode === 'vehicles' ? t('live.vehiclesTab') : mode === 'favorites' ? t('live.favorites') : t('live.stations');
}

/** Chip-urile de categorie (Google Maps), derulabile orizontal: stații, vehicule, favorite. */
export function MapModeChips({ mode, onMode }: { mode: MapMode; onMode: (mode: MapMode) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.chipsRow}
      pointerEvents="box-none"
    >
      {MODES.map((m) => {
        const active = m.mode === mode;
        return (
          <Pressable
            key={m.mode}
            accessibilityRole="button"
            accessibilityLabel={modeLabel(m.mode)}
            accessibilityState={{ selected: active }}
            onPress={() => onMode(m.mode)}
            style={[styles.chip, { backgroundColor: active ? colors.primary : colors.chip }]}
          >
            <Ionicons name={active ? m.activeIcon : m.icon} size={16} color={active ? colors.onPrimary : colors.text} />
            <Text style={[styles.chipLabel, { color: active ? colors.onPrimary : colors.text }]}>{modeLabel(m.mode)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
