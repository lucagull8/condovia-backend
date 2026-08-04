# Migrazione Condovia → VPS Hetzner

## Prerequisiti
- VPS Hetzner CX22 acquistato (Ubuntu 24.04)
- IP del VPS a portata di mano
- DNS condovia.it già su Cloudflare
- Repository GitHub clonabile

## Stima tempo: 2-3 ore

---

## Step 1 — Aggiorna DNS su Cloudflare

Vai su Cloudflare → condovia.it → DNS → aggiungi/modifica:

| Tipo | Nome | Contenuto      | Proxy |
|------|------|----------------|-------|
| A    | @    | `<VPS_IP>`     | OFF   |
| A    | www  | `<VPS_IP>`     | OFF   |
| A    | api  | `<VPS_IP>`     | OFF   |

Attendi propagazione DNS (5-30 minuti).

---

## Step 2 — Setup VPS

```bash
ssh root@<VPS_IP>
git clone https://github.com/lucagull8/condovia-backend /tmp/setup
bash /tmp/setup/infra/scripts/setup-vps.sh
```

---

## Step 3 — Configura MongoDB

```bash
bash /tmp/setup/infra/scripts/setup-mongo.sh PASSWORD_SICURA_DA_SCEGLIERE
```

Salva la password generata — ti servirà per la connection string.

---

## Step 4 — Deploy backend

```bash
su - condovia
git clone https://github.com/lucagull8/condovia-backend /home/condovia/condovia-backend
cd /home/condovia/condovia-backend
npm ci --production
cp .env.example .env
nano .env
```

Compila `.env` con i valori Fase 2:
```
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://condovia_user:PASSWORD@127.0.0.1:27017/condovia-db
JWT_SECRET=<stringa random 64 caratteri>
FRONTEND_URL=https://condovia.it
RESEND_API_KEY=<la tua chiave Resend>
```

---

## Step 5 — Avvia con PM2

```bash
cd /home/condovia/condovia-backend
pm2 start infra/ecosystem.config.js --env production
pm2 save
pm2 startup
# Copia e incolla il comando che PM2 ti suggerisce (con sudo)
```

---

## Step 6 — Deploy frontend

In locale (sul tuo PC):
```bash
cd condovia-frontend
VITE_API_URL=https://api.condovia.it npm run build
scp -r dist/* condovia@<VPS_IP>:/var/www/condovia/
```

---

## Step 7 — Nginx + SSL

```bash
sudo cp /home/condovia/condovia-backend/infra/nginx/condovia.conf \
  /etc/nginx/sites-available/condovia
sudo ln -s /etc/nginx/sites-available/condovia \
  /etc/nginx/sites-enabled/condovia
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx \
  -d condovia.it -d www.condovia.it -d api.condovia.it
```

---

## Step 8 — Cron backup

```bash
crontab -e
```

Aggiungi:
```
0 3 * * * MONGODB_URI=mongodb://condovia_user:PASSWORD@127.0.0.1:27017/condovia-db /home/condovia/condovia-backend/infra/scripts/backup-mongo.sh
```

---

## Step 9 — Aggiorna Vercel (se mantieni frontend su Vercel)

Dashboard Vercel → condovia-frontend → Settings → Environment Variables:
- Cambia `VITE_API_URL` da `https://condovia-backend.onrender.com` a `https://api.condovia.it`
- Triggera un nuovo deploy

---

## Step 10 — Verifica e spegni Render

1. Testa `https://condovia.it` e `https://api.condovia.it/health`
2. Verifica login, backoffice, registrazioni
3. Una volta tutto ok: Render → il tuo servizio → Suspend (o Delete)
4. Aggiorna UptimeRobot: cambia URL da `.onrender.com/health` a `https://api.condovia.it/health`

---

## Rollback in caso di problemi

Se qualcosa va storto, il vecchio setup (Render + Vercel) è ancora attivo finché
non lo spegni. Basta non fare il Step 10.
