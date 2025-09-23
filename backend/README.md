# Web Gallery Backend

API REST pour la galerie photo Web Gallery v2 avec authentification et gestion des permissions.

## 🛠️ Technologies

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Base de données**: Supabase (PostgreSQL)
- **Authentification**: Supabase Auth + JWT
- **Stockage**: S3 compatible (Minio/AWS S3)
- **Documentation**: Swagger/OpenAPI

## 🚀 Démarrage

### Installation des dépendances
```bash
npm install
```

### Configuration
Créer un fichier `.env` à la racine du projet :
```bash
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# S3 Storage
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=web-gallery
S3_REGION=us-east-1

# Server
PORT=5000
NODE_ENV=development
```

### Développement
```bash
npm run dev
```
API disponible sur `http://localhost:5000`

### Production
```bash
npm start
```

### Documentation API
Accessible sur `http://localhost:5000/api-docs`

## 📁 Structure

```
app/
├── controllers/        # Logique métier
│   ├── authController.js
│   ├── albumController.js
│   ├── photoController.js
│   └── accessLinkController.js
├── models/            # Modèles de données
│   ├── Album.js
│   ├── Photo.js
│   ├── AccessLink.js
│   └── UserAlbumPermission.js
├── routes/            # Définition des routes
│   ├── authRoutes.js
│   ├── albumRoutes.js
│   ├── photoRoutes.js
│   └── accessLinkRoutes.js
├── middleware/        # Middlewares
│   ├── auth.js        # Authentification JWT/Access Token
│   ├── upload.js      # Gestion upload fichiers
│   └── validation.js  # Validation des données
├── utils/             # Utilitaires
│   └── s3Storage.js   # Configuration S3
├── config/            # Configuration
│   ├── database.js    # Connexion Supabase
│   ├── index.js       # Configuration générale
│   └── swagger.js     # Documentation API
└── server.js          # Point d'entrée
```

## 🔧 API Endpoints

### Authentification (`/api/auth`)
- `POST /login` - Connexion utilisateur
- `POST /register` - Inscription utilisateur  
- `POST /refresh` - Renouvellement token
- `POST /logout` - Déconnexion
- `GET /profile` - Profil utilisateur

### Albums (`/api/albums`)
- `GET /` - Liste des albums accessibles
- `POST /` - Créer un album
- `GET /public` - Albums publics
- `GET /:id` - Détails d'un album
- `PUT /:id` - Modifier un album
- `DELETE /:id` - Supprimer un album
- `GET /:id/users` - Utilisateurs avec accès

### Photos (`/api/photos`)
- `GET /album/:id` - Photos d'un album (avec `?access_token=`)
- `POST /upload/:albumId` - Upload de photos
- `POST /download` - Téléchargement multiple (ZIP)
- `GET /:id` - Détails d'une photo
- `DELETE /:id` - Supprimer une photo

### Liens d'Accès (`/api/access-links`)
- `GET /:albumId` - Liens d'un album
- `POST /` - Créer un lien d'accès
- `POST /validate` - Valider un token d'accès
- `DELETE /:id` - Supprimer un lien

### Permissions (`/api/permissions`)
- `GET /:albumId/users` - Permissions utilisateurs
- `POST /` - Accorder une permission
- `PUT /:id` - Modifier une permission
- `DELETE /:id` - Révoquer une permission

## 🔒 Authentification & Sécurité

### Types d'authentification supportés
1. **JWT Token** : Pour les utilisateurs connectés
2. **Access Token** : Pour l'accès public via liens partagés

### Middleware d'authentification
- `authenticateToken` : Vérifie le JWT utilisateur
- `authenticateTokenOrAccessToken` : Supporte les deux modes
- `requirePermission(action)` : Vérifie les permissions (view/download/manage)

### Système de permissions
- **view** : Visualisation des photos
- **download** : Téléchargement des photos 
- **manage** : Gestion complète de l'album

## 📊 Base de Données

### Tables principales
- `albums` : Métadonnées des albums
- `photos` : Informations des photos
- `access_links` : Liens de partage avec permissions
- `user_album_permissions` : Permissions utilisateurs

### Migrations Supabase
```bash
# Appliquer les migrations
npx supabase db push

# Créer une nouvelle migration
npx supabase migration new nom_migration
```

## 🗄️ Stockage S3

### Configuration
Le système supporte tout stockage compatible S3 (AWS S3, Minio, etc.)

### Buckets utilisés
- `photos` : Photos originales
- `previews` : Miniatures générées

### Gestion des fichiers
- URLs signées pour l'accès sécurisé
- Compression automatique des images
- Génération de miniatures
- Nettoyage automatique lors de suppression

## 🧪 Tests

### Tests avec Bruno
```bash
cd ../api-testing
bru run --env development
```

### Scripts utiles
```bash
# Créer un utilisateur admin
npm run create-admin

# Tester la connexion S3
npm run test-s3
```

## 📈 Monitoring

### Logs
- Logs d'erreur uniquement en production
- Logs détaillés en développement
- Rotation automatique des logs

### Métriques
- Utilisation des liens d'accès
- Nombre d'uploads/téléchargements
- Statistiques par album

## 🐳 Docker

### Dockerfile
Le projet inclut un Dockerfile optimisé pour la production.

### Build
```bash
docker build -t web-gallery-backend .
```

### Run
```bash
docker run -p 5000:5000 --env-file .env web-gallery-backend
```

## 🤝 Contribution

1. Respecter la structure MVC
2. Ajouter des tests pour les nouvelles fonctionnalités
3. Documenter les endpoints dans Swagger
4. Suivre les conventions de nommage
5. Gérer les erreurs de manière cohérente

## 🔧 Dépannage

### Problèmes courants
- **Erreur 500 lors d'upload** : Vérifier la configuration S3
- **Token expired** : Implémenter le rafraîchissement automatique
- **Permission denied** : Vérifier les RLS policies Supabase
- **CORS errors** : Configurer les origines autorisées

### Debug
```bash
# Logs détaillés
NODE_ENV=development npm run dev

# Test connexion base de données
npm run test-db

# Test connexion S3
npm run test-s3
```