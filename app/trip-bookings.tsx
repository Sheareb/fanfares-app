import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

type BookingRow = {
  booking_id: string;
  customer_name: string;
  paid: boolean;
};

function surname(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

function forename(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[0].toLowerCase();
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function TripBookingsScreen() {
  const { tripId, tripDescription } = useLocalSearchParams<{
    tripId: string;
    tripDescription: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  // track paid state separately so toggles are responsive
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!tripId || !supabase || !hasSupabaseConfig) {
      setErrorMessage("Trip not found.");
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase!
        .from("trip_bookings")
        .select("booking_id, customer_name, paid")
        .eq("trip_id", tripId);

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      const sorted = ((data ?? []) as BookingRow[]).sort((a, b) =>
        surname(a.customer_name ?? "") !== surname(b.customer_name ?? "")
          ? surname(a.customer_name ?? "").localeCompare(
              surname(b.customer_name ?? ""),
            )
          : forename(a.customer_name ?? "") !== forename(b.customer_name ?? "")
            ? forename(a.customer_name ?? "").localeCompare(
                forename(b.customer_name ?? ""),
              )
            : normalizeName(a.customer_name ?? "").localeCompare(
                normalizeName(b.customer_name ?? ""),
              ),
      );

      setBookings(sorted);
      setPaidMap(
        Object.fromEntries(sorted.map((b) => [b.booking_id, Boolean(b.paid)])),
      );
      setLoading(false);
    };

    load();
  }, [tripId]);

  const updateBookingStatus = async (booking: BookingRow, isPaid: boolean) => {
    if (!supabase) return;

    const bookingId = booking.booking_id;
    const previous = paidMap[bookingId] ?? false;
    const newPaid = isPaid;

    setErrorMessage(null);
    setPaidMap((prev) => ({
      ...prev,
      [bookingId]: isPaid,
    }));
    setSavingMap((prev) => ({
      ...prev,
      [bookingId]: true,
    }));

    const { error } = await supabase
      .from("trip_bookings")
      .update({ paid: newPaid })
      .eq("booking_id", bookingId);

    if (error) {
      setPaidMap((prev) => ({
        ...prev,
        [bookingId]: previous,
      }));
      setErrorMessage(
        `Failed to save ${booking.customer_name}: ${error.message}`,
      );
    } else {
      setBookings((prev) =>
        prev.map((entry) =>
          entry.booking_id === bookingId ? { ...entry, paid: newPaid } : entry,
        ),
      );
    }

    setSavingMap((prev) => ({
      ...prev,
      [bookingId]: false,
    }));
  };

  const renderBookingRow = (booking: BookingRow) => {
    const isPaid = paidMap[booking.booking_id] ?? false;
    const isSaving = savingMap[booking.booking_id] ?? false;

    return (
      <View key={booking.booking_id} style={styles.row}>
        <Text style={styles.passengerName}>
          {booking.customer_name || "Unknown"}
        </Text>
        <View style={styles.paidColumn}>
          <Text style={styles.paidLabel}>{isPaid ? "Paid" : "Unpaid"}</Text>
          <Switch
            value={isPaid}
            onValueChange={(val) => updateBookingStatus(booking, val)}
            disabled={isSaving}
            trackColor={{ false: "#dfe7ff", true: "#5b6bff" }}
            thumbColor="#fff"
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{tripDescription ?? "Trip"} — Bookings</Text>
        <Text style={styles.subtitle}>
          {bookings.length} passenger
          {bookings.length !== 1 ? "s" : ""}
          {"\n"}
          <Text style={styles.debugText}>trip_id: {tripId ?? "(none)"}</Text>
        </Text>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#5b6bff" />
            <Text style={styles.stateText}>Loading bookings...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>No bookings yet for this trip.</Text>
          </View>
        ) : (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Passengers</Text>
              <Text style={styles.sectionCount}>{bookings.length}</Text>
            </View>
            {bookings.map(renderBookingRow)}
          </View>
        )}

        <Pressable style={styles.backIconButton} onPress={() => router.back()}>
          <Text style={styles.backIconText}>←</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  container: {
    paddingTop: 24,
    paddingBottom: 36,
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1f2a44",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 14,
  },
  debugText: {
    fontSize: 11,
    color: "#9ca3af",
    fontFamily: "monospace",
  },
  stateCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  stateText: {
    marginTop: 10,
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
  errorCard: {
    backgroundColor: "#fff1f2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fecdd3",
    marginBottom: 16,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#1f2937",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#1f2937",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2a44",
  },
  sectionCount: {
    minWidth: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    color: "#4338ca",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  row: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  passengerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2a44",
  },
  paidColumn: {
    alignItems: "center",
    gap: 2,
  },
  paidLabel: {
    fontSize: 11,
    color: "#6b7280",
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
