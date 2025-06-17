import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  Button,
  View,
  Pressable,
  Image,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { supabase } from "@/lib/supabase";
import React from "react";
// import { MatchingService } from "@/services/matchingService";

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [birthday, setBirthday] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const uploadProfilePicture = async (userId: number, uri: string) => {
    // react-native fetch on a file:// URI often returns an empty body -> 0-byte upload.
    // Instead, read the file with FileSystem and convert the Base64 string to an ArrayBuffer.
    try {
      // Read the image as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const arrayBuffer = decode(base64);

      // Build path inside the bucket
      const fileExt = uri.split(".").pop() || "jpg";
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const contentType = `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("propics")
        .upload(filePath, arrayBuffer, { contentType });

      if (uploadError) throw uploadError;

      // Record in DB
      const { error: dbError } = await supabase
        .from("user")
        .update({ propic_bucket_ref: filePath })
        .eq("id", userId);

      if (dbError) throw dbError;
    } catch (error) {
      console.error("Error uploading profile picture:", error);
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    // Navigate depending on whether a session exists
    if (data.user) {
      // upsert user row with all the new fields
      const { data: userData, error: userError } = await supabase
        .from("user")
        .upsert({
          email: data.user.email!,
          display_name: displayName || null,
          bio: bio || null,
          birthday: birthday.toISOString().split("T")[0], // Format as YYYY-MM-DD
        })
        .select()
        .single();

      if (userError) {
        setError(userError.message);
        setLoading(false);
        return;
      }

      if (userData) {
        // Upload profile picture if one was selected
        if (profileImage) {
          await uploadProfilePicture(userData.id, profileImage);
        }
        // Update embedding after user and optional propic are set
        try {
          // await MatchingService.updateUserEmbedding(userData.id);
          console.log("User embedding created successfully after signup.");
        } catch (embeddingError) {
          console.error(
            "Failed to create user embedding after signup:",
            embeddingError
          );
          // Potentially inform user or log for follow-up
        }
      }
    }
    if (data.session) {
      router.replace("/(tabs)/home");
    } else {
      router.replace("/login");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">Create account</ThemedText>

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
        <TextInput
          placeholder="Display Name"
          value={displayName}
          onChangeText={setDisplayName}
          style={styles.input}
        />
        <TextInput
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          style={[styles.input, styles.bioInput]}
          placeholder="Tell us about your running preferences: distance, time of day, experience, and what you feel like sharing"
        />

        {Platform.OS === "ios" ? (
          <DateTimePicker
            value={birthday}
            mode="date"
            maximumDate={new Date()}
            onChange={(_event: any, selectedDate?: Date) => {
              if (selectedDate) {
                setBirthday(selectedDate);
              }
            }}
          />
        ) : (
          <>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={styles.dateButton}
            >
              <ThemedText>Birthday: {birthday.toLocaleDateString()}</ThemedText>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={birthday}
                mode="date"
                maximumDate={new Date()}
                onChange={(_event: any, selectedDate?: Date) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setBirthday(selectedDate);
                  }
                }}
              />
            )}
          </>
        )}

        <View style={styles.profilePicSection}>
          <ThemedText>Profile Picture (optional)</ThemedText>
          {profileImage ? (
            <Pressable onPress={pickImage}>
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
              />
            </Pressable>
          ) : (
            <Pressable onPress={pickImage} style={styles.imagePicker}>
              <ThemedText>Tap to select image</ThemedText>
            </Pressable>
          )}
        </View>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <View style={styles.buttonWrapper}>
          <Button
            title={loading ? "Creating…" : "Sign up"}
            onPress={handleSignUp}
            disabled={loading}
          />
        </View>

        <Pressable onPress={() => router.replace("/login")}>
          <ThemedText type="link">Already have an account? Sign in</ThemedText>
        </Pressable>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
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
  bioInput: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  dateButton: {
    height: 48,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  profilePicSection: {
    gap: 8,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: "center",
  },
  imagePicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#ccc",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  buttonWrapper: {
    marginTop: 8,
  },
  error: {
    color: "red",
  },
});
