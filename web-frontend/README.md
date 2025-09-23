# Web Gallery Frontend

Interface utilisateur moderne pour la galerie photo Web Gallery v2.

## 🛠️ Technologies

- **Framework**: React Router v7 (Remix)
- **Build Tool**: Vite
- **Language**: TypeScript
- **UI Components**: React Bootstrap
- **Styling**: Bootstrap CSS + Custom CSS

## 🚀 Démarrage

### Installation des dépendances
```bash
npm install
```

### Développement
```bash
npm run dev
```
Application disponible sur `http://localhost:5173`

### Build de production
```bash
npm run build
```

### Déploiement Docker
```bash
docker build -t web-gallery-frontend .
docker run -p 3000:3000 web-gallery-frontend
```

## 📁 Structure

```
app/
├── routes/             # Pages et routes
│   ├── _index.tsx     # Page d'accueil
│   ├── login.tsx      # Connexion
│   ├── dashboard.tsx  # Tableau de bord
│   ├── album.$id.tsx  # Visualisation d'album
│   └── admin/         # Interface d'administration
├── contexts/          # Contextes React
│   └── AuthContext.tsx
├── hooks/             # Hooks personnalisés
├── lib/               # Utilitaires et clients API
│   ├── apiClient.ts   # Client API
│   └── supabase.ts    # Configuration Supabase
└── app.css           # Styles globaux
```

## 🔧 Configuration

### Variables d'environnement
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:5000/api
```

## 🎨 Fonctionnalités UI

### Pages Principales
- **Page d'accueil** : Présentation et accès aux albums publics
- **Connexion/Inscription** : Authentification utilisateur
- **Tableau de bord** : Gestion des albums personnels
- **Galerie d'album** : Visualisation et téléchargement de photos
- **Administration** : Gestion avancée des albums et permissions

### Composants Clés
- **Lightbox** : Visualisation plein écran des photos
- **Sélection multiple** : Interface pour téléchargements groupés
- **Formulaires responsives** : Création et modification d'albums
- **Navigation adaptative** : Interface mobile-friendly

### Authentification
- Contexte d'authentification avec gestion d'état
- Tokens JWT avec rafraîchissement automatique
- Protection des routes sensibles
- Gestion des sessions expirées

## 🔒 Sécurité Frontend

- Validation des formulaires côté client
- Gestion sécurisée des tokens
- Protection contre les XSS
- Validation des types de fichiers

## 📱 Responsive Design

- Interface adaptée mobile/tablette/desktop
- Navigation optimisée pour tous écrans
- Galerie responsive avec grille adaptative
- Formulaires optimisés tactile

Built with ❤️ using React Router.
