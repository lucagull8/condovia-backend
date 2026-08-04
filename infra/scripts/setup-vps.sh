#!/bin/bash
set -e

echo "═══════════════════════════════════════"
echo " Condovia VPS Setup — Ubuntu 24.04"
echo "═══════════════════════════════════════"

# Update sistema
apt update && apt upgrade -y

# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# PM2
npm install -g pm2

# Nginx
apt install -y nginx

# Certbot
apt install -y certbot python3-certbot-nginx

# MongoDB 7.0
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update && apt install -y mongodb-org
systemctl enable mongod && systemctl start mongod

# Utente sistema 'condovia'
id -u condovia &>/dev/null || useradd -m -s /bin/bash -G sudo condovia
echo "condovia ALL=(ALL) NOPASSWD:/usr/bin/systemctl reload nginx" >> /etc/sudoers.d/condovia

# Directory web e backup
mkdir -p /var/www/condovia
chown condovia:condovia /var/www/condovia
mkdir -p /home/condovia/backups
chown condovia:condovia /home/condovia/backups

# Firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Security updates automatici
apt install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

echo ""
echo "═══════════════════════════════════════"
echo " Setup completato! Comandi manuali:"
echo "═══════════════════════════════════════"
echo " 1. bash infra/scripts/setup-mongo.sh PASSWORD_SICURA"
echo " 2. Copia infra/nginx/condovia.conf in /etc/nginx/sites-available/"
echo " 3. sudo ln -s /etc/nginx/sites-available/condovia /etc/nginx/sites-enabled/"
echo " 4. sudo nginx -t && sudo systemctl reload nginx"
echo " 5. sudo certbot --nginx -d condovia.it -d www.condovia.it -d api.condovia.it"
echo " 6. Seguire infra/docs/DEPLOY.md per il deploy dell'applicazione"
echo "═══════════════════════════════════════"
