import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OrganiserDashboardScreen() {
  useEffect(() => {
    router.replace("/(organiser-tabs)/overview");
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#07111f",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
