import { Modal as RNModal, StyleSheet, View, Dimensions } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Text } from "./Text";
import { useEffect } from "react";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SWIPE_DOWN_THRESHOLD = SCREEN_HEIGHT * 0.2;

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}

export function Modal({ visible, onClose, children, title }: ModalProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = Colors[colorScheme ?? "light"].background;
  const translateY = useSharedValue(0);
  const tabBarHeight = useBottomTabBarHeight();

  useEffect(() => {
    if (!visible) {
      translateY.value = 0;
    }
  }, [visible]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      translateY.value = 0;
    })
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.velocityY > 500 || translateY.value > SWIPE_DOWN_THRESHOLD;

      if (shouldDismiss) {
        translateY.value = withSpring(SCREEN_HEIGHT, {}, () => {
          runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <SafeAreaView
            style={[
              styles.content,
              { backgroundColor, marginBottom: tabBarHeight },
            ]}
            edges={["top", "left", "right"]}
          >
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{title}</Text>
            </View>
            {children}
          </SafeAreaView>
        </Animated.View>
      </GestureDetector>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  handleContainer: {
    width: "100%",
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
  },
  titleContainer: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
});
