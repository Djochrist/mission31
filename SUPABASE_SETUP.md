# 🟢 Connecter Mission 31 à Supabase

Mission 31 fonctionne **100% hors ligne** sans aucune configuration. Si tu veux activer les **statistiques globales en temps réel** (nombre d'utilisateurs, missions terminées, taux de complétion), il faut connecter une base **Supabase**. C'est gratuit jusqu'à 50 000 utilisateurs actifs / mois.

> ⚠️ **Aucune donnée personnelle n'est envoyée à Supabase**. Seul un identifiant anonyme généré aléatoirement par appareil (UUID) et un compteur de jours validés sont synchronisés.

---

## 1. Créer un projet Supabase

1. Va sur [supabase.com](https://supabase.com) et crée un compte gratuit.
2. Clique sur **New Project** → choisis un nom (ex. `mission-31`), une région proche, et un mot de passe pour la base.
3. Attends ~1 minute que le projet soit prêt.

## 2. Créer la table & la fonction d'agrégation

Dans ton projet Supabase, ouvre **SQL Editor** et exécute ce script :

```sql
-- Table : un utilisateur anonyme par appareil
create table if not exists public.mission31_users (
  client_id    uuid primary key,
  created_at   timestamptz not null default now(),
  last_active  timestamptz not null default now(),
  completed_count int not null default 0,
  finished_at  timestamptz
);

-- Index pour les agrégations rapides
create index if not exists mission31_users_finished_idx
  on public.mission31_users (finished_at)
  where finished_at is not null;

-- Activer Row Level Security
alter table public.mission31_users enable row level security;

-- Politique : un anonyme peut INSÉRER son propre enregistrement
create policy "anon insert own"
  on public.mission31_users
  for insert
  to anon
  with check (true);

-- Politique : un anonyme peut METTRE À JOUR n'importe quelle ligne
-- (l'app utilise client_id comme clé d'upsert ; pas d'auth donc pas de filtre fin possible)
create policy "anon update"
  on public.mission31_users
  for update
  to anon
  using (true)
  with check (true);

-- Aucune politique SELECT : on bloque la lecture des lignes individuelles.
-- Les stats globales passent uniquement par la fonction sécurisée ci-dessous.

-- Fonction RPC : retourne uniquement les agrégats (jamais les lignes)
create or replace function public.mission31_get_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_users',        count(*)::int,
    'completed_missions', count(*) filter (where completed_count >= 31)::int,
    'completion_rate',
      case when count(*) > 0
        then round(100.0 * count(*) filter (where completed_count >= 31) / count(*), 1)
        else 0
      end
  )
  from public.mission31_users;
$$;

grant execute on function public.mission31_get_stats() to anon;
```

## 3. Récupérer les clés API

Dans Supabase :

1. **Settings** → **API**
2. Copie ces deux valeurs :
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon / public key** → commence par `eyJ...`

> 💡 La clé `anon` est conçue pour être publique. Elle sera incluse dans le bundle JavaScript de l'app — c'est normal et sans risque tant que la RLS est activée (étape 2).

## 4. Configurer les variables d'environnement

### En local (développement)

Crée un fichier `.env` à la racine de `artifacts/mission31/` :

```bash
cp .env.example .env
# puis édite .env avec tes vraies valeurs
```

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Redémarre le dev server pour qu'il recharge les variables.

### Sur Vercel (production)

1. Ouvre ton projet sur [vercel.com](https://vercel.com)
2. **Settings** → **Environment Variables**
3. Ajoute :
   - `VITE_SUPABASE_URL` = `https://xxxxx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOi...`
4. Coche **Production**, **Preview** et **Development**
5. Redéploie le projet (**Deployments** → dernier déploiement → **Redeploy**)

## 5. Vérification

- Ouvre l'app : ton appareil est **automatiquement enregistré** au premier chargement (silencieusement, juste un UUID).
- Va dans **Stats** → **Voir les stats globales**.
- Tu devrais voir le nombre réel d'utilisateurs (au minimum **1** : toi).
- Si tu vois "Stats globales indisponibles" → les variables d'environnement ne sont pas chargées. Vérifie l'orthographe et redéploie.
- Si tu vois "Données indisponibles" → les variables sont chargées mais la fonction RPC n'est pas en place. Réexécute l'étape 2 dans le SQL Editor.

## 6. (Optionnel) Synchronisation multi-appareils

Pour permettre à un utilisateur de retrouver sa progression sur téléphone + tablette, il faut stocker la progression détaillée et l'horodatage. Ajoute la colonne suivante :

```sql
alter table public.mission31_users
  add column if not exists progress jsonb,
  add column if not exists last_synced_at timestamptz;
```

L'app envoie déjà `last_active`. La logique de fusion ("le plus récent gagne") peut être ajoutée côté client en récupérant l'enregistrement par `client_id` au démarrage, mais cela demande une politique SELECT spécifique (ou une RPC dédiée par `client_id`). Voir les notes en fin de README.

## 🔒 Sécurité & vie privée

- Aucune donnée personnelle n'est envoyée (pas d'email, pas de nom, pas de localisation, pas de tracking).
- L'identifiant `client_id` est un UUID v4 généré localement et stocké dans le `localStorage`. Si l'utilisateur efface ses données du navigateur, un nouveau `client_id` sera créé.
- La fonction `mission31_get_stats()` est `security definer` : elle retourne uniquement des **agrégats** (compteurs), jamais les lignes individuelles. Aucune politique `SELECT` n'est définie sur la table elle-même, donc aucun client ne peut lire les enregistrements bruts.
- La clé `anon` ne permet **que** d'insérer/mettre à jour la table `mission31_users` et d'appeler la fonction `mission31_get_stats`. Tout le reste est bloqué par RLS.

## ❓ Désactiver Supabase

Supprime simplement les variables d'environnement (ou laisse `.env` vide). L'app continuera à fonctionner normalement, et la page "Stats globales" affichera "Stats globales indisponibles" au lieu d'erreurs.
