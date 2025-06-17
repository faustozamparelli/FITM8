import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, Pressable, View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "@/components/ui/Text";
import { ChatCard } from "@/components/ChatCard";
import { supabase } from "@/lib/supabase";
import { SafeAreaView } from "react-native-safe-area-context";
import { Tables } from "@/database.types";
import { User } from "@supabase/supabase-js";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function ChatsScreen() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<Tables<"user"> | null>(null);
  const [runs, setRuns] = useState<
    (Tables<"run"> & {
      messages: Tables<"run_message">[];
      user: Tables<"user"> | null;
      participantCount: number;
    })[]
  >();

  const fetchDbUser = async (authUser: User) => {
    if (!authUser?.email) return;
    const { data, error } = await supabase
      .from("user")
      .select("*")
      .eq("email", authUser.email)
      .single();

    if (error) {
      console.error("Error fetching user data:", error);
      return;
    }

    setDbUser(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        fetchDbUser(session.user).catch((error) => {
          console.error("Error fetching user data:", error);
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        fetchDbUser(session.user).catch((error) => {
          console.error("Error fetching user data:", error);
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchChats = useCallback(async () => {
    if (!authUser?.email) return;
    try {
      // First get the numeric user ID
      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("id")
        .eq("email", authUser.email)
        .single();

      if (userError || !userData) {
        console.error("Error getting user data:", userError);
        return;
      }

      const { data: chatMemberships, error: membershipError } = await supabase
        .from("run_user")
        .select("run(*)")
        .eq("user", userData.id);

      if (membershipError) {
        console.error("Error fetching chat memberships:", membershipError);
        return;
      }

      const chatIds = chatMemberships.map((cm) => cm.run.id);

      if (chatIds.length === 0) {
        setRuns([]);
        return;
      }

      const { data, error } = await supabase
        .from("run")
        .select("*, messages:run_message(*), user!idea_user_fkey(*)")
        .in("id", chatIds)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching chats:", error);
        return;
      }

      // Filter out runs that only have the creator (no actual participants)
      const runsWithParticipants = [];

      for (const run of data) {
        // Get participant count for each run
        const { count, error: countError } = await supabase
          .from("run_user")
          .select("*", { count: "exact", head: true })
          .eq("run", run.id);

        if (!countError && count !== null && count > 1) {
          runsWithParticipants.push({
            ...run,
            participantCount: count,
          });
        }
      }

      // Sort by datetime - upcoming runs first
      const sortedRuns = runsWithParticipants.sort((a, b) => {
        const dateA = a.datetime ? new Date(a.datetime).getTime() : Infinity;
        const dateB = b.datetime ? new Date(b.datetime).getTime() : Infinity;
        return dateA - dateB;
      });

      setRuns(sortedRuns);
    } catch (error) {
      console.error("Error fetching chats:", error);
    }
  }, [authUser?.email]);

  // Initial fetch
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [fetchChats])
  );

  const unreadChats = runs?.filter((run) => {
    return run.messages.every((message) => message.user !== dbUser?.id);
  });

  const handleLeaveGroup = useCallback(() => {
    fetchChats();
  }, [fetchChats]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
        <View style={styles.container}>
          <Text style={styles.title}>Chats</Text>
          {/* <Text style={styles.subtitle}>
            Interact with the running groups to get the notification bubble away
          </Text> */}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
            alwaysBounceVertical={true}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
            scrollEventThrottle={16}
          >
            {runs?.map((run) => (
              <ChatCard
                key={run.id}
                run={run}
                currentUser={dbUser}
                hasUnread={unreadChats?.some((c) => c.id === run.id)}
                onLeaveGroup={handleLeaveGroup}
              />
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    color: "#666",
  },
});
