import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Tables } from "@/database.types";
import { Text } from "@/components/ui/Text";
import { formatDistance, formatPace } from "@/utils/format";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { supabase } from "@/lib/supabase";

type Props = {
  run: Tables<"run"> & { messages: Tables<"run_message">[] };
  hasUnread?: boolean;
  onLeaveGroup?: () => void;
};

export function ChatCard({ run, hasUnread, onLeaveGroup }: Props) {
  const router = useRouter();
  const lastMessage = run.messages?.[0];
  const translateX = useSharedValue(0);
  const context = useSharedValue({ x: 0 });

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { x: translateX.value };
    })
    .onUpdate((event) => {
      translateX.value = event.translationX + context.value.x;
    })
    .onEnd(() => {
      if (translateX.value < -100) {
        translateX.value = withSpring(-100);
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-100, -50, 0],
      [1, 0.5, 0],
      Extrapolate.CLAMP
    );
    return { opacity };
  });

  const handleLeaveGroup = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: userData } = await supabase
        .from("user")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!userData) return;

      const { error } = await supabase
        .from("run_user")
        .delete()
        .eq("run", run.id)
        .eq("user", userData.id);

      if (error) throw error;
      onLeaveGroup?.();
    } catch (error) {
      console.error("Error leaving group:", error);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.deleteButton, deleteButtonStyle]}>
        <Pressable
          onPress={handleLeaveGroup}
          style={styles.deleteButtonContent}
        >
          <Text style={styles.deleteButtonText}>Leave</Text>
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.container, hasUnread && styles.unread, animatedStyle]}
        >
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/chat/[id]",
                params: { id: run.id.toString() },
              })
            }
            style={styles.content}
          >
            <View style={styles.header}>
              <Text style={styles.title}>
                {formatDistance(run.target_meters || 0)} •{" "}
                {formatPace(run.target_seconds_per_km || 0)}
              </Text>
              {hasUnread && <View style={styles.unreadDot} />}
            </View>

            <Text style={styles.location}>{run.location}</Text>

            <Text style={styles.dateRange}>
              {new Date(run.datetime || "").toLocaleDateString()}
            </Text>

            {lastMessage && (
              <Text style={styles.lastMessage} numberOfLines={1}>
                {lastMessage.text}
              </Text>
            )}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    marginBottom: 12,
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: 16,
  },
  unread: {
    backgroundColor: "#f0f9ff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  location: {
    fontSize: 16,
    color: "#4b5563",
    marginBottom: 4,
  },
  dateRange: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: "#4b5563",
  },
  deleteButton: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    zIndex: 1,
  },
  deleteButtonContent: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
