import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type DashboardSettingsMenuProps = {
  onChangePassword: () => void;
  onEditProfile: () => void;
  onSignOut: () => void;
};

export default function DashboardSettingsMenu({
  onChangePassword,
  onEditProfile,
  onSignOut,
}: DashboardSettingsMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        onPress={() => setOpen((current) => !current)}
      >
        <View style={styles.icon}>
          <View style={styles.iconBar} />
          <View style={styles.iconBar} />
          <View style={styles.iconBar} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.menu}>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setOpen(false);
              onChangePassword();
            }}
          >
            <Text style={styles.menuItemText}>Change password</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setOpen(false);
              onEditProfile();
            }}
          >
            <Text style={styles.menuItemText}>Edit profile</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <Text style={styles.menuItemText}>Sign out</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 9999,
    elevation: 999,
    overflow: "visible",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d7def0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1f2a44",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  pressed: {
    opacity: 0.8,
  },
  icon: {
    width: 18,
    gap: 3,
    alignItems: "stretch",
  },
  iconBar: {
    height: 2,
    borderRadius: 999,
    backgroundColor: "#1f2a44",
  },
  menu: {
    position: "absolute",
    top: 48,
    right: 0,
    zIndex: 10000,
    minWidth: 190,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5eaf3",
    paddingVertical: 8,
    shadowColor: "#1f2a44",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1000,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    color: "#1f2a44",
    fontSize: 14,
    fontWeight: "600",
  },
});
