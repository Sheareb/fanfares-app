import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

type DashboardTrip = Record<string, unknown>;

type CustomerTrip = {
  trip_id: string;
  organiser_id: string;
  description: string;
  departure_date: string;
  departure_time: string;
  seat_count: number | null;
  remaining_seats: number | null;
  seat_reserved_count: number | null;
  total_paid: number | null;
  seat_price: number | null;
  pickup_points: PickupPoint[];
};

type PickupPoint = {
  description: string;
  time: string;
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

function readNumber(source: DashboardTrip, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
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

function getStatusLabel(trip: DashboardTrip) {
  const status = readString(trip, ["status", "trip_status"]);
  if (status) {
    return status;
  }

  return isPastTrip(trip) ? "Completed" : "Active";
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

function getAvailabilityColor(availabilityPercent: number | null) {
  if (availabilityPercent === null) {
    return "#2563eb";
  }

  if (availabilityPercent > 50) {
    return "#16a34a";
  }

  if (availabilityPercent > 25) {
    return "#f59e0b";
  }

  return "#dc2626";
}

function groupTrips(rows: DashboardTrip[]) {
  const groupedTrips = new Map<string, CustomerTrip>();

  for (const row of rows) {
    const tripId = readString(row, ["trip_id"]);
    if (!tripId) {
      continue;
    }

    const existingTrip = groupedTrips.get(tripId);

    if (!existingTrip) {
      groupedTrips.set(tripId, {
        trip_id: tripId,
        organiser_id: readString(row, ["organiser_id"]),
        description: readString(row, ["description"]),
        departure_date: readString(row, ["departure_date"]),
        departure_time: readString(row, ["departure_time"]),
        seat_count: readNumber(row, ["seat_count"]),
        remaining_seats: readNumber(row, ["remaining_seats"]),
        seat_reserved_count: readNumber(row, ["seat_reserved_count"]),
        total_paid: readNumber(row, ["total_paid"]),
        seat_price: readNumber(row, ["seat_price"]),
        pickup_points: [],
      });
    }

    const pickupDescription = readString(row, ["pickup_description"]);
    const pickupTime = readString(row, ["pickup_time"]);

    if (pickupDescription || pickupTime) {
      groupedTrips.get(tripId)?.pickup_points.push({
        description: pickupDescription,
        time: pickupTime,
      });
    }
  }

  return Array.from(groupedTrips.values());
}

export default function TripSearchResultsScreen() {
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trips, setTrips] = useState<CustomerTrip[]>([]);
  const [bookedSeatsByTrip, setBookedSeatsByTrip] = useState<
    Record<string, number>
  >({});
  const activeTrips = trips.filter((trip) => !isPastTrip(trip));

  const searchTrips = async () => {
    const query = searchText.trim();

    if (!query) {
      setErrorMessage("Enter a description to search for a trip.");
      setHasSearched(false);
      setTrips([]);
      return;
    }

    if (!supabase || !hasSupabaseConfig) {
      setErrorMessage("Supabase is not configured.");
      setHasSearched(false);
      setTrips([]);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const client = supabase;

    const { data: tripRowsData, error: tripRowsError } = await client
      .from("trips")
      .select(
        "trip_id, organiser_id, description, departure_date, departure_time, total_cost, seat_count, seat_reserved_count, remaining_seats, total_paid, seat_price",
      )
      .ilike("description", `%${query}%`);

    setLoading(false);
    setHasSearched(true);

    if (tripRowsError) {
      setErrorMessage(
        tripRowsError.message || "We could not load matching trips.",
      );
      setTrips([]);
      return;
    }

    const tripRows = (tripRowsData || []) as DashboardTrip[];
    const tripIds = tripRows
      .map((trip) => readString(trip, ["trip_id"]))
      .filter((tripId): tripId is string => Boolean(tripId));

    let bookedSeatsByTripMap: Record<string, number> = {};

    if (tripIds.length > 0) {
      const { data: bookingRows, error: bookingError } = await client
        .from("vw_fan_bookings")
        .select("trip_id")
        .in("trip_id", tripIds);

      if (!bookingError && bookingRows) {
        bookedSeatsByTripMap = (bookingRows as DashboardTrip[]).reduce<
          Record<string, number>
        >((acc, row) => {
          const bookingTripId = readString(row, ["trip_id"]);
          if (!bookingTripId) {
            return acc;
          }

          acc[bookingTripId] = (acc[bookingTripId] ?? 0) + 1;
          return acc;
        }, {});
      }
    }

    let pickupPointsByTripId = new Map<string, PickupPoint[]>();

    if (tripIds.length > 0) {
      const { data: pickupRows, error: pickupError } = await client
        .from("trip_pickuppoints")
        .select("trip_id, description, time")
        .in("trip_id", tripIds);

      if (!pickupError && pickupRows) {
        pickupPointsByTripId = new Map<string, PickupPoint[]>();

        for (const row of pickupRows as DashboardTrip[]) {
          const tripId = readString(row, ["trip_id"]);
          if (!tripId) {
            continue;
          }

          const existing = pickupPointsByTripId.get(tripId) ?? [];
          existing.push({
            description: readString(row, ["description"]),
            time: readString(row, ["time"]),
          });
          pickupPointsByTripId.set(tripId, existing);
        }
      }
    }

    const enrichedTrips = tripRows.map((trip) => {
      const tripId = readString(trip, ["trip_id"]);
      const seatCount = readNumber(trip, ["seat_count"]);
      const reservedSeats = readNumber(trip, ["seat_reserved_count"]);
      const storedRemainingSeats = readNumber(trip, ["remaining_seats"]);
      const computedRemainingSeats =
        seatCount !== null && reservedSeats !== null
          ? Math.max(0, seatCount - reservedSeats)
          : null;

      return {
        ...trip,
        seat_count: seatCount,
        seat_reserved_count: reservedSeats,
        remaining_seats: storedRemainingSeats ?? computedRemainingSeats ?? null,
        total_paid: readNumber(trip, ["total_paid"]),
        pickup_points: tripId ? (pickupPointsByTripId.get(tripId) ?? []) : [],
      };
    });

    setTrips(groupTrips(enrichedTrips));
    setBookedSeatsByTrip(bookedSeatsByTripMap);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Trip Search</Text>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="e.g. coast, airport, weekend"
            value={searchText}
            onChangeText={(value) => {
              setSearchText(value);
              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
            onSubmitEditing={searchTrips}
            returnKeyType="search"
          />
          <Pressable
            style={[
              styles.searchButton,
              loading && styles.searchButtonDisabled,
            ]}
            onPress={searchTrips}
            disabled={loading}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        <Pressable style={styles.backIconButton} onPress={() => router.back()}>
          <Text style={styles.backIconText}>←</Text>
        </Pressable>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.stateText}>Looking for trips...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : !hasSearched ? null : activeTrips.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.emptyText}>
              No active trips found for that description.
            </Text>
          </View>
        ) : (
          activeTrips.map((trip, index) => {
            const seatPrice = formatCurrency(trip.seat_price);
            const pickupPoints = trip.pickup_points;
            const availableSeats = trip.remaining_seats ?? trip.seat_count;
            const availabilityPercent =
              trip.seat_count && availableSeats !== null
                ? Math.max(
                    0,
                    Math.min(100, (availableSeats / trip.seat_count) * 100),
                  )
                : null;
            const availabilityColor = getAvailabilityColor(availabilityPercent);

            return (
              <Pressable
                key={trip.trip_id || String(index)}
                style={({ pressed }) => [
                  styles.tripCard,
                  pressed && styles.tripCardPressed,
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/book-trip",
                    params: { tripId: trip.trip_id },
                  })
                }
              >
                <View style={styles.tripHeader}>
                  <Text style={styles.tripTitle}>
                    {trip.description || "Untitled trip"}
                  </Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {getStatusLabel(trip)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.tripMeta}>
                  Departure: {formatDeparture(trip)}
                </Text>
                {availableSeats !== null ? (
                  <Text style={styles.tripMeta}>
                    Seats Available: {availableSeats}
                  </Text>
                ) : null}
                {trip.seat_count !== null && availableSeats !== null ? (
                  <View style={styles.progressSection}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${availabilityPercent ?? 0}%`,
                            backgroundColor: availabilityColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressLabel}>
                      {availableSeats} of {trip.seat_count} seats left
                    </Text>
                  </View>
                ) : null}
                {seatPrice ? (
                  <Text style={styles.tripPrice}>{seatPrice} per seat</Text>
                ) : null}

                {pickupPoints.length > 0 ? (
                  <View style={styles.pickupList}>
                    {pickupPoints.map((pickup, pickupIndex) => (
                      <Text
                        key={`${trip.trip_id}-${pickupIndex}`}
                        style={styles.pickupItem}
                      >
                        •{" "}
                        {pickup.time ? `${normalizeTime(pickup.time)} - ` : ""}
                        {pickup.description}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {(bookedSeatsByTrip[trip.trip_id] ?? 0) > 0 ? (
                  <Text style={styles.tripBookedSeatsText}>
                    you have {bookedSeatsByTrip[trip.trip_id]} seat
                    {bookedSeatsByTrip[trip.trip_id] === 1 ? "" : "s"} booked
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        )}
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
    fontSize: 24,
    fontWeight: "800",
    color: "#1f2a44",
    marginBottom: 14,
  },
  searchRow: {
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7def0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1f2a44",
  },
  searchButton: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  backIconButton: {
    alignSelf: "center",
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    marginBottom: 20,
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
  tripCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e5eaf3",
    shadowColor: "#1f2a44",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  tripCardPressed: {
    opacity: 0.8,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  tripTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2a44",
  },
  tripMeta: {
    fontSize: 15,
    color: "#334155",
    marginBottom: 4,
  },
  progressSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  progressLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 6,
  },
  tripPrice: {
    fontSize: 15,
    color: "#1f2a44",
    fontWeight: "700",
    marginTop: 4,
  },
  pickupList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5eaf3",
    marginBottom: 14,
  },
  pickupItem: {
    fontSize: 15,
    color: "#334155",
    marginBottom: 4,
  },
  tripBookedSeatsText: {
    alignSelf: "flex-end",
    marginTop: 8,
    color: "#1f2a44",
    fontSize: 12,
    fontWeight: "700",
  },
  statusBadge: {
    backgroundColor: "#2f9e44",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    textTransform: "capitalize",
  },
});
