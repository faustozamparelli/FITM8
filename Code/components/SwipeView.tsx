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
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import { Text } from "./ui/Text";
import React from "react";
import * as Haptics from "expo-haptics";

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
  const successOpacity = useSharedValue(0);
  const successScale = useSharedValue(0.5);
  const checkmarkScale = useSharedValue(0);

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

  const showSuccessAnimation = () => {
    // Trigger haptic feedback for success
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    successOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(1300, withTiming(0, { duration: 300 }))
    );
    successScale.value = withSequence(
      withSpring(1.1, { damping: 10 }),
      withSpring(1, { damping: 15 }),
      withDelay(1300, withTiming(0.5, { duration: 300 }))
    );
    checkmarkScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1.2, { duration: 300 }),
      withSpring(1, { damping: 12 }),
      withDelay(1300, withTiming(0, { duration: 300 }))
    );
  };

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
        const isRightSwipe = direction > 0;

        translateX.value = withSpring(
          direction * SCREEN_WIDTH * 1.5,
          {},
          () => {
            if (isRightSwipe) {
              // Show success animation for right swipe (join)
              runOnJS(showSuccessAnimation)();
              // Call the callback immediately (animation will still show)
              runOnJS(onSwipeRight)(items[currentIndex.value]);
            } else {
              // Immediate callback for left swipe (skip)
              runOnJS(onSwipeLeft)(items[currentIndex.value]);
            }
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

  const successOverlayStyle = useAnimatedStyle(() => {
    return {
      opacity: successOpacity.value,
      transform: [{ scale: successScale.value }],
    };
  });

  const checkmarkStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkmarkScale.value }],
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

          {/* Success Animation Overlay */}
          <Animated.View
            style={[styles.successOverlay, successOverlayStyle]}
            pointerEvents="none"
          >
            <View style={styles.successContent}>
              <Animated.View
                style={[styles.checkmarkContainer, checkmarkStyle]}
              >
                <Text style={styles.checkmark}>✓</Text>
              </Animated.View>
              <Text style={styles.successText}>Joined Run!</Text>
              <Text style={styles.successSubtext}>Check your chats</Text>
            </View>
          </Animated.View>
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
  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  successContent: {
    backgroundColor: "white",
    padding: 32,
    borderRadius: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  checkmarkContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkmark: {
    fontSize: 50,
    fontWeight: "bold",
    color: "white",
  },
  successText: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 20,
    color: "#333",
  },
  successSubtext: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
});
