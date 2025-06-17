import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useState } from "react";
import { Text } from "./ui/Text";
import { Modal } from "./ui/Modal";
import { supabase } from "@/lib/supabase";
import DateTimePicker from "@react-native-community/datetimepicker";

interface NewRunModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewRunModal({ visible, onClose, onSuccess }: NewRunModalProps) {
  const [distance, setDistance] = useState("");
  const [paceMinutes, setPaceMinutes] = useState("");
  const [paceSeconds, setPaceSeconds] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: userData } = await supabase
        .from("user")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!userData) return;

      const targetMeters = parseFloat(distance) * 1000; // Convert km to meters
      const targetSecondsPerKm =
        parseInt(paceMinutes) * 60 + parseInt(paceSeconds);

      // Create the run
      const { data: runData, error: runError } = await supabase
        .from("run")
        .insert([
          {
            user: userData.id,
            target_meters: targetMeters,
            target_seconds_per_km: targetSecondsPerKm,
            location,
            datetime: date.toISOString(),
          },
        ])
        .select()
        .single();

      if (runError) throw runError;

      // Add the organizer to the chat
      const { error: runUserError } = await supabase
        .from("run_user")
        .insert([{ run: runData.id, user: userData.id }]);

      if (runUserError) throw runUserError;

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating run:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Create New Run">
      <View style={styles.container}>
        <Text type="title" style={styles.title}>
          Create New Run
        </Text>

        <View style={styles.inputGroup}>
          <Text>Distance (km)</Text>
          <TextInput
            style={styles.input}
            value={distance}
            onChangeText={setDistance}
            keyboardType="numeric"
            placeholder="e.g. 5"
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text>Target Pace</Text>
          <View style={styles.paceInputs}>
            <TextInput
              style={[styles.input, styles.paceInput]}
              value={paceMinutes}
              onChangeText={setPaceMinutes}
              keyboardType="numeric"
              placeholder="min"
              editable={!isSubmitting}
            />
            <Text>:</Text>
            <TextInput
              style={[styles.input, styles.paceInput]}
              value={paceSeconds}
              onChangeText={setPaceSeconds}
              keyboardType="numeric"
              placeholder="sec"
              editable={!isSubmitting}
            />
            <Text>/km</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Central Park"
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text>Date</Text>
          {Platform.OS === "ios" ? (
            <DateTimePicker
              value={date}
              mode="date"
              onChange={(_event, selectedDate) => {
                if (selectedDate) {
                  setDate(selectedDate);
                }
              }}
            />
          ) : (
            <>
              <Pressable
                onPress={() => !isSubmitting && setShowDatePicker(true)}
              >
                <Text>{date.toLocaleDateString()}</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  onChange={(_event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setDate(selectedDate);
                    }
                  }}
                />
              )}
            </>
          )}
        </View>

        <Pressable
          style={[
            styles.submitButton,
            isSubmitting && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Create Run</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  paceInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  paceInput: {
    width: 80,
  },
  submitButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "white",
    fontWeight: "600",
  },
});
