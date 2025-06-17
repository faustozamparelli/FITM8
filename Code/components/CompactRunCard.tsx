import { View, StyleSheet, Pressable } from "react-native";
import { Text } from "./ui/Text";
import { formatDistance, formatPace } from "@/utils/format";
import { Tables } from "@/database.types";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface CompactRunCardProps {
  run: Tables<"run">;
  onPress?: () => void;
}

export function CompactRunCard({ run, onPress }: CompactRunCardProps) {
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    const fetchMemberCount = async () => {
      const { count, error } = await supabase
        .from("run_user")
        .select("*", { count: "exact", head: true })
        .eq("run", run.id);

      if (!error && count !== null) {
        setMemberCount(count);
      }
    };

    fetchMemberCount();
  }, [run.id]);

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

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        <View style={styles.mainInfo}>
          <Text style={styles.dateTime} numberOfLines={1}>
            {formatSmartDate(run.datetime)}
          </Text>
          <Text style={styles.location} numberOfLines={1}>
            {run.location || "No location"}
          </Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.runInfo}>
            {formatDistance(run.target_meters || 0)} •{" "}
            {formatPace(run.target_seconds_per_km || 0)}
          </Text>
          {memberCount > 1 && (
            <Text style={styles.participants}>{memberCount} runners</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
  },
  mainInfo: {
    marginBottom: 8,
  },
  dateTime: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    color: "#007AFF",
  },
  location: {
    fontSize: 14,
    color: "#000",
    fontWeight: "500",
  },
  details: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  runInfo: {
    fontSize: 14,
    color: "#666",
    fontWeight: "400",
  },
  participants: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
});
