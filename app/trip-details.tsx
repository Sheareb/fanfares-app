import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

type TripSummary = {
  trip_id: string | number | null;
  description: string | null;
  departure_date: string | null;
  departure_time: string | null;
  seat_count: number | null;
  seat_price: number | null;
  total_cost: number | null;
};

type Passenger = {
  id: string;
  name: string;
  pickup: string;
  paid: boolean;
  boarded: boolean;
};

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(dateValue: string | null, timeValue: string | null) {
  if (!dateValue) {
    return "Date pending";
  }

  const normalizedTime = timeValue || "00:00:00";
  const parsed = new Date(`${dateValue}T${normalizedTime}`);

  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function TripDetailsScreen() {
  const params = useLocalSearchParams<{
    tripId?: string;
    tripDescription?: string;
  }>();

  const tripTitle = String(params.tripDescription || "Trip");
  const tripId = String(params.tripId || "");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);

  useEffect(() => {
    if (!tripId) {
      setErrorMessage("Trip details were not provided.");
      setLoading(false);
      return;
    }

    const loadDetails = async () => {
      if (!supabase || !hasSupabaseConfig) {
        setErrorMessage("Supabase is not configured.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      const [tripResult, bookingsResult] = await Promise.all([
        supabase
          .from("trips")
          .select(
            "trip_id, description, departure_date, departure_time, seat_count, seat_price, total_cost",
          )
          .eq("trip_id", tripId)
          .maybeSingle<TripSummary>(),
        supabase
          .from("vw_org_customer_bookings")
          .select(
            "booking_id, customer_name, pickup_description, paid, boarded",
          )
          .eq("trip_id", tripId),
      ]);

      if (tripResult.error) {
        setErrorMessage(
          tripResult.error.message || "We could not load this trip.",
        );
        setLoading(false);
        return;
      }

      if (bookingsResult.error) {
        setErrorMessage(
          bookingsResult.error.message ||
            "We could not load the passenger list.",
        );
        setLoading(false);
        return;
      }

      setTrip((tripResult.data as TripSummary | null) ?? null);
      setPassengers(
        (
          (bookingsResult.data ?? []) as Array<{
            booking_id: string;
            customer_name: string;
            pickup_description: string | null;
            paid: boolean;
            boarded: boolean;
          }>
        ).map((booking) => ({
          id: booking.booking_id,
          name: booking.customer_name || "Unnamed passenger",
          pickup: booking.pickup_description?.trim() || "Pickup pending",
          paid: Boolean(booking.paid),
          boarded: Boolean(booking.boarded),
        })),
      );
      setLoading(false);
    };

    void loadDetails();
  }, [tripId]);

  const focusPoints = useMemo(() => {
    const bookedCount = passengers.length;
    const availableSeats =
      trip?.seat_count !== null && trip?.seat_count !== undefined
        ? Math.max(0, trip.seat_count - bookedCount)
        : null;
    const pendingPayments = passengers.filter(
      (passenger) => !passenger.paid,
    ).length;
    const boardedCount = passengers.filter(
      (passenger) => passenger.boarded,
    ).length;

    return [
      {
        label: "Pickup status",
        value: boardedCount > 0 ? `${boardedCount} checked in` : "Waiting",
      },
      {
        label: "Payments",
        value:
          pendingPayments > 0 ? `${pendingPayments} pending` : "All settled",
      },
      {
        label: "Capacity",
        value:
          trip?.seat_count !== null && trip?.seat_count !== undefined
            ? `${availableSeats ?? "—"} / ${trip.seat_count}`
            : "Live count",
      },
    ];
  }, [passengers, trip]);

  const tripSubtitle = useMemo(() => {
    if (!trip) {
      return "Loading trip details...";
    }

    return formatDateTime(trip.departure_date, trip.departure_time);
  }, [trip]);

  const paidCount = passengers.filter((passenger) => passenger.paid).length;
  const pendingPaymentCount = passengers.length - paidCount;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Trip details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Live overview</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>Live</Text>
              </View>
            </View>

            <Text style={styles.tripName}>{tripTitle}</Text>
            <Text style={styles.tripMeta}>{tripSubtitle}</Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Capacity</Text>
                <Text style={styles.summaryValue}>
                  {trip?.seat_count !== null && trip?.seat_count !== undefined
                    ? `${Math.max(0, trip.seat_count - passengers.length)} / ${trip.seat_count}`
                    : "—"}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Price</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(trip?.seat_price ?? null)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Payments</Text>
                <Text style={styles.summaryValue}>
                  {pendingPaymentCount} pending
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonPrimary,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/trip-bookings",
                  params: { tripId, tripDescription: tripTitle },
                })
              }
            >
              <Text style={styles.actionIcon}>💷</Text>
              <Text style={styles.actionButtonText}>Payments</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/run-trip",
                  params: { tripId, tripDescription: tripTitle },
                })
              }
            >
              <Text style={styles.actionIcon}>🚌</Text>
              <Text style={styles.actionButtonText}>Boarding</Text>
            </Pressable>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>At a glance</Text>
            <View style={styles.infoGrid}>
              {focusPoints.map((item) => (
                <View key={item.label} style={styles.infoTile}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Passenger list</Text>
              <View style={styles.sectionBadgeWrap}>
                <Text style={styles.sectionBadge}>
                  {passengers.length} travellers
                </Text>
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.loadingText}>Loading passengers...</Text>
              </View>
            ) : errorMessage ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : passengers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No passengers have been booked yet.
                </Text>
              </View>
            ) : (
              passengers.map((passenger) => (
                <View key={passenger.id} style={styles.passengerCard}>
                  <View style={styles.passengerAvatarWrap}>
                    <Text style={styles.passengerAvatarText}>
                      {getInitials(passenger.name)}
                    </Text>
                  </View>

                  <View style={styles.passengerInfo}>
                    <Text style={styles.passengerName}>{passenger.name}</Text>
                    <Text style={styles.passengerMeta}>{passenger.pickup}</Text>
                  </View>

                  <View style={styles.statusStack}>
                    <View
                      style={[
                        styles.paymentBadge,
                        passenger.paid ? styles.paidBadge : styles.pendingBadge,
                      ]}
                    >
                      <Text style={styles.paymentBadgeText}>
                        {passenger.paid ? "Paid" : "Pending"}
                      </Text>
                    </View>
                    {passenger.boarded ? (
                      <View style={styles.boardedBadge}>
                        <Text style={styles.boardedBadgeText}>Boarded</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backButtonPressed: {
    opacity: 0.8,
  },
  backButtonText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "700",
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 56,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  heroCard: {
    backgroundColor: "#2563eb",
    borderRadius: 28,
    padding: 20,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statusPill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  tripName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  tripMeta: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  summaryItem: {
    flex: 1,
    minWidth: 90,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    padding: 12,
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  actionButtonPrimary: {
    backgroundColor: "#dbeafe",
  },
  actionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  actionIcon: {
    fontSize: 16,
  },
  actionButtonText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoTile: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "#eff6ff",
    borderRadius: 16,
    padding: 12,
  },
  infoLabel: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  infoValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionBadgeWrap: {
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionBadge: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "700",
  },
  loadingCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  errorCard: {
    backgroundColor: "#fef2f2",
    borderRadius: 16,
    padding: 16,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },
  passengerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  passengerAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
  },
  passengerAvatarText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "800",
  },
  passengerInfo: {
    flex: 1,
    gap: 4,
  },
  passengerName: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  passengerMeta: {
    color: "#64748b",
    fontSize: 13,
  },
  statusStack: {
    alignItems: "flex-end",
    gap: 6,
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  paidBadge: {
    backgroundColor: "#dcfce7",
  },
  pendingBadge: {
    backgroundColor: "#fef3c7",
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  boardedBadge: {
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  boardedBadgeText: {
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: "700",
  },
});
