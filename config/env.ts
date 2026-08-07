import Constants from "expo-constants";

declare const process: { env: Record<string, string | undefined> };

const expoConfig = Constants.expoConfig as
  | {
      extra?: {
        supabaseUrl?: string;
        supabaseAnonKey?: string;
      };
    }
  | undefined;

const envValues = {
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    (expoConfig?.extra?.supabaseUrl as string | undefined) ||
    "",
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    (expoConfig?.extra?.supabaseAnonKey as string | undefined) ||
    "",
};

export const supabaseConfig = {
  url: envValues.supabaseUrl,
  anonKey: envValues.supabaseAnonKey,
};

export const hasSupabaseConfig = Boolean(
  supabaseConfig.url && supabaseConfig.anonKey,
);
