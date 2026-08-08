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
  const [selectedRole, setSelectedRole] = useState<"organiser" | "fan" | null>(
    null,
  );

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

    setSelectedRole(isOrganiser ? "organiser" : "fan");
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
      isOrganiser ? "/(organiser-tabs)/overview" : "/(customer-tabs)/home",
    );
  };

  if (!userId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Welcome to Fanfares</Text>
          <Text style={styles.title}>How will you use Fanfares?</Text>
          <Text style={styles.subtitle}>
            Choose the journey that fits you best. You can always refine it
            later.
          </Text>
          <View style={styles.heroHintRow}>
            <View style={styles.heroHintPill}>
              <Text style={styles.heroHintText}>Fast setup</Text>
            </View>
            <View style={styles.heroHintPill}>
              <Text style={styles.heroHintText}>Mobile-first</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={[
            styles.card,
            loading && styles.disabled,
            selectedRole === "organiser" && styles.cardSelected,
          ]}
          onPress={() => selectRole(true)}
          disabled={loading}
        >
          <Text style={styles.cardIcon}>🎺</Text>
          <Text style={styles.cardTitle}>I’m an organiser</Text>
          <Text style={styles.cardDescription}>
            Create, manage, and operate trips with a clear command centre.
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.card,
            loading && styles.disabled,
            selectedRole === "fan" && styles.cardSelected,
          ]}
          onPress={() => selectRole(false)}
          disabled={loading}
        >
          <Text style={styles.cardIcon}>🎟️</Text>
          <Text style={styles.cardTitle}>I’m a fan</Text>
          <Text style={styles.cardDescription}>
            Browse, book, and keep every journey organised in one neat flow.
          </Text>
        </Pressable>

        {loading && (
          <ActivityIndicator
            style={styles.spinner}
            size="small"
            color="#2563eb"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#07111f",
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
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroHintRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  heroHintPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroHintText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  eyebrow: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#cbd5e1",
    marginBottom: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: "#2563eb",
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
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  spinner: {
    marginTop: 16,
  },
});
