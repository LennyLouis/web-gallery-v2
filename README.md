# Web Gallery v2

Une galerie photo moderne avec système de partage et gestion des permissions.

## 🌟 Fonctionnalités

### Gestion des Albums
- ✅ Création, modification et suppression d'albums
- ✅ Albums publics et privés
- ✅ Photos de couverture personnalisables
- ✅ Métadonnées (titre, description, date, lieu, tags)

### Partage et Permissions
- ✅ Système de permissions avancé (view/download/manage)
- ✅ Liens d'accès avec permissions granulaires
- ✅ Partage public avec contrôle d'accès
- ✅ Gestion des utilisateurs et invitations

### Gestion des Photos
- ✅ Upload multiple avec prévisualisation
- ✅ Support des formats JPEG, PNG, WebP
- ✅ Génération automatique de miniatures
- ✅ Téléchargement individuel et par lot (ZIP)
- ✅ Stockage optimisé avec S3/Minio

### Interface Utilisateur
- ✅ Interface responsive et moderne (React + Bootstrap)
- ✅ Navigation intuitive
- ✅ Galerie avec lightbox
- ✅ Sélection multiple pour téléchargements
- ✅ Interface d'administration

## 🏗️ Architecture

### Backend (Node.js + Express)
- **Base de données** : Supabase (PostgreSQL)
- **Authentification** : JWT avec Supabase Auth
- **Stockage** : S3 compatible (Minio/AWS S3)
- **API** : REST avec documentation Swagger

### Frontend (React + Remix)
- **Framework** : Remix avec React Router v7
- **UI** : React Bootstrap
- **Build** : Vite
- **TypeScript** pour la robustesse

### Déploiement
- **Conteneurisation** : Docker + Docker Compose
- **Environnements** : Développement et Production
- **Base de données** : Migrations Supabase

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 18+
- Docker et Docker Compose
- Compte Supabase

### Configuration

1. **Cloner le projet**
```bash
git clone <repo-url>
cd web-gallery-v2
```

2. **Variables d'environnement**
```bash
cp .env.example .env
# Configurer les variables Supabase et S3
```

3. **Démarrage avec Docker**
```bash
docker-compose up -d
```

4. **Accès à l'application**
- Frontend : http://localhost:3000
- Backend API : http://localhost:5000
- Documentation API : http://localhost:5000/api-docs

### Développement

#### Backend
```bash
cd backend
npm install
npm run dev
```

#### Frontend
```bash
cd web-frontend
npm install
npm run dev
```

## 📁 Structure du Projet

```
web-gallery-v2/
├── backend/                 # API Node.js/Express
│   ├── app/
│   │   ├── controllers/     # Logique métier
│   │   ├── models/         # Modèles de données
│   │   ├── routes/         # Routes API
│   │   ├── middleware/     # Middlewares
│   │   └── utils/          # Utilitaires
│   └── supabase/           # Migrations et configuration
├── web-frontend/           # Application React/Remix
│   ├── app/
│   │   ├── routes/         # Pages et routes
│   │   ├── contexts/       # Contextes React
│   │   ├── hooks/          # Hooks personnalisés
│   │   └── lib/            # Utilitaires et API client
├── api-testing/            # Tests API avec Bruno
└── docker-compose.yaml     # Configuration Docker
```

## 🔧 API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `POST /api/auth/refresh` - Renouvellement token
- `GET /api/auth/profile` - Profil utilisateur

### Albums
- `GET /api/albums` - Liste des albums
- `POST /api/albums` - Créer un album
- `GET /api/albums/:id` - Détails d'un album
- `PUT /api/albums/:id` - Modifier un album
- `DELETE /api/albums/:id` - Supprimer un album

### Photos
- `GET /api/photos/album/:id` - Photos d'un album
- `POST /api/photos/upload/:albumId` - Upload de photos
- `POST /api/photos/download` - Téléchargement multiple
- `DELETE /api/photos/:id` - Supprimer une photo

### Liens d'Accès
- `GET /api/access-links/:albumId` - Liens d'un album
- `POST /api/access-links` - Créer un lien
- `DELETE /api/access-links/:id` - Supprimer un lien
- `POST /api/access-links/validate` - Valider un lien

## 🔒 Sécurité

- **Authentification JWT** avec tokens d'accès et de rafraîchissement
- **Row Level Security (RLS)** dans Supabase
- **Permissions granulaires** (view/download/manage)
- **Validation des uploads** (types de fichiers, taille)
- **URLs signées** pour l'accès aux fichiers

## 🧪 Tests

### Tests API avec Bruno
```bash
cd api-testing
bru run --env development
```

### Variables d'environnement de test
Configurez `api-testing/environments/development.bru` avec vos credentials.

## 📊 Monitoring et Logs

- Logs d'erreur uniquement en production
- Métriques d'utilisation des liens d'accès
- Suivi des uploads et téléchargements

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -am 'Ajouter nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🆘 Support

Pour toute question ou problème :
- Créer une issue sur GitHub
- Consulter la documentation API : `/api-docs`
- Vérifier les logs Docker : `docker-compose logs`