import { supabase } from "./supabase";

export function normalizeSerial(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export async function loadFactoryMasters() {
  if (!supabase) throw new Error("Supabase is not configured");
  const [lines, shifts] = await Promise.all([
    supabase.from("production_lines").select("id,line_code,line_name").eq("is_active", true).order("line_code"),
    supabase.from("production_shifts").select("id,shift_code,shift_name,start_time,end_time").eq("is_active", true).order("shift_code"),
  ]);
  if (lines.error) throw lines.error;
  if (shifts.error) throw shifts.error;
  return { lines: lines.data ?? [], shifts: shifts.data ?? [] };
}

export async function findExistingSerials(serials: string[]) {
  if (!supabase) throw new Error("Supabase is not configured");
  const keys = [...new Set(serials.map(normalizeSerial))];
  const found: string[] = [];
  for (let i = 0; i < keys.length; i += 500) {
    const { data, error } = await supabase.from("serial_registry").select("serial_key").in("serial_key", keys.slice(i, i + 500));
    if (error) throw error;
    found.push(...(data ?? []).map((row) => row.serial_key));
  }
  return found;
}
