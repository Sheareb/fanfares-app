import { router } from "expo-router";
import React, { useState } from "react";
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

export default function ChangePasswordScreen() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    router.replace("/");
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Missing password", "Please fill in both password fields.");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(
        "Password too short",
        "Please use at least 8 characters for your new password.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords do not match", "Please re-enter your password.");
      return;
    }

    if (!hasSupabaseConfig || !supabase) {
      Alert.alert("Supabase unavailable", "Unable to update your password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      Alert.alert("Password update failed", error.message);
      return;
    }

    Alert.alert("Password updated", "Your password has been changed.", [
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
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Security</Text>
          <Text style={styles.heroSubtitle}>
            Keep your account protected with a fresh password.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Change password</Text>
          <Text style={styles.subtitle}>
            Use a strong password you’ll remember.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleChangePassword}
          />

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              loading && styles.primaryButtonDisabled,
            ]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Update password</Text>
            )}
          </Pressable>

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
    backgroundColor: "#07111f",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  heroSection: {
    marginBottom: 18,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  cardLabel: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 18,
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
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
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
