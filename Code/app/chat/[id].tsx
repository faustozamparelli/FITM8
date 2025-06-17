import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  TextInput,
  Pressable,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/database.types";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Modal } from "@/components/ui/Modal";
import { formatDistance, formatPace } from "@/utils/format";

type Message = Tables<"run_message"> & {
  user: Tables<"user"> | null;
};

type ChatItem =
  | { type: "message"; data: Message }
  | { type: "day_separator"; data: { date: string } };

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const run_id = typeof id === "string" ? parseInt(id, 10) : 0;
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [otherUser, setOtherUser] = useState<Tables<"user"> | null>(null);
  const [run, setRun] = useState<
    (Tables<"run"> & { user?: Tables<"user"> | null }) | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRunInfoExpanded, setIsRunInfoExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedRun, setEditedRun] = useState<{
    target_meters: number | null;
    target_seconds_per_km: number | null;
    location: string | null;
    datetime: string | null;
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [runUsers, setRunUsers] = useState<Tables<"user">[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Tables<"user"> | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("run_message")
      .select("*, user(*)")
      .eq("run", run_id)
      .order("created_at", { ascending: true });

    if (data) {
      const messagesData = data as Message[];
      setMessages(messagesData);
      setChatItems(groupMessagesByDay(messagesData));
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    }
  }, [run_id]);

  const fetchChatData = useCallback(async () => {
    if (!run_id) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return;

    try {
      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("id,bio,display_name")
        .eq("email", user.email)
        .single();

      if (userError || !userData) {
        console.error("Error getting user data:", userError);
        return;
      }

      setCurrentUserId(userData.id);

      // Fetch chat participants
      const { data: chatUsers, error: chatUsersError } = await supabase
        .from("run_user")
        .select("user(*)")
        .eq("run", run_id);

      if (chatUsersError) {
        console.error("Error fetching chat users:", chatUsersError);
        return;
      }

      if (chatUsers) {
        const users = chatUsers.map((cu) => cu.user as Tables<"user">);
        setRunUsers(users);
        const other = users.find((u) => u.id !== userData.id);
        if (other) {
          setOtherUser(other);
        }
      }
      // Fetch messages
      fetchMessages();
    } catch (error) {
      console.error("Error in fetchChatData:", error);
    } finally {
      setInitialLoading(false);
    }
  }, [run_id, fetchMessages]);

  const groupMessagesByDay = (messages: Message[]): ChatItem[] => {
    const items: ChatItem[] = [];
    let currentDay = "";

    messages.forEach((message) => {
      const messageDate = new Date(message.created_at);
      const dayString = messageDate.toDateString();

      if (dayString !== currentDay) {
        currentDay = dayString;
        const today = new Date().toDateString();
        const yesterday = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toDateString();

        let displayDate;
        if (dayString === today) {
          displayDate = "Today";
        } else if (dayString === yesterday) {
          displayDate = "Yesterday";
        } else {
          displayDate = messageDate.toLocaleDateString([], {
            weekday: "long",
            month: "short",
            day: "numeric",
          });
        }

        items.push({
          type: "day_separator",
          data: { date: displayDate },
        });
      }

      items.push({
        type: "message",
        data: message,
      });
    });

    return items;
  };

  // Set up data fetching when component mounts or run_id changes
  useEffect(() => {
    if (run_id) {
      fetchChatData();
    }
  }, [run_id, fetchChatData]);

  useEffect(() => {
    supabase
      .from("run")
      .select("*, user!idea_user_fkey(*)")
      .eq("id", run_id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching run:", error);
        } else {
          setRun(data);
        }
      });
  }, [run_id]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId) return;

    setLoading(true);
    console.log({
      message: "inserting message",
      run_id,
      currentUserId,
      newMessage,
    });
    // Insert and immediately return the new row with user joined
    const { data: inserted, error } = await supabase
      .from("run_message")
      .insert({
        run: run_id,
        user: currentUserId,
        text: newMessage.trim(),
      })
      .select(`*, user(*)`)
      .single();

    if (!error && inserted) {
      // Optimistically append so message is visible right away
      const newMessages = [...messages, inserted as Message];
      setMessages(newMessages);
      setChatItems(groupMessagesByDay(newMessages));
      setNewMessage("");
      // Scroll to bottom after slight delay to allow render
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    }
    setLoading(false);
  };

  const handleEdit = () => {
    if (!run) return;
    setEditedRun({
      target_meters: run.target_meters,
      target_seconds_per_km: run.target_seconds_per_km,
      location: run.location,
      datetime: run.datetime,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!run || !editedRun) return;

    try {
      const { error } = await supabase
        .from("run")
        .update({
          target_meters: editedRun.target_meters,
          target_seconds_per_km: editedRun.target_seconds_per_km,
          location: editedRun.location,
          datetime: editedRun.datetime,
        })
        .eq("id", run.id);

      if (error) throw error;

      setRun((prev) => (prev ? { ...prev, ...editedRun } : null));
      setIsEditing(false);
      setEditedRun(null);
    } catch (error) {
      console.error("Error updating run:", error);
      Alert.alert("Error", "Failed to update run details");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedRun(null);
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (selectedDate && editedRun) {
      const newDate = new Date(selectedDate);
      const currentTime = editedRun.datetime
        ? new Date(editedRun.datetime)
        : new Date();
      newDate.setHours(currentTime.getHours());
      newDate.setMinutes(currentTime.getMinutes());
      setEditedRun({
        ...editedRun,
        datetime: newDate.toISOString(),
      });
    }
    setShowDatePicker(false);
  };

  const handleTimeChange = (_event: any, selectedTime?: Date) => {
    if (selectedTime && editedRun) {
      const newDate = editedRun.datetime
        ? new Date(editedRun.datetime)
        : new Date();
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setEditedRun({
        ...editedRun,
        datetime: newDate.toISOString(),
      });
    }
    setShowTimePicker(false);
  };

  const renderDaySeparator = ({ item }: { item: ChatItem }) => {
    if (item.type !== "day_separator") return null;

    return (
      <View style={styles.daySeparatorContainer}>
        <View style={styles.daySeparatorLine} />
        <ThemedText style={styles.daySeparatorText}>
          {item.data.date}
        </ThemedText>
        <View style={styles.daySeparatorLine} />
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ChatItem }) => {
    if (item.type === "day_separator") {
      return renderDaySeparator({ item });
    }

    const message = item.data;
    const isOwnMessage = message.user?.id === currentUserId;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwnMessage && (
          <ThemedText style={styles.messageSender}>
            {message.user?.display_name || "Unknown"}
          </ThemedText>
        )}
        <ThemedText
          style={isOwnMessage ? styles.ownMessageText : styles.otherMessageText}
        >
          {message.text}
        </ThemedText>
        <ThemedText
          style={isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime}
        >
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </ThemedText>
      </View>
    );
  };

  const handleBack = () => {
    router.push({
      pathname: "/(tabs)/chats",
    });
  };

  const handleUserPress = (user: Tables<"user">) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  if (initialLoading) {
    return <LoadingIndicator message="Loading chat..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
          <ThemedView style={styles.header}>
            <Pressable onPress={handleBack}>
              <ThemedText style={styles.backButton}>‹ Back</ThemedText>
            </Pressable>
            <ThemedText type="subtitle" style={styles.headerTitle}>
              {run?.user?.display_name
                ? `${run.user.display_name.split(" ")[0]}'s Run`
                : "Group Run"}
            </ThemedText>
            <Pressable onPress={() => setShowUsers(!showUsers)}>
              <ThemedText style={styles.usersButton}>
                {showUsers ? "Hide Users" : "Show Users"}
              </ThemedText>
            </Pressable>
          </ThemedView>

          {showUsers && (
            <ThemedView style={styles.usersList}>
              {/* Show creator first with special styling */}
              {run?.user && (
                <Pressable
                  key={`creator-${run.user.id}`}
                  style={[styles.userItem, styles.creatorItem]}
                  onPress={() => handleUserPress(run.user!)}
                >
                  <View style={styles.userItemContent}>
                    <View style={styles.creatorInfo}>
                      <ThemedText style={[styles.userName, styles.creatorName]}>
                        {run.user.display_name}
                      </ThemedText>
                      <ThemedText style={styles.creatorLabel}>
                        Creator
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.userItemArrow}>›</ThemedText>
                  </View>
                </Pressable>
              )}

              {/* Show other participants */}
              {runUsers
                .filter((user) => user.id !== run?.user?.id)
                .map((user) => (
                  <Pressable
                    key={user.id}
                    style={styles.userItem}
                    onPress={() => handleUserPress(user)}
                  >
                    <View style={styles.userItemContent}>
                      <ThemedText style={styles.userName}>
                        {user.display_name}
                      </ThemedText>
                      <ThemedText style={styles.userItemArrow}>›</ThemedText>
                    </View>
                  </Pressable>
                ))}
            </ThemedView>
          )}

          <FlatList
            ref={flatListRef}
            data={chatItems}
            keyExtractor={(item, index) =>
              item.type === "message"
                ? item.data.id.toString()
                : `separator-${index}`
            }
            renderItem={renderMessage}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContainer}
            ListHeaderComponent={
              run ? (
                <View style={styles.chatRunDetails}>
                  {run.user?.id === currentUserId && (
                    <Pressable
                      onPress={handleEdit}
                      style={styles.overlayEditButton}
                    >
                      <ThemedText style={styles.editButtonText}>
                        Edit
                      </ThemedText>
                    </Pressable>
                  )}

                  <ThemedText style={styles.runDateTime}>
                    {run.datetime
                      ? (() => {
                          const date = new Date(run.datetime);
                          const now = new Date();
                          const today = new Date(
                            now.getFullYear(),
                            now.getMonth(),
                            now.getDate()
                          );
                          const tomorrow = new Date(
                            today.getTime() + 24 * 60 * 60 * 1000
                          );
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
                            const dayName = date.toLocaleDateString("en-US", {
                              weekday: "long",
                            });
                            return `${dayName} at ${timeString}`;
                          }
                        })()
                      : "No date set"}
                  </ThemedText>

                  <ThemedText style={styles.runLocation}>
                    {run.location || "No location"}
                  </ThemedText>

                  <View style={styles.runStats}>
                    <ThemedText style={styles.runStatsText}>
                      {formatDistance(run.target_meters || 0)} •{" "}
                      {formatPace(run.target_seconds_per_km || 0)}
                    </ThemedText>
                    <ThemedText style={styles.runParticipants}>
                      {runUsers.length} runners
                    </ThemedText>
                  </View>
                </View>
              ) : null
            }
          />

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              multiline
              maxLength={500}
            />
            <Pressable
              style={[
                styles.sendButton,
                !newMessage.trim() && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={loading || !newMessage.trim()}
            >
              <ThemedText style={styles.sendButtonText}>Send</ThemedText>
            </Pressable>
          </View>

          {showUserModal && selectedUser && (
            <Modal
              visible={showUserModal}
              onClose={() => setShowUserModal(false)}
              title={selectedUser.display_name || "User Profile"}
            >
              <View style={styles.userModalContent}>
                <View style={styles.userProfileSection}>
                  <ThemedText style={styles.userModalName}>
                    {selectedUser.display_name}
                  </ThemedText>
                  <ThemedText style={styles.userModalEmail}>
                    {selectedUser.email}
                  </ThemedText>
                </View>

                {selectedUser.bio && (
                  <View style={styles.userBioSection}>
                    <ThemedText style={styles.userBioTitle}>About</ThemedText>
                    <ThemedText style={styles.userBioText}>
                      {selectedUser.bio}
                    </ThemedText>
                  </View>
                )}

                {selectedUser.birthday && (
                  <View style={styles.userInfoSection}>
                    <ThemedText style={styles.userInfoTitle}>
                      Birthday
                    </ThemedText>
                    <ThemedText style={styles.userInfoText}>
                      {new Date(selectedUser.birthday).toLocaleDateString()}
                    </ThemedText>
                  </View>
                )}
              </View>
            </Modal>
          )}

          {/* Edit Modal */}
          <Modal
            visible={isEditing}
            onClose={handleCancel}
            title="Edit Run Details"
          >
            <View style={styles.editForm}>
              <View style={styles.editRow}>
                <ThemedText style={styles.editLabel}>Distance (km):</ThemedText>
                <TextInput
                  style={styles.editInput}
                  value={
                    editedRun?.target_meters
                      ? (editedRun.target_meters / 1000).toString()
                      : ""
                  }
                  onChangeText={(text) => {
                    const km = parseFloat(text);
                    setEditedRun((prev) =>
                      prev
                        ? {
                            ...prev,
                            target_meters: isNaN(km) ? null : km * 1000,
                          }
                        : null
                    );
                  }}
                  keyboardType="numeric"
                  placeholder="Distance in km"
                />
              </View>
              <View style={styles.editRow}>
                <ThemedText style={styles.editLabel}>Pace (min/km):</ThemedText>
                <TextInput
                  style={styles.editInput}
                  value={
                    editedRun?.target_seconds_per_km
                      ? (editedRun.target_seconds_per_km / 60).toFixed(1)
                      : ""
                  }
                  onChangeText={(text) => {
                    const mins = parseFloat(text);
                    setEditedRun((prev) =>
                      prev
                        ? {
                            ...prev,
                            target_seconds_per_km: isNaN(mins)
                              ? null
                              : mins * 60,
                          }
                        : null
                    );
                  }}
                  keyboardType="numeric"
                  placeholder="Pace in min/km"
                />
              </View>
              <View style={styles.editRow}>
                <ThemedText style={styles.editLabel}>Location:</ThemedText>
                <TextInput
                  style={styles.editInput}
                  value={editedRun?.location || ""}
                  onChangeText={(text) =>
                    setEditedRun((prev) =>
                      prev ? { ...prev, location: text } : null
                    )
                  }
                  placeholder="Location"
                />
              </View>
              <View style={styles.editRow}>
                <ThemedText style={styles.editLabel}>Date:</ThemedText>
                {Platform.OS === "ios" ? (
                  <DateTimePicker
                    value={
                      editedRun?.datetime
                        ? new Date(editedRun.datetime)
                        : new Date()
                    }
                    mode="date"
                    minimumDate={new Date()}
                    onChange={handleDateChange}
                  />
                ) : (
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={styles.dateTimeButton}
                  >
                    <ThemedText>
                      {editedRun?.datetime
                        ? new Date(editedRun.datetime).toLocaleDateString()
                        : "Select date"}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              <View style={styles.editRow}>
                <ThemedText style={styles.editLabel}>Time:</ThemedText>
                {Platform.OS === "ios" ? (
                  <DateTimePicker
                    value={
                      editedRun?.datetime
                        ? new Date(editedRun.datetime)
                        : new Date()
                    }
                    mode="time"
                    onChange={handleTimeChange}
                  />
                ) : (
                  <Pressable
                    onPress={() => setShowTimePicker(true)}
                    style={styles.dateTimeButton}
                  >
                    <ThemedText>
                      {editedRun?.datetime
                        ? new Date(editedRun.datetime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Select time"}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              {Platform.OS === "android" && showDatePicker && (
                <DateTimePicker
                  value={
                    editedRun?.datetime
                      ? new Date(editedRun.datetime)
                      : new Date()
                  }
                  mode="date"
                  minimumDate={new Date()}
                  onChange={handleDateChange}
                />
              )}
              {Platform.OS === "android" && showTimePicker && (
                <DateTimePicker
                  value={
                    editedRun?.datetime
                      ? new Date(editedRun.datetime)
                      : new Date()
                  }
                  mode="time"
                  onChange={handleTimeChange}
                />
              )}
              <View style={styles.editButtons}>
                <Pressable
                  onPress={handleCancel}
                  style={[styles.editActionButton, styles.cancelButton]}
                >
                  <ThemedText style={styles.editActionButtonText}>
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  style={[styles.editActionButton, styles.saveButton]}
                >
                  <ThemedText style={styles.editActionButtonText}>
                    Save
                  </ThemedText>
                </Pressable>
              </View>
              <View style={styles.deleteSection}>
                <Pressable
                  onPress={() => {
                    Alert.alert(
                      "Delete Run",
                      "Are you sure you want to delete this run? This action cannot be undone.",
                      [
                        {
                          text: "Cancel",
                          style: "cancel",
                        },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              // First delete all related run_user records
                              const { error: runUserError } = await supabase
                                .from("run_user")
                                .delete()
                                .eq("run", run_id);

                              if (runUserError) throw runUserError;

                              // Then delete all related messages
                              const { error: messageError } = await supabase
                                .from("run_message")
                                .delete()
                                .eq("run", run_id);

                              if (messageError) throw messageError;

                              // Finally delete the run itself
                              const { error: runError } = await supabase
                                .from("run")
                                .delete()
                                .eq("id", run_id);

                              if (runError) throw runError;

                              // Navigate back to home with a refresh parameter
                              router.replace({
                                pathname: "/",
                                params: {
                                  refresh: Date.now().toString(),
                                },
                              });
                            } catch (error) {
                              console.error("Error deleting run:", error);
                              Alert.alert("Error", "Failed to delete run");
                            }
                          },
                        },
                      ]
                    );
                  }}
                  style={styles.deleteButton}
                >
                  <ThemedText style={styles.deleteButtonText}>
                    Delete Run
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </Modal>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 0,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    fontSize: 18,
    color: "#007AFF",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 50,
  },
  messagesList: {
    flex: 1,
  },
  messageContainer: {
    maxWidth: "80%",
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#e0e0e0",
  },
  ownMessageText: {
    fontSize: 16,
    color: "white",
  },
  ownMessageTime: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 4,
  },
  otherMessageText: {
    fontSize: 16,
    color: "#333333",
  },
  otherMessageTime: {
    fontSize: 12,
    color: "rgba(51, 51, 51, 0.7)",
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "white",
    fontWeight: "600",
  },
  runInfoContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  runInfoHeaderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#495057",
  },
  expandIcon: {
    fontSize: 14,
    color: "#6c757d",
  },
  runSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    opacity: 0.7,
  },
  runContainer: {
    backgroundColor: "#E3F2FD",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  myRunInfo: {
    flexDirection: "column",
  },
  myRunText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1565C0",
  },
  editHint: {
    fontSize: 12,
    color: "#007AFF",
    marginTop: 4,
    fontWeight: "500",
  },
  otherRunContainer: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#9E9E9E",
  },
  otherRunInfo: {
    flexDirection: "column",
  },
  otherRunText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#424242",
  },
  bioContainer: {
    backgroundColor: "#FFF3E0",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  bioTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#E65100",
  },
  bioText: {
    fontSize: 14,
    color: "#BF360C",
    lineHeight: 20,
  },
  runInfoText: {
    fontSize: 16,
    marginBottom: 12,
  },
  daySeparatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  daySeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  daySeparatorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#495057",
    marginHorizontal: 10,
  },
  runInfoHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  editButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  editForm: {
    padding: 16,
    gap: 12,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editLabel: {
    width: 100,
    fontSize: 14,
    fontWeight: "500",
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  editButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  editActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: "#666",
  },
  saveButton: {
    backgroundColor: "#007AFF",
  },
  editActionButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  messageSender: {
    fontSize: 12,
    color: "rgba(51, 51, 51, 0.7)",
    marginBottom: 4,
  },
  usersButton: {
    fontSize: 16,
    color: "#007AFF",
  },
  usersList: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  userItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "white",
  },
  userItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userItemArrow: {
    fontSize: 18,
    color: "#007AFF",
    fontWeight: "600",
  },
  userName: {
    fontSize: 16,
    fontWeight: "500",
  },
  userBio: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "center",
  },
  deleteButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
  },
  deleteButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  dateTimeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "white",
  },
  userModalContent: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  userProfileSection: {
    marginBottom: 20,
  },
  userModalName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  userModalEmail: {
    fontSize: 14,
    color: "#666",
  },
  userBioSection: {
    marginBottom: 20,
  },
  userBioTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  userBioText: {
    fontSize: 14,
    color: "#666",
  },
  userInfoSection: {
    marginBottom: 20,
  },
  userInfoTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  userInfoText: {
    fontSize: 14,
    color: "#666",
  },
  fixedRunInfo: {
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  runInfoHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f8f9fa",
  },
  runInfoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#495057",
  },
  runInfoContent: {
    padding: 16,
  },
  runDateTime: {
    fontSize: 14,
    fontWeight: "500",
    color: "#495057",
    marginBottom: 8,
  },
  runLocation: {
    fontSize: 14,
    fontWeight: "500",
    color: "#495057",
    marginBottom: 12,
  },
  runStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  runStatsText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#495057",
  },
  runParticipants: {
    fontSize: 14,
    fontWeight: "500",
    color: "#495057",
  },
  creatorItem: {
    backgroundColor: "#E3F2FD",
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  creatorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: "600",
  },
  creatorLabel: {
    fontSize: 12,
    color: "#6c757d",
  },
  chatRunDetails: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#f8f9fa",
    position: "relative",
  },
  overlayEditButton: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    zIndex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
