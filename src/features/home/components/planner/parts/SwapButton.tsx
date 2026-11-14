import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Animated, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { t } from '../../../../../core/i18n';
import { useTheme } from '../../../../../core/theme/useTheme';
import { styles } from '../plannerCardStyles';

interface SwapButtonProps {
  onSwap: () => void;
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
  iconSize?: number;
  hitSlop?: number;
  /** Răspuns la apăsare: micșorare + estompare (planner), doar estompare sau nimic. */
  feedback?: 'scale' | 'fade' | 'none';
}

/** Butonul de inversare plecare ↔ destinație; se rotește cu 180° la fiecare apăsare. */
export function SwapButton({ onSwap, style = styles.swapButton, iconColor, iconSize = 18, hitSlop = 12, feedback = 'scale' }: SwapButtonProps) {
  const { colors } = useTheme();
  const swapAnim = useRef(new Animated.Value(0)).current;
  const rotationCount = useRef(0);
  const spin = swapAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  function handlePress(): void {
    rotationCount.current += 1;
    Animated.spring(swapAnim, {
      toValue: rotationCount.current,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
    onSwap();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('a11y.swap')}
      onPress={handlePress}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        style,
        {
          backgroundColor: colors.fill,
          opacity: pressed && feedback !== 'none' ? 0.75 : 1,
          transform: [{ scale: pressed && feedback === 'scale' ? 0.92 : 1 }],
        },
      ]}
    >
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Ionicons name="swap-vertical" size={iconSize} color={iconColor ?? colors.text} />
      </Animated.View>
    </Pressable>
  );
}
