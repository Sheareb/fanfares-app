import { Link, router } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getIsOrganiser } from "../lib/profile";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    const isDevelopmentBypass =
      __DEV__ && email.trim() === "testName" && password === "testPass";

    if (isDevelopmentBypass) {
      router.replace("/(customer-tabs)/home");
      return;
    }

    if (!hasSupabaseConfig) {
      setErrorMessage(
        "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY first.",
      );
      return;
    }

    if (!supabase) {
      setErrorMessage("Supabase is unavailable right now.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message || "Please try again.");
        return;
      }

      const signedInUserId = authData.user?.id;
      if (!signedInUserId) {
        setErrorMessage(
          "Signed in, but we could not read your account profile.",
        );
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", signedInUserId)
        .maybeSingle();

      if (profileError) {
        setErrorMessage("Signed in, but we could not load your profile.");
        return;
      }

      if (!profileData) {
        router.replace("/select-role");
        return;
      }

      if (getIsOrganiser(profileData)) {
        router.replace("/(organiser-tabs)/overview");
        return;
      }

      router.replace("/(customer-tabs)/home");
    } catch (error) {
      console.error("Login failed", error);
      const message =
        error instanceof Error ? error.message : "Unable to sign in right now.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroSection}>
            <View style={styles.brandPill}>
              <Text style={styles.brandPillText}>
                Fanfares • Travel made simple
              </Text>
            </View>
            <Text style={styles.heroTitle}>Welcome back</Text>
            <Text style={styles.heroSubtitle}>
              Your next journey should feel effortless from the first tap.
            </Text>
            <View style={styles.heroRow}>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>Fast booking</Text>
              </View>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>Real-time updates</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Sign in</Text>
            <Text style={styles.subtitle}>
              Access your trips, bookings, and organiser tools in one place.
            </Text>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (errorMessage) {
                  setErrorMessage(null);
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => {
                // focus handled by next field in the form
              }}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (errorMessage) {
                  setErrorMessage(null);
                }
              }}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                loading && styles.primaryButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "Signing in..." : "Continue"}
              </Text>
            </Pressable>

            <View style={styles.rowLinks}>
              <Pressable onPress={() => router.push("/signup")}>
                <Text style={styles.linkText}>Create account</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/reset-password")}>
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
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
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  heroSection: {
    marginBottom: 18,
  },
  brandPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  brandPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 6,
  },
  heroSubtitle: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  heroRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  heroChip: {
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroChipText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
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
    color: "#475569",
    marginBottom: 18,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "600",
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
  rowLinks: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  linkText: {
    color: "#2563eb",
    fontWeight: "700",
  },
});
