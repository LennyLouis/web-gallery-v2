# Web Gallery v2 - Spécifications Techniques Détaillées

## 📋 Vue d'ensemble du Projet

**Nom** : Web Gallery v2  
**Version** : 1.1.0  
**Type** : Application web full-stack de galerie photo  
**Architecture** : SPA (Single Page Application) + API REST  
**Déploiement** : Containerisé (Docker)  

### Objectif
Galerie photo moderne avec système de partage granulaire, gestion des permissions utilisateurs et interface d'administration complète.

### ✨ Nouveautés v1.1.0 (Décembre 2024)
- **Cover Photos** : Support complet des photos de couverture avec URLs S3 signées
- **Interface Admin** : Nouvelle interface d'administration complète
- **URLs S3 Dynamiques** : Génération automatique d'URLs signées pour les previews
- **Améliorations UX** : Interface utilisateur modernisée avec Bootstrap 5.3

---

## 🏗️ Architecture Système

### Vue d'ensemble
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │   Database      │
│   React/Remix   │◄──►│   Node.js/API    │◄──►│   Supabase      │
│   Port 3000     │    │   Port 5000      │    │   PostgreSQL    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                ▲
                                │
                       ┌────────────────┐
                       │   Storage S3   │
                       │   Minio/AWS    │
                       │   Port 9000    │
                       └────────────────┘
```

### Flux de données
1. **Upload** : Frontend → API → S3 Storage → Database
2. **Visualisation** : Frontend → API → Database → S3 (URLs signées)
3. **Partage** : API génère tokens → Database → Frontend affiche liens
4. **Téléchargement** : Frontend → API → S3 → ZIP Stream → Client

---

## 🎯 Backend - API Node.js

### Stack Technique
- **Runtime** : Node.js 18+
- **Framework** : Express.js 4.18+
- **Base de données** : Supabase (PostgreSQL 15)
- **ORM/Query Builder** : Supabase Client SDK
- **Authentification** : Supabase Auth + JWT
- **Stockage** : AWS S3 SDK v3 (compatible Minio)
- **Documentation** : Swagger/OpenAPI 3.0
- **Upload** : Multer + Sharp (redimensionnement)
- **Compression** : Archiver (création ZIP)

### Structure des Dossiers
```
backend/
├── app/
│   ├── controllers/         # Logique métier
│   │   ├── authController.js
│   │   ├── albumController.js
│   │   ├── photoController.js
│   │   ├── accessLinkController.js
│   │   └── userController.js
│   ├── models/             # Modèles de données
│   │   ├── Album.js
│   │   ├── Photo.js
│   │   ├── AccessLink.js
│   │   └── UserAlbumPermission.js
│   ├── routes/             # Définition routes API
│   │   ├── authRoutes.js
│   │   ├── albumRoutes.js
│   │   ├── photoRoutes.js
│   │   └── accessLinkRoutes.js
│   ├── middleware/         # Middlewares
│   │   ├── auth.js         # JWT + Access Token Auth
│   │   ├── upload.js       # Multer + validation
│   │   └── validation.js   # Schémas Joi
│   ├── utils/              # Utilitaires
│   │   └── s3Storage.js    # Configuration S3
│   └── config/             # Configuration
│       ├── database.js     # Supabase clients
│       ├── index.js        # Variables env
│       └── swagger.js      # Doc API
├── scripts/                # Scripts utilitaires
│   ├── create-admin.js
│   └── test-s3.js
└── server.js              # Point d'entrée
```

### API Endpoints

#### Authentification (`/api/auth`)
- `POST /login` - Connexion (email/password)
- `POST /register` - Inscription utilisateur
- `POST /refresh` - Renouvellement token JWT
- `POST /logout` - Déconnexion
- `GET /profile` - Informations utilisateur

#### Albums (`/api/albums`)
- `GET /` - Liste albums accessibles (permissions) + cover photos URLs
- `POST /` - Création album
- `GET /public` - Albums publics + cover photos URLs
- `GET /:id` - Détails album + photos
- `PUT /:id` - Modification album (support cover_photo_id)
- `DELETE /:id` - Suppression album + cascade
- `GET /:id/users` - Utilisateurs avec permissions
- `PUT /:id/cover` - Définition photo de couverture

#### Photos (`/api/photos`)
- `GET /album/:id` - Photos d'un album (+ ?access_token=)
- `POST /upload/:albumId` - Upload multiple avec processing
- `POST /download` - Téléchargement ZIP multiple
- `GET /:id` - Détails photo individuelle
- `DELETE /:id` - Suppression photo + fichiers S3

#### Liens d'Accès (`/api/access-links`)
- `GET /:albumId` - Liens existants d'un album
- `POST /` - Création lien avec permissions
- `POST /validate` - Validation token d'accès
- `DELETE /:id` - Suppression lien d'accès

#### Permissions (`/api/permissions`)
- `GET /:albumId/users` - Permissions utilisateurs album
- `POST /` - Accordage permission utilisateur
- `PUT /:id` - Modification permission
- `DELETE /:id` - Révocation permission

### Système d'Authentification

#### Types d'authentification
1. **JWT Token** : Utilisateurs connectés
   ```javascript
   Authorization: Bearer <jwt_token>
   ```

2. **Access Token** : Accès public via liens
   ```javascript
   ?access_token=<crypto_token>
   ```

#### Middleware d'authentification
```javascript
// Authentification utilisateur uniquement
authenticateToken(req, res, next)

