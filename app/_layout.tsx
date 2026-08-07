import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

export default function RootLayout() {
  const [authReady, setAuthReady] = useState(false);
  const supabaseClient = supabase;

  useEffect(() => {
    if (!hasSupabaseConfig || !supabaseClient) {
      setAuthReady(true);
      return;
    }
    let isMounted = true;

    const loadSession = async () => {
      await supabaseClient.auth.getSession();
      if (isMounted) {
        setAuthReady(true);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange(() => {
      if (isMounted) {
        setAuthReady(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!authReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="select-role" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="organiser-dashboard" />
        <Stack.Screen name="customer_dashboard" />
        <Stack.Screen name="add-trip" />
        <Stack.Screen name="book-trip" />
        <Stack.Screen name="booking-summary" />
        <Stack.Screen name="trip-actions" />
        <Stack.Screen name="trip-bookings" />
        <Stack.Screen name="run-trip" />
        <Stack.Screen name="trip-reports" />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f7fb",
  },
});
