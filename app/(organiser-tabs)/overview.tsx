import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import DashboardSettingsMenu from "../../components/dashboard-settings-menu";
import { hasSupabaseConfig, supabase } from "../../lib/supabase";

type OrganiserTrip = {
  trip_id: string | number | null;
  description: string | null;
  departure_date: string | null;
  departure_time: string | null;
  seat_count: number | null;
  seats_booked: number | null;
  seat_price: number | null;
  pickup_points: Array<{
    time: string | null;
    description: string | null;
    seatsBooked: number | null;
  }>;
};

function normalizeTime(value: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return trimmed;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDepartureDateBadge(trip: OrganiserTrip) {
  const date = trip.departure_date;
  const time = trip.departure_time;
  if (!date) return "TBA";
  const dateValue = new Date(`${date}T${time || "00:00:00"}`);
  if (Number.isNaN(dateValue.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(dateValue);
}

function getCapacityProgressColor(trip: OrganiserTrip) {
  const availableSeats =
    trip.seat_count !== null && trip.seats_booked !== null
      ? Math.max(0, trip.seat_count - trip.seats_booked)
      : null;
  if (availableSeats === null) return "#2563eb";
  if (availableSeats <= 0) return "#dc2626";
  if (availableSeats <= 3) return "#f59e0b";
  return "#16a34a";
}

function buildStatItems(trip: OrganiserTrip) {
  const items: Array<{ label: string; value: string | number }> = [];
  if (trip.seat_count !== null) {
    items.push({ label: "Seats", value: trip.seat_count });
  }
  if (trip.seats_booked !== null) {
    items.push({ label: "Booked", value: trip.seats_booked });
  }
  return items;
}

export default function OrganiserOverviewScreen() {
  const [tripView, setTripView] = useState<"active" | "past">("active");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trips, setTrips] = useState<OrganiserTrip[]>([]);
  const [deletingTripMap, setDeletingTripMap] = useState<
    Record<string, boolean>
  >({});
  const [pendingDeleteTrip, setPendingDeleteTrip] =
    useState<OrganiserTrip | null>(null);
  const [isOrganiser, setIsOrganiser] = useState(true);

  useEffect(() => {
    const loadTrips = async () => {
      if (!supabase || !hasSupabaseConfig) {
        setErrorMessage("Supabase is not configured.");
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("is_organiser")
        .maybeSingle();

      if (profileError) {
        setErrorMessage(profileError.message);
        setLoading(false);
        return;
      }

      setIsOrganiser(Boolean(profileData?.is_organiser));

      const { data, error } = await supabase
        .from("vw_organiser_trips")
        .select(
          "trip_id, description, departure_date, departure_time, seat_count, seats_booked, seat_price, pickup_points",
        )
        .order("departure_date", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      setTrips(((data ?? []) as OrganiserTrip[]) || []);
      setLoading(false);
    };

    void loadTrips();
  }, []);

  const confirmDeleteTrip = async () => {
    if (!supabase || !pendingDeleteTrip) return;
    const tripId = String(pendingDeleteTrip.trip_id || "");
    const { error } = await supabase
      .from("trips")
      .delete()
      .eq("trip_id", tripId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setTrips((prev) =>
        prev.filter((trip) => String(trip.trip_id) !== tripId),
      );
    }
    setDeletingTripMap((prev) => ({ ...prev, [tripId]: false }));
    setPendingDeleteTrip(null);
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.replace("/");
  };

  const visibleTrips = useMemo(() => {
    return trips.filter((trip) => {
      const departureDate = trip.departure_date;
      if (!departureDate) return tripView === "active";
      const departureAt = new Date(
        `${departureDate}T${trip.departure_time || "00:00:00"}`,
      );
      return tripView === "active"
        ? departureAt.getTime() >= Date.now()
        : departureAt.getTime() < Date.now();
    });
  }, [trips, tripView]);

  const visibleTripLabel =
    tripView === "active" ? "Upcoming trips" : "Past trips";
  const primaryTrip = visibleTrips[0];
  const primaryTripId = primaryTrip ? String(primaryTrip.trip_id || "") : "";
  const primaryTripDescription = primaryTrip
    ? String(primaryTrip.description || "Trip")
    : "Trip";
  const bookedSeats = useMemo(
    () => trips.reduce((sum, trip) => sum + (trip.seats_booked ?? 0), 0),
    [trips],
  );
  const totalCapacity = useMemo(
    () => trips.reduce((sum, trip) => sum + (trip.seat_count ?? 0), 0),
    [trips],
  );

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
      onMoveShouldSetPanResponder: (_, gestureState) =>
        !hasBookings && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderRelease: (_, gestureState) => {
        if (!hasBookings && gestureState.dx < -90) {
          setPendingDeleteTrip(trip);
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
              params: { tripId, tripDescription },
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
              <View style={styles.tripTitleWrap}>
                <Text style={styles.tripTitle}>
                  {trip.description || "Untitled trip"}
                </Text>
                <Text style={styles.tripSubtitle}>
                  Departure {departureDateBadge}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  availableSeats !== null && availableSeats <= 0
                    ? styles.statusPillFull
                    : styles.statusPillOpen,
                ]}
              >
                <Text style={styles.statusPillText}>
                  {availableSeats !== null && availableSeats <= 0
                    ? "Full"
                    : "Open"}
                </Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricTile}>
                <Text style={styles.metricValue}>{availableSeats ?? "—"}</Text>
                <Text style={styles.metricLabel}>Seats left</Text>
              </View>
              <View style={styles.metricTile}>
                <Text style={styles.metricValue}>{seatPrice || "—"}</Text>
                <Text style={styles.metricLabel}>Per seat</Text>
              </View>
            </View>

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

            {pickupPoints.length > 0 ? (
              <View style={styles.pickupList}>
                {pickupPoints.map((pickup, pickupIndex) => (
                  <Text
                    key={`${trip.trip_id}-${pickupIndex}`}
                    style={styles.pickupItem}
                  >
                    • {pickup.time ? `${normalizeTime(pickup.time)} • ` : ""}
                    {pickup.description}
                    {pickup.seatsBooked !== null
                      ? ` (${pickup.seatsBooked})`
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
              setPendingDeleteTrip(trip);
            }}
            onPressIn={(event) => event.stopPropagation()}
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
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
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

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Operations hub</Text>
          <Text style={styles.heroTitle}>Keep every trip moving</Text>
          <Text style={styles.heroSubtitle}>
            Review capacity, follow bookings, and manage departures from one
            place.
          </Text>
          <View style={styles.heroMetricsRow}>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{trips.length}</Text>
              <Text style={styles.heroMetricLabel}>Trips</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{bookedSeats}</Text>
              <Text style={styles.heroMetricLabel}>Booked</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{totalCapacity}</Text>
              <Text style={styles.heroMetricLabel}>Capacity</Text>
            </View>
          </View>
          <Pressable
            style={styles.tempButton}
            onPress={() => {
              if (primaryTrip) {
                router.push({
                  pathname: "/trip-actions",
                  params: {
                    tripId: primaryTripId,
                    tripDescription: primaryTripDescription,
                  },
                });
              } else {
                router.push("/add-trip");
              }
            }}
          >
            <Text style={styles.tempButtonText}>
              {primaryTrip ? "Open latest trip" : "Create a trip"}
            </Text>
          </Pressable>
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
                <Text style={styles.sectionTitle}>
                  {tripView === "active"
                    ? "No active trips yet"
                    : "No past trips to show yet"}
                </Text>
                <Text style={styles.emptyText}>
                  {tripView === "active"
                    ? "Start by creating your first trip and sharing it with travellers."
                    : "Past trips will appear here once they have departed."}
                </Text>
                {tripView === "active" ? (
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => router.push("/add-trip")}
                  >
                    <Text style={styles.primaryButtonText}>Create a trip</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              visibleTrips.map((trip, index) => renderTripCard(trip, index))
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
  safeArea: { flex: 1, backgroundColor: "#07111f" },
  container: { paddingTop: 24, paddingBottom: 36, padding: 24 },
  headerRow: {
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
  headerLeftSpacer: { width: 44 },
  headerMenuSlot: { width: 44, alignItems: "flex-end" },
  toggleGroup: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.14)",
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
  toggleButtonActive: { backgroundColor: "#fff", borderColor: "#fff" },
  toggleButtonText: { color: "#cbd5e1", fontWeight: "700", fontSize: 14 },
  toggleButtonTextActive: { color: "#0f172a" },
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  heroSubtitle: { fontSize: 14, color: "#475569", lineHeight: 20 },
  heroMetricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
  heroMetricCard: {
    flex: 1,
    minWidth: 90,
    backgroundColor: "#eff6ff",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  heroMetricValue: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  heroMetricLabel: { fontSize: 12, color: "#475569", marginTop: 2 },
  tempButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tempButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 6,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  stateCard: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
    marginBottom: 24,
    gap: 10,
  },
  stateText: { color: "#4b5563", fontSize: 15 },
  emptyText: { color: "#4b5563", fontSize: 15, lineHeight: 22 },
  errorText: { color: "#b91c1c", fontWeight: "600", fontSize: 14 },
  tripCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
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
  tripCardWithDelete: { paddingRight: 64 },
  tripCardPressable: { cursor: "pointer" },
  tripCardContainer: { position: "relative" },
  tripCardMuted: { opacity: 0.65 },
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
  deleteTripIcon: { fontSize: 16 },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  tripTitleWrap: { flex: 1 },
  tripTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  tripSubtitle: { fontSize: 12, color: "#64748b", marginTop: 4 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  statusPillOpen: { backgroundColor: "#dcfce7" },
  statusPillFull: { backgroundColor: "#fee2e2" },
  statusPillText: { color: "#0f172a", fontSize: 12, fontWeight: "700" },
  metricRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  metricTile: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  metricValue: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  metricLabel: { fontSize: 12, color: "#64748b", marginTop: 2 },
  progressSection: { marginTop: 8, marginBottom: 8 },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999 },
  progressLabel: { fontSize: 12, color: "#64748b", marginTop: 6 },
  pickupList: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5eaf3",
  },
  pickupItem: { fontSize: 14, color: "#334155", marginBottom: 4 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
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
  statLabel: { color: "#475569", fontSize: 12, fontWeight: "700" },
  statValue: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
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
  modalButtonSecondary: { backgroundColor: "#f1f5f9" },
  modalButtonSecondaryText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },
  modalButtonDanger: { backgroundColor: "#dc2626" },
  modalButtonDangerText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
});
