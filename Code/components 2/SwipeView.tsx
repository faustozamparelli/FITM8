import { View, StyleSheet, Dimensions } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureStateChangeEvent,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Text } from "./ui/Text";
import React from "react";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

interface SwipeViewProps<T> {
  items: T[];
  onSwipeLeft: (item: T) => void;
  onSwipeRight: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
  onEmpty?: () => void;
}

export function SwipeView<T>({
  items,
  onSwipeLeft,
  onSwipeRight,
  renderItem,
  onEmpty,
}: SwipeViewProps<T>) {
  const translateX = useSharedValue(0);
  const currentIndex = useSharedValue(0);

  // Track if we've already called onEmpty
  const hasCalledOnEmpty = React.useRef(false);

  React.useEffect(() => {
    if (items.length === 0 && onEmpty && !hasCalledOnEmpty.current) {
      hasCalledOnEmpty.current = true;
      onEmpty();
    }
    if (items.length > 0) {
      hasCalledOnEmpty.current = false;
    }
  }, [items.length, onEmpty]);

  React.useEffect(() => {
    if (currentIndex.value >= items.length) {
      currentIndex.value = 0;
    }
  }, [items.length]);

  const gesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(
      (event: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
        translateX.value = 0;
      }
    )
    .onUpdate((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      translateX.value = event.translationX;
    })
    .onEnd((event: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
      const shouldDismiss =
        Math.abs(event.velocityX) > 500 ||
        Math.abs(translateX.value) > SWIPE_THRESHOLD;

      if (shouldDismiss) {
        const direction = translateX.value > 0 ? 1 : -1;
        translateX.value = withSpring(
          direction * SCREEN_WIDTH * 1.5,
          {},
          () => {
            runOnJS(direction > 0 ? onSwipeRight : onSwipeLeft)(
              items[currentIndex.value]
            );
            translateX.value = 0;
            currentIndex.value = (currentIndex.value + 1) % items.length;
          }
        );
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = (translateX.value / SCREEN_WIDTH) * 10;
    return {
      transform: [{ translateX: translateX.value }, { rotate: `${rotate}deg` }],
    };
  });

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text>No more runs to discover!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View style={styles.container}>
          {items[currentIndex.value] &&
          renderItem(items[currentIndex.value]) ? (
            <Animated.View style={[styles.card, animatedStyle]}>
              {renderItem(items[currentIndex.value])}
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: SCREEN_WIDTH - 48,
    height: SCREEN_HEIGHT * 0.65,
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 20,
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
  },
});
