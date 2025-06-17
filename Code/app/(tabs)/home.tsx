import { View, StyleSheet, Pressable, Image, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Text } from "@/components/ui/Text";
import { Tables } from "@/database.types";
import { RunCard } from "@/components/RunCard";
import { CompactRunCard } from "@/components/CompactRunCard";
import { FloatingButton } from "@/components/ui/FloatingButton";
import { Modal } from "@/components/ui/Modal";
import { SwipeView } from "@/components/SwipeView";
import { ProfileModal } from "@/components/ProfileModal";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { SafeAreaView } from "react-native-safe-area-context";
import { NewRunModal } from "@/components/NewRunModal";
import { useNotification } from "@/app/context/NotificationContext";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "react-native";

export default function HomeScreen() {
  const router = useRouter();
  const { refresh } = useLocalSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Tables<"user"> | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [showDiscoverDone, setShowDiscoverDone] = useState(false);
  const [myRuns, setMyRuns] = useState<Tables<"run">[]>([]);
  const [discoverRuns, setDiscoverRuns] = useState<
    (Tables<"run"> & { user?: Tables<"user"> | null })[]
  >([]);
  const [showNewRunModal, setShowNewRunModal] = useState(false);
  const { setHasNewChat } = useNotification();
  const colorScheme = useColorScheme();

  const fetchProfile = useCallback(async () => {
    if (!user?.email) return;
    try {
      const { data, error } = await supabase
        .from("user")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  }, [user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  const fetchMyRuns = useCallback(async () => {
    if (!user?.email) return;
    try {
      const { data: userData } = await supabase
        .from("user")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!userData) return;

      const { data, error } = await supabase
        .from("run")
        .select("*, user!idea_user_fkey(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const myRuns = data.filter((run) => run.user?.id === userData.id);

      // Sort by datetime - upcoming runs first, then by date ascending
      const sortedRuns = myRuns.sort((a, b) => {
        const dateA = a.datetime ? new Date(a.datetime).getTime() : Infinity;
        const dateB = b.datetime ? new Date(b.datetime).getTime() : Infinity;
        return dateA - dateB;
      });

      setMyRuns(sortedRuns);
    } catch (error) {
      console.error("Error fetching my runs:", error);
    }
  }, [user?.email]);

  const fetchDiscoverRuns = useCallback(async () => {
    if (!user?.email) return;
    try {
      const { data: userData } = await supabase
        .from("user")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!userData) return;

      // Get runs that the user has already joined
      const { data: joinedRuns } = await supabase
        .from("run_user")
        .select("run")
        .eq("user", userData.id);

      const joinedRunIds = joinedRuns?.map((jr) => jr.run) || [];

      // Fetch all runs that are:
      // 1. Not created by the current user
      // 2. Not already joined by the current user
      // 3. In the future (optional: add datetime filter)
      let query = supabase
        .from("run")
        .select("*, user!idea_user_fkey(*)")
        .neq("user", userData.id);

      // Exclude already joined runs
      if (joinedRunIds.length > 0) {
        query = query.not("id", "in", `(${joinedRunIds.join(",")})`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        // Shuffle the array for random order
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setDiscoverRuns(shuffled);
      }
    } catch (error) {
      console.error("Error fetching discover runs:", error);
    }
  }, [user?.email]);

  useEffect(() => {
    if (user?.email) {
      fetchProfile();
      fetchMyRuns();
    }
  }, [user?.email, fetchProfile, fetchMyRuns, refresh]);

  useEffect(() => {
    if (user?.email && showDiscover) {
      fetchDiscoverRuns();
    }
  }, [user?.email, showDiscover, fetchDiscoverRuns]);

  const handleCreateRun = () => {
    setShowNewRunModal(true);
  };

  const handleSwipe = async (run: Tables<"run">) => {
    if (!user?.email) return;
    try {
      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("id")
        .eq("email", user.email)
        .single();

      if (userError || !userData) {
        throw new Error("User not found");
      }

      const { error } = await supabase
        .from("run_user")
        .upsert({ user: userData.id, run: run.id });

      if (error) throw error;

      // Set notification indicator when successfully joining a run
      setHasNewChat(true);

      // Remove the joined run from discoverRuns immediately
      setDiscoverRuns((prev) => {
        const newRuns = prev.filter((r) => r.id !== run.id);
        if (newRuns.length === 0) {
          setShowDiscoverDone(true);
        }
        return newRuns;
      });
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  const handleSwipeLeft = (run: Tables<"run">) => {
    // Remove the skipped run from discoverRuns immediately
    setDiscoverRuns((prev) => {
      const newRuns = prev.filter((r) => r.id !== run.id);
      if (newRuns.length === 0) {
        setShowDiscoverDone(true);
      }
      return newRuns;
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <Pressable onPress={() => setShowProfile(true)}>
              {profile?.propic_bucket_ref ? (
                <Image
                  source={{
                    uri: supabase.storage
                      .from("propics")
                      .getPublicUrl(profile.propic_bucket_ref).data.publicUrl,
                  }}
                  style={styles.profileImage}
                />
              ) : (
                <IconSymbol name="person.circle" size={32} color={"#000"} />
              )}
            </Pressable>
            <Text style={styles.greeting}>
              Hello, {profile?.display_name?.split(" ")[0] || "there"}!
            </Text>
          </View>
          <Pressable style={styles.newRunButton} onPress={handleCreateRun}>
            <Text style={styles.newRunText}>New Run</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Runs you are hosting</Text>

        <View style={styles.runsContainer}>
          {myRuns
            ?.filter((run) => run != null)
            .map((run) => (
              <CompactRunCard
                key={run.id}
                run={run}
                onPress={() => router.push(`/chat/${run.id}`)}
              />
            ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <FloatingButton
        title="Discover"
        onPress={() => {
          setShowDiscover(true);
          setShowDiscoverDone(false);
          // Always fetch fresh results when opening discover
          fetchDiscoverRuns();
        }}
        style={styles.discoverButton}
      />

      <Modal
        visible={showDiscover}
        onClose={() => setShowDiscover(false)}
        title="Discover Upcoming Runs"
      >
        {discoverRuns.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 32,
            }}
          >
            <Text
              style={{ fontSize: 24, textAlign: "center", marginBottom: 16 }}
            >
              No runs to discover right now!
            </Text>
            <Text
              style={{
                fontSize: 16,
                textAlign: "center",
                color: Colors[colorScheme ?? "light"].icon,
              }}
            >
              Swipe down to close
            </Text>
          </View>
        ) : (
          <SwipeView
            items={discoverRuns}
            onSwipeRight={handleSwipe}
            onSwipeLeft={handleSwipeLeft}
            renderItem={(run) =>
              run ? <RunCard run={run} showSwipeIndicators /> : null
            }
            onEmpty={() => {
              setShowDiscoverDone(true);
            }}
          />
        )}
      </Modal>

      <ProfileModal
        visible={showProfile}
        onClose={() => setShowProfile(false)}
      />

      <NewRunModal
        visible={showNewRunModal}
        onClose={() => setShowNewRunModal(false)}
        onSuccess={() => {
          fetchMyRuns();
          setShowNewRunModal(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  newRunButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newRunText: {
    color: "#fff",
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  greeting: {
    fontSize: 18,
    fontWeight: "600",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  discoverButton: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  bottomSpacer: {
    height: 160,
  },
  runsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  runCardContainer: {
    height: 120,
    marginBottom: 8,
  },
});
