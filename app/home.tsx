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
import { getFullName, getIsOrganiser } from "../lib/profile";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

type DashboardTrip = Record<string, unknown>;

type OrganiserTrip = {
  trip_id: string;
  organiser_id: string;
  description: string;
  departure_date: string;
  departure_time: string;
  total_cost: number | null;
  seat_count: number | null;
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

function parsePickupPoints(value: unknown): PickupPoint[] {
  if (!value) {
    return [];
  }

  let parsedValue = value;

  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return parsedValue
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const description =
        (typeof candidate.description === "string" && candidate.description) ||
        (typeof candidate.pickup_description === "string" &&
          candidate.pickup_description) ||
        "";
      const time =
        (typeof candidate.time === "string" && candidate.time) ||
        (typeof candidate.pickup_time === "string" && candidate.pickup_time) ||
        "";

      if (!description && !time) {
        return null;
      }

      return { description, time };
    })
    .filter((entry): entry is PickupPoint => Boolean(entry));
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

function groupTrips(rows: DashboardTrip[]) {
  const groupedTrips = new Map<string, OrganiserTrip>();

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
        total_cost: readNumber(row, ["total_cost"]),
        seat_count: readNumber(row, ["seat_count"]),
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

  return Array.from(groupedTrips.values()).sort((left, right) => {
    const leftTime = getDepartureDateTime(left)?.getTime() || 0;
    const rightTime = getDepartureDateTime(right)?.getTime() || 0;
    return rightTime - leftTime;
  });
}

function buildStatItems(trip: OrganiserTrip) {
  return [
    {
      label: "Total Cost",
      value: formatCurrency(trip.total_cost),
    },
    {
      label: "Seat Count",
      value: trip.seat_count,
    },
    {
      label: "Seat Price",
      value: formatCurrency(trip.seat_price),
    },
  ].filter(
    (item) =>
      item.value !== null && item.value !== undefined && item.value !== "",
  );
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fullName, setFullName] = useState("Organiser");
  const [isOrganiser, setIsOrganiser] = useState(false);
  const [trips, setTrips] = useState<OrganiserTrip[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!supabase || !hasSupabaseConfig) {
        setErrorMessage("Supabase is not configured.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage("Please sign in again to view your dashboard.");
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setErrorMessage("We could not load your organiser profile.");
        setLoading(false);
        return;
      }

      const organiser = getIsOrganiser(profileData);
      setFullName(getFullName(profileData));
      setIsOrganiser(organiser);

      if (!organiser) {
        setTrips([]);
        setLoading(false);
        return;
      }

      const { data: tripData, error: tripsError } = await supabase
        .from("vw_trips")
        .select("*");

      if (tripsError) {
        setErrorMessage(tripsError.message || "We could not load your trips.");
        setLoading(false);
        return;
      }

      setTrips(groupTrips((tripData || []) as DashboardTrip[]));
      setLoading(false);
    };

    loadDashboard();
  }, []);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    router.replace("/");
  };

  const activeTrips = trips.filter((trip) => !isPastTrip(trip));
  const pastTrips = trips.filter((trip) => isPastTrip(trip));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Welcome, {fullName}!</Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/add-trip")}
        >
          <Text style={styles.primaryButtonText}>+ Add New Trip</Text>
        </Pressable>

        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign out</Text>
        </Pressable>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.stateText}>Loading your trips...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : !isOrganiser ? (
          <View style={styles.stateCard}>
            <Text style={styles.sectionTitle}>Dashboard unavailable</Text>
            <Text style={styles.emptyText}>
              This account is not marked as an organiser yet.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Active Trips</Text>
            {activeTrips.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.emptyText}>
                  No active trips yet. Add a trip to get started.
                </Text>
              </View>
            ) : (
              activeTrips.map((trip, index) => {
                const seatPrice = formatCurrency(trip.seat_price);
                const pickupPoints = trip.pickup_points;
                const statusLabel = getStatusLabel(trip);
                const statItems = buildStatItems(trip);

                return (
                  <View
                    key={trip.trip_id || String(index)}
                    style={styles.tripCard}
                  >
                    <View style={styles.tripHeader}>
                      <Text style={styles.tripTitle}>
                        {trip.description || "Untitled trip"}
                      </Text>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{statusLabel}</Text>
                      </View>
                    </View>

                    <Text style={styles.tripMeta}>
                      Departure: {formatDeparture(trip)}
                    </Text>
                    {trip.seat_count !== null ? (
                      <Text style={styles.tripMeta}>
                        Seats Available: {trip.seat_count}
                      </Text>
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
                            {pickup.time
                              ? `${normalizeTime(pickup.time)} - `
                              : ""}
                            {pickup.description}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {statItems.length > 0 ? (
                      <View style={styles.statsRow}>
                        {statItems.map((item) => (
                          <View key={item.label} style={styles.statChip}>
                            <Text style={styles.statLabel}>{item.label}:</Text>
                            <Text style={styles.statValue}>
                              {String(item.value)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}

            <Text style={styles.sectionTitle}>Past Trips</Text>
            {pastTrips.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.emptyText}>No past trips to show yet.</Text>
              </View>
            ) : (
              pastTrips.map((trip, index) => {
                const seatPrice = formatCurrency(trip.seat_price);
                const pickupPoints = trip.pickup_points;
                const statItems = buildStatItems(trip);

                return (
                  <View
                    key={trip.trip_id || `past-${index}`}
                    style={styles.tripCard}
                  >
                    <View style={styles.tripHeader}>
                      <Text style={styles.tripTitle}>
                        {trip.description || "Untitled trip"}
                      </Text>
                      <View style={[styles.statusBadge, styles.completedBadge]}>
                        <Text style={styles.statusText}>
                          {getStatusLabel(trip)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.tripMeta}>
                      Departure: {formatDeparture(trip)}
                    </Text>
                    {trip.seat_count !== null ? (
                      <Text style={styles.tripMeta}>
                        Seats Available: {trip.seat_count}
                      </Text>
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
                            {pickup.time
                              ? `${normalizeTime(pickup.time)} - `
                              : ""}
                            {pickup.description}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {statItems.length > 0 ? (
                      <View style={styles.statsRow}>
                        {statItems.map((item) => (
                          <View key={item.label} style={styles.statChip}>
                            <Text style={styles.statLabel}>{item.label}:</Text>
                            <Text style={styles.statValue}>
                              {String(item.value)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </>
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
    fontSize: 34,
    fontWeight: "800",
    color: "#1f2a44",
    marginBottom: 18,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#2563eb",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  signOutButton: {
    alignSelf: "flex-start",
    marginTop: 12,
    marginBottom: 28,
  },
  signOutButtonText: {
    color: "#4b5563",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2a44",
    marginBottom: 14,
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
  },
  pickupItem: {
    fontSize: 15,
    color: "#334155",
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: "#2f9e44",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  completedBadge: {
    backgroundColor: "#64748b",
  },
  statusText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    textTransform: "capitalize",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  statChip: {
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  statValue: {
    color: "#1f2a44",
    fontSize: 13,
    fontWeight: "800",
  },
});
