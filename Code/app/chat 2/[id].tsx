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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/database.types";

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

  if (initialLoading) {
    return <LoadingIndicator message="Loading chat..." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
        {/* Header & run details */}
        <ThemedView style={styles.header}>
          <Pressable onPress={handleBack}>
            <ThemedText style={styles.backButton}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="subtitle" style={styles.headerTitle}>
            Group Run
          </ThemedText>
          <Pressable onPress={() => setShowUsers(!showUsers)}>
            <ThemedText style={styles.usersButton}>
              {showUsers ? "Hide Users" : "Show Users"}
            </ThemedText>
          </Pressable>
        </ThemedView>

        {showUsers && (
          <ThemedView style={styles.usersList}>
            {runUsers.map((user) => (
              <View key={user.id} style={styles.userItem}>
                <ThemedText style={styles.userName}>
                  {user.display_name}
                </ThemedText>
                {user.bio && (
                  <ThemedText style={styles.userBio}>{user.bio}</ThemedText>
                )}
              </View>
            ))}
          </ThemedView>
        )}

        {/* Runner & run info */}
        {run && (
          <ThemedView style={styles.runInfoContainer}>
            <Pressable
              style={styles.runInfoHeader}
              onPress={() => setIsRunInfoExpanded(!isRunInfoExpanded)}
            >
              <ThemedText style={styles.runInfoHeaderText}>
                Run Details
              </ThemedText>
              <View style={styles.runInfoHeaderRight}>
                {isRunInfoExpanded &&
                  !isEditing &&
                  run.user?.id === currentUserId && (
                    <Pressable onPress={handleEdit} style={styles.editButton}>
                      <ThemedText style={styles.editButtonText}>
                        Edit
                      </ThemedText>
                    </Pressable>
                  )}
                <ThemedText style={styles.expandIcon}>
                  {isRunInfoExpanded ? "▼" : "▶"}
                </ThemedText>
              </View>
            </Pressable>

            {isRunInfoExpanded && (
              <>
                {run && (
                  <View style={styles.runContainer}>
                    <ThemedText style={styles.runSectionTitle}>
                      {run.user?.display_name}'s Run
                    </ThemedText>
                    {isEditing ? (
                      <View style={styles.editForm}>
                        <View style={styles.editRow}>
                          <ThemedText style={styles.editLabel}>
                            Distance (km):
                          </ThemedText>
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
                                      target_meters: isNaN(km)
                                        ? null
                                        : km * 1000,
                                    }
                                  : null
                              );
                            }}
                            keyboardType="numeric"
                            placeholder="Distance in km"
                          />
                        </View>
                        <View style={styles.editRow}>
                          <ThemedText style={styles.editLabel}>
                            Pace (min/km):
                          </ThemedText>
                          <TextInput
                            style={styles.editInput}
                            value={
                              editedRun?.target_seconds_per_km
                                ? (
                                    editedRun.target_seconds_per_km / 60
                                  ).toFixed(1)
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
                          <ThemedText style={styles.editLabel}>
                            Location:
                          </ThemedText>
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
                          <ThemedText style={styles.editLabel}>
                            Date:
                          </ThemedText>
                          <TextInput
                            style={styles.editInput}
                            value={
                              editedRun?.datetime
                                ? new Date(
                                    editedRun.datetime
                                  ).toLocaleDateString()
                                : ""
                            }
                            onChangeText={(text) => {
                              const date = new Date(text);
                              setEditedRun((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      datetime: isNaN(date.getTime())
                                        ? null
                                        : date.toISOString(),
                                    }
                                  : null
                              );
                            }}
                            placeholder="Date"
                          />
                        </View>
                        <View style={styles.editButtons}>
                          <Pressable
                            onPress={handleCancel}
                            style={[
                              styles.editActionButton,
                              styles.cancelButton,
                            ]}
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
                      </View>
                    ) : (
                      <Pressable style={styles.myRunInfo}>
                        <ThemedText style={styles.myRunText}>
                          {(run.target_meters ?? 0) / 1000}km @
                          {run.target_seconds_per_km
                            ? ` ${(run.target_seconds_per_km / 60).toFixed(1)}min/km`
                            : " N/A"}
                          {run.location ? ` · ${run.location}` : ""}
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                )}

                {otherUser?.bio && (
                  <View style={styles.bioContainer}>
                    <ThemedText style={styles.bioTitle}>
                      About {otherUser.display_name}
                    </ThemedText>
                    <ThemedText style={styles.bioText}>
                      {otherUser.bio}
                    </ThemedText>
                  </View>
                )}
              </>
            )}
          </ThemedView>
        )}

        <FlatList
          ref={flatListRef}
          data={chatItems}
          renderItem={renderMessage}
          keyExtractor={(item, index) =>
            item.type === "message" ? `message-${item.data.id}` : `day-${index}`
          }
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
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
      </Pressable>
    </KeyboardAvoidingView>
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
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
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
    flexGrow: 1,
    padding: 20,
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
  runInfoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f8f9fa",
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
    marginBottom: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
  },
  userBio: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
});
