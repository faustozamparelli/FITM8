import { View, StyleSheet, Image, Dimensions } from "react-native";
import { Text } from "./ui/Text";
import { Tables } from "@/database.types";
import { formatDistance, formatPace } from "@/utils/format";
import { supabase } from "@/lib/supabase";
import { IconSymbol } from "./ui/IconSymbol";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface RunCardProps {
  run: Tables<"run"> & { user?: Tables<"user"> | null };
  showSwipeIndicators?: boolean;
}

export function RunCard({ run, showSwipeIndicators }: RunCardProps) {
  if (!run) return null;

  const calculateAge = (birthday: string | null) => {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {run.user && run.user.propic_bucket_ref ? (
          <Image
            source={{
              uri: supabase.storage
                .from("propics")
                .getPublicUrl(run.user.propic_bucket_ref).data.publicUrl,
            }}
            style={styles.organizerImage}
          />
        ) : (
          <View style={styles.organizerImagePlaceholder}>
            <IconSymbol name="person.circle" size={48} color="#666" />
          </View>
        )}

        <View style={styles.organizerInfo}>
          <Text style={styles.organizerName}>
            {run.user?.display_name}
            {run.user?.birthday && `, ${calculateAge(run.user.birthday)}`}
          </Text>
          <Text style={styles.organizerBio}>{run.user?.bio}</Text>
        </View>

        <View style={styles.runDetails}>
          <View style={styles.detailRow}>
            <IconSymbol name="figure.run" size={24} color="#007AFF" />
            <Text style={styles.detailText}>
              {formatDistance(run.target_meters || 0)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <IconSymbol name="timer" size={24} color="#007AFF" />
            <Text style={styles.detailText}>
              {formatPace(run.target_seconds_per_km || 0)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <IconSymbol name="location" size={24} color="#007AFF" />
            <Text style={styles.detailText}>{run.location}</Text>
          </View>
          <View style={styles.detailRow}>
            <IconSymbol name="calendar" size={24} color="#007AFF" />
            <Text style={styles.detailText}>
              {new Date(run.datetime || "").toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>

      {showSwipeIndicators && (
        <View style={styles.swipeIndicators}>
          <View style={styles.swipeIndicator}>
            <IconSymbol name="arrow.left" size={20} color="#666" />
            <Text style={styles.swipeText}>Skip</Text>
          </View>
          <View style={styles.swipeIndicator}>
            <Text style={styles.swipeText}>Join</Text>
            <IconSymbol name="arrow.right" size={20} color="#666" />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "relative",
  },
  card: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 20,
    margin: 16,
    padding: 0,
    alignItems: "center",
    overflow: "hidden",
  },
  organizerImage: {
    width: "100%",
    height: SCREEN_WIDTH * 0.4,
    marginBottom: 8,
  },
  organizerImagePlaceholder: {
    width: "100%",
    height: SCREEN_WIDTH * 0.4,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  organizerInfo: {
    alignItems: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 24,
    width: "100%",
  },
  organizerName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 2,
  },
  organizerBio: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  runDetails: {
    width: "100%",
    gap: 6,
    paddingHorizontal: 24,
    flex: 1,
    justifyContent: "center",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 16,
  },
  swipeIndicators: {
    flex: 0.1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  swipeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swipeText: {
    fontSize: 14,
    color: "#666",
  },
});
