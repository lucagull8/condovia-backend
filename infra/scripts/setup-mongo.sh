#!/bin/bash
set -e

PASSWORD="${1:?Uso: $0 PASSWORD_SICURA}"

echo "Configurazione MongoDB per Condovia..."

# Crea database e utente
mongosh --quiet <<EOF
use condovia-db
db.createUser({
  user: "condovia_user",
  pwd: "${PASSWORD}",
  roles: [{ role: "dbOwner", db: "condovia-db" }]
})
print("Utente condovia_user creato")
EOF

# Abilita autenticazione in mongod.conf
sed -i 's/#security:/security:/' /etc/mongod.conf
grep -q "authorization: enabled" /etc/mongod.conf || \
  sed -i '/^security:/a\  authorization: enabled' /etc/mongod.conf

# Assicura bindIp solo localhost
sed -i 's/bindIp:.*/bindIp: 127.0.0.1/' /etc/mongod.conf

systemctl restart mongod

echo "✅ MongoDB configurato. Connection string:"
echo "   mongodb://condovia_user:${PASSWORD}@127.0.0.1:27017/condovia-db"
