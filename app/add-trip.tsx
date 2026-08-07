import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getIsOrganiser } from "../lib/profile";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

type PickupPoint = {
  id: string;
  description: string;
  time: string;
};

function createPickupPoint() {
  return {
    id: `${Date.now()}-${Math.random()}`,
    description: "",
    time: "",
  };
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function toSortMinutes(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function sortPickupPointsByTime(points: PickupPoint[]) {
  if (points.length <= 1) {
    return points;
  }

  const [departurePoint, ...rest] = points;
  const sortedRest = [...rest].sort((a, b) => {
    const timeDiff = toSortMinutes(a.time) - toSortMinutes(b.time);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return a.description.localeCompare(b.description);
  });

  return [departurePoint, ...sortedRest];
}

export default function AddTripScreen() {
  const [description, setDescription] = useState("");
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [showDepartureDatePicker, setShowDepartureDatePicker] = useState(false);
  const [departureTime, setDepartureTime] = useState("");
  const [showDepartureTimePicker, setShowDepartureTimePicker] = useState(false);
  const [activePickupTimePickerId, setActivePickupTimePickerId] = useState<
    string | null
  >(null);
  const [totalCost, setTotalCost] = useState("");
  const [seatCount, setSeatCount] = useState("");
  const [seatPrice, setSeatPrice] = useState("");
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([
    createPickupPoint(),
  ]);
  const [loading, setLoading] = useState(false);
  const [isOrganiser, setIsOrganiser] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"error" | "success" | null>(
    null,
  );
  const [pickupTimeError, setPickupTimeError] = useState<string | null>(null);

  const seatCountValueForWarning = Number(seatCount);
  const seatPriceValueForWarning = Number(seatPrice);
  const totalCostValueForWarning = Number(totalCost);
  const seatRevenueValueForWarning =
    seatCountValueForWarning * seatPriceValueForWarning;
  const gbpFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const hasRevenueComparison =
    totalCost.trim().length > 0 &&
    Number.isFinite(totalCostValueForWarning) &&
    totalCostValueForWarning > 0 &&
    Number.isFinite(seatCountValueForWarning) &&
    seatCountValueForWarning > 0 &&
    Number.isFinite(seatPriceValueForWarning) &&
    seatPriceValueForWarning > 0;
  const revenueDelta = seatRevenueValueForWarning - totalCostValueForWarning;
  const hasRevenueWarning = hasRevenueComparison && revenueDelta < 0;
  const hasRevenueExcess = hasRevenueComparison && revenueDelta > 0;
  const hasRevenueBreakEven = hasRevenueComparison && revenueDelta === 0;
  const minDepartureDate = startOfToday();

  useEffect(() => {
    const loadProfile = async () => {
      if (!supabase || !hasSupabaseConfig) {
        setLoadingProfile(false);
        setFeedback("Supabase is not configured.");
        setFeedbackType("error");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLoadingProfile(false);
        setFeedback("Please sign in again to create a trip.");
        setFeedbackType("error");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      setLoadingProfile(false);

      if (profileError) {
        setFeedback("We could not load your organiser status.");
        setFeedbackType("error");
        return;
      }

      const organiser = getIsOrganiser(profileData);
      setIsOrganiser(organiser);
      if (!organiser) {
        setFeedback("Only organisers can create trips.");
        setFeedbackType("error");
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    setPickupPoints((current) => {
      if (current.length === 0) {
        return [createPickupPoint()];
      }

      const [firstPoint, ...rest] = current;
      return [{ ...firstPoint, time: departureTime }, ...rest];
    });
  }, [departureTime]);

  const addPickupPoint = () => {
    setPickupTimeError(null);
    setPickupPoints((current) => {
      const sortedCurrent = sortPickupPointsByTime(current);
      return [...sortedCurrent, createPickupPoint()];
    });
  };

  const updatePickupPoint = (
    id: string,
    field: "description" | "time",
    value: string,
  ) => {
    setPickupTimeError(null);
    setPickupPoints((current) =>
      current.map((point) =>
        point.id === id ? { ...point, [field]: value } : point,
      ),
    );
  };

  const removePickupPoint = (id: string) => {
    if (pickupPoints[0]?.id === id) {
      return;
    }

    if (activePickupTimePickerId === id) {
      setActivePickupTimePickerId(null);
    }
    setPickupTimeError(null);
    setPickupPoints((current) => current.filter((point) => point.id !== id));
  };

  const isValidTimeFormat = (value: string) => {
    if (!value.trim()) {
      return false;
    }

    const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    return Boolean(match);
  };

  const toMinutesFromMidnight = (value: string) => {
    if (!isValidTimeFormat(value)) {
      return null;
    }

    const [hoursText, minutesText] = value.split(":");
    return Number(hoursText) * 60 + Number(minutesText);
  };

  const departurePoint = pickupPoints[0] || null;
  const lastPickupPoint =
    pickupPoints.length > 0 ? pickupPoints[pickupPoints.length - 1] : null;
  const isDeparturePointComplete = Boolean(
    departurePoint?.description.trim() && isValidTimeFormat(departureTime),
  );
  const isLastPickupPointComplete = Boolean(
    lastPickupPoint?.description.trim() &&
    isValidTimeFormat(lastPickupPoint?.time || ""),
  );

  const formatDateForDisplay = (value: Date) => {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(value);
  };

  const formatDateToIso = (value: Date) => {
    return [
      String(value.getFullYear()).padStart(4, "0"),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  };

  const parseIsoDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const [yearText, monthText, dayText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const parsedDate = new Date(year, month - 1, day);

    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      return null;
    }

    return parsedDate;
  };

  const isPastDate = (value: Date) => {
    const candidate = new Date(value);
    candidate.setHours(0, 0, 0, 0);
    return candidate.getTime() < minDepartureDate.getTime();
  };

  const formatTimeToHHMM = (value: Date) => {
    return `${String(value.getHours()).padStart(2, "0")}:${String(
      value.getMinutes(),
    ).padStart(2, "0")}`;
  };

  const getDepartureTimePickerValue = () => {
    if (!isValidTimeFormat(departureTime)) {
      return new Date();
    }

    const [hoursText, minutesText] = departureTime.split(":");
    const date = new Date();
    date.setHours(Number(hoursText), Number(minutesText), 0, 0);
    return date;
  };

  const getTimePickerValue = (value: string) => {
    if (!isValidTimeFormat(value)) {
      return new Date();
    }

    const [hoursText, minutesText] = value.split(":");
    const date = new Date();
    date.setHours(Number(hoursText), Number(minutesText), 0, 0);
    return date;
  };

  const formatTimeForDisplay = (value: string) => {
    if (!isValidTimeFormat(value)) {
      return value;
    }

    const [hoursText, minutesText] = value.split(":");
    const date = new Date();
    date.setHours(Number(hoursText), Number(minutesText), 0, 0);

    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  const onDepartureDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowDepartureDatePicker(false);
    }

    if (event.type === "set" && selectedDate) {
      setDepartureDate(selectedDate);
      if (feedback) {
        setFeedback(null);
        setFeedbackType(null);
      }
    }
  };

  const onDepartureTimeChange = (
    event: DateTimePickerEvent,
    selectedTime?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowDepartureTimePicker(false);
    }

    if (event.type === "set" && selectedTime) {
      setPickupTimeError(null);
      setDepartureTime(formatTimeToHHMM(selectedTime));
      if (feedback) {
        setFeedback(null);
        setFeedbackType(null);
      }
    }
  };

  const handleSave = async () => {
    setPickupTimeError(null);

    if (!supabase || !hasSupabaseConfig) {
      setFeedback("Supabase is not configured.");
      setFeedbackType("error");
      return;
    }

    if (!isOrganiser) {
      setFeedback("Only organisers can create trips.");
      setFeedbackType("error");
      return;
    }

    if (!description.trim()) {
      setFeedback("Please enter a trip description.");
      setFeedbackType("error");
      return;
    }

    const normalizedDepartureDate = departureDate
      ? formatDateToIso(departureDate)
      : "";

    if (!normalizedDepartureDate) {
      setFeedback("Please choose a departure date.");
      setFeedbackType("error");
      return;
    }

    const departureDateCandidate = parseIsoDate(normalizedDepartureDate);
    if (!departureDateCandidate) {
      setFeedback("Please choose a valid departure date.");
      setFeedbackType("error");
      return;
    }

    if (isPastDate(departureDateCandidate)) {
      setFeedback("Departure date cannot be earlier than today.");
      setFeedbackType("error");
      return;
    }

    if (!departureTime.trim()) {
      setFeedback("Please choose a departure time.");
      setFeedbackType("error");
      return;
    }

    if (!isValidTimeFormat(departureTime)) {
      setFeedback("Departure time must be in the format HH:MM.");
      setFeedbackType("error");
      return;
    }

    if (!isDeparturePointComplete) {
      setFeedback("Please complete the departure point before saving.");
      setFeedbackType("error");
      return;
    }

    if (!seatCount.trim()) {
      setFeedback("Please enter the number of seats available.");
      setFeedbackType("error");
      return;
    }

    if (!seatPrice.trim()) {
      setFeedback("Please enter the price per seat.");
      setFeedbackType("error");
      return;
    }

    const seatCountValue = Number(seatCount);
    if (!Number.isInteger(seatCountValue) || seatCountValue <= 0) {
      setFeedback("Seat count must be a whole number greater than zero.");
      setFeedbackType("error");
      return;
    }

    const seatPriceValue = Number(seatPrice);
    if (!Number.isFinite(seatPriceValue) || seatPriceValue <= 0) {
      setFeedback("Seat price must be a positive number.");
      setFeedbackType("error");
      return;
    }

    const totalCostValue = totalCost.trim() ? Number(totalCost) : null;
    if (
      totalCostValue !== null &&
      (!Number.isFinite(totalCostValue) || totalCostValue < 0)
    ) {
      setFeedback("Total cost must be a positive number when provided.");
      setFeedbackType("error");
      return;
    }

    const hasIncompletePickup = pickupPoints.some(
      (point) =>
        Boolean(point.description.trim()) !== Boolean(point.time.trim()),
    );

    if (hasIncompletePickup) {
      setFeedback(
        "A pickup point is incomplete. Finish entering it or remove before saving.",
      );
      setFeedbackType("error");
      return;
    }

    const hasInvalidPickupTime = pickupPoints.some((point) => {
      if (!point.time.trim()) {
        return false;
      }
      return !isValidTimeFormat(point.time);
    });

    if (hasInvalidPickupTime) {
      setFeedback("Pickup times must be in the format HH:MM.");
      setFeedbackType("error");
      return;
    }

    const departureTimeMinutes = toMinutesFromMidnight(departureTime);
    const hasPickupEarlierThanDeparture = pickupPoints.some((point, index) => {
      if (index === 0) {
        return false;
      }

      if (!point.time.trim()) {
        return false;
      }

      const pickupTimeMinutes = toMinutesFromMidnight(point.time);
      if (pickupTimeMinutes === null || departureTimeMinutes === null) {
        return false;
      }

      return pickupTimeMinutes < departureTimeMinutes;
    });

    if (hasPickupEarlierThanDeparture) {
      setPickupTimeError(
        "Pickup point times cannot be earlier than the trip departure time.",
      );
      return;
    }

    const normalizedPickupPoints = pickupPoints
      .filter((point) => point.description.trim() || point.time.trim())
      .map((point) => ({
        description: point.description.trim(),
        time: point.time.trim(),
      }));

    setLoading(true);
    setFeedback(null);
    setFeedbackType(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFeedback("Please sign in again before saving.");
        setFeedbackType("error");
        return;
      }

      const tripData = {
        organiser_id: user.id,
        description: description.trim(),
        departure_date: normalizedDepartureDate,
        departure_time: departureTime,
        total_cost: totalCostValue,
        seat_count: seatCountValue,
        seat_price: seatPriceValue,
      };

      const { data, error } = await supabase.rpc("create_trip_with_pickups", {
        trip_data: tripData,
        pickup_points: normalizedPickupPoints,
      });

      if (error) {
        setFeedback(error.message || "Unable to save the trip right now.");
        setFeedbackType("error");
        return;
      }

      setFeedback(`Trip saved successfully${data ? ` (${data})` : ""}.`);
      setFeedbackType("success");
      setDescription("");
      setDepartureDate(null);
      setShowDepartureDatePicker(false);
      setDepartureTime("");
      setShowDepartureTimePicker(false);
      setActivePickupTimePickerId(null);
      setTotalCost("");
      setSeatCount("");
      setSeatPrice("");
      setPickupPoints([createPickupPoint()]);
      router.replace("/organiser-dashboard");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save the trip right now.";
      setFeedback(message);
      setFeedbackType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.topActions}>
              <Pressable
                style={styles.addIconButton}
                onPress={() => router.back()}
              >
                <Text style={styles.addIconText}>←</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>Add a trip</Text>
            <Text style={styles.subtitle}>
              Share the trip details and pickup points for your travellers.
            </Text>

            {feedback ? (
              <View
                style={
                  feedbackType === "error" ? styles.errorBox : styles.successBox
                }
              >
                <Text
                  style={
                    feedbackType === "error"
                      ? styles.errorText
                      : styles.successText
                  }
                >
                  {feedback}
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Weekend trip to the coast"
              value={description}
              onChangeText={(value) => {
                setDescription(value);
                if (feedback) {
                  setFeedback(null);
                  setFeedbackType(null);
                }
              }}
              multiline
            />

            <Text style={styles.label}>Departure date</Text>
            <>
              <Pressable
                style={styles.input}
                onPress={() =>
                  setShowDepartureDatePicker((current) => !current)
                }
              >
                <Text
                  style={[
                    styles.inputValueText,
                    !departureDate && styles.inputPlaceholderText,
                  ]}
                >
                  {departureDate
                    ? formatDateForDisplay(departureDate)
                    : "Select departure date"}
                </Text>
              </Pressable>

              {showDepartureDatePicker ? (
                <DateTimePicker
                  value={departureDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={minDepartureDate}
                  onChange={onDepartureDateChange}
                />
              ) : null}
            </>

            <Text style={styles.label}>Departure time</Text>
            <>
              <Pressable
                style={styles.input}
                onPress={() =>
                  setShowDepartureTimePicker((current) => !current)
                }
              >
                <Text
                  style={[
                    styles.inputValueText,
                    !departureTime && styles.inputPlaceholderText,
                  ]}
                >
                  {departureTime
                    ? formatTimeForDisplay(departureTime)
                    : "Select departure time"}
                </Text>
              </Pressable>

              {showDepartureTimePicker ? (
                <DateTimePicker
                  value={getDepartureTimePickerValue()}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onDepartureTimeChange}
                />
              ) : null}
            </>

            <Text style={styles.label}>Total cost (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={totalCost}
              onChangeText={(value) => {
                setTotalCost(value);
                if (feedback) {
                  setFeedback(null);
                  setFeedbackType(null);
                }
              }}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Number of seats available</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 24"
              value={seatCount}
              onChangeText={(value) => {
                setSeatCount(value);
                if (feedback) {
                  setFeedback(null);
                  setFeedbackType(null);
                }
              }}
              keyboardType="number-pad"
            />

            {hasRevenueWarning ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  Warning: income is {gbpFormatter.format(-revenueDelta)} less
                  than trip cost.
                </Text>
              </View>
            ) : null}

            {hasRevenueExcess ? (
              <View style={styles.excessBox}>
                <Text style={styles.excessText}>
                  Income exceeds cost, excess is{" "}
                  {gbpFormatter.format(revenueDelta)}.
                </Text>
              </View>
            ) : null}

            {hasRevenueBreakEven ? (
              <View style={styles.breakEvenBox}>
                <Text style={styles.breakEvenText}>
                  Income matches cost exactly at{" "}
                  {gbpFormatter.format(totalCostValueForWarning)}.
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Price per seat</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 25"
              value={seatPrice}
              onChangeText={(value) => {
                setSeatPrice(value);
                if (feedback) {
                  setFeedback(null);
                  setFeedbackType(null);
                }
              }}
              keyboardType="decimal-pad"
            />

            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Pickup points</Text>
            </View>

            {pickupPoints.length === 0 ? (
              <Text style={styles.helperText}>
                No pickup points yet. Add one if this trip has stops.
              </Text>
            ) : null}

            {pickupPoints.map((point, index) => (
              <View key={point.id} style={styles.pickupCard}>
                <View style={styles.pickupHeader}>
                  <Text style={styles.pickupCardLabel}>
                    {index === 0 ? "Departure point" : `Pickup ${index + 1}`}
                  </Text>
                  {index !== 0 ? (
                    <Pressable
                      style={styles.deletePickupButton}
                      onPress={() => removePickupPoint(point.id)}
                    >
                      <Text style={styles.deletePickupIcon}>🗑</Text>
                    </Pressable>
                  ) : null}
                </View>

                <TextInput
                  style={styles.pickupInput}
                  placeholder="Pickup description"
                  value={point.description}
                  onChangeText={(value) =>
                    updatePickupPoint(point.id, "description", value)
                  }
                />
                {index === 0 ? (
                  <View style={styles.pickupInput}>
                    <Text
                      style={[
                        styles.pickupInputValueText,
                        !departureTime && styles.pickupInputPlaceholderText,
                      ]}
                    >
                      {departureTime
                        ? formatTimeForDisplay(departureTime)
                        : "Set departure time above"}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Pressable
                      style={styles.pickupInput}
                      onPress={() =>
                        setActivePickupTimePickerId((current) =>
                          current === point.id ? null : point.id,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.pickupInputValueText,
                          !point.time && styles.pickupInputPlaceholderText,
                        ]}
                      >
                        {point.time
                          ? formatTimeForDisplay(point.time)
                          : "Select pickup time"}
                      </Text>
                    </Pressable>

                    {activePickupTimePickerId === point.id ? (
                      <DateTimePicker
                        value={getTimePickerValue(point.time)}
                        mode="time"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={(event, selectedTime) => {
                          if (Platform.OS === "android") {
                            setActivePickupTimePickerId(null);
                          }

                          if (event.type === "set" && selectedTime) {
                            updatePickupPoint(
                              point.id,
                              "time",
                              formatTimeToHHMM(selectedTime),
                            );
                            if (feedback) {
                              setFeedback(null);
                              setFeedbackType(null);
                            }
                          }
                        }}
                      />
                    ) : null}
                  </>
                )}
              </View>
            ))}

            {pickupTimeError ? (
              <Text style={styles.pickupTimeErrorText}>{pickupTimeError}</Text>
            ) : null}

            {isLastPickupPointComplete ? (
              <Pressable
                style={styles.pickupAddButton}
                onPress={addPickupPoint}
              >
                <Text style={styles.pickupAddIcon}>＋</Text>
              </Pressable>
            ) : null}

            {isDeparturePointComplete ? (
              <Pressable
                style={[
                  styles.primaryButton,
                  loading && styles.primaryButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={loading || loadingProfile}
              >
                <Text style={styles.primaryButtonText}>Save</Text>
              </Pressable>
            ) : (
              <Text style={styles.departurePointHintText}>
                Complete the departure point to save this trip.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f7ff",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#5b6bff",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  topActions: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 12,
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
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#132238",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 18,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    color: "#132238",
  },
  input: {
    borderWidth: 1,
    borderColor: "#dfe7ff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 15,
    color: "#132238",
  },
  inputValueText: {
    fontSize: 15,
    color: "#132238",
  },
  inputPlaceholderText: {
    color: "#94a3b8",
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  successBox: {
    backgroundColor: "#ecfdf3",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "600",
  },
  successText: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "600",
  },
  warningBox: {
    backgroundColor: "#fffbeb",
    borderColor: "#fcd34d",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  warningText: {
    color: "#92400e",
    fontSize: 13,
    fontWeight: "600",
  },
  excessBox: {
    backgroundColor: "#ecfdf3",
    borderColor: "#86efac",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  excessText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "600",
  },
  breakEvenBox: {
    backgroundColor: "#eff6ff",
    borderColor: "#93c5fd",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  breakEvenText: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "600",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#132238",
  },
  pickupCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pickupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pickupCardLabel: {
    color: "#2563eb",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  deletePickupButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
  },
  deletePickupIcon: {
    fontSize: 14,
    lineHeight: 16,
  },
  pickupInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe2f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1f2a44",
    marginBottom: 12,
  },
  pickupInputValueText: {
    fontSize: 14,
    color: "#334155",
  },
  pickupInputPlaceholderText: {
    color: "#64748b",
  },
  pickupTimeErrorText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "600",
    marginTop: -2,
    marginBottom: 8,
  },
  helperText: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 12,
  },
  pickupAddButton: {
    alignSelf: "center",
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    marginTop: 2,
    marginBottom: 8,
    shadowColor: "#2563eb",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  pickupAddIcon: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 24,
    fontWeight: "700",
  },
  departurePointHintText: {
    color: "#92400e",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: "#5b6bff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
