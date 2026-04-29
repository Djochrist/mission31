// ============================================================
// Mission 31 — Client Supabase (stats globales anonymes)
// ============================================================
// Variables d'environnement Vite (préfixe VITE_ obligatoire) :
//   VITE_SUPABASE_URL       = https://xxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY  = eyJhbGciOi...
//
// Si l'une des deux est absente, le module reste désactivé et
// l'app continue de fonctionner normalement en mode local.
// ============================================================

import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(URL && KEY);

export const supabase = supabaseEnabled
  ? createClient(URL, KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// Identifiant client anonyme persistant (un par appareil).
const CID_KEY = "mission31:client_id:v1";
export function clientId() {
  let id = localStorage.getItem(CID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CID_KEY, id);
  }
  return id;
}

// Upsert progression (appelé après chaque validation de lecture).
export async function syncProgress(completedCount) {
  if (!supabase) return;
  const payload = {
    client_id: clientId(),
    completed_count: completedCount,
    last_active: new Date().toISOString(),
    finished_at: completedCount >= 31 ? new Date().toISOString() : null,
  };
  try {
    await supabase
      .from("mission31_users")
      .upsert(payload, { onConflict: "client_id" });
  } catch (err) {
    console.warn("Supabase sync failed:", err);
  }
}

// Récupère les stats globales agrégées (RPC côté serveur).
export async function fetchGlobalStats() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("mission31_get_stats");
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn("Supabase stats failed:", err);
    return null;
  }
}
