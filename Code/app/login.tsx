import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  Button,
  View,
  Pressable,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    // upsert user row
    await supabase.from("user").upsert({ email });

    // Successful login – go to the main app (root)
    if (data.session) {
      router.replace("/(tabs)/home");
    }
  };

  // Open the user's mail client with a pre-filled subject asking for a password reset.
  const handleContactSupport = () => {
    Linking.openURL(
      "mailto:fausto@fitm8.ai?subject=Forgot%20password%20support",
    ).catch(() => {
      // Fallback: if the device cannot open the mail client, show an alert or ignore.
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Sign in</ThemedText>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <View style={styles.buttonWrapper}>
        <Button
          title={loading ? "Signing in…" : "Sign in"}
          onPress={handleLogin}
          disabled={loading}
        />
      </View>

      {/* Reveal the support email only after the user explicitly taps "Forgot password?" */}
      {showSupport ? (
        <Pressable onPress={handleContactSupport} accessibilityRole="link">
          <ThemedText type="link">
            Contact customer support at fausto@fitm8.ai
          </ThemedText>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setShowSupport(true)}
          accessibilityRole="button"
        >
          <ThemedText type="link">Forgot password?</ThemedText>
        </Pressable>
      )}

      <Pressable onPress={() => router.replace("/signup")}>
        <ThemedText type="link">Don't have an account? Sign up</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  buttonWrapper: {
    marginTop: 8,
  },
  error: {
    color: "red",
  },
});
