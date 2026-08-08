import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OrganiserTripsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Create and manage</Text>
          <Text style={styles.title}>Trip tools</Text>
          <Text style={styles.subtitle}>
            Add a new journey or jump into an existing one.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.actionCard,
            pressed && styles.actionCardPressed,
          ]}
          onPress={() => router.push("/add-trip")}
        >
          <Text style={styles.actionIcon}>➕</Text>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Create trip</Text>
            <Text style={styles.actionDescription}>
              Publish a new departure and manage pickup points.
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionCard,
            pressed && styles.actionCardPressed,
          ]}
          onPress={() => router.push("/(organiser-tabs)/overview")}
        >
          <Text style={styles.actionIcon}>🧭</Text>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Manage trips</Text>
            <Text style={styles.actionDescription}>
              Open the full organiser dashboard when you need detailed control.
            </Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#07111f" },
  container: { flex: 1, padding: 24, gap: 16 },
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  eyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#475569", lineHeight: 20 },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  actionCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.995 }],
  },
  actionIcon: { fontSize: 24 },
  actionTextWrap: { flex: 1 },
  actionTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  actionDescription: { color: "#64748b", fontSize: 13, lineHeight: 18 },
});
