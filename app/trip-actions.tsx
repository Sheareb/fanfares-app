import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TripActionsScreen() {
  const { tripId, tripDescription } = useLocalSearchParams<{
    tripId: string;
    tripDescription: string;
  }>();

  const normalizedTripId = String(tripId ?? "");
  const normalizedTripDescription = String(tripDescription ?? "Trip");

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{normalizedTripDescription}</Text>

        <Pressable
          style={({ pressed }) => [
            styles.optionCard,
            pressed && styles.cardPressed,
          ]}
          onPress={() =>
            router.push({
              pathname: "/trip-bookings",
              params: {
                tripId: normalizedTripId,
                tripDescription: normalizedTripDescription,
              },
            })
          }
        >
          <Text style={styles.optionIcon}>💷</Text>
          <Text style={styles.optionTitle}>Payments</Text>
          <Text style={styles.optionDescription}>
            Review all passengers and update paid or unpaid status.
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.optionCard,
            pressed && styles.cardPressed,
          ]}
          onPress={() =>
            router.push({
              pathname: "/run-trip",
              params: {
                tripId: normalizedTripId,
                tripDescription: normalizedTripDescription,
              },
            })
          }
        >
          <Text style={styles.optionIcon}>🚌</Text>
          <Text style={styles.optionTitle}>Board Bus</Text>
          <Text style={styles.optionDescription}>
            Mark travellers as boarded by tapping their rows.
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.optionCard,
            pressed && styles.cardPressed,
          ]}
          onPress={() =>
            router.push({
              pathname: "/trip-reports",
              params: {
                tripId: normalizedTripId,
                tripDescription: normalizedTripDescription,
              },
            })
          }
        >
          <Text style={styles.optionIcon}>📄</Text>
          <Text style={styles.optionTitle}>Reports</Text>
          <Text style={styles.optionDescription}>
            Generate reports for your trip
          </Text>
        </Pressable>

        <Pressable
          style={styles.backIconButton}
          onPress={() => router.replace("/organiser-dashboard")}
        >
          <Text style={styles.backIconText}>←</Text>
        </Pressable>
      </View>
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
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#132238",
    marginBottom: 32,
    textAlign: "center",
  },
  optionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#5b6bff",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.7,
  },
  optionIcon: {
    fontSize: 34,
    marginBottom: 10,
  },
  optionTitle: {
    color: "#132238",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  optionDescription: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
  },
  backIconButton: {
    alignSelf: "center",
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    marginTop: 14,
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
