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
      router.replace("/customer_dashboard");
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
        router.replace("/organiser-dashboard");
        return;
      }

      router.replace("/customer_dashboard");
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
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/images/fanfares_logo_white.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to continue to your account.
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
            />

            <Pressable
              style={styles.primaryButton}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "Signing in..." : "Log in"}
              </Text>
            </Pressable>

            <View style={styles.rowLinks}>
              <Link href="/signup" style={styles.linkText}>
                Create account
              </Link>
              <Link href="/reset-password" style={styles.linkText}>
                Forgot password?
              </Link>
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
    backgroundColor: "#f4f7ff",
  },
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 640,
    height: 240,
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
    marginBottom: 24,
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
    backgroundColor: "#5b6bff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  rowLinks: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  linkText: {
    color: "#5b6bff",
    fontWeight: "600",
  },
});
