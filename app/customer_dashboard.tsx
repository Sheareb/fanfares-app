import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DashboardSettingsMenu from "../components/dashboard-settings-menu";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

type DashboardTrip = Record<string, unknown>;

type BookedSeat = {
  booking_id: string;
  customer_name: string;
  pickup_point: string;
  pickup_time: string;
  isPaid: boolean;
  seat_price: number | null;
};

type BookedTrip = {
  trip_id: string;
  description: string;
  departure_date: string;
  departure_time: string;
  bookings: BookedSeat[];
};

type BookingRow = {
  booking_id: string;
  trip_id: string;
  pickuppoint_id: string | null;
  customer_name: string | null;
  paid: boolean | null;
  seat_price: number | null;
  trip_description: string | null;
  departure_date: string | null;
  departure_time: string | null;
  pickup_description: string | null;
  pickup_time: string | null;
};

function readString(source: DashboardTrip, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function normalizeTime(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    return trimmed;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getDepartureDateTime(trip: DashboardTrip) {
  const departureDate = readString(trip, ["departure_date", "trip_date"]);
  const departureTime = readString(trip, ["departure_time", "time"]);

  if (!departureDate) {
    return null;
  }

  const isoTime = departureTime || "00:00:00";
  const normalizedTime = isoTime.length === 5 ? `${isoTime}:00` : isoTime;
  const date = new Date(`${departureDate}T${normalizedTime}`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDeparture(trip: DashboardTrip) {
  const departureAt = getDepartureDateTime(trip);
  if (!departureAt) {
    return "Departure time unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(departureAt);
}

function isPastTrip(trip: DashboardTrip) {
  const status = readString(trip, ["status", "trip_status"]).toLowerCase();
  if (status === "completed" || status === "past") {
    return true;
  }

  const departureAt = getDepartureDateTime(trip);
  if (!departureAt) {
    return false;
  }

  return departureAt.getTime() < Date.now();
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return null;
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CustomerDashboardScreen() {
  const [bookedTrips, setBookedTrips] = useState<BookedTrip[]>([]);
  const [bookedTripsLoading, setBookedTripsLoading] = useState(false);
  const [bookedTripsError, setBookedTripsError] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    router.replace("/");
  };

  useEffect(() => {
    const loadBookedTrips = async () => {
      if (!supabase || !hasSupabaseConfig) {
        setBookedTrips([]);
        setBookedTripsError("Supabase is not configured.");
        return;
      }

      setBookedTripsLoading(true);
      setBookedTripsError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.id) {
        setBookedTrips([]);
        setBookedTripsError(
          userError?.message || "You need to be signed in to view bookings.",
        );
        setBookedTripsLoading(false);
        return;
      }

      const { data: bookingRows, error: bookingsError } = await supabase
        .from("vw_fan_bookings")
        .select(
          "booking_id, trip_id, pickuppoint_id, user_id, customer_name, paid, seat_price, trip_description, departure_date, departure_time, pickup_description, pickup_time",
        )
        .order("departure_date", { ascending: true })
        .order("departure_time", { ascending: true });

      if (bookingsError) {
        setBookedTrips([]);
        setBookedTripsError(
          bookingsError.message || "We could not load your bookings.",
        );
        setBookedTripsLoading(false);
        return;
      }

      if (!bookingRows?.length) {
        setBookedTrips([]);
        setBookedTripsLoading(false);
        return;
      }

      const groupedByTrip = new Map<string, BookedTrip>();

      for (const row of bookingRows as BookingRow[]) {
        const tripId = row.trip_id;
        if (!tripId) {
          continue;
        }

        const existing = groupedByTrip.get(tripId);
        if (!existing) {
          groupedByTrip.set(tripId, {
            trip_id: tripId,
            description: row.trip_description || "Untitled trip",
            departure_date: row.departure_date || "",
            departure_time: row.departure_time || "",
            bookings: [],
          });
        }

        const isPaid = Boolean(row.paid);

        groupedByTrip.get(tripId)?.bookings.push({
          booking_id: row.booking_id,
          customer_name: row.customer_name || "Customer",
          pickup_point: row.pickup_description || "Pickup point unavailable",
          pickup_time: row.pickup_time
            ? normalizeTime(row.pickup_time)
            : "Time unavailable",
          isPaid,
          seat_price: row.seat_price,
        });
      }

      const upcomingBookings = Array.from(groupedByTrip.values()).filter(
        (trip) => {
          const tripForDateCheck = {
            departure_date: trip.departure_date,
            departure_time: trip.departure_time,
          } as DashboardTrip;

          return !isPastTrip(tripForDateCheck);
        },
      );

      setBookedTrips(upcomingBookings);
      setBookedTripsLoading(false);
    };

    loadBookedTrips();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Pressable
            style={[styles.addIconButton, styles.leftTopControl]}
            onPress={() => router.push("/trip-search")}
          >
            <Text style={styles.addIconText}>＋</Text>
          </Pressable>

          <View style={styles.rightTopControl}>
            <DashboardSettingsMenu
              onChangePassword={() => router.push("/change-password")}
              onEditProfile={() => router.push("/edit-profile")}
              onSignOut={handleSignOut}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Your upcoming bookings</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{bookedTrips.length}</Text>
            </View>
          </View>

          {bookedTripsLoading ? (
            <View style={styles.sectionStateRow}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.sectionStateText}>
                Loading your bookings...
              </Text>
            </View>
          ) : bookedTripsError ? (
            <Text style={styles.errorText}>{bookedTripsError}</Text>
          ) : bookedTrips.length === 0 ? (
            <Text style={styles.emptyText}>
              You do not have any upcoming bookings.
            </Text>
          ) : (
            bookedTrips.map((trip) => {
              const unpaidTotal = trip.bookings
                .filter((seat) => !seat.isPaid)
                .reduce((sum, seat) => sum + (seat.seat_price ?? 0), 0);

              return (
                <View key={trip.trip_id} style={styles.bookedTripCard}>
                  <Text style={styles.bookedTripTitle}>
                    {trip.description || "Untitled trip"}
                  </Text>
                  <Text style={styles.bookedTripMeta}>
                    Departure: {formatDeparture(trip as DashboardTrip)}
                  </Text>

                  {trip.bookings.map((seat) => (
                    <View key={seat.booking_id} style={styles.bookingRow}>
                      <View style={styles.bookingMain}>
                        <Text style={styles.bookingPassenger}>
                          {seat.customer_name}
                        </Text>
                        <Text style={styles.bookingPickup}>
                          {seat.pickup_point} • {seat.pickup_time}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.paymentBadge,
                          seat.isPaid ? styles.paidBadge : styles.unpaidBadge,
                        ]}
                      >
                        <Text style={styles.paymentBadgeText}>
                          {seat.isPaid ? "Paid" : "Not paid"}
                        </Text>
                      </View>
                    </View>
                  ))}

                  <View style={styles.unpaidSummaryRow}>
                    <Text style={styles.unpaidSummaryLabel}>
                      Total amount to be paid
                    </Text>
                    <Text style={styles.unpaidSummaryValue}>
                      {formatCurrency(unpaidTotal)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
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
  headerRow: {
    position: "relative",
    zIndex: 1500,
    elevation: 50,
    overflow: "visible",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 18,
    minHeight: 44,
  },
  leftTopControl: {
    position: "absolute",
    left: 0,
  },
  rightTopControl: {
    position: "absolute",
    right: 0,
    zIndex: 1600,
    elevation: 60,
  },
  addIconButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    shadowColor: "#2563eb",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  addIconText: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 24,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#1f2a44",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    marginBottom: 20,
  },
  sectionHeaderRow: {
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
  sectionBadge: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionBadgeText: {
    color: "#2563eb",
    fontWeight: "700",
    fontSize: 13,
  },
  sectionStateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionStateText: {
    color: "#475569",
    fontSize: 14,
  },
  bookedTripCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  bookedTripTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2a44",
    marginBottom: 4,
  },
  bookedTripMeta: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 10,
  },
  bookingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  bookingMain: {
    flex: 1,
  },
  bookingPassenger: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2a44",
  },
  bookingPickup: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  paymentBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  paidBadge: {
    backgroundColor: "#dcfce7",
  },
  unpaidBadge: {
    backgroundColor: "#fee2e2",
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  unpaidSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  unpaidSummaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1f2a44",
  },
  unpaidSummaryValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#dc2626",
  },
  stateCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#1f2a44",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    marginBottom: 24,
    gap: 10,
  },
  stateText: {
    color: "#4b5563",
    fontSize: 15,
  },
  emptyText: {
    color: "#4b5563",
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "600",
    fontSize: 14,
  },
});
