import { router } from "expo-router";
import React, { useState } from "react";
import {
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

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Missing email", "Please enter your email address.");
      return;
    }

    if (!hasSupabaseConfig) {
      Alert.alert(
        "Supabase not configured",
        "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY first.",
      );
      return;
    }

    if (!supabase) {
      Alert.alert("Supabase unavailable", "Unable to initialize Supabase.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "fanfares://reset-password",
    });
    setLoading(false);

    if (error) {
      Alert.alert("Reset failed", error.message);
      return;
    }

    Alert.alert("Check your email", "A reset link has been sent.");
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Reset password</Text>
          <Text style={styles.heroSubtitle}>
            We’ll send a secure link to help you get back into your account.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Recovery</Text>
          <Text style={styles.subtitle}>
            Enter the email tied to your account.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="done"
            onSubmitEditing={handleResetPassword}
          />

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              loading && styles.primaryButtonDisabled,
            ]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Sending..." : "Send reset link"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.backIconButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIconText}>←</Text>
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
    opacity: 0.7,
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
});
