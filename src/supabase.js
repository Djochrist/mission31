// ============================================================
// Mission 31 : Client Supabase (visiteurs, installations et progression anonymes)
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

// Enregistre l'utilisateur dès le premier lancement de l'app.
const REG_KEY = "mission31:registered:v1";
export async function registerUser(daysCompleted = 0) {
  if (!supabase) return false;
  const normalizedCompleted = Math.max(0, Math.min(31, Number(daysCompleted) || 0));

  try {
    const { error } = await supabase
      .from("mission31_users")
      .upsert(
        {
          client_id: clientId(),
          days_completed: normalizedCompleted,
          completed: normalizedCompleted >= 31,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" },
      );
    if (error) {
      console.warn("Supabase register failed:", error);
      return false;
    }
    localStorage.setItem(REG_KEY, "1");
    return true;
  } catch (err) {
    console.warn("Supabase register failed:", err);
    return false;
  }
}

// Upsert progression (appelé après chaque validation de lecture).
export async function syncProgress(completedCount) {
  if (!supabase) return;
  const payload = {
    client_id: clientId(),
    days_completed: completedCount,
    completed: completedCount >= 31,
    updated_at: new Date().toISOString(),
  };
  try {
    await supabase
      .from("mission31_users")
      .upsert(payload, { onConflict: "client_id" });
    localStorage.setItem(REG_KEY, "1");
  } catch (err) {
    console.warn("Supabase sync failed:", err);
  }
}

// Marque l'installation PWA quand le navigateur expose l'événement.
export async function markInstalled() {
  if (!supabase) return;
  try {
    await supabase
      .from("mission31_users")
      .upsert(
        {
          client_id: clientId(),
          installed: true,
          installed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" },
      );
    localStorage.setItem(REG_KEY, "1");
  } catch (err) {
    console.warn("Supabase install sync failed:", err);
  }
}

// Récupère les stats agrégées (RPC côté serveur).
// Retourne { total_users, installed_users, completed_missions, completion_rate } ou null.
export async function fetchGlobalStats() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("mission31_get_stats");
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.warn("Supabase stats failed:", err);
    return null;
  }
}
