import { createClient } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabaseConfig } from "../config/env";

export const supabase = hasSupabaseConfig
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

export { hasSupabaseConfig };

export async function writeAudit({
  eventType,
  message,
  tableName,
  recordId,
} = {}) {
  if (!supabase) {
    return { error: new Error("Supabase is not initialized") };
  }

  const result = await supabase.rpc("audit.log_event", {
    p_event_type: eventType,
    p_message: message,
    p_table_name: tableName,
    p_record_id: recordId,
  });

  if (result.error) {
    console.warn("Audit logging failed:", result.error);
  }

  return result;
}
