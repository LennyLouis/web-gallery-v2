#!/bin/bash

# Script d'optimisation système pour gros téléchargements
# À exécuter en tant que root

echo "🔧 Configuration système pour gros téléchargements..."

# 1. Optimisation TCP pour connexions longues
echo "📡 Optimisation des paramètres TCP..."

cat >> /etc/sysctl.conf << EOF

# === Optimisation pour gros téléchargements ===
# Augmentation des timeouts TCP
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 60  
net.ipv4.tcp_keepalive_probes = 20

# Buffers réseau plus larges
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728

# Optimisation des connexions
net.core.netdev_max_backlog = 5000
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096

# Réutilisation rapide des sockets
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30

EOF

# Appliquer les changements
sysctl -p

# 2. Configuration UFW pour connexions longues
echo "🔥 Configuration UFW..."

# Augmenter les timeouts de connexion UFW
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Règles pour web gallery
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp

# Configuration des timeouts de connexion
echo "# UFW timeout configuration" >> /etc/ufw/before.rules
echo "-A ufw-before-input -p tcp --syn -j ACCEPT" >> /etc/ufw/before.rules

ufw --force enable

# 3. Limites système
echo "📊 Configuration des limites système..."

cat >> /etc/security/limits.conf << EOF

# === Limites pour web gallery ===
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768

EOF

# 4. Configuration systemd pour les services Docker
echo "🐳 Configuration systemd pour Docker..."

mkdir -p /etc/systemd/system/docker.service.d
cat > /etc/systemd/system/docker.service.d/timeout.conf << EOF
[Service]
TimeoutStartSec=0
TimeoutStopSec=120s
EOF

# 5. Configuration Docker daemon
echo "🔧 Configuration Docker daemon..."

mkdir -p /etc/docker
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65536,
      "Soft": 65536
    },
    "nproc": {
      "Name": "nproc",
      "Hard": 32768,
      "Soft": 32768
    }
  },
  "live-restore": true,
  "userland-proxy": false
}
EOF

# 6. Redémarrer les services
echo "🔄 Redémarrage des services..."

systemctl daemon-reload
systemctl restart docker

# 7. Configuration de logs pour debug
echo "📋 Configuration des logs..."

# Logrotate pour Traefik
cat > /etc/logrotate.d/traefik << EOF
/data/traefik/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    create 0644 root root
    postrotate
        docker kill -s USR1 \$(docker ps -q --filter name=traefik) 2>/dev/null || true
    endscript
}
EOF

echo "✅ Configuration système terminée !"
echo ""
echo "📝 Prochaines étapes :"
echo "1. Redémarrer le serveur pour appliquer toutes les modifications"
echo "2. Redémarrer les conteneurs Docker"
echo "3. Tester avec un gros téléchargement"
echo ""
echo "🔍 Pour monitorer :"
echo "- docker logs -f traefik"
echo "- docker logs -f web-gallery-backend"  
echo "- netstat -i 1  (pour monitorer le réseau)"