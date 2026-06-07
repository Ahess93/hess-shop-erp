# Hess Solutions — Shop ERP

A machine-shop ERP for Hess Solutions, built to run as a self-contained Windows application and designed from day one to grow into a multi-tenant SaaS.

---

## First-time setup (copy-paste these steps)

### 1. Install required tools

You need these installed before anything else:

- [Node.js LTS](https://nodejs.org) — the JavaScript runtime
- [Docker Desktop](https://www.docker.com/products/docker-desktop) — runs the database locally
- [Git](https://git-scm.com) — version control

### 2. Clone the repo

Open PowerShell and run:

```powershell
git clone https://github.com/Ahess93/hess-shop-erp.git
cd hess-shop-erp
```

_This downloads all the code to your computer._

### 3. Install dependencies

```powershell
npm install
```

_This installs all the libraries the app needs. Takes ~1 minute._

### 4. Set up your environment file

```powershell
Copy-Item .env.example server\.env
```

_This creates your local settings file. It already has the right values for development._

### 5. Start the database

```powershell
docker compose up -d
```

_This starts a PostgreSQL database in the background. You should see Docker Desktop show a running container called `hess-erp-db`._

### 6. Set up the database tables

```powershell
cd server
npx prisma migrate dev --name init
cd ..
```

_This creates all the database tables. You'll see "Your database is now in sync with your schema."_

### 7. Start the app

```powershell
npm run dev
```

_This starts both the backend server and the web frontend. You should see:_

- _`[server]` ... Application is running on: http://localhost:3001_
- _`[web]` ... Local: http://localhost:5173_

Open your browser to **http://localhost:5173** to see the app.

---

## Project structure

```
hess-shop-erp/
├── server/          ← NestJS backend API (Node.js + TypeScript)
│   └── prisma/      ← Database schema and migrations
├── web/             ← React + Vite frontend
├── desktop/         ← Electron wrapper (packages the app as a .exe)
├── packages/
│   └── shared/      ← TypeScript types shared between server and web
├── .github/
│   └── workflows/   ← Automated CI checks (run on every pull request)
└── docker-compose.yml ← Local database setup
```

---

## Common commands

| What you want to do    | Command                                 |
| ---------------------- | --------------------------------------- |
| Start the app (dev)    | `npm run dev`                           |
| Run all tests          | `npm run test`                          |
| Check for code issues  | `npm run lint`                          |
| Check TypeScript types | `npm run typecheck`                     |
| Format code            | `npm run format`                        |
| Open database UI       | `cd server && npx prisma studio`        |
| Reset database         | `cd server && npx prisma migrate reset` |

---

## Development rules (enforced automatically)

- **Nothing merges to `main` without CI passing.** Every pull request must pass lint, typecheck, tests, and build.
- **No secrets in Git.** Use `.env` for local secrets — it is gitignored and will never be committed.
- **Conventional commits.** Prefix commits with `feat:`, `fix:`, `chore:`, `test:`, `docs:`, or `refactor:`.
- **Every mutation is audit-logged.** If you add a new write endpoint, wire it through the audit service.

---

## Build phases

See [HANDOFF.md](./HANDOFF.md) for the full phased build plan.

| Phase | Status         | Description                                |
| ----- | -------------- | ------------------------------------------ |
| 0     | 🔄 In progress | Foundations & guardrails                   |
| 1     | ⏳ Pending     | Data layer, tenancy, security spine        |
| 2     | ⏳ Pending     | Auth UI, first-run wizard, user management |
| 3     | ⏳ Pending     | Jobs, Job Board, Job List                  |
| 4     | ⏳ Pending     | Job Traveler & file uploads                |
| 5     | ⏳ Pending     | Quoting module & PDF                       |
| 6     | ⏳ Pending     | Inventory & time tracking                  |
| 7     | ⏳ Pending     | Invoicing, reporting, notifications        |
| 8     | ⏳ Pending     | Windows packaging & backups                |
| 9     | ⏳ Pending     | Remote access                              |
