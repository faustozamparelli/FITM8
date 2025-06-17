import React, { useState, useEffect } from "react";
import { StyleSheet, View, Dimensions, Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { ProfilePictureCarousel } from "@/components/ProfilePictureCarousel";
import { supabase } from "@/lib/supabase";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { Tables } from "@/database.types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

export default function SwipeScreen() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [runs, setRuns] = useState<
    (Tables<"run"> & {
      user: Tables<"user"> | null;
    })[]
  >([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creatingChat, setCreatingChat] = useState(false);

  const translateX = useSharedValue(0);

  useEffect(() => {
    fetchRunIdeas();
  }, []);

  const fetchRunIdeas = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("id")
        .eq("email", user.email)
        .single();

      if (userError || !userData) {
        console.error("Error getting user data:", userError);
        setLoading(false);
        return;
      }

      setCurrentUserId(userData.id);

      // Fetch all run ideas with user data and their profile pictures
      const { data, error: ideasError } = await supabase
        .from("run")
        .select("*, user(*)")
        .neq("user", userData.id)
        .order("created_at", { ascending: true });

      if (ideasError) {
        console.error("Error fetching run ideas:", ideasError);
      }
      if (data) {
        setRuns(data);
      }
    } catch (error) {
      console.error("Error in fetchRunIdeas:", error);
    } finally {
      setLoading(false);
    }
  };

  const createChat = async (otherUserId: number) => {
    if (!currentUserId) return;

    setCreatingChat(true);

    // 1️⃣  Check if a chat already exists between these two users
    // Get all chat ids for the current user
    const { data: myChats, error: myChatErr } = await supabase
      .from("run_user")
      .select("run")
      .eq("user", currentUserId);

    if (myChatErr) {
      Alert.alert("Error", "Unable to start chat");
      setCreatingChat(false);
      return;
    }

    const myChatIds = (myChats || []).map((cu) => cu.run);

    if (myChatIds.length) {
      // See if the other user is in any of those chats
      const { data: commonChats } = await supabase
        .from("run_user")
        .select("run")
        .eq("user", otherUserId)
        .in("run", myChatIds);

      if (commonChats && commonChats.length > 0) {
        // Chat already exists – navigate to it and bail out 🏃‍♂️
        setCreatingChat(false);
        router.push({
          pathname: "/chat/[id]",
          params: { id: commonChats[0].run.toString() },
        });
        return;
      }
    }

    // 2️⃣  No existing chat, so create a new one
    const { data: chatData, error: chatError } = await supabase
      .from("run_user")
      .insert({ run: currentUserId, user: otherUserId })
      .select()
      .single();

    if (chatError || !chatData) {
      Alert.alert("Error", "Failed to create chat");
      setCreatingChat(false);
      return;
    }

    // Add both users as participants
    const { error: userError } = await supabase.from("run_user").insert([
      { run: chatData.run, user: currentUserId },
      { run: chatData.run, user: otherUserId },
    ]);

    if (userError) {
      Alert.alert("Error", "Failed to start chat");
      setCreatingChat(false);
      return;
    }

    // Navigate to the new chat
    setCreatingChat(false);
    router.push({
      pathname: "/chat/[id]",
      params: { id: chatData.run.toString() },
    });
  };

  const handleSwipe = (direction: "left" | "right") => {
    const currentIdea = runs[currentIndex];

    if (direction === "right" && currentIdea.user) {
      // Create a chat with the other user
      createChat(currentIdea.user);
    } else {
      // Move to next idea
      if (currentIndex < runs.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        Alert.alert("No more runs", "You've seen all available runs!");
        router.back();
      }
    }
  };

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        translateX.value = withSpring(
          event.translationX > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH,
          {},
          () => {
            runOnJS(handleSwipe)(event.translationX > 0 ? "right" : "left");
          }
        );
      } else {
        translateX.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-15, 0, 15]
    );

    return {
      transform: [{ translateX: translateX.value }, { rotate: `${rotate}deg` }],
    };
  });

  const formatPace = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}/km`;
  };

  const formatDistance = (meters: number | null) => {
    if (!meters) return "N/A";
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const getImageUrl = (bucketRef: string) => {
    const { data } = supabase.storage.from("propics").getPublicUrl(bucketRef);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <LoadingIndicator />
      </ThemedView>
    );
  }

  if (creatingChat) {
    return (
      <ThemedView style={styles.container}>
        <LoadingIndicator message="Starting chat..." />
      </ThemedView>
    );
  }

  if (runs.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>No other runs available</ThemedText>
      </ThemedView>
    );
  }

  const currentIdea = runs[currentIndex];

  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <ThemedText style={styles.backButton}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            Find Running Partners
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.cardContainer}>
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.card, cardStyle]}>
              <ProfilePictureCarousel
                profilePics={
                  currentIdea.user?.propic_bucket_ref
                    ? [currentIdea.user.propic_bucket_ref]
                    : []
                }
                getImageUrl={getImageUrl}
                cardWidth={SCREEN_WIDTH * 0.9}
              />

              <ThemedText type="title" style={styles.userName}>
                {currentIdea.user?.display_name || "Anonymous Runner"}
              </ThemedText>

              <View style={styles.runDetails}>
                <ThemedText type="subtitle" style={styles.distance}>
                  {formatDistance(currentIdea.target_meters)}
                </ThemedText>
                <ThemedText style={styles.pace}>
                  Pace: {formatPace(currentIdea.target_seconds_per_km)}
                </ThemedText>
                <ThemedText style={styles.location}>
                  📍 {currentIdea.location || "Flexible location"}
                </ThemedText>
                <ThemedText style={styles.dates}>
                  📅{" "}
                  {currentIdea.datetime &&
                    new Date(currentIdea.datetime).toLocaleDateString()}
                </ThemedText>
              </View>

              {currentIdea.user?.bio && (
                <View style={styles.bioSection}>
                  <ThemedText type="subtitle">About</ThemedText>
                  <ThemedText>{currentIdea.user.bio}</ThemedText>
                </View>
              )}
            </Animated.View>
          </GestureDetector>

          <View style={styles.swipeHints}>
            <ThemedText style={styles.swipeLeft}>← Pass</ThemedText>
            <ThemedText style={styles.swipeRight}>Match →</ThemedText>
          </View>
        </View>
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    fontSize: 18,
    color: "#007AFF",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 50,
  },
  cardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: SCREEN_WIDTH * 0.9,
    height: "80%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userName: {
    textAlign: "center",
    marginBottom: 15,
  },
  runDetails: {
    marginBottom: 20,
  },
  distance: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  pace: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 15,
  },
  location: {
    fontSize: 15,
    marginBottom: 8,
  },
  dates: {
    fontSize: 15,
  },
  bioSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    flex: 1,
  },
  swipeHints: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: SCREEN_WIDTH * 0.8,
    marginTop: 20,
  },
  swipeLeft: {
    color: "#ff3b30",
    fontSize: 16,
    fontWeight: "600",
  },
  swipeRight: {
    color: "#34c759",
    fontSize: 16,
    fontWeight: "600",
  },
});
