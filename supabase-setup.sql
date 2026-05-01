-- ============================================================
-- Mission 31 — Setup Supabase (à exécuter dans le SQL Editor)
-- ============================================================

-- 1. Table principale des utilisateurs
-- ============================================================
CREATE TABLE IF NOT EXISTS mission31_users (
  client_id     UUID PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  days_completed INT NOT NULL DEFAULT 0 CHECK (days_completed >= 0 AND days_completed <= 31),
  completed_count INT NOT NULL DEFAULT 0,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  finished_at   TIMESTAMPTZ,
  installed     BOOLEAN NOT NULL DEFAULT FALSE,
  installed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour accélérer les agrégats
CREATE INDEX IF NOT EXISTS idx_mission31_users_completed ON mission31_users (completed);
CREATE INDEX IF NOT EXISTS idx_mission31_users_installed ON mission31_users (installed);

-- 2. Row Level Security (RLS)
-- ============================================================
ALTER TABLE mission31_users ENABLE ROW LEVEL SECURITY;

-- Chaque client peut lire/écrire uniquement sa propre ligne.
-- L'identifiant client est stocké dans le token JWT custom claim "client_id"
-- ou, pour les utilisateurs anonymes, passé directement.
-- Comme il n'y a pas d'auth, on autorise toutes les opérations sur la table
-- (chaque ligne est identifiée par un UUID aléatoire généré côté client).

DROP POLICY IF EXISTS "allow_anon_upsert" ON mission31_users;
CREATE POLICY "allow_anon_upsert" ON mission31_users
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_service_all" ON mission31_users;
CREATE POLICY "allow_service_all" ON mission31_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Fonction RPC : mission31_get_stats
-- ============================================================
CREATE OR REPLACE FUNCTION mission31_get_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total       INT;
  v_installed   INT;
  v_completed   INT;
  v_rate        NUMERIC;
BEGIN
  SELECT
    COUNT(*)                                       INTO v_total
  FROM mission31_users;

  SELECT
    COUNT(*) FILTER (WHERE installed = TRUE)       INTO v_installed
  FROM mission31_users;

  SELECT
    COUNT(*) FILTER (WHERE completed = TRUE)       INTO v_completed
  FROM mission31_users;

  IF v_total > 0 THEN
    v_rate := ROUND((v_completed::NUMERIC / v_total) * 100, 1);
  ELSE
    v_rate := NULL;
  END IF;

  RETURN json_build_object(
    'total_users',         v_total,
    'installed_users',     v_installed,
    'completed_missions',  v_completed,
    'completion_rate',     v_rate
  );
END;
$$;

-- Accès anonyme à la fonction
GRANT EXECUTE ON FUNCTION mission31_get_stats() TO anon;
GRANT EXECUTE ON FUNCTION mission31_get_stats() TO authenticated;

-- 4. Trigger : mise à jour de last_active automatiquement
-- ============================================================
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.last_active = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mission31_last_active ON mission31_users;
CREATE TRIGGER trg_mission31_last_active
  BEFORE INSERT OR UPDATE ON mission31_users
  FOR EACH ROW EXECUTE FUNCTION update_last_active();

-- ============================================================
-- Vérification : doit retourner { total_users: 0, ... }
-- SELECT mission31_get_stats();
-- ============================================================
