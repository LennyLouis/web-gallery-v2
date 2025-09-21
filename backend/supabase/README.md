# Supabase Database Setup - Web Gallery

Configuration et gestion de la base de données avec le CLI Supabase.

## 🚀 Installation et démarrage

### Prérequis
```bash
# Installer le CLI Supabase (si pas déjà fait)
npm install -g @supabase/cli

# Installer Docker Desktop (requis pour le développement local)
```

### Commandes de base

```bash
# Démarrer Supabase en local
npm run supabase:start
# ou
supabase start

# Arrêter Supabase
npm run supabase:stop

# Voir le statut et les URLs
npm run supabase:status

# Reset complet de la DB
npm run supabase:reset
```

## 📊 Structure de la base de données

### Tables principales

#### `albums`
- **id** (UUID) : Identifiant unique
- **title** (VARCHAR) : Titre de l'album
- **description** (TEXT) : Description optionnelle
- **date** (DATE) : Date de l'album
- **tags** (TEXT[]) : Tags associés
- **location** (VARCHAR) : Lieu de prise de vue
- **is_public** (BOOLEAN) : Album public ou privé
- **owner_id** (UUID) : Référence vers auth.users
- **created_at/updated_at** : Timestamps

#### `photos`
- **id** (UUID) : Identifiant unique
- **filename** (VARCHAR) : Nom du fichier
- **original_name** (VARCHAR) : Nom original
- **file_path** (VARCHAR) : Chemin HQ
- **preview_path** (VARCHAR) : Chemin preview
- **file_size** (BIGINT) : Taille du fichier
- **mime_type** (VARCHAR) : Type MIME
- **width/height** (INTEGER) : Dimensions
- **album_id** (UUID) : Référence vers albums

#### `access_links`
- **id** (UUID) : Identifiant unique
- **token** (VARCHAR) : Token d'accès unique
- **album_id** (UUID) : Référence vers albums
- **expires_at** (TIMESTAMP) : Date d'expiration
- **is_active** (BOOLEAN) : Lien actif
- **created_by** (UUID) : Créateur du lien
- **used_count/max_uses** : Contrôle d'usage

## 🔐 Migrations et déploiement

### Développement local

```bash
# Appliquer les migrations localement
npm run supabase:migrate

# Créer une nouvelle migration
supabase migration new nom_de_la_migration

# Reset complet avec nouvelles migrations
npm run supabase:reset
```

### Déploiement en production

```bash
# Lier le projet local au projet Supabase distant
supabase link --project-ref your-project-ref

# Appliquer les migrations en production
supabase db push

# Générer les types TypeScript depuis la prod
supabase gen types typescript --project-id your-project-ref > types/database.types.ts
```

## 🔒 Sécurité (RLS)

Toutes les tables utilisent Row Level Security :

- **albums** : Les utilisateurs ne voient que leurs albums + albums publics
- **photos** : Accès via propriété d'album ou lien d'accès valide
- **access_links** : Seuls les propriétaires d'albums peuvent gérer

### Stockage

- **photos** bucket : Photos HQ (accès restreint)
- **previews** bucket : Miniatures (accès plus ouvert)
- Organisation : `user_id/album_id/photo.jpg`

## 🛠️ Commandes utiles

```bash
# Voir les logs en temps réel
supabase logs

# Accéder au Studio local
# URL affiché dans supabase status (généralement http://127.0.0.1:54323)

# Backup de la DB locale
supabase db dump > backup.sql

# Restaurer un backup
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres < backup.sql

# Générer types TypeScript (local)
npm run supabase:generate-types
```

## 📋 URLs de développement

Après `supabase start` :

- **Studio** : http://127.0.0.1:54323
- **API** : http://127.0.0.1:54321
- **DB** : postgresql://postgres:postgres@127.0.0.1:54322/postgres
- **Inbucket** (emails) : http://127.0.0.1:54324

## 🔧 Configuration

Le fichier `supabase/config.toml` contient :
- Taille max fichiers : 100MB
- JWT expiry : 1 heure
- URLs autorisées : localhost:5173 (frontend) + localhost:3000 (backend)

## 📝 Vues disponibles

- `albums_with_photo_count` : Albums avec compteur de photos
- `public_albums_view` : Albums publics avec métadonnées

## 🎯 Fonctions utilitaires

- `is_access_link_valid(token)` : Vérifie validité d'un lien d'accès
- `update_updated_at_column()` : Trigger auto pour updated_at

---

Cette configuration utilise les meilleures pratiques Supabase avec :
- ✅ Migrations versionnées
- ✅ RLS activé partout
- ✅ Types TypeScript auto-générés
- ✅ Développement local complet
- ✅ Stockage sécurisé
- ✅ Politiques granulaires