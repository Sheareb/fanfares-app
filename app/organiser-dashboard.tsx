import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DashboardSettingsMenu from "../components/dashboard-settings-menu";
import { getIsOrganiser } from "../lib/profile";
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
  total_seatvalue: number | null;
  seats_booked: number | null;
  total_paid: number | null;
  total_unpaid: number | null;
  unpaid: number | null;
  pickup_points: PickupPoint[];
};

type PickupPoint = {
  description: string;
  time: string;
  seatsBooked: number | null;
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

function formatDepartureDateBadge(trip: DashboardTrip) {
  const departureDate = readString(trip, ["departure_date", "trip_date"]);

  if (!departureDate) {
    return "Unknown";
  }

  const parsed = new Date(`${departureDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return departureDate;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
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

  const departureDay = new Date(departureAt);
  departureDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return departureDay.getTime() < today.getTime();
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

function getCapacityProgressColor(trip: OrganiserTrip) {
  if (
    trip.total_paid === null ||
    trip.total_cost === null ||
    trip.total_cost <= 0
  ) {
    return "#f59e0b";
  }

  if (trip.total_paid > trip.total_cost) {
    return "#16a34a";
  }

  if (trip.total_paid < trip.total_cost * 0.5) {
    return "#dc2626";
  }

  return "#f59e0b";
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
        total_seatvalue: readNumber(row, ["total_seatvalue"]),
        seats_booked: readNumber(row, ["seats_booked"]),
        total_paid: readNumber(row, ["total_paid"]),
        total_unpaid: readNumber(row, ["total_unpaid"]),
        unpaid: readNumber(row, ["unpaid", "total_unpaid", "Unpaid"]),
        pickup_points: [],
      });
    }

    const pickupDescription = readString(row, ["pickup_description"]);
    const pickupTime = readString(row, ["pickup_time"]);

    if (pickupDescription || pickupTime) {
      groupedTrips.get(tripId)?.pickup_points.push({
        description: pickupDescription,
        time: pickupTime,
        seatsBooked: readNumber(row, ["pickup_seats_booked"]),
      });
    }
  }

  return Array.from(groupedTrips.values());
}

function buildStatItems(trip: OrganiserTrip) {
  const unpaidValue = trip.unpaid !== null ? trip.unpaid : null;

  return [
    {
      label: "Cost",
      value: formatCurrency(trip.total_cost),
    },
    {
      label: "Rcvd",
      value: formatCurrency(trip.total_paid),
    },
    {
      label: "Due",
      value: formatCurrency(unpaidValue),
    },
  ].filter(
    (item) =>
      item.value !== null && item.value !== undefined && item.value !== "",
  );
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOrganiser, setIsOrganiser] = useState(false);
  const [trips, setTrips] = useState<OrganiserTrip[]>([]);
  const [tripView, setTripView] = useState<"active" | "past">("active");
  const [deletingTripMap, setDeletingTripMap] = useState<
    Record<string, boolean>
  >({});
  const [pendingDeleteTrip, setPendingDeleteTrip] =
    useState<OrganiserTrip | null>(null);

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
    setIsOrganiser(organiser);

    if (!organiser) {
      setTrips([]);
      setLoading(false);
      return;
    }

    const { data: tripData, error: tripsError } = await supabase
      .from("vw_org_trips")
      .select("*");

    if (tripsError) {
      setErrorMessage(tripsError.message || "We could not load your trips.");
      setLoading(false);
      return;
    }

    setTrips(groupTrips((tripData || []) as DashboardTrip[]));
    setLoading(false);
  };

  useEffect(() => {
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
  const visibleTrips = tripView === "active" ? activeTrips : pastTrips;
  const visibleTripLabel =
    tripView === "active" ? "Active Trips" : "Past Trips";

  const confirmDeleteTrip = async () => {
    if (!supabase || !pendingDeleteTrip) {
      return;
    }

    const tripId = String(pendingDeleteTrip.trip_id || "");

    setPendingDeleteTrip(null);
    setErrorMessage(null);
    setDeletingTripMap((prev) => ({
      ...prev,
      [tripId]: true,
    }));

    const { count, error: bookingCheckError } = await supabase
      .from("trip_bookings")
      .select("booking_id", { count: "exact", head: true })
      .eq("trip_id", tripId);

    if (bookingCheckError) {
      setErrorMessage(
        bookingCheckError.message ||
          "Could not verify whether this trip has bookings.",
      );
      setDeletingTripMap((prev) => ({
        ...prev,
        [tripId]: false,
      }));
      return;
    }

    if ((count ?? 0) > 0) {
      setErrorMessage("This trip cannot be deleted because it has bookings.");
      setDeletingTripMap((prev) => ({
        ...prev,
        [tripId]: false,
      }));
      return;
    }

    const { error: tripDeleteError } = await supabase
      .from("trips")
      .delete()
      .eq("trip_id", tripId);

    if (tripDeleteError) {
      setErrorMessage(tripDeleteError.message || "Could not delete this trip.");
      setDeletingTripMap((prev) => ({
        ...prev,
        [tripId]: false,
      }));
      return;
    }

    setDeletingTripMap((prev) => ({
      ...prev,
      [tripId]: false,
    }));

    await loadDashboard();
  };

  const handleDeleteTrip = (trip: OrganiserTrip) => {
    if (!supabase) {
      setErrorMessage("Supabase is not configured.");
      return;
    }

    const tripId = String(trip.trip_id || "");
    const seatsBooked = trip.seats_booked ?? 0;

    if (!tripId) {
      setErrorMessage("Trip is missing an id and cannot be deleted.");
      return;
    }

    if (seatsBooked > 0) {
      setErrorMessage("This trip cannot be deleted because it has bookings.");
      return;
    }

    setPendingDeleteTrip(trip);
  };

  const renderTripCard = (trip: OrganiserTrip, index: number) => {
    const seatPrice = formatCurrency(trip.seat_price);
    const pickupPoints = trip.pickup_points;
    const departureDateBadge = formatDepartureDateBadge(trip);
    const statItems = buildStatItems(trip);
    const availableSeats =
      trip.seat_count !== null && trip.seats_booked !== null
        ? Math.max(0, trip.seat_count - trip.seats_booked)
        : trip.seat_count;
    const seatsSold = trip.seats_booked ?? null;
    const progressColor = getCapacityProgressColor(trip);
    const progressPercent =
      trip.seat_count !== null && trip.seat_count > 0 && seatsSold !== null
        ? Math.max(0, Math.min(100, (seatsSold / trip.seat_count) * 100))
        : 0;
    const tripId = String(trip.trip_id || "");
    const tripDescription = String(trip.description || "Trip");
    const hasBookings = (trip.seats_booked ?? 0) > 0;
    const isDeleting = deletingTripMap[tripId] ?? false;
    const swipeResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => !hasBookings,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          !hasBookings && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!hasBookings && gestureState.dx < -90) {
          handleDeleteTrip(trip);
        }
      },
    });

    return (
      <View
        key={trip.trip_id || String(index)}
        style={styles.tripCardContainer}
        {...swipeResponder.panHandlers}
      >
        <Pressable
          style={styles.tripCardPressable}
          onPress={() =>
            router.push({
              pathname: "/trip-actions",
              params: {
                tripId,
                tripDescription,
              },
            })
          }
        >
          <View
            style={[
              styles.tripCard,
              !hasBookings && styles.tripCardWithDelete,
              isDeleting && styles.tripCardMuted,
            ]}
          >
            <View style={styles.tripHeader}>
              <Text style={styles.tripTitle}>
                {trip.description || "Untitled trip"}
              </Text>
              <View style={styles.departureDateBadge}>
                <Text style={styles.departureDateBadgeText}>
                  {departureDateBadge}
                </Text>
              </View>
            </View>

            {availableSeats !== null ? (
              <Text style={styles.tripMeta}>
                Seats Available: {availableSeats}
              </Text>
            ) : null}
            {trip.seat_count !== null && seatsSold !== null ? (
              <View style={styles.progressSection}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: progressColor,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {seatsSold} of {trip.seat_count} seats sold
                </Text>
              </View>
            ) : null}
            {seatPrice ? (
              <Text style={styles.tripPrice}>{seatPrice} per seat</Text>
            ) : null}

            {!hasBookings ? (
              <Text style={styles.swipeHint}>Swipe left to delete</Text>
            ) : null}

            {pickupPoints.length > 0 ? (
              <View style={styles.pickupList}>
                {pickupPoints.map((pickup, pickupIndex) => (
                  <Text
                    key={`${trip.trip_id}-${pickupIndex}`}
                    style={styles.pickupItem}
                  >
                    • {pickup.time ? `${normalizeTime(pickup.time)} - ` : ""}
                    {pickup.description}
                    {pickup.seatsBooked !== null
                      ? ` (${pickup.seatsBooked} passengers)`
                      : ""}
                  </Text>
                ))}
              </View>
            ) : null}

            {statItems.length > 0 ? (
              <View style={styles.statsRow}>
                {statItems.map((item) => (
                  <View key={item.label} style={styles.statChip}>
                    <Text style={styles.statLabel}>{item.label}:</Text>
                    <Text style={styles.statValue}>{String(item.value)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Pressable>

        {!hasBookings ? (
          <Pressable
            style={[
              styles.deleteTripButton,
              isDeleting && styles.tripCardMuted,
            ]}
            onPress={(event) => {
              event.stopPropagation();
              handleDeleteTrip(trip);
            }}
            onPressIn={(event) => {
              event.stopPropagation();
            }}
            disabled={isDeleting}
            hitSlop={10}
          >
            <Text style={styles.deleteTripIcon}>🗑</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeftSpacer} />

          <View style={styles.headerCenter}>
            <View style={styles.toggleGroup}>
              <Pressable
                style={[
                  styles.toggleButton,
                  tripView === "active" && styles.toggleButtonActive,
                ]}
                onPress={() => setTripView("active")}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    tripView === "active" && styles.toggleButtonTextActive,
                  ]}
                >
                  Active
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.toggleButton,
                  tripView === "past" && styles.toggleButtonActive,
                ]}
                onPress={() => setTripView("past")}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    tripView === "past" && styles.toggleButtonTextActive,
                  ]}
                >
                  Past
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.headerMenuSlot}>
            <DashboardSettingsMenu
              onChangePassword={() => router.push("/change-password")}
              onEditProfile={() => router.push("/edit-profile")}
              onSignOut={handleSignOut}
            />
          </View>
        </View>

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
            <Text style={styles.sectionTitle}>{visibleTripLabel}</Text>
            {visibleTrips.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.emptyText}>
                  {tripView === "active"
                    ? "No active trips yet. Add a trip to get started."
                    : "No past trips to show yet."}
                </Text>
              </View>
            ) : (
              visibleTrips.map((trip, index) => {
                return renderTripCard(trip, index);
              })
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(pendingDeleteTrip)}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDeleteTrip(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete trip?</Text>
            <Text style={styles.modalMessage}>
              This will permanently delete the trip.
            </Text>

            <View style={styles.modalActionsRow}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setPendingDeleteTrip(null)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={() => {
                  void confirmDeleteTrip();
                }}
              >
                <Text style={styles.modalButtonDangerText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  headerLeftSpacer: {
    width: 44,
  },
  headerMenuSlot: {
    width: 44,
    alignItems: "flex-end",
  },
  toggleGroup: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#e8edf8",
    borderRadius: 999,
    padding: 4,
  },
  toggleButton: {
    minWidth: 96,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  toggleButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  toggleButtonText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 14,
  },
  toggleButtonTextActive: {
    color: "#fff",
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
  tripCardWithDelete: {
    paddingRight: 64,
  },
  tripCardPressable: {
    cursor: "pointer",
  },
  tripCardContainer: {
    position: "relative",
  },
  tripCardMuted: {
    opacity: 0.65,
  },
  deleteTripButton: {
    position: "absolute",
    right: 14,
    top: 14,
    zIndex: 20,
    elevation: 20,
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  deleteTripIcon: {
    fontSize: 16,
  },
  departureDateBadge: {
    marginLeft: 10,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#16a34a",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  departureDateBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  modalTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  modalMessage: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalButton: {
    minWidth: 92,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonSecondary: {
    backgroundColor: "#f1f5f9",
  },
  modalButtonSecondaryText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },
  modalButtonDanger: {
    backgroundColor: "#dc2626",
  },
  modalButtonDangerText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
    height: 16,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
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
  swipeHint: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 8,
    fontStyle: "italic",
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
