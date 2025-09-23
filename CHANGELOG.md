# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
et ce projet adhère au [Versioning Sémantique](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-09-23

### 🎉 Version 1.0 - Release initiale

#### ✨ Ajouté
- **Système d'authentification complet**
  - Inscription/connexion via Supabase Auth
  - Gestion des sessions JWT avec rafraîchissement automatique
  - Protection des routes et API endpoints

- **Gestion des albums**
  - Création, modification, suppression d'albums
  - Albums publics et privés
  - Métadonnées complètes (titre, description, date, lieu, tags)
  - Photos de couverture personnalisables

- **Système de permissions avancé**
  - Permissions granulaires : view/download/manage
  - Partage d'albums avec contrôle d'accès
  - Invitations utilisateurs avec rôles
  - Row Level Security (RLS) dans Supabase

- **Liens d'accès publics**
  - Génération de liens de partage sécurisés
  - Permissions différenciées (visualisation seule vs téléchargement)
  - Limitations d'usage et d'expiration
  - Tokens cryptographiquement sécurisés

- **Gestion des photos**
  - Upload multiple avec prévisualisation
  - Support JPEG, PNG, WebP
  - Génération automatique de miniatures
  - Stockage optimisé S3/Minio
  - Téléchargement individuel et par lot (ZIP)

- **Interface utilisateur moderne**
  - Design responsive (mobile/tablette/desktop)
  - React + Bootstrap pour l'UI
  - Galerie avec lightbox
  - Sélection multiple pour téléchargements
  - Interface d'administration intuitive

- **API REST complète**
  - Documentation Swagger/OpenAPI
  - Endpoints pour toutes les fonctionnalités
  - Gestion d'erreurs cohérente
  - Support CORS configuré

- **Infrastructure de développement**
  - Docker Compose pour développement local
  - Migrations Supabase automatisées
  - Tests API avec Bruno
  - Configuration TypeScript
  - Hot reload en développement

#### 🏗️ Architecture technique
- **Backend** : Node.js + Express + Supabase
- **Frontend** : React Router v7 (Remix) + TypeScript
- **Base de données** : PostgreSQL via Supabase avec RLS
- **Stockage** : S3 compatible (AWS S3, Minio, etc.)
- **Authentification** : Supabase Auth + JWT
- **Déploiement** : Docker + Docker Compose

#### 🔧 Configuration
- Variables d'environnement documentées
- Fichier `.env.example` fourni
- Instructions d'installation complètes
- Configuration de développement et production

#### 📚 Documentation
- README principal avec guide complet
- Documentation API et frontend
- Guide de contribution
- Exemples de configuration

#### 🧪 Tests
- Suite de tests API avec Bruno
- Tests des endpoints d'authentification
- Tests de permissions et accès
- Tests d'upload et téléchargement

#### 🔒 Sécurité
- Authentification JWT robuste
- Permissions granulaires avec héritage
- Validation des uploads (type, taille)
- URLs signées pour l'accès aux fichiers
- Protection CSRF et XSS
- RLS activé sur toutes les tables

### 🎯 Fonctionnalités clés de la v1

1. **Galerie photo complète** avec upload, organisation et partage
2. **Système de permissions sophistiqué** pour contrôler l'accès
3. **Partage public sécurisé** via liens avec permissions granulaires
4. **Interface moderne et responsive** optimisée pour tous écrans
5. **API REST documentée** pour intégrations futures
6. **Architecture scalable** prête pour la production

### 🚀 Prochaines versions prévues

#### v1.1 (Q4 2025)
- [ ] Recherche et filtres avancés
- [ ] Tags et collections automatiques
- [ ] Notifications en temps réel
- [ ] Export/import d'albums

#### v1.2 (Q1 2026)
- [ ] Édition d'images intégrée
- [ ] Partage sur réseaux sociaux
- [ ] API publique avec clés d'accès
- [ ] Métriques et analytics détaillées

---

**Note** : Cette v1.0 représente une base solide et fonctionnelle pour une galerie photo moderne avec toutes les fonctionnalités essentielles pour un usage personnel ou professionnel.