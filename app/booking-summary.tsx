import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
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
  trip_id: string;
  description: string;
  departure_date: string;
  departure_time: string;
  seat_count: number | null;
  seat_price: number | null;
  pickup_points: Array<{
    pickuppoint_id: string;
    description: string;
    time: string;
  }>;
};

type TravellerSummary = {
  id: string;
  customerName: string;
  pickupPointId: string;
};

function formatCurrency(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function getDepartureDateTime(trip: TripSummary) {
  const departureDate = trip.departure_date;
  const departureTime = trip.departure_time || "00:00:00";
  const normalizedTime =
    departureTime.length === 5 ? `${departureTime}:00` : departureTime;
  const date = new Date(`${departureDate}T${normalizedTime}`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDeparture(trip: TripSummary) {
  const departureAt = getDepartureDateTime(trip);
  if (!departureAt) {
    return "Departure time unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(departureAt);
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

export default function BookingSummaryScreen() {
  const params = useLocalSearchParams<{ trip?: string; travellers?: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trip = useMemo(() => {
    const rawTrip = params.trip;
    if (Array.isArray(rawTrip)) {
      return rawTrip[0] ? (JSON.parse(rawTrip[0]) as TripSummary) : null;
    }

    return rawTrip ? (JSON.parse(rawTrip) as TripSummary) : null;
  }, [params.trip]);

  const travellers = useMemo(() => {
    const rawTravellers = params.travellers;
    if (Array.isArray(rawTravellers)) {
      return rawTravellers[0]
        ? (JSON.parse(rawTravellers[0]) as TravellerSummary[])
        : [];
    }

    return rawTravellers
      ? (JSON.parse(rawTravellers) as TravellerSummary[])
      : [];
  }, [params.travellers]);

  const confirmBooking = async () => {
    if (!trip || !travellers.length) {
      setErrorMessage("There is nothing to book yet.");
      return;
    }

    if (!supabase || !hasSupabaseConfig) {
      setErrorMessage("Supabase is not configured.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      for (const traveller of travellers) {
        const pickup = trip.pickup_points.find(
          (point) => point.pickuppoint_id === traveller.pickupPointId,
        );
        if (!pickup) {
          throw new Error("A pickup point could not be resolved.");
        }

        const { error } = await supabase.rpc("book_seat", {
          trip_id: trip.trip_id,
          pickuppoint_id: pickup.pickuppoint_id,
          customer_name: traveller.customerName,
          seat_price: trip.seat_price ?? 0,
        });

        if (error) {
          throw new Error(
            error.message || "The booking could not be completed.",
          );
        }
      }

      setMessage("Booking request submitted successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Booking failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>Step 2 of 2</Text>
          </View>
          <Text style={styles.title}>Booking summary</Text>
          <Text style={styles.subtitle}>
            Confirm the trip, passengers, and pickup points before you book.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillLabel}>Trip</Text>
              <Text style={styles.summaryPillValue}>
                {trip?.description || "Selected"}
              </Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillLabel}>Travellers</Text>
              <Text style={styles.summaryPillValue}>{travellers.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRow}>
          <Pressable
            style={[styles.backIconButton, styles.leftTopControl]}
            onPress={() => router.replace("/(customer-tabs)/home")}
          >
            <Text style={styles.backIconText}>←</Text>
          </Pressable>
        </View>

        {trip ? (
          <View style={styles.tripCard}>
            <Text style={styles.cardLabel}>Trip</Text>
            <Text style={styles.tripTitle}>
              {trip.description || "Untitled trip"}
            </Text>
            <Text style={styles.tripMeta}>
              Departure: {formatDeparture(trip)}
            </Text>
            <Text style={styles.tripMeta}>
              Seats available: {trip.seat_count ?? "—"}
            </Text>
            <Text style={styles.tripPrice}>
              {formatCurrency(trip.seat_price)} per seat
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.cardLabel}>Travellers</Text>
          {travellers.length === 0 ? (
            <Text style={styles.emptyText}>No travellers selected.</Text>
          ) : (
            travellers.map((traveller, index) => {
              const pickup = trip?.pickup_points.find(
                (point) => point.pickuppoint_id === traveller.pickupPointId,
              );
              return (
                <View key={traveller.id} style={styles.travellerRow}>
                  <Text style={styles.travellerName}>
                    {index + 1}. {traveller.customerName}
                  </Text>
                  <Text style={styles.travellerPickup}>
                    {pickup
                      ? `${normalizeTime(pickup.time)} - ${pickup.description}`
                      : "Pickup point not selected"}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {message ? (
          <View style={styles.successCard}>
            <Text style={styles.successText}>{message}</Text>
            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.secondaryButton, styles.actionsButton]}
                onPress={() => router.replace("/(customer-tabs)/home")}
              >
                <Text style={styles.secondaryButtonText}>View bookings</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.actionsButton]}
                onPress={() => router.replace("/(customer-tabs)/discover")}
              >
                <Text style={styles.primaryButtonText}>Book another trip</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        {!message ? (
          <Pressable
            style={styles.primaryButton}
            onPress={confirmBooking}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Book now</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#07111f",
  },
  container: {
    padding: 24,
    paddingBottom: 36,
  },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  stepPill: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  stepPillText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  headerRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    marginBottom: 8,
  },
  leftTopControl: {
    position: "absolute",
    left: 0,
  },
  backIconButton: {
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
  backIconText: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 24,
    fontWeight: "700",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    marginTop: 4,
    lineHeight: 20,
  },
  summaryStrip: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
  summaryPill: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    padding: 10,
  },
  summaryPillLabel: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryPillValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  tripCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e5eaf3",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e5eaf3",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  cardLabel: {
    color: "#2563eb",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  tripTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  tripMeta: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 4,
  },
  tripPrice: {
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "700",
    marginTop: 6,
  },
  travellerRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  travellerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  travellerPickup: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
  },
  successCard: {
    backgroundColor: "#ecfdf3",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#86efac",
  },
  successText: {
    color: "#166534",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  actionsButton: {
    flexGrow: 1,
    minWidth: 140,
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "600",
    marginTop: 8,
  },
});
