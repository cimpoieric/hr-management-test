# HR Management — Ghid Instalare & Deploy

Aplicație web locală pentru gestionarea angajaților, documentelor și detașărilor. Rulează exclusiv în rețeaua companiei — datele nu părăsesc serverul.

---

## Cerințe Sistem

| Componentă | Versiune minimă |
|-----------|----------------|
| Node.js | >= 20 |
| npm | >= 10 |
| Sistem de operare | Windows 10/11, Ubuntu 22.04+, macOS 13+ |
| RAM | 2 GB (4 GB recomandat) |
| Spațiu disk | 1 GB (variază în funcție de documente) |

### Verificare Node.js

```bash
node --version   # Trebuie să arate v20.x.x sau mai mare
npm --version    # Trebuie să arate 10.x.x sau mai mare
```

Dacă nu ai Node.js >= 20: https://nodejs.org/ (descarcă LTS)

---

## Instalare Rapidă (5 minute)

### 1. Clonează / Copiază proiectul

```bash
cd calea\catre\proiect
# Sau pe Windows: cd C:\Proiecte\hr-management
```

### 2. Instalează dependențele

```bash
npm install
```

### 3. Rulează setup-ul automat

```bash
npm run setup
```

Acest script:
- Verifică Node.js >= 20
- Creează fișierul `.env` cu chei secrete auto-generate
- Creează structura de directoare (`data/`, `documents/`, `backups/` etc.)
- Configurează baza de date SQLite
- Populează datele inițiale (admin + angajați demo)

### 4. Pornește aplicația

```bash
# Mod dezvoltare (cu hot reload)
npm run dev

# Sau mod producție (mai rapid)
npm run build
npm start
```

### 5. Accesează aplicația

Deschide browserul la: **http://localhost:3000**

Cont admin default:
- Email: `admin@firma.local`
- Parolă: `Admin123!`

---

## Structură Directoare

```
hr-management/
├── data/                    # Date persistente (NU se șterge)
│   ├── app.db              # Baza de date SQLite
│   ├── documents/          # Documente angajați (PDF, JPG etc.)
│   ├── backups/            # Backup-uri ZIP automate
│   ├── reports/            # Rapoarte PDF generate
│   ├── settings/           # Logo, configurații
│   ├── imports/            # Fișiere import temporare
│   └── temp/               # Fișiere temporare
├── prisma/
│   ├── schema.prisma       # Schema bazei de date
│   └── seed.ts             # Date inițiale
├── scripts/
│   ├── setup.js            # Setup inițial
│   └── start.js            # Pornire producție
├── src/
│   ├── app/                # Pagini Next.js
│   ├── components/         # Componente React
│   ├── lib/                # Utilități (auth, encrypt, backup, audit)
│   └── middleware.ts       # Protecție rute
├── .env                    # Variabile de mediu (NU se comite!)
├── package.json
└── DEPLOY.md               # Acest fișier
```

---

## Variabile de Mediu (.env)

```env
# OBLIGATORIU — cheie de 64 caractere hex pentru criptare AES-256-GCM
# Dacă pierzi această cheie, datele criptate (CNP, IBAN) sunt irecuperabile!
ENCRYPTION_KEY="<generat automat de npm run setup>"

# OBLIGATORIU — secret pentru semnarea token-urilor JWT
JWT_SECRET="<generat automat de npm run setup>"

# Opțional — port și host
PORT=3000
HOST=0.0.0.0

# Opțional — backup automat
BACKUP_AUTO=true
BACKUP_INTERVAL_MS=86400000          # 24 ore
BACKUP_PASSWORD="<parolă puternică>" # Parolă pentru fișierele ZIP

# Opțional — mod debug
DEBUG=false
```

---

## Backup & Restaurare

### Backup manual

Interfață web: http://localhost:3000/backup

Sau via API:
```bash
curl -X POST http://localhost:3000/api/backup/create \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

### Backup automat

**Windows (Task Scheduler):**
```powershell
# Creează task zilnic la 2:00 AM
schtasks /create /tn "HR Backup" /tr "curl -X POST http://localhost:3000/api/backup/create" /sc daily /st 02:00
```

**Linux (cron):**
```bash
# Editează cron: crontab -e
# Adaugă linia:
0 2 * * * curl -X POST http://localhost:3000/api/backup/create -H "Cookie: token=<TOKEN>"
```

**Din aplicație (dacă rulează 24/7):**
Setează în `.env`:
```env
BACKUP_AUTO=true
BACKUP_INTERVAL_MS=86400000
```

### Restaurare

1. Mergi la http://localhost:3000/backup
2. Upload fișier ZIP
3. Confirmă în 2 pași (înțelegi că datele noi se pierd)
4. Un safety backup al stării curente e creat automat

---

## Gestionare Utilizatori

### Roluri disponibile

| Rol | Permisiuni |
|-----|-----------|
| **ADMIN** | Full access: toate paginile, setări, backup, gestionare utilizatori |
| **OPERATOR** | CRUD angajați, documente, detașări, importuri |
| **READONLY** | Doar vizualizare (dashboard, angajați, rapoarte) |

### Creare utilizator

1. Loghează-te ca admin
2. Mergi la: http://localhost:3000/utilizatori
3. Click "Adaugă utilizator"
4. Completează nume, email, rol
5. Parola temporară e afișată o singură dată — salveaz-o!

---

## Actualizare Aplicație

```bash
# 1. Oprește aplicația (Ctrl+C)

# 2. Fă backup înainte de orice actualizare
curl -X POST http://localhost:3000/api/backup/create

# 3. Copiază noua versiune

# 4. Reinstalează dependențele
npm install

# 5. Migrează baza de date
npm run db:migrate

# 6. Pornește aplicația
npm start
```

---

## Troubleshooting

### "Prisma Client could not locate the Query Engine"

```bash
npx prisma generate
```

### "Cannot find module '@prisma/client'"

```bash
npm install
npx prisma generate
```

### "ENCRYPTION_KEY invalidă"

```bash
# Rulează setup-ul din nou (va genera chei noi)
npm run setup
# ⚠️ Dacă DB are date criptate cu altă cheie, acele date vor fi pierdute!
```

### Port 3000 e ocupat

```bash
# Găsește procesul
# Windows: netstat -ano | findstr :3000
# Linux: lsof -ti:3000

# Oprește-l sau foloseș alt port în .env:
PORT=3001
```

### "npm install" eșuează

```bash
# Șterge cache-ul și reîncearcă
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## Securitate

### Recomandări obligatorii

1. **Schimbă parola admin** imediat după primul login
2. **Salvează .env într-un loc sigur** (cheile de criptare nu pot fi regenerate fără pierderea datelor)
3. **Restricționează accesul la port** — folosește firewall pentru a limita accesul doar la LAN
4. **Backup regulat** — configurează backup automat zilnic
5. **Actualizează regulat** — păstrează Node.js și dependențele la zi

### Ce NU trebuie făcut

- Nu commite fișierul `.env` în git
- Nu șterge folderul `data/` — conține TOATE datele
- Nu modifica `ENCRYPTION_KEY` după ce ai date în baza de date
- Nu expune portul 3000 la internet fără reverse proxy (nginx)

---

## Suport

Pentru probleme sau întrebări, verifică:
1. Log-urile aplicației (terminal)
2. Audit log: http://localhost:3000/setari/audit
3. Baza de date: `npm run db:studio`

---

**Versiune:** 1.0.0 | **Ultima actualizare:** 2026-04-30
