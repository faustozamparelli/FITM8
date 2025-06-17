import { View, StyleSheet, Pressable, Image } from "react-native";
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
  run: Tables<"run"> & {
    messages: Tables<"run_message">[];
    user: Tables<"user"> | null;
    participantCount: number;
  };
  currentUser: Tables<"user"> | null;
  hasUnread?: boolean;
  onLeaveGroup?: () => void;
};

export function ChatCard({ run, currentUser, hasUnread, onLeaveGroup }: Props) {
  const router = useRouter();
  const lastMessage = run.messages?.[0];
  const translateX = useSharedValue(0);
  const context = useSharedValue({ x: 0 });

  const gesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      context.value = { x: translateX.value };
    })
    .onUpdate((event) => {
      if (Math.abs(event.translationX) > Math.abs(event.translationY)) {
        translateX.value = event.translationX + context.value.x;
      }
    })
    .onEnd((event) => {
      if (
        Math.abs(event.translationX) > Math.abs(event.translationY) &&
        translateX.value < -50
      ) {
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

  const formatSmartDate = (dateString: string | null) => {
    if (!dateString) return "No date set";

    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const runDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    const timeString = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (runDate.getTime() === today.getTime()) {
      return `Today at ${timeString}`;
    } else if (runDate.getTime() === tomorrow.getTime()) {
      return `Tomorrow at ${timeString}`;
    } else {
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
      return `${dayName} at ${timeString}`;
    }
  };

  const getGroupName = () => {
    if (run.user?.id === currentUser?.id) {
      return "Your Run";
    }
    return `${run.user?.display_name || "Unknown"}'s Run`;
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
              <View style={styles.groupInfo}>
                {run.user?.propic_bucket_ref ? (
                  <Image
                    source={{
                      uri: supabase.storage
                        .from("propics")
                        .getPublicUrl(run.user.propic_bucket_ref).data
                        .publicUrl,
                    }}
                    style={styles.groupImage}
                  />
                ) : (
                  <View style={styles.groupImagePlaceholder}>
                    <Text style={styles.groupImageText}>
                      {(run.user?.display_name || "U").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.groupName}>{getGroupName()}</Text>
              </View>
              {hasUnread && <View style={styles.unreadDot} />}
            </View>

            <Text style={styles.dateTime}>{formatSmartDate(run.datetime)}</Text>

            <Text style={styles.location}>{run.location || "No location"}</Text>

            <View style={styles.runDetailsContainer}>
              <Text style={styles.runDetails}>
                {formatDistance(run.target_meters || 0)} •{" "}
                {formatPace(run.target_seconds_per_km || 0)}
              </Text>
              <Text style={styles.participants}>
                {run.participantCount} runners
              </Text>
            </View>
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
    marginBottom: 12,
  },
  groupInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  groupImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  groupImagePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  groupImageText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  groupName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  dateTime: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: "#000",
    fontWeight: "500",
    marginBottom: 4,
  },
  runDetailsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  runDetails: {
    fontSize: 14,
    color: "#666",
    fontWeight: "400",
  },
  participants: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
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
