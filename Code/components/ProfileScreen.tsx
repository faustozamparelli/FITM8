import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  ScrollView,
  TextInput,
  Button,
  View,
  Pressable,
  Image,
  Alert,
  FlatList,
  Platform,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { supabase } from "@/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { Tables } from "@/database.types";
// import { MatchingService } from "@/services/matchingService";

export default function ProfileScreen() {
  const [user, setUser] = useState<Tables<"user"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form states
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [birthday, setBirthday] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    setLoading(true);
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (authUser) {
      const { data: userData } = await supabase
        .from("user")
        .select("*")
        .eq("email", authUser.email!)
        .single();

      if (userData) {
        setUser(userData);
        setDisplayName(userData.display_name || "");
        setBio(userData.bio || "");
        if (userData.birthday) {
          setBirthday(new Date(userData.birthday));
        }
      }
    }
    setLoading(false);
  };

  const updateProfile = async () => {
    if (!user) return;

    setLoading(true);
    const { error } = await supabase
      .from("user")
      .update({
        display_name: displayName || null,
        bio: bio || null,
        birthday: birthday.toISOString().split("T")[0],
      })
      .eq("id", user.id);

    if (!error) {
      // try {
      //   await MatchingService.updateUserEmbedding(user.id);
      //   console.log(
      //     "User embedding updated successfully after profile change."
      //   );
      // } catch (embeddingError) {
      //   console.error("Failed to update user embedding:", embeddingError);
      //   // Optionally, inform the user that part of the update failed
      //   Alert.alert(
      //     "Profile Updated",
      //     "Profile details saved, but we had an issue refreshing match data. Please try again later."
      //   );
      // }
      setEditing(false);
      fetchUserData();
    } else {
      Alert.alert("Error", "Failed to update profile");
    }
    setLoading(false);
  };

  const pickAndUploadImage = async () => {
    if (!user) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setLoading(true);
      const uri = result.assets[0].uri;

      try {
        // Read image as base64 and convert
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const arrayBuffer = decode(base64);

        const fileExt = uri.split(".").pop() || "jpg";
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const contentType = `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;

        console.log("Starting storage upload...");
        const { error: uploadError } = await supabase.storage
          .from("propics")
          .upload(filePath, arrayBuffer, { contentType });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw uploadError;
        }
        console.log("Storage upload successful");

        console.log("Starting database insert...");
        const { error: dbError } = await supabase
          .from("user")
          .update({ propic_bucket_ref: filePath })
          .eq("id", user.id);

        if (dbError) {
          console.error("Database insert error:", dbError);
          throw dbError;
        }
        console.log("Database insert successful");

        fetchUserData();
      } catch (error) {
        console.error("Error uploading profile picture:", error);
        Alert.alert("Error", "Failed to upload image");
      }
      setLoading(false);
    }
  };

  const deletePropic = async (bucketRef: string) => {
    if (!user) return;

    Alert.alert("Delete Photo", "Are you sure you want to delete this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setLoading(true);

          // Delete from storage
          await supabase.storage.from("propics").remove([bucketRef]);

          // Delete from database
          const { error } = await supabase
            .from("user")
            .update({ propic_bucket_ref: null })
            .eq("id", user.id);

          if (!error) {
            fetchUserData();
          }
          setLoading(false);
        },
      },
    ]);
  };

  const getImageUrl = (bucketRef: string) => {
    const { data } = supabase.storage.from("propics").getPublicUrl(bucketRef);
    return data.publicUrl;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const renderPropic = ({ item }: { item: string }) => (
    <Pressable
      style={styles.propicContainer}
      onLongPress={() => deletePropic(item)}
    >
      <Image source={{ uri: getImageUrl(item) }} style={styles.propic} />
    </Pressable>
  );

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <LoadingIndicator />
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Profile</ThemedText>
        {!editing && (
          <Pressable onPress={() => setEditing(true)}>
            <ThemedText style={styles.editButton}>Edit</ThemedText>
          </Pressable>
        )}
      </ThemedView>

      <View style={styles.profileSection}>
        <ThemedText type="subtitle">Profile Pictures</ThemedText>

        <FlatList
          data={user.propic_bucket_ref ? [user.propic_bucket_ref] : []}
          renderItem={renderPropic}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          ListFooterComponent={
            <Pressable
              style={styles.addPropicButton}
              onPress={pickAndUploadImage}
            >
              <ThemedText style={styles.addPropicText}>+</ThemedText>
            </Pressable>
          }
          contentContainerStyle={styles.propicList}
        />

        <ThemedText style={styles.hint}>
          Long press to delete a photo
        </ThemedText>
      </View>

      <View style={styles.infoSection}>
        {editing ? (
          <>
            <View style={styles.field}>
              <ThemedText>Display Name</ThemedText>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter display name"
              />
            </View>

            <View style={styles.field}>
              <ThemedText>Bio</ThemedText>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about your running preferences: distance, time of day, experience, and what you feel like sharing"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.field}>
              <ThemedText>Birthday</ThemedText>
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
                    <ThemedText>{birthday.toLocaleDateString()}</ThemedText>
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
            </View>

            <View style={styles.buttonRow}>
              <Button
                title="Cancel"
                onPress={() => {
                  setEditing(false);
                  setDisplayName(user.display_name || "");
                  setBio(user.bio || "");
                  if (user.birthday) {
                    setBirthday(new Date(user.birthday));
                  }
                }}
              />
              <Button title="Save" onPress={updateProfile} disabled={loading} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <ThemedText style={styles.label}>Display Name</ThemedText>
              <ThemedText>{user.display_name || "Not set"}</ThemedText>
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <ThemedText>{user.email}</ThemedText>
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>Bio</ThemedText>
              <ThemedText>{user.bio || "No bio yet"}</ThemedText>
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>Birthday</ThemedText>
              <ThemedText>
                {user.birthday
                  ? new Date(user.birthday).toLocaleDateString()
                  : "Not set"}
              </ThemedText>
            </View>
          </>
        )}
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  editButton: {
    color: "#007AFF",
    fontSize: 17,
  },
  profileSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  propicList: {
    paddingVertical: 16,
  },
  propicContainer: {
    marginRight: 12,
  },
  propic: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  addPropicButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#ccc",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addPropicText: {
    fontSize: 30,
    lineHeight: 30,
    color: "#ccc",
    textAlign: "center",
  },
  hint: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 8,
  },
  infoSection: {
    paddingHorizontal: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    opacity: 0.6,
    marginBottom: 4,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 16,
    marginTop: 8,
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
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
  signOutButton: {
    marginHorizontal: 20,
    marginVertical: 40,
    backgroundColor: "#ff3b30",
    height: 48,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
});
