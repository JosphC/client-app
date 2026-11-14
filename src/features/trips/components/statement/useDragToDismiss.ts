import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, type NativeGesture, type PanGesture } from 'react-native-gesture-handler';

// Peste prag (sau o aruncare rapidă în jos) pagina iese din ecran; sub prag revine la loc.
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800; // px/s

interface DragToDismiss {
  translateY: Animated.Value;
  /** Gestul de tragere al întregii pagini (pus pe `GestureDetector`). */
  pan: PanGesture;
  /** Gestul nativ al listei: rulează simultan cu `pan`, ca lista să poată derula. */
  listGesture: NativeGesture;
  onListScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

/**
 * Trage pagina în jos de oriunde ca s-o închizi: urmează degetul, apoi alunecă afară și cheamă `onClose`.
 * Peste listă, tragerea închide pagina doar dacă lista era sus de tot când a început gestul; altfel lista derulează.
 */
export function useDragToDismiss(visible: boolean, onClose: () => void): DragToDismiss {
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const listOffset = useRef(0);
  const dragging = useRef(false);

  // La fiecare deschidere pagina pornește din poziția normală, cu lista sus.
  useEffect(() => {
    if (!visible) return;
    translateY.setValue(0);
    listOffset.current = 0;
  }, [visible, translateY]);

  const onListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    listOffset.current = e.nativeEvent.contentOffset.y;
  };

  const { pan, listGesture } = useMemo(() => {
    const native = Gesture.Native();
    const settle = (dy: number, vy: number) => {
      if (dy > DISMISS_DISTANCE || vy > DISMISS_VELOCITY) {
        Animated.timing(translateY, { toValue: height, duration: 200, useNativeDriver: true }).start(() =>
          onCloseRef.current()
        );
      } else {
        Animated.spring(translateY, { toValue: 0, tension: 68, friction: 12, useNativeDriver: true }).start();
      }
    };
    const drag = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetY(10)
      .failOffsetX([-20, 20])
      .simultaneousWithExternalGesture(native)
      .onStart(() => {
        dragging.current = listOffset.current <= 0;
      })
      .onUpdate((g) => {
        if (dragging.current) translateY.setValue(Math.max(0, g.translationY));
      })
      .onEnd((g) => {
        if (dragging.current) settle(g.translationY, g.velocityY);
        dragging.current = false;
      });
    return { pan: drag, listGesture: native };
  }, [height, translateY]);

  return { translateY, pan, listGesture, onListScroll };
}
