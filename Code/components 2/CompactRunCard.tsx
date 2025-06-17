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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  };

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        <View style={styles.mainInfo}>
          <Text style={styles.location} numberOfLines={1}>
            {run.location || "No location"}
          </Text>
          <Text style={styles.date}>{formatDate(run.datetime)}</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.runInfo}>
            {formatDistance(run.target_meters || 0)} •{" "}
            {formatPace(run.target_seconds_per_km || 0)}
          </Text>
          <Text style={styles.participants}>{memberCount} runners</Text>
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
  location: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    color: "#000",
  },
  date: {
    fontSize: 14,
    color: "#666",
  },
  details: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  runInfo: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  participants: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
});
