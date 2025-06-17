import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { Text } from "./Text";
import { IconSymbol } from "./IconSymbol";

interface FloatingButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
}

export function FloatingButton({ title, onPress, style }: FloatingButtonProps) {
  const backgroundColor = "#34c759";

  return (
    <Pressable
      style={[styles.button, { backgroundColor }, style]}
      onPress={onPress}
    >
      <IconSymbol
        name="magnifyingglass"
        size={20}
        color="white"
        style={{ marginRight: 8 }}
      />
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  text: {
    color: "white",
    fontWeight: "600",
  },
});
