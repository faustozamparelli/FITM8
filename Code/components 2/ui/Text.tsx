import { Text as RNText, TextProps as RNTextProps } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";

interface TextProps extends RNTextProps {
  type?: "title" | "subtitle" | "body";
}

export function Text({ style, type = "body", ...props }: TextProps) {
  const colorScheme = useColorScheme();
  const color = Colors[colorScheme ?? "light"].text;

  const getFontSize = () => {
    switch (type) {
      case "title":
        return 24;
      case "subtitle":
        return 18;
      case "body":
      default:
        return 16;
    }
  };

  return (
    <RNText
      style={[
        {
          color,
          fontSize: getFontSize(),
        },
        style,
      ]}
      {...props}
    />
  );
}
