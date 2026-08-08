import { router, useLocalSearchParams } from "expo-router";
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

type TabKey = "home" | "discover" | "bookings" | "profile";

type CustomerDashboardScreenProps = {
  initialTab?: TabKey;
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

  const date = new Date();
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
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

export default function CustomerDashboardScreen({
  initialTab,
}: CustomerDashboardScreenProps) {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? "home");
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

  useEffect(() => {
    const nextTab = initialTab ?? params.tab;
    if (
      nextTab === "home" ||
      nextTab === "discover" ||
      nextTab === "bookings" ||
      nextTab === "profile"
    ) {
      setActiveTab(nextTab);
    }
  }, [initialTab, params.tab]);

  const pendingPaymentTotal = bookedTrips.reduce((sum, trip) => {
    const unpaid = trip.bookings
      .filter((seat) => !seat.isPaid)
      .reduce((tripSum, seat) => tripSum + (seat.seat_price ?? 0), 0);
    return sum + unpaid;
  }, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.eyebrow}>Welcome back</Text>
            <Text style={styles.title}>Your journeys</Text>
          </View>
          <DashboardSettingsMenu
            onChangePassword={() => router.push("/change-password")}
            onEditProfile={() => router.push("/edit-profile")}
            onSignOut={handleSignOut}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "home" ? (
            <>
              <View style={styles.heroCard}>
                <View style={styles.heroTextGroup}>
                  <Text style={styles.heroTitle}>
                    Ready for your next trip?
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    Find new departures, keep track of your bookings, and stay
                    on top of payments.
                  </Text>
                </View>
                <View style={styles.heroActions}>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => router.push("/trip-search")}
                  >
                    <Text style={styles.primaryButtonText}>Find trips</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setActiveTab("bookings")}
                  >
                    <Text style={styles.secondaryButtonText}>
                      View bookings
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.heroSummaryRow}>
                  <View style={styles.heroSummaryPill}>
                    <Text style={styles.heroSummaryLabel}>Upcoming</Text>
                    <Text style={styles.heroSummaryValue}>
                      {bookedTrips.length}
                    </Text>
                  </View>
                  <View style={styles.heroSummaryPill}>
                    <Text style={styles.heroSummaryLabel}>Pending</Text>
                    <Text style={styles.heroSummaryValue}>
                      {formatCurrency(pendingPaymentTotal) ?? "—"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Upcoming plans</Text>
                  <Pressable onPress={() => setActiveTab("bookings")}>
                    <Text style={styles.linkText}>See all</Text>
                  </Pressable>
                </View>

                {bookedTripsLoading ? (
                  <View style={styles.stateRow}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.stateText}>
                      Loading your bookings...
                    </Text>
                  </View>
                ) : bookedTripsError ? (
                  <Text style={styles.errorText}>{bookedTripsError}</Text>
                ) : bookedTrips.length === 0 ? (
                  <Text style={styles.emptyText}>
                    You do not have any upcoming bookings yet.
                  </Text>
                ) : (
                  bookedTrips.slice(0, 2).map((trip) => (
                    <View key={trip.trip_id} style={styles.tripMiniCard}>
                      <Text style={styles.tripMiniTitle}>
                        {trip.description || "Untitled trip"}
                      </Text>
                      <Text style={styles.tripMiniMeta}>
                        {formatDeparture(trip as DashboardTrip)}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Pending payments</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(pendingPaymentTotal)}
                </Text>
                <Text style={styles.summaryHint}>
                  Keep an eye on anything still outstanding.
                </Text>
              </View>
            </>
          ) : null}

          {activeTab === "discover" ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Discover trips</Text>
                <Text style={styles.sectionSubtitle}>
                  Browse all available departures and book your next journey in
                  a few taps.
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.push("/trip-search")}
                >
                  <Text style={styles.primaryButtonText}>Open trip search</Text>
                </Pressable>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Quick access</Text>
                <Text style={styles.infoCardText}>
                  Use the search to find new routes, compare departure times,
                  and save your preferred pickup points.
                </Text>
                <View style={styles.infoList}>
                  <View style={styles.infoListItem}>
                    <Text style={styles.infoListBullet}>•</Text>
                    <Text style={styles.infoListText}>
                      Search by route or destination
                    </Text>
                  </View>
                  <View style={styles.infoListItem}>
                    <Text style={styles.infoListBullet}>•</Text>
                    <Text style={styles.infoListText}>
                      Check seat availability instantly
                    </Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}

          {activeTab === "bookings" ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Your bookings</Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>
                    {bookedTrips.length}
                  </Text>
                </View>
              </View>

              {bookedTripsLoading ? (
                <View style={styles.stateRow}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={styles.stateText}>Loading your bookings...</Text>
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
                              seat.isPaid
                                ? styles.paidBadge
                                : styles.unpaidBadge,
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
                          Amount outstanding
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
          ) : null}

          {activeTab === "profile" ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Account</Text>
              <Text style={styles.sectionSubtitle}>
                Manage your details and sign out securely.
              </Text>

              <Pressable
                style={styles.profileRow}
                onPress={() => router.push("/edit-profile")}
              >
                <Text style={styles.profileRowIcon}>✎</Text>
                <View style={styles.profileRowTextWrap}>
                  <Text style={styles.profileRowTitle}>Edit profile</Text>
                  <Text style={styles.profileRowSubtitle}>
                    Update your name, phone and preferences.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.profileRow}
                onPress={() => router.push("/change-password")}
              >
                <Text style={styles.profileRowIcon}>🔐</Text>
                <View style={styles.profileRowTextWrap}>
                  <Text style={styles.profileRowTitle}>Change password</Text>
                  <Text style={styles.profileRowSubtitle}>
                    Keep your account secure.
                  </Text>
                </View>
              </Pressable>

              <Pressable style={styles.profileRow} onPress={handleSignOut}>
                <Text style={styles.profileRowIcon}>↩</Text>
                <View style={styles.profileRowTextWrap}>
                  <Text style={styles.profileRowTitle}>Sign out</Text>
                  <Text style={styles.profileRowSubtitle}>
                    Return to the welcome screen.
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : null}
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
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTextGroup: {
    flex: 1,
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#2563eb",
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  heroTextGroup: {
    gap: 6,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    lineHeight: 20,
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  heroSummaryRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  heroSummaryPill: {
    flex: 1,
    minWidth: 110,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 14,
    padding: 10,
  },
  heroSummaryLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroSummaryValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#1d4ed8",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
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
    elevation: 3,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
  },
  linkText: {
    color: "#2563eb",
    fontWeight: "700",
    fontSize: 13,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stateText: {
    color: "#475569",
    fontSize: 14,
  },
  emptyText: {
    color: "#4b5563",
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "600",
    fontSize: 14,
  },
  tripMiniCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tripMiniTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  tripMiniMeta: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4,
  },
  summaryHint: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  infoCardTitle: {
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: "800",
  },
  infoCardText: {
    color: "#1e3a8a",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  infoList: {
    gap: 8,
    marginTop: 10,
  },
  infoListItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoListBullet: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "800",
  },
  infoListText: {
    color: "#1e3a8a",
    fontSize: 13,
    fontWeight: "600",
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
    color: "#0f172a",
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
    color: "#0f172a",
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
    color: "#0f172a",
  },
  unpaidSummaryValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#dc2626",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  profileRowIcon: {
    fontSize: 18,
    width: 30,
    textAlign: "center",
  },
  profileRowTextWrap: {
    flex: 1,
  },
  profileRowTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  profileRowSubtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
});
