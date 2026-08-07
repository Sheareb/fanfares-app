import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

export default function EditProfileScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    router.replace("/");
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setLoading(false);
        Alert.alert("Supabase unavailable", "Unable to load your profile.");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLoading(false);
        Alert.alert("Session expired", "Please sign in again.", [
          { text: "OK", onPress: () => router.replace("/") },
        ]);
        return;
      }

      setEmail(user.email || "");

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      setLoading(false);

      if (profileError) {
        Alert.alert("Load failed", profileError.message);
        return;
      }

      setFullName((profileData?.full_name as string | null) || "");
    };

    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!supabase || !hasSupabaseConfig) {
      Alert.alert("Supabase unavailable", "Unable to save your profile.");
      return;
    }

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Please enter your full name.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      Alert.alert("Session expired", "Please sign in again.", [
        { text: "OK", onPress: () => router.replace("/") },
      ]);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: trimmedName })
      .eq("id", user.id);
    setSaving(false);

    if (error) {
      Alert.alert("Save failed", error.message);
      return;
    }

    Alert.alert("Profile updated", "Your profile has been saved.", [
      {
        text: "OK",
        onPress: () => router.back(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Edit profile</Text>
          <Text style={styles.subtitle}>
            Update your account details used across Fanfares.
          </Text>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#5b6bff" />
              <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={email}
                editable={false}
              />

              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your full name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <Pressable
                style={[
                  styles.primaryButton,
                  saving && styles.primaryButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save profile</Text>
                )}
              </Pressable>
            </>
          )}

          <Pressable
            style={styles.backIconButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIconText}>←</Text>
          </Pressable>

          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f7ff",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#5b6bff",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#132238",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#132238",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#dfe7ff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 15,
    color: "#132238",
  },
  readOnlyInput: {
    backgroundColor: "#f8fafc",
    color: "#64748b",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  loadingText: {
    color: "#64748b",
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#5b6bff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backIconButton: {
    alignSelf: "center",
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    marginTop: 12,
    shadowColor: "#2563eb",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  backIconText: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 24,
    fontWeight: "700",
  },
  signOutButton: {
    marginTop: 14,
    alignItems: "center",
  },
  signOutButtonText: {
    color: "#dc2626",
    fontWeight: "700",
  },
});
