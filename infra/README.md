# Infra — Migrazione VPS Hetzner

Questa cartella contiene tutto il necessario per migrare dal setup attuale
(Vercel + Render) al VPS Hetzner CX22 con Ubuntu 24.04.

## La migrazione richiede solo:

1. Seguire `infra/docs/DEPLOY.md` sul VPS
2. Cambiare `VITE_API_URL=https://api.condovia.it` su Vercel (o spostare il frontend sul VPS)
3. Aggiornare le env del backend (vedi `.env.example`)
4. **Zero modifiche al codice sorgente**

## Struttura

```
infra/
├── README.md             ← questo file
├── nginx/
│   └── condovia.conf     ← configurazione Nginx completa
├── scripts/
│   ├── setup-vps.sh      ← installa tutto sul VPS (Node, PM2, Nginx, MongoDB, Certbot)
│   ├── setup-mongo.sh    ← crea database e utente MongoDB
│   └── backup-mongo.sh   ← backup giornaliero con retention 7 giorni
├── ecosystem.config.js   ← configurazione PM2
└── docs/
    └── DEPLOY.md         ← guida step-by-step migrazione
```
