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
  pickup_description: string | null;
  paid: boolean;
  boarded: boolean;
};

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function getNameParts(name: string) {
  const normalized = normalizeName(name);
  const parts = normalized ? normalized.split(" ") : [];

  if (parts.length === 0) {
    return { forename: "", surname: "" };
  }

  if (parts.length === 1) {
    return { forename: parts[0], surname: parts[0] };
  }

  return {
    forename: parts.slice(0, -1).join(" "),
    surname: parts[parts.length - 1],
  };
}

function formatNameSurnameFirst(name: string) {
  const { forename, surname } = getNameParts(name);

  if (!surname) {
    return "Unknown";
  }

  if (!forename || forename === surname) {
    return surname;
  }

  return `${surname}, ${forename}`;
}

export default function RunTripScreen() {
  const { tripId, tripDescription } = useLocalSearchParams<{
    tripId: string;
    tripDescription: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>({});
  const [boardedMap, setBoardedMap] = useState<Record<string, boolean>>({});
  const [statusSavingMap, setStatusSavingMap] = useState<
    Record<string, boolean>
  >({});
  const [boardedSavingMap, setBoardedSavingMap] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (!tripId || !supabase || !hasSupabaseConfig) {
      setErrorMessage("Trip not found.");
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase!
        .from("vw_org_customer_bookings")
        .select("booking_id, customer_name, pickup_description, paid, boarded")
        .eq("trip_id", tripId);

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      const sorted = ((data ?? []) as BookingRow[]).sort((a, b) => {
        const leftName = a.customer_name ?? "";
        const rightName = b.customer_name ?? "";
        const leftParts = getNameParts(leftName);
        const rightParts = getNameParts(rightName);

        const surnameDiff = leftParts.surname.localeCompare(rightParts.surname);
        if (surnameDiff !== 0) {
          return surnameDiff;
        }

        const forenameDiff = leftParts.forename.localeCompare(
          rightParts.forename,
        );
        if (forenameDiff !== 0) {
          return forenameDiff;
        }

        return normalizeName(leftName).localeCompare(normalizeName(rightName));
      });

      setBookings(sorted);
      setPaidMap(
        Object.fromEntries(sorted.map((b) => [b.booking_id, Boolean(b.paid)])),
      );
      setBoardedMap(
        Object.fromEntries(
          sorted.map((b) => [b.booking_id, Boolean(b.boarded)]),
        ),
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
    setStatusSavingMap((prev) => ({
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

    setStatusSavingMap((prev) => ({
      ...prev,
      [bookingId]: false,
    }));
  };

  const updateBoardedStatus = async (
    booking: BookingRow,
    isBoarded: boolean,
  ) => {
    if (!supabase) return;

    const bookingId = booking.booking_id;
    const previous = boardedMap[bookingId] ?? false;

    setErrorMessage(null);
    setBoardedMap((prev) => ({
      ...prev,
      [bookingId]: isBoarded,
    }));
    setBoardedSavingMap((prev) => ({
      ...prev,
      [bookingId]: true,
    }));

    const { error } = await supabase
      .from("trip_bookings")
      .update({ boarded: isBoarded })
      .eq("booking_id", bookingId);

    if (error) {
      setBoardedMap((prev) => ({
        ...prev,
        [bookingId]: previous,
      }));
      setErrorMessage(
        `Failed to save ${booking.customer_name}: ${error.message}`,
      );
    } else {
      setBookings((prev) =>
        prev.map((entry) =>
          entry.booking_id === bookingId
            ? { ...entry, boarded: isBoarded }
            : entry,
        ),
      );
    }

    setBoardedSavingMap((prev) => ({
      ...prev,
      [bookingId]: false,
    }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{tripDescription ?? "Trip"} — Run Trip</Text>
        <Text style={styles.subtitle}>
          {bookings.length} passenger{bookings.length !== 1 ? "s" : ""}
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
          bookings.map((booking) => {
            const isPaid = paidMap[booking.booking_id] ?? false;
            const isBoarded = boardedMap[booking.booking_id] ?? false;
            const isStatusSaving = statusSavingMap[booking.booking_id] ?? false;
            const isBoardedSaving =
              boardedSavingMap[booking.booking_id] ?? false;

            return (
              <Pressable
                key={booking.booking_id}
                style={[styles.row, isBoarded && styles.rowBoarded]}
                onPress={() => updateBoardedStatus(booking, !isBoarded)}
                disabled={isBoardedSaving}
              >
                <View style={styles.passengerMeta}>
                  <Text style={styles.passengerName}>
                    {formatNameSurnameFirst(booking.customer_name || "")}
                    {isBoarded ? (
                      <Text style={styles.passengerName}> (Boarded)</Text>
                    ) : null}
                  </Text>
                  <Text style={styles.pickupPointText}>
                    {booking.pickup_description?.trim() || "No pickup point"}
                  </Text>
                </View>

                <View style={styles.switchesColumn}>
                  <View style={styles.switchGroup}>
                    <Text style={styles.switchLabel}>
                      {isPaid ? "Paid" : "Unpaid"}
                    </Text>
                    <Switch
                      value={isPaid}
                      onValueChange={(val) => updateBookingStatus(booking, val)}
                      disabled={isStatusSaving || isBoardedSaving}
                      trackColor={{ false: "#dfe7ff", true: "#5b6bff" }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              </Pressable>
            );
          })
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
    marginBottom: 24,
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
    color: "#6b7280",
    marginTop: 8,
  },
  errorCard: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "600",
  },
  row: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#5b6bff",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  rowBoarded: {
    borderWidth: 1,
    borderColor: "#15803d",
    backgroundColor: "#dcfce7",
  },
  passengerMeta: {
    flex: 1,
    marginRight: 8,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2a44",
  },
  pickupPointText: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
  },
  switchesColumn: {
    alignItems: "flex-end",
    gap: 6,
  },
  switchGroup: {
    alignItems: "center",
    gap: 2,
  },
  switchLabel: {
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