// Dual auth : JWT OU Access Token
authenticateTokenOrAccessToken(req, res, next)

// Vérification permissions granulaires
requirePermission('view|download|manage')
```

#### Permissions hiérarchiques
- `view` : Visualisation photos
- `download` : Téléchargement + view
- `manage` : Gestion complète + download + view

### Base de Données (Supabase)

#### Schéma des Tables

**users** (géré par Supabase Auth)
```sql
- id (UUID, PK)
- email (TEXT, UNIQUE)
- user_metadata (JSONB)
  - role: 'admin' | 'user'
  - full_name: TEXT
```

**albums**
```sql
- id (UUID, PK, DEFAULT gen_random_uuid())
- title (TEXT, NOT NULL)
- description (TEXT)
- date (DATE)
- tags (TEXT[])
- location (TEXT)
- is_public (BOOLEAN, DEFAULT false)
- owner_id (UUID, FK → auth.users.id)
- cover_photo_id (UUID, FK → photos.id)
- created_at (TIMESTAMPTZ, DEFAULT now())
- updated_at (TIMESTAMPTZ, DEFAULT now())
```

**photos**
```sql
- id (UUID, PK, DEFAULT gen_random_uuid())
- album_id (UUID, FK → albums.id, CASCADE)
- filename (TEXT, NOT NULL)
- original_name (TEXT)
- file_path (TEXT, NOT NULL)
- preview_path (TEXT)
- file_size (BIGINT)
- mime_type (TEXT)
- width (INTEGER)
- height (INTEGER)
- created_at (TIMESTAMPTZ, DEFAULT now())
```

**access_links**
```sql
- id (UUID, PK, DEFAULT gen_random_uuid())
- album_id (UUID, FK → albums.id, CASCADE)
- token (TEXT, UNIQUE, NOT NULL)
- permission_type ('view' | 'download')
- expires_at (TIMESTAMPTZ)
- max_uses (INTEGER)
- used_count (INTEGER, DEFAULT 0)
- is_active (BOOLEAN, DEFAULT true)
- created_by (UUID, FK → auth.users.id)
- created_at (TIMESTAMPTZ, DEFAULT now())
- updated_at (TIMESTAMPTZ, DEFAULT now())
```

**user_album_permissions**
```sql
- id (UUID, PK, DEFAULT gen_random_uuid())
- user_id (UUID, FK → auth.users.id)
- album_id (UUID, FK → albums.id, CASCADE)
- permission_type ('view' | 'download' | 'manage')
- granted_by (UUID, FK → auth.users.id)
- granted_at (TIMESTAMPTZ, DEFAULT now())
- expires_at (TIMESTAMPTZ)
- is_active (BOOLEAN, DEFAULT true)
```

#### Row Level Security (RLS)
Toutes les tables ont des politiques RLS activées :
- Albums : Propriétaire + permissions explicites
- Photos : Via permissions album
- Access Links : Propriétaire album uniquement
- Permissions : Propriétaire album + self-read

#### Fonctions Database
```sql
-- Validation des liens d'accès
is_access_link_valid(link_token TEXT) RETURNS BOOLEAN

