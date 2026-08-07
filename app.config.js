// app.config.js replaces app.json so extra values can be driven by env vars
export default {
  expo: {
    name: "Fanfares",
    slug: "fanfares",
    scheme: "fanfares",
    newArchEnabled: true,
    platforms: ["ios", "android", "web"],
    plugins: [
      "expo-router",
      "@react-native-community/datetimepicker",
      "expo-asset",
    ],
    web: { bundler: "metro" },
    extra: {
      supabaseUrl:
        process.env.EXPO_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
      supabaseAnonKey:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
    },
    orientation: "portrait",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#f4f7ff",
    },
    assetBundlePatterns: ["**/*"],
    ios: { supportsTablet: true },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/splash.png",
        backgroundColor: "#f4f7ff",
      },
    },
  },
};
