import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getProfileOrganiserPayload,
  shouldRetryProfileInsertWithLegacyColumn,
} from "../lib/profile";
import { supabase } from "../lib/supabase";

export default function SelectRoleScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/");
        return;
      }
      setUserId(data.user.id);
      setFullName(
        (data.user.user_metadata?.full_name as string | undefined) ?? "",
      );
    });
  }, []);

  const selectRole = async (isOrganiser: boolean) => {
    if (!userId || !supabase) return;

    setLoading(true);

    let { error } = await supabase.from("profiles").insert({
      id: userId,
      full_name: fullName,
      ...getProfileOrganiserPayload(isOrganiser, false),
    });

    if (shouldRetryProfileInsertWithLegacyColumn(error?.message)) {
      const retry = await supabase.from("profiles").insert({
        id: userId,
        full_name: fullName,
        ...getProfileOrganiserPayload(isOrganiser, true),
      });
      error = retry.error;
    }

    setLoading(false);

    if (error) {
      Alert.alert("Error", "Could not save your profile. Please try again.");
      return;
    }

    router.replace(
      isOrganiser ? "/organiser-dashboard" : "/customer_dashboard",
    );
  };

  if (!userId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#5b6bff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>How will you use Fanfares?</Text>
        <Text style={styles.subtitle}>
          Choose your account type. You can only set this once.
        </Text>

        <Pressable
          style={[styles.card, loading && styles.disabled]}
          onPress={() => selectRole(true)}
          disabled={loading}
        >
          <Text style={styles.cardIcon}>🎺</Text>
          <Text style={styles.cardTitle}>I'm an Organiser</Text>
          <Text style={styles.cardDescription}>
            Create and manage trips for fans to book.
          </Text>
        </Pressable>

        <Pressable
          style={[styles.card, loading && styles.disabled]}
          onPress={() => selectRole(false)}
          disabled={loading}
        >
          <Text style={styles.cardIcon}>🎟️</Text>
          <Text style={styles.cardTitle}>I'm a Fan</Text>
          <Text style={styles.cardDescription}>
            Browse and book trips organised by others.
          </Text>
        </Pressable>

        {loading && (
          <ActivityIndicator
            style={styles.spinner}
            size="small"
            color="#5b6bff"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f7ff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#132238",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 32,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#5b6bff",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  disabled: {
    opacity: 0.5,
  },
  cardIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#132238",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  spinner: {
    marginTop: 16,
  },
});
