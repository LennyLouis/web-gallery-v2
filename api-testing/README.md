# Web Gallery API Testing avec Bruno

Ce dossier contient les profils Bruno pour tester l'API du backend Web Gallery.

## Structure

```
api-testing/
├── bruno.json                 # Configuration de la collection Bruno
├── bruno.config.js            # Configuration globale et scripts
├── environments/              # Environnements
│   ├── development.bru       # Variables pour développement
│   └── production.bru        # Variables pour production
├── Authentication/           # Collection d'authentification
│   ├── Login.bru            # Test de connexion
│   ├── Register.bru         # Test d'inscription (admin only)
│   ├── Profile.bru          # Test de récupération du profil
│   ├── Refresh Token.bru    # Test de refresh du token
│   └── Logout.bru           # Test de déconnexion
├── Health Check.bru         # Test de santé du serveur
└── README.md               # Ce fichier
```

## Utilisation

### Prérequis
1. Installer [Bruno](https://www.usebruno.com/)
2. Avoir le serveur backend en fonctionnement (`npm run dev` dans le dossier backend)
3. Avoir configuré le fichier `.env` à la racine du projet

### Configuration initiale
1. Ouvrir Bruno
2. Ouvrir cette collection (`api-testing`)
3. Sélectionner l'environnement `development`

### Collections de tests

#### Authentication
- **Health Check**: `GET /health` - Vérifier le serveur
- **Login**: `POST /api/auth/login` - Connexion utilisateur
- **Register**: `POST /api/auth/register` - Créer utilisateur (admin only)
- **Profile**: `GET /api/auth/profile` - Profil utilisateur
- **Refresh Token**: `POST /api/auth/refresh` - Renouveler token
- **Logout**: `POST /api/auth/logout` - Déconnexion

#### Albums
- **Create Album**: `POST /api/albums` - Créer un album
- **Get All Albums**: `GET /api/albums` - Lister mes albums
- **Get Album by ID**: `GET /api/albums/{id}` - Détails d'un album
- **Get Public Albums**: `GET /api/albums/public` - Albums publics
- **Update Album**: `PUT /api/albums/{id}` - Modifier album
- **Delete Album**: `DELETE /api/albums/{id}` - Supprimer album

#### Photos
- **Upload Photos**: `POST /api/photos/upload/{albumId}` - Upload avec traitement
- **Get Photos by Album**: `GET /api/photos/album/{albumId}` - Photos d'un album
- **Download Multiple**: `POST /api/photos/download` - URLs de téléchargement

#### Access Links
- **Create Access Link**: `POST /api/access-links` - Créer lien d'accès
- **Validate Access Link**: `GET /api/access-links/validate/{token}` - Valider lien
- **Get Album by Access Link**: `GET /api/albums/access/{token}` - Album via lien
- **Get All Access Links**: `GET /api/access-links` - Tous mes liens

## Variables d'environnement

### Development
- `baseUrl`: http://localhost:3000
- `apiUrl`: {{baseUrl}}/api

### Production
- `baseUrl`: https://your-production-domain.com
- `apiUrl`: {{baseUrl}}/api

## Variables dynamiques

Ces variables sont automatiquement mises à jour lors des tests :
- `accessToken`: Token d'accès JWT
- `refreshToken`: Token de refresh

## Ordre de test recommandé

1. **Health Check** - Vérifier que le serveur fonctionne
2. **Login** - Se connecter et obtenir les tokens
3. **Profile** - Vérifier que l'authentification fonctionne
4. **Register** - Créer de nouveaux utilisateurs (si admin)
5. **Refresh Token** - Tester le renouvellement de token
6. **Logout** - Se déconnecter

## Notes

- Les tokens sont automatiquement sauvegardés et utilisés dans les requêtes suivantes
- Les tests incluent des vérifications automatiques des statuts HTTP et du contenu des réponses
- Pour créer de nouveaux utilisateurs, vous devez d'abord être connecté en tant qu'admin
- Les erreurs sont automatiquement loggées dans la console Bruno