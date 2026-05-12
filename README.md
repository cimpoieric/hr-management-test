# HR Management

Aplicație web (și opțional desktop Electron) pentru **gestiunea locală** a angajaților, documentelor, detașărilor, pontajului, importurilor și fluturașilor de salariu. Interfață în limba română, roluri și audit orientate spre echipe HR mici și medii.

## Tehnologii

| Strat | Tehnologie |
|--------|-------------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| Limbaj | TypeScript |
| Bază de date | SQLite + [Prisma ORM](https://www.prisma.io/) |
| Autentificare | JWT (cookie httpOnly), fără NextAuth |
| UI | React, Tailwind CSS, componente Radix |
| Email | Nodemailer (SMTP), configurare în aplicație |
| Import email | IMAP (opțional, variabile de mediu) |
| Desktop | Electron (opțional) |

## Cerințe sistem

- **Node.js** 20 sau mai nou (`engines` în `package.json`)
- **npm** (sau compatibil) pentru dependențe și scripturi
- **Windows / macOS / Linux** — SQLite și căile din `data/` sunt gândite pentru rulare locală sau server propriu
- Spațiu disc pentru baza de date, documente și backup-uri (directorul `data/`)

## Instalare pas cu pas

1. **Clonează sau copiază** proiectul și intră în folderul rădăcină al aplicației (`hr-management-config`).

2. **Instalează dependențele**

   ```bash
   npm install
   ```

3. **Variabile de mediu**

   ```bash
   copy .env.example .env
   ```

   Pe macOS/Linux: `cp .env.example .env`

4. **Prima configurare (recomandat)**

   ```bash
   npm run setup
   ```

   Scriptul: verifică Node, creează `.env` dacă lipsește, poate genera `ENCRYPTION_KEY` și `JWT_SECRET`, creează `data/`, rulează `prisma generate` și `db push`, iar dacă baza e goală rulează **seed** cu o parolă admin generată (afișată o dată în consolă) sau folosește `SEED_ADMIN_PASSWORD` din mediu dacă e setată (minim 8 caractere).

5. **Build producție** (opțional înainte de `npm start`)

   ```bash
   npm run build
   ```

## Configurare email SMTP

1. Deschide aplicația și autentifică-te cu un cont **administrator**.
2. Mergi la **Configurări → Email** (sau ruta echivalentă din meniu) și completează:
   - host SMTP (ex. `smtp.gmail.com`)
   - port (ex. `587` pentru STARTTLS)
   - utilizator și parolă (pentru Gmail se folosesc de obicei [parole de aplicație](https://myaccount.google.com/apppasswords))
   - **De la (email)** și **Nume expeditor**
3. Salvează și folosește **Test conexiune** dacă e disponibil.

Datele SMTP se stochează în baza de date (criptate unde e cazul), nu în cod. Variabilele din `.env.example` (`SMTP_*`, `FROM_*`) servesc ca documentație sau pentru integrări viitoare; fluxul principal este prin UI.

## Configurare bază de date

- **Prisma** folosește `DATABASE_URL` din `.env`. Pentru SQLite local, exemplu tipic:

  ```env
  DATABASE_URL="file:../data/app.db"
  ```

  Calea e relativă la folderul `prisma/` (vezi comentarii în `.env.example`).

- **Migrări / schema**

  ```bash
  npm run db:generate
  npm run db:push
  ```

  Pentru medii cu migrări versionate: `npm run db:migrate`.

- **Seed date demo**

  ```bash
  set SEED_ADMIN_PASSWORD=ParolaTaMin8Ch
  npm run db:seed
  ```

  Pe PowerShell: `$env:SEED_ADMIN_PASSWORD="..."; npm run db:seed`

  Fără `SEED_ADMIN_PASSWORD` valid, seed-ul se oprește cu eroare explicită (fără parolă implicită în cod).

## Pornire aplicație

| Scop | Comandă |
|------|---------|
| Dezvoltare (hot reload) | `npm run dev` |
| Producție (după build) | `npm run build` apoi `npm start` |
| Curățare artefacte build | `npm run final-cleanup` |

`npm start` pornește Next pe host/port din `.env` (`HOST`, `PORT`), cu verificări pentru chei obligatorii.

## Structura rolurilor

Rolurile sunt definite în schema Prisma și normalizate în cod (`UserRole`):

| Rol | Cod | Descriere sumară |
|-----|-----|------------------|
| **Operator** | `operator` | Utilizare zilnică: înregistrări, modificări acolo unde politica RBAC permite (împreună cu administratorul pe rute de scriere). |
| **Administrator** | `administrator` | Acces complet la configurări critice, utilizatori, setări sensibile și operațiuni administrative. |
| **Doar vizualizare** | `doar_vizualizare` | Acces în principal citire; nu poate efectua acțiuni de scriere acolo unde aplicația restricționează la `WRITE_ROLES` (operator + administrator). |

Valorile vechi sau alternative (`admin`, `vizualizare`, `read_only`) sunt mapate la echivalentul canonic în stratul de autentificare.

## Scripturi utile

- `npm run setup` — prima instalare
- `npm run final-cleanup` — șterge `.next`, loguri, jurnal/backup Prisma temporar, etc.
- `node scripts/fix-password.js` — necesită `FIX_USER_EMAIL` și `FIX_NEW_PASSWORD` în mediu (reset punctual parolă)

## Licență / livrare

Proiect marcat `private` în `package.json`; termenii de licențiere sunt responsabilitatea deținătorului codului sursă.
