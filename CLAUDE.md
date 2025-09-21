# Web Gallery

## 📌 Description du projet
**Web Gallery** est une application web permettant aux clients photographiés d’accéder et de télécharger leurs photos en haute qualité via une interface moderne.  
Elle remplace les envois classiques (réseaux sociaux, mails) en offrant une solution professionnelle, sécurisée et performante.

### Modes d’accès
- Connexion par identifiant / mot de passe
- Accès via un lien unique généré par l’admin

### Stack technique
- **Frontend :** ReactJS (React Router v7)
- **Backend :** Node.js (API + gestion auth & permissions)
- **Services tiers :** Supabase (authentification, base de données, stockage)

---

## 🎨 Fonctionnalités Frontend

### Interface client
- Affichage des albums accessibles (liste ou accès direct par lien).
- Galerie responsive (5 à 9 photos par ligne, previews optimisées).
- Ouverture d’une photo en haute qualité sur la même page.
- Sélection et ajout de photos dans une liste de téléchargement en HQ.

### Interface admin
- Gestion et création d’albums.
- Import de nouvelles photos.
- Gestion des utilisateurs (invitations par email, suppression, permissions).
- Génération et gestion de liens uniques.
- Édition des métadonnées (titre, description, date, tags, lieu, public/privé).

---

## ⚙️ Fonctionnalités Backend
- Vérification des tokens et permissions utilisateur.
- Connexion à Supabase pour :
  - Authentification (email/mdp, liens uniques).
  - Stockage et récupération albums/photos.
  - Gestion des métadonnées (title, description, tags, dates, etc.).
- Génération de liens sécurisés pour un album.
- Gestion des rôles (admin / utilisateur).

---

## ✅ Todo list

### Backend (Node.js + Supabase)
- [ ] Initialiser projet Node.js avec Express.
- [ ] Configurer Supabase (auth + storage + base de données).
- [ ] Créer modèles de données : Album, Photo, Utilisateur, Lien d’accès.
- [ ] Implémenter l’authentification (JWT + Supabase).
- [ ] Endpoint : récupérer albums accessibles à un utilisateur.
- [ ] Endpoint : récupérer photos d’un album (preview vs HQ).
- [ ] Endpoint : uploader des photos.
- [ ] Endpoint : créer/gérer des liens uniques.
- [ ] Endpoint : gestion des métadonnées album.

### Frontend (ReactJS)
- [ ] Initialiser projet React (Vite ou CRA) + React Router v7.
- [ ] Créer page **connexion / accès par lien**.
- [ ] Créer page **liste des albums**.
- [ ] Créer composant **galerie photo (preview)**.
- [ ] Implémenter ouverture photo HQ.
- [ ] Implémenter **sélection / téléchargement** de photos.
- [ ] Créer page **admin**.
- [ ] Ajouter gestion des albums (CRUD).
- [ ] Ajouter gestion des utilisateurs et invitations.
- [ ] Intégrer Supabase côté front (auth + storage).

### Organisation & Déploiement
- [ ] Définir architecture (mono-repo ou séparé front/back).
- [ ] Mettre en place Docker Compose (front + back).
- [ ] Déployer une première version (Vercel/Netlify + Railway/Render/EC2).
- [ ] Prévoir CI/CD (tests + build + déploiement auto).