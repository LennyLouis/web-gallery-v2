# Docker Setup for Web Gallery v2

Ce guide explique comment déployer la Web Gallery v2 avec Docker Compose, incluant le frontend, backend et les services de stockage.

## 🚀 Démarrage rapide

### 1. Configuration initiale

```bash
# Copier le fichier d'environnement
cp .env.example .env

# Éditer les variables d'environnement
nano .env
```

### 2. Variables d'environnement requises

Remplir au minimum ces variables dans `.env` :

```bash
# Supabase (obligatoire)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# JWT Secret (obligatoire)
JWT_SECRET=your-super-secret-jwt-key-here
```

### 3. Lancement des services

```bash
# Démarrer tous les services
docker compose up -d

# Ou avec Nginx (reverse proxy)
docker compose --profile with-nginx up -d
```

## 📋 Services disponibles

| Service | URL | Port | Description |
|---------|-----|------|-------------|
| Frontend | http://localhost:3001 | 3001 | Interface utilisateur React |
| Backend API | http://localhost:3000 | 3000 | API REST Node.js |
| Minio API | http://localhost:9000 | 9000 | Stockage S3-compatible |
| Minio Console | http://localhost:9001 | 9001 | Interface admin Minio |
| Nginx (optionnel) | http://localhost:80 | 80 | Reverse proxy |

## 🔧 Configuration avancée

### Personnalisation des ports

Modifier ces variables dans `.env` :

```bash
FRONTEND_PORT=3001
BACKEND_PORT=3000
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
NGINX_PORT=80
```

### Configuration de domaines (production)

```bash
FRONTEND_DOMAIN=gallery.example.com
BACKEND_DOMAIN=api.gallery.example.com
MINIO_DOMAIN=s3.gallery.example.com
MINIO_CONSOLE_DOMAIN=s3-console.gallery.example.com
```

### Stockage S3 externe

Pour utiliser AWS S3 ou un autre provider :

```bash
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=your-aws-access-key
S3_SECRET_KEY=your-aws-secret-key
S3_BUCKET=your-bucket-name
S3_REGION=eu-west-1
S3_FORCE_PATH_STYLE=false
```

## 📊 Monitoring et logs

### Voir les logs

```bash
# Tous les services
docker compose logs -f

# Service spécifique
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f minio
```

### Status des services

```bash
# État des conteneurs
docker compose ps

# Health checks
docker compose exec backend curl http://localhost:3000/health
docker compose exec frontend curl http://localhost:3001
```

## 🛠️ Commandes utiles

### Développement

```bash
# Rebuild et redémarrer
docker compose up --build -d

# Redémarrer un service spécifique
docker compose restart backend

# Accéder au shell d'un conteneur
docker compose exec backend sh
docker compose exec frontend sh
```

### Maintenance

```bash
# Arrêter tous les services
docker compose down

# Arrêter et supprimer les volumes
docker compose down -v

# Nettoyer les images inutilisées
docker system prune -a
```

### Base de données

```bash
# Appliquer les migrations Supabase
docker compose exec backend npm run db:migrate

# Créer un utilisateur admin
docker compose exec backend npm run create-admin
```

## 🐛 Dépannage

### Problèmes courants

1. **Port déjà utilisé**
   ```bash
   # Vérifier les ports occupés
   lsof -i :3000
   lsof -i :3001
   ```

2. **Problème de connexion Supabase**
   - Vérifier les variables `SUPABASE_URL` et `SUPABASE_ANON_KEY`
   - Tester la connexion : `curl -H "apikey: YOUR_KEY" YOUR_SUPABASE_URL`

3. **Erreur de stockage S3**
   - Vérifier que Minio est démarré
   - Créer le bucket manuellement via la console

4. **Frontend ne se connecte pas au backend**
   - Vérifier `VITE_API_URL` dans les variables d'environnement
   - S'assurer que CORS est configuré correctement

### Logs de debug

```bash
# Activer les logs détaillés
NODE_ENV=development docker compose up

# Vérifier la configuration réseau
docker network ls
docker network inspect web-gallery-v2_web-gallery-network
```

## 🚦 Production

### Configuration SSL

1. Obtenir des certificats SSL (Let's Encrypt recommandé)
2. Placer les certificats dans `./ssl/`
3. Modifier `nginx.conf` pour activer HTTPS
4. Redémarrer avec `docker compose --profile with-nginx up -d`

### Sécurité

- Changer tous les mots de passe par défaut
- Utiliser des JWT secrets forts
- Configurer un firewall
- Activer les logs d'audit
- Mettre en place une sauvegarde automatique

### Performance

- Utiliser un CDN pour les assets statiques
- Configurer un cache Redis (à ajouter au compose)
- Optimiser les images avec un service externe
- Monitorer avec Prometheus/Grafana

## 📞 Support

Pour plus d'informations, consulter :
- [Documentation API](http://localhost:3000/api-docs)
- [Logs des services](#monitoring-et-logs)
- [Issues GitHub](https://github.com/your-repo/issues)