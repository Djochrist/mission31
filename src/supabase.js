// ============================================================
// Mission 31 : Client Supabase (visiteurs et progression anonymes)
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

// Enregistre l'utilisateur dès le premier lancement de l'app
// (ne touche pas à completed_count s'il existe déjà).
const REG_KEY = "mission31:registered:v1";
export async function registerUser() {
  if (!supabase) return;
  if (localStorage.getItem(REG_KEY) === "1") {
    // Déjà enregistré : on met juste à jour last_active.
    try {
      await supabase
        .from("mission31_users")
        .update({ last_active: new Date().toISOString() })
        .eq("client_id", clientId());
    } catch (err) {
      console.warn("Supabase touch failed:", err);
    }
    return;
  }
  try {
    const { error } = await supabase
      .from("mission31_users")
      .upsert(
        {
          client_id: clientId(),
          last_active: new Date().toISOString(),
          completed_count: 0,
        },
        { onConflict: "client_id", ignoreDuplicates: true },
      );
    if (!error) localStorage.setItem(REG_KEY, "1");
    else console.warn("Supabase register failed:", error);
  } catch (err) {
    console.warn("Supabase register failed:", err);
  }
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
    localStorage.setItem(REG_KEY, "1");
  } catch (err) {
    console.warn("Supabase sync failed:", err);
  }
}

// Récupère les stats agrégées (RPC côté serveur).
// Retourne { total_users, completed_missions, completion_rate } ou null.
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
