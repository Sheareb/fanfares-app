import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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

type TripRow = Record<string, unknown>;

type PickupPoint = {
  pickuppoint_id: string;
  description: string;
  time: string;
};

type BookingTrip = {
  trip_id: string;
  description: string;
  departure_date: string;
  departure_time: string;
  seat_count: number | null;
  seat_price: number | null;
  pickup_points: PickupPoint[];
};

type TravellerDraft = {
  id: string;
  customerName: string;
  pickupPointId: string;
};

function readString(source: TripRow, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function readNumber(source: TripRow, keys: string[]) {
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

function getDepartureDateTime(trip: BookingTrip) {
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

function formatDeparture(trip: BookingTrip) {
  const departureAt = getDepartureDateTime(trip);
  if (!departureAt) {
    return "Departure time unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(departureAt);
}

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

function pickupSortKey(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function groupTripRows(rows: TripRow[]) {
  const grouped = new Map<string, BookingTrip>();

  for (const row of rows) {
    const tripId = readString(row, ["trip_id"]);
    if (!tripId) {
      continue;
    }

    const existingTrip = grouped.get(tripId);
    if (!existingTrip) {
      grouped.set(tripId, {
        trip_id: tripId,
        description: readString(row, ["description"]),
        departure_date: readString(row, ["departure_date"]),
        departure_time: readString(row, ["departure_time"]),
        seat_count: readNumber(row, ["seat_count"]),
        seat_price: readNumber(row, ["seat_price"]),
        pickup_points: [],
      });
    }

    const pickuppointId = readString(row, ["pickuppoint_id"]);
    const pickupDescription = readString(row, ["pickup_description"]);
    const pickupTime = readString(row, ["pickup_time"]);

    if (pickuppointId || pickupDescription || pickupTime) {
      grouped.get(tripId)?.pickup_points.push({
        pickuppoint_id: pickuppointId,
        description: pickupDescription,
        time: pickupTime,
      });
    }
  }

  const trip = Array.from(grouped.values())[0] || null;
  if (!trip) {
    return null;
  }

  trip.pickup_points.sort((a, b) => {
    const timeDiff = pickupSortKey(a.time) - pickupSortKey(b.time);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return a.description.localeCompare(b.description);
  });

  return trip;
}

function createTravellerDraft() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    customerName: "",
    pickupPointId: "",
  };
}

export default function BookTripScreen() {
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = useMemo(() => {
    const value = params.tripId;
    if (Array.isArray(value)) {
      return value[0] || "";
    }

    return value || "";
  }, [params.tripId]);

  const [trip, setTrip] = useState<BookingTrip | null>(null);
  const [travellers, setTravellers] = useState<TravellerDraft[]>([]);
  const [openPickupFor, setOpenPickupFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasReadyPassenger = travellers.some(
    (traveller) =>
      traveller.customerName.trim().length > 0 &&
      traveller.pickupPointId.trim().length > 0,
  );

  useEffect(() => {
    if (!tripId) {
      setErrorMessage("Trip details are missing.");
      return;
    }

    const loadTrip = async () => {
      if (!supabase || !hasSupabaseConfig) {
        setErrorMessage("Supabase is not configured.");
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("vw_trips")
        .select("*")
        .eq("trip_id", tripId);

      setLoading(false);

      if (error) {
        setErrorMessage(error.message || "We could not load the trip details.");
        return;
      }

      setTrip(groupTripRows((data || []) as TripRow[]));
    };

    loadTrip();
  }, [tripId]);

  const addTraveller = () => {
    setTravellers((current) => [...current, createTravellerDraft()]);
  };

  const updateTraveller = (id: string, updates: Partial<TravellerDraft>) => {
    setTravellers((current) =>
      current.map((traveller) =>
        traveller.id === id ? { ...traveller, ...updates } : traveller,
      ),
    );
  };

  const removeTraveller = (id: string) => {
    setTravellers((current) =>
      current.filter((traveller) => traveller.id !== id),
    );
    setOpenPickupFor((current) => (current === id ? null : current));
  };

  const goToSummary = () => {
    const invalidTraveller = travellers.find(
      (traveller) => !traveller.customerName.trim() || !traveller.pickupPointId,
    );

    if (!travellers.length) {
      setErrorMessage("Add at least one passenger before continuing.");
      return;
    }

    if (invalidTraveller) {
      setErrorMessage("Each passenger needs a name and a pickup point.");
      return;
    }

    if (!trip) {
      setErrorMessage("Trip details are still loading.");
      return;
    }

    router.push({
      pathname: "/booking-summary",
      params: {
        trip: JSON.stringify(trip),
        travellers: JSON.stringify(travellers),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable style={styles.backIconButton} onPress={() => router.back()}>
          <Text style={styles.backIconText}>←</Text>
        </Pressable>

        <Text style={styles.title}>Book your seat</Text>
        <Text style={styles.subtitle}>
          Review the trip details, add each traveller, and choose a pickup
          point.
        </Text>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.stateText}>Loading trip details...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : trip ? (
          <>
            <View style={styles.tripCard}>
              <Text style={styles.cardLabel}>Trip summary</Text>
              <Text style={styles.tripTitle}>
                {trip.description || "Untitled trip"}
              </Text>
              <Text style={styles.tripMeta}>Date: {formatDeparture(trip)}</Text>
              <Text style={styles.tripMeta}>
                Seats available: {trip.seat_count ?? "—"}
              </Text>
              <Text style={styles.tripPrice}>
                {formatCurrency(trip.seat_price)} per seat
              </Text>
              <View style={styles.tripPickupList}>
                {trip.pickup_points.length > 0 ? (
                  trip.pickup_points.map((pickup) => (
                    <Text
                      key={pickup.pickuppoint_id || pickup.description}
                      style={styles.tripPickupItem}
                    >
                      {pickup.time ? `${normalizeTime(pickup.time)} - ` : ""}
                      {pickup.description}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    No pickup points are available for this trip.
                  </Text>
                )}
              </View>
            </View>

            {travellers.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.emptyText}>
                  Add a traveller to begin your booking.
                </Text>
              </View>
            ) : null}

            {travellers.map((traveller, index) => (
              <View key={traveller.id} style={styles.passengerCard}>
                <View style={styles.passengerHeader}>
                  <Text style={styles.cardLabel}>Passenger {index + 1}</Text>
                  <Pressable
                    style={styles.deletePassengerButton}
                    onPress={() => removeTraveller(traveller.id)}
                  >
                    <Text style={styles.deletePassengerIcon}>🗑</Text>
                  </Pressable>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Customer name"
                  value={traveller.customerName}
                  onChangeText={(value) =>
                    updateTraveller(traveller.id, { customerName: value })
                  }
                />

                <View style={styles.pickupList}>
                  {trip.pickup_points.length > 0 ? (
                    <>
                      {(() => {
                        const selectedPickup = trip.pickup_points.find(
                          (pickup) =>
                            pickup.pickuppoint_id === traveller.pickupPointId,
                        );
                        const selectedLabel = selectedPickup
                          ? `${selectedPickup.time ? `${normalizeTime(selectedPickup.time)} - ` : ""}${selectedPickup.description}`
                          : "Select pickup point";
                        const isOpen = openPickupFor === traveller.id;

                        return (
                          <>
                            <Pressable
                              style={styles.dropdownTrigger}
                              onPress={() =>
                                setOpenPickupFor((current) =>
                                  current === traveller.id
                                    ? null
                                    : traveller.id,
                                )
                              }
                            >
                              <Text
                                style={[
                                  styles.dropdownTriggerText,
                                  !selectedPickup && styles.dropdownPlaceholder,
                                ]}
                              >
                                {selectedLabel}
                              </Text>
                              <Text style={styles.dropdownChevron}>
                                {isOpen ? "▲" : "▼"}
                              </Text>
                            </Pressable>

                            {isOpen ? (
                              <View style={styles.dropdownMenu}>
                                {trip.pickup_points.map((pickup) => {
                                  const selected =
                                    traveller.pickupPointId ===
                                    pickup.pickuppoint_id;

                                  return (
                                    <Pressable
                                      key={
                                        pickup.pickuppoint_id ||
                                        `${traveller.id}-${pickup.description}`
                                      }
                                      style={[
                                        styles.dropdownOption,
                                        selected && styles.dropdownOptionActive,
                                      ]}
                                      onPress={() => {
                                        updateTraveller(traveller.id, {
                                          pickupPointId: pickup.pickuppoint_id,
                                        });
                                        setOpenPickupFor(null);
                                      }}
                                    >
                                      <Text
                                        style={[
                                          styles.dropdownOptionText,
                                          selected &&
                                            styles.dropdownOptionTextActive,
                                        ]}
                                      >
                                        {pickup.time
                                          ? `${normalizeTime(pickup.time)} - `
                                          : ""}
                                        {pickup.description}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            ) : null}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <Text style={styles.emptyText}>
                      No pickup points are available for this trip.
                    </Text>
                  )}
                </View>
              </View>
            ))}

            <Pressable style={styles.addIconButton} onPress={addTraveller}>
              <Text style={styles.addIconText}>＋</Text>
            </Pressable>

            {hasReadyPassenger ? (
              <Pressable style={styles.summaryButton} onPress={goToSummary}>
                <Text style={styles.summaryButtonText}>View summary</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
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
    padding: 24,
    paddingBottom: 36,
  },
  backIconButton: {
    alignSelf: "flex-start",
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    marginBottom: 16,
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
    fontSize: 30,
    fontWeight: "800",
    color: "#1f2a44",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    marginBottom: 18,
  },
  stateCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    shadowColor: "#1f2a44",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  stateText: {
    color: "#475569",
    marginTop: 8,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "600",
  },
  tripCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#1f2a44",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
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
    color: "#1f2a44",
    marginBottom: 6,
  },
  tripMeta: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 4,
  },
  tripPrice: {
    fontSize: 15,
    color: "#1f2a44",
    fontWeight: "700",
    marginTop: 6,
  },
  tripPickupList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 4,
  },
  tripPickupItem: {
    fontSize: 14,
    color: "#334155",
  },
  addIconButton: {
    alignSelf: "center",
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    marginTop: 2,
    marginBottom: 16,
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
  passengerCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  passengerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  deletePassengerButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
  },
  deletePassengerIcon: {
    fontSize: 14,
    lineHeight: 16,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe2f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1f2a44",
    marginBottom: 10,
  },
  pickupList: {
    gap: 8,
  },
  dropdownTrigger: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe2f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownTriggerText: {
    flex: 1,
    color: "#334155",
    fontSize: 14,
    marginRight: 10,
  },
  dropdownPlaceholder: {
    color: "#64748b",
  },
  dropdownChevron: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  dropdownMenu: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe2f0",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#edf2fa",
  },
  dropdownOptionActive: {
    backgroundColor: "#eff6ff",
  },
  dropdownOptionText: {
    color: "#334155",
    fontSize: 14,
  },
  dropdownOptionTextActive: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  summaryButton: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
    backgroundColor: "#0f766e",
  },
  summaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
