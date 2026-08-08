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
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Trip operations</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Focused controls</Text>
          </View>
          <Text style={styles.title}>{normalizedTripDescription}</Text>
          <Text style={styles.subtitle}>
            Run the journey with clarity, speed, and fewer taps.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.optionCard,
            pressed && styles.cardPressed,
          ]}
          onPress={() =>
            router.push({
              pathname: "/trip-details",
              params: {
                tripId: normalizedTripId,
                tripDescription: normalizedTripDescription,
              },
            })
          }
        >
          <View style={styles.optionContent}>
            <View style={styles.optionIconWrap}>
              <Text style={styles.optionIcon}>🧭</Text>
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Trip overview</Text>
              <Text style={styles.optionDescription}>
                Review trip details, passenger status, and next actions.
              </Text>
            </View>
          </View>
        </Pressable>

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
          <View style={styles.optionContent}>
            <View style={styles.optionIconWrap}>
              <Text style={styles.optionIcon}>💷</Text>
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Payments</Text>
              <Text style={styles.optionDescription}>
                Review every passenger and update payment status in one place.
              </Text>
            </View>
          </View>
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
          <View style={styles.optionContent}>
            <View style={styles.optionIconWrap}>
              <Text style={styles.optionIcon}>🚌</Text>
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Boarding</Text>
              <Text style={styles.optionDescription}>
                Tap through the list to mark travellers as they board.
              </Text>
            </View>
          </View>
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
          <View style={styles.optionContent}>
            <View style={styles.optionIconWrap}>
              <Text style={styles.optionIcon}>📄</Text>
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTitle}>Reports</Text>
              <Text style={styles.optionDescription}>
                Generate trip reports and keep operations organised.
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
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
    padding: 24,
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  backButtonText: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 20,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 40,
  },
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  heroBadgeText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 20,
  },
  optionCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardPressed: {
    opacity: 0.85,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  optionIcon: {
    fontSize: 24,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  optionDescription: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
  },
});