-- Vérification permissions utilisateur
user_has_album_permission(user_uuid UUID, album_uuid UUID, required_permission TEXT) RETURNS BOOLEAN
```

### Stockage S3

#### Configuration
```javascript
// Compatible AWS S3, Minio, DigitalOcean Spaces
{
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  },
  forcePathStyle: true // Pour Minio
}
```

#### Buckets
- `photos` : Images originales
- `previews` : Miniatures (max 800px)

#### Gestion des fichiers
- **Upload** : Multipart avec validation taille/type
- **Nommage** : `album_id/photo_id_timestamp.ext`
- **URLs signées** : Expiration 1h pour sécurité
- **Compression** : Miniatures JPEG qualité 85%

---

## 🎨 Frontend - React Application

### Stack Technique
- **Framework** : React Router v7 (ex-Remix)
- **Language** : TypeScript 5.0+
- **Build Tool** : Vite 5.0+
- **UI Library** : React Bootstrap 2.9+
- **Styling** : Bootstrap CSS 5.3 + Custom CSS
- **State Management** : React Context + useState/useEffect
- **HTTP Client** : Axios
- **Routing** : React Router v7 file-based

### Structure des Dossiers
```
web-frontend/
├── app/
│   ├── routes/                 # Pages (file-based routing)
│   │   ├── _index.tsx         # Page d'accueil
│   │   ├── login.tsx          # Authentification
│   │   ├── dashboard.tsx      # Dashboard utilisateur
│   │   ├── album.$id.tsx      # Visualisation album
│   │   └── admin/             # Interface admin
│   │       ├── album.$id.tsx  # Admin album
│   │       └── _index.tsx     # Dashboard admin
│   ├── contexts/              # Contextes React
│   │   └── AuthContext.tsx    # Gestion auth globale
│   ├── hooks/                 # Hooks personnalisés
│   │   ├── useAuth.ts
│   │   └── useApi.ts
│   ├── lib/                   # Utilitaires
│   │   ├── apiClient.ts       # Client API Axios
│   │   ├── supabase.ts        # Config Supabase
│   │   └── types.ts           # Types TypeScript
│   ├── components/            # Composants réutilisables
│   │   ├── Navbar.tsx
│   │   ├── PhotoGallery.tsx
│   │   └── UploadModal.tsx
│   ├── app.css               # Styles globaux
│   └── root.tsx              # Layout racine
├── public/                    # Assets statiques
│   ├── favicon.ico
│   └── logo-*.png
├── vite.config.ts            # Configuration Vite
├── tsconfig.json             # Configuration TypeScript
└── package.json              # Dépendances
```

### Authentification Frontend

#### AuthContext
```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isSessionValid: () => boolean;
}
```

#### Gestion des tokens
- **Stockage** : localStorage pour persistence
- **Rafraîchissement** : Automatique avant expiration
- **Invalidation** : Nettoyage sur erreurs 401/403

### Pages Principales

#### Page d'accueil (`/_index.tsx`)
- Présentation de l'application
- Liste des albums publics
- Accès sans authentification

#### Authentification (`/login.tsx`)
- Formulaire connexion/inscription
- Validation côté client
- Redirection post-auth

#### Dashboard (`/dashboard.tsx`)
- Liste albums personnels
- Statistiques utilisateur
- Actions rapides (créer album, etc.)

#### Visualisation Album (`/album.$id.tsx`)
- **Multi-mode** : Authentifié, Access Token, Public
- Galerie responsive avec lightbox
- Sélection multiple pour téléchargement
- Boutons contextuels selon permissions

#### Administration (`/admin/album.$id.tsx`)
- Gestion métadonnées album
- Création/gestion liens d'accès
- Gestion permissions utilisateurs
- Upload de photos

### Composants Clés

#### PhotoGallery
```typescript
interface PhotoGalleryProps {
  photos: Photo[];
  onPhotoSelect?: (photo: Photo) => void;
  selectable?: boolean;
  selectedPhotos?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}
```

#### UploadModal
- Drag & drop interface
- Prévisualisation avant upload
- Progress bar avec gestion d'erreurs
- Validation fichiers côté client

#### Lightbox
- Navigation clavier (←→)
- Zoom et pan
- Informations métadonnées
- Actions contextuelles

### Client API

#### Configuration Axios
```typescript
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000, // 30s pour uploads
});

// Intercepteurs pour auth automatique
apiClient.interceptors.request.use(addAuthHeader);
apiClient.interceptors.response.use(null, handleAuthErrors);
```

#### Types TypeScript
```typescript
interface Album {
  id: string;
  title: string;
  description?: string;
  date?: string;
  tags: string[];
  location?: string;
  is_public: boolean;
  owner_id: string;
  cover_photo_id?: string;
  photos?: Photo[];
  user_permissions?: Permission[];
}

interface Photo {
  id: string;
  album_id: string;
  filename: string;
  original_name?: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  download_url?: string;
  preview_url?: string;
}

interface AccessLink {
  id: string;
  album_id: string;
  token: string;
  permission_type: 'view' | 'download';
  expires_at?: string;
  max_uses?: number;
  used_count: number;
  is_active: boolean;
}
```

---

## 🔧 Configuration et Déploiement

### Variables d'Environnement

#### Backend (.env)
```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# S3 Storage
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=web-gallery
S3_REGION=us-east-1

# Server
PORT=5000
NODE_ENV=production
```

#### Frontend (.env)
```bash
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

### Docker Configuration

#### docker-compose.yml
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports: ["5000:5000"]
    env_file: .env
    depends_on: [minio]
    
  frontend:
    build: ./web-frontend
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [backend]
    
  minio:
    image: minio/minio:latest
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes: ["minio_data:/data"]
```

### Scripts de Déploiement

#### setup.sh
```bash
#!/bin/bash
# Configuration initiale du projet

