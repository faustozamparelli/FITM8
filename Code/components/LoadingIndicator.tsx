import React from "react";
import { ActivityIndicator } from "react-native";
import { StyleSheet } from "react-native";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";

interface LoadingIndicatorProps {
  message?: string;
  size?: "small" | "large";
}

export function LoadingIndicator({
  message = "Loading...",
  size = "large",
}: LoadingIndicatorProps) {
  return (
    <ThemedView style={styles.container}>
      <ActivityIndicator size={size} color="#007AFF" />
      <ThemedText style={styles.message}>{message}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    opacity: 0.7,
    textAlign: "center",
  },
});
