import {
  View,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  Button,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { Tables } from "@/database.types";
import { Text } from "@/components/ui/Text";
import { Modal } from "@/components/ui/Modal";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { User as SupabaseUser } from "@supabase/supabase-js";
import DateTimePicker from "@react-native-community/datetimepicker";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ProfileModal({ visible, onClose }: Props) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Tables<"user"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  // Edit form states
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [birthday, setBirthday] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!user?.email) return;
    try {
      const { data, error } = await supabase
        .from("user")
        .select("*")
        .eq("email", user.email)
        .single();

      if (error) throw error;
      setProfile(data);
      setDisplayName(data.display_name || "");
      setBio(data.bio || "");
      if (data.birthday) {
        setBirthday(new Date(data.birthday));
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  }, [user?.email]);

  useEffect(() => {
    if (user?.email) {
      fetchProfile();
    }
  }, [user?.email, fetchProfile]);

  const updateProfile = async () => {
    if (!user?.email) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("user")
        .update({
          display_name: displayName || null,
          bio: bio || null,
          birthday: birthday.toISOString().split("T")[0],
        })
        .eq("email", user.email);

      if (error) throw error;
      fetchProfile();
      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
    }
    setLoading(false);
  };

  const handleDiscard = () => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      if (profile.birthday) {
        setBirthday(new Date(profile.birthday));
      }
    }
    onClose();
  };

  const pickImage = async () => {
    if (!user?.id || !user?.email) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImageLoading(true);
      try {
        // Get user's numeric ID from database
        const { data: userData, error: userError } = await supabase
          .from("user")
          .select("id")
          .eq("email", user.email)
          .single();

        if (userError || !userData) {
          console.error("Error getting user data:", userError);
          return;
        }

        // Read image as base64 and convert
        const base64 = await FileSystem.readAsStringAsync(
          result.assets[0].uri,
          {
            encoding: FileSystem.EncodingType.Base64,
          }
        );

        const arrayBuffer = decode(base64);

        const fileExt = result.assets[0].uri.split(".").pop() || "jpg";
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const contentType = `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("propics")
          .upload(filePath, arrayBuffer, { contentType });

        if (uploadError) {
          console.error("Error uploading image:", uploadError);
          return;
        }

        const { error: updateError } = await supabase
          .from("user")
          .update({
            propic_bucket_ref: filePath,
          })
          .eq("email", user.email)
          .select();

        if (updateError) {
          console.error("Error updating profile:", updateError);
        } else {
          fetchProfile();
        }
      } catch (error) {
        console.error("Error uploading image:", error);
      } finally {
        setImageLoading(false);
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  if (!profile) return null;

  return (
    <Modal visible={visible} onClose={onClose} title="Profile">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Profile</Text>
          </View>

          <View style={styles.profileSection}>
            <Pressable onPress={pickImage} disabled={imageLoading}>
              {imageLoading ? (
                <View
                  style={[
                    styles.profileImagePlaceholder,
                    styles.loadingContainer,
                  ]}
                >
                  <ActivityIndicator size="large" color="#007AFF" />
                </View>
              ) : profile?.propic_bucket_ref ? (
                <Image
                  source={{
                    uri: supabase.storage
                      .from("propics")
                      .getPublicUrl(profile.propic_bucket_ref).data.publicUrl,
                  }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Text>Add Photo</Text>
                </View>
              )}
            </Pressable>

            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display Name"
            />
            <Text style={styles.email}>{profile.email}</Text>
          </View>

          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>About</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about your running preferences: distance, time of day, experience, and what you feel like sharing"
              multiline
              numberOfLines={2}
            />

            <Text style={styles.sectionTitle}>Birthday</Text>
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
                  <Text>{birthday.toLocaleDateString()}</Text>
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

            <View style={styles.buttonRow}>
              <Button title="Discard" onPress={handleDiscard} />
              <Button title="Save" onPress={updateProfile} disabled={loading} />
            </View>
          </View>

          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 16,
    marginTop: 8,
    width: "100%",
  },
  email: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  detailsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 2,
  },
  bioInput: {
    height: 100,
    paddingTop: 8,
    textAlignVertical: "top",
  },
  dateButton: {
    height: 40,
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
    marginTop: 16,
  },
  signOutButton: {
    marginTop: 16,
    backgroundColor: "#ff3b30",
    height: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
});