# 1. Copier les variables d'environnement
cp .env.example .env

# 2. Installer les dépendances
cd backend && npm install
cd ../web-frontend && npm install

# 3. Appliquer les migrations Supabase
cd ../backend && npx supabase db push

# 4. Créer les buckets S3
npm run setup-storage

# 5. Démarrer les services
cd .. && docker-compose up -d
```

---

## 🔒 Sécurité

### Authentification & Autorisation
- **JWT** avec expiration courte (1h)
- **Refresh tokens** sécurisés (7 jours)
- **RLS** activé sur toutes les tables sensibles
- **Validation** double : client + serveur
- **CORS** configuré pour domaines autorisés

### Upload & Stockage
- **Validation fichiers** : type MIME + extension
- **Limite taille** : 10MB par photo
- **Scan antivirus** : À implémenter (ClamAV)
- **URLs signées** S3 avec expiration
- **Chiffrement** au repos (S3 encryption)

### Protection des Données
- **HTTPS** obligatoire en production
- **Rate limiting** sur API (express-rate-limit)
- **Sanitization** des entrées utilisateur
- **Logs** sans données sensibles
- **Backup** automatique database

### Tokens d'Accès
- **Génération cryptographique** (crypto.randomBytes)
- **Limitation usage** (max_uses, expires_at)
- **Révocation** possible à tout moment
- **Audit trail** des accès

---

## 📊 Performance & Optimisation

### Backend
- **Connection pooling** Supabase
- **Lazy loading** des relations
- **Pagination** des listes importantes
- **Compression** gzip des réponses
- **Caching** des URLs signées S3

### Frontend
- **Code splitting** automatique (Vite)
- **Lazy loading** des routes
- **Image optimization** avec lazy loading
- **Bundle analysis** avec rollup-plugin-analyzer
- **Service Worker** pour cache statique

### Stockage
- **Thumbnails** pré-générées
- **CDN** pour assets statiques (à configurer)
- **Compression** images (Sharp)
- **Progressive JPEG** pour meilleure UX

---

## 🧪 Tests & Qualité

### Tests API (Bruno)
```
api-testing/
├── environments/
│   ├── development.bru
│   └── production.bru
├── Auth/
│   ├── Login.bru
│   ├── Register.bru
│   └── Refresh.bru
├── Albums/
│   ├── Create.bru
│   ├── GetAll.bru
│   └── Update.bru
└── Photos/
    ├── Upload.bru
    └── Download.bru
```

### Scripts de Test
```bash
# Tests API complets
cd api-testing && bru run --env development

# Test connexion S3
cd backend && npm run test-s3

# Test création admin
cd backend && npm run create-admin
```

### Métriques & Monitoring
- **Logs structurés** avec Winston
- **Health checks** endpoints
- **Métriques usage** liens d'accès
- **Performance monitoring** avec collecte metrics
- **Error tracking** avec Sentry (à configurer)

---

## 🚀 Roadmap Technique

### v1.1 - Q4 2025
- [ ] **Tests unitaires** Jest + Supertest
- [ ] **CI/CD** GitHub Actions
- [ ] **Monitoring** Prometheus + Grafana
- [ ] **Cache Redis** pour sessions
- [ ] **Search** Elasticsearch pour photos

### v1.2 - Q1 2026
- [ ] **Microservices** split API
- [ ] **WebSockets** notifications temps réel
- [ ] **ML** classification automatique photos
- [ ] **CDN** CloudFlare pour assets
- [ ] **API publique** avec rate limiting

### v2.0 - Q2 2026
- [ ] **Mobile app** React Native
- [ ] **Desktop app** Electron
- [ ] **Plugin système** intégrations tierces
- [ ] **Analytics** dashboard avancé
- [ ] **Multi-tenant** support

---

## 📚 Documentation Technique

### Standards Code
- **ESLint** + **Prettier** pour formatage
- **TypeScript strict** mode activé
- **Conventional Commits** pour git
- **JSDoc** pour documentation fonctions
- **OpenAPI 3.0** pour documentation API

### Architecture Decisions Records (ADR)
- **ADR-001** : Choix Supabase vs PostgreSQL direct
- **ADR-002** : React Router v7 vs Next.js
- **ADR-003** : S3 vs système fichiers local
- **ADR-004** : JWT vs sessions serveur
- **ADR-005** : Monorepo vs repositories séparés

### Performance Benchmarks
- **API Response Time** : < 200ms (p95)
- **Image Upload** : < 5s pour 10MB
- **ZIP Download** : < 10s pour 100 photos
- **Page Load** : < 2s (LCP)
- **Bundle Size** : < 500KB initial

---

*Dernière mise à jour : 23 septembre 2025*  
*Version du document : 1.0.0*