# Hess Solutions Shop ERP — Engineering Handoff & Build Plan

> **Audience:** Claude Code (and any human developer assisting).
> **Author of spec:** Generated from a requirements interview with the product owner (non-technical founder).
> **Prototype reference:** A working single-file HTML prototype (`hess_shop_erp.html`) accompanies this document. It defines the visual design, color system, data shapes, and feature behavior. **Treat it as the UX source of truth, not the architecture source of truth.** We are rebuilding it properly.

---

## 0. How to read this document

This is a phased, multi-agent build plan. Each phase has:
- **Goal** — what "done" means
- **Tasks** — discrete units of work
- **Quality gate** — what must pass before the phase merges and the next begins
- **Definition of Done (DoD)** — the checklist

**The product owner is a total beginner.** Every command Claude Code asks them to run must be copy-pasteable with a one-line explanation of what it does and what they should see. Never assume prior terminal, Git, or Node knowledge. When something needs the owner to make a decision, present it as a numbered choice, not an open question.

**Quality gates are strict.** Nothing merges to `main` without all checks green. This is non-negotiable per the owner's instruction.

---

## 1. Product vision

A machine-shop ERP that runs as a **self-contained Windows application** for Hess Solutions today, architected from day one to become a **multi-tenant SaaS** sold to other shops later.

**Guiding principle for every decision:** *"Would this choice make it harder to sell seats to another company later?"* If yes, reconsider. We build single-tenant-deployed but multi-tenant-aware.

### What it replaces
Job tracking, inventory management, customer records, quoting, invoicing, time tracking, and shop-floor job travelers — currently spread across paper, spreadsheets, and memory.

---

## 2. Confirmed requirements (from owner interview)

| Area | Decision |
|---|---|
| **Deployment** | Installable Windows `.exe`. Short setup wizard (2–3 screens): choose install folder, set Super Admin account, set port/data location. |
| **Server model** | Runs a local server on a Windows machine; users on the shop LAN reach it via browser. Remote access is a **later** phase. |
| **Users (initial)** | 1–5 users at Hess. |
| **SaaS model (future)** | **Each company gets their own isolated install + database.** (Single-tenant deployment, repeated per customer.) |
| **File storage** | Real file uploads required — blueprints (PDF), setup pictures, job pictures (images). Must store and retrieve actual files. |
| **Roles** | **Super Admin** (controls user access + everything, including system settings), **Admin**, **Operator**. Super Admin is above Admin. |
| **Auth method** | **Super Admin chooses** the operator login style — full email/password OR quick PIN/select login for the shop floor. Build both; make it a system setting. |
| **Notifications** | Email alerts for overdue jobs, low stock, etc. |
| **Quoting** | Full quoting workflow: labor rate × run time + material cost + markup → quoted price. Generates a **PDF quote**. **Visible to Admin and above only.** |
| **Time tracking** | Per-job time tracking **and** a daily clock in/out for each operator. |
| **Modules in v1** | Everything: jobs, inventory, customers, traveler, quoting, **invoicing (build our own, no QuickBooks/Xero integration)**, and **reporting** (revenue per customer, job profitability, on-time %). |
| **Backups** | Super Admin configurable — local folder, external drive/NAS, and cloud (OneDrive/Google Drive/Dropbox) options. |
| **Customer portal** | Not in v1. **Design the database schema to support it later** (don't build the UI). |
| **Mobile/tablet** | Single responsive build that works on shop-floor tablets and office desktops. |
| **Audit trail** | **Full detailed audit log** — who changed what, when, old value vs new value. |
| **White-labeling** | **Build from day one.** Logo + theme colors swappable per deployment. Hess gold/black is the default theme. |
| **Quality gates** | **Strict.** Full automated test coverage + CI/CD. Nothing merges without passing. |
| **Owner skill level** | Total beginner. Claude Code sets up everything; owner follows numbered steps. |

---

## 3. Recommended technology stack

These choices optimize for: (a) packaging as a Windows `.exe`, (b) one responsive codebase for desktop + tablet, (c) clean path to multi-tenant SaaS, (d) a beginner being able to run it.

### 3.1 Core stack

| Layer | Choice | Why |
|---|---|---|
| **App shell / packaging** | **Electron** (wraps the web app + Node server into one Windows `.exe`) | Produces a true double-click installer via Electron Forge / electron-builder. Bundles Node, the server, and the database engine so the owner installs nothing else. |
| **Backend runtime** | **Node.js (LTS)** + **TypeScript** | One language across front and back. TypeScript catches errors before runtime — important for a strict-quality build. |
| **API framework** | **Fastify** (or NestJS if we want more structure) | Fast, well-typed, great validation story. NestJS is worth considering because its module/guard system maps cleanly onto our role-based access control and future multi-tenancy. **Recommendation: NestJS** for the structure it enforces on a large, long-lived app. |
| **Database** | **PostgreSQL** (bundled portable build for the local `.exe`; managed instance for SaaS) | The owner asked about SQL "or something better." Postgres is the right answer: rock-solid, handles JSON for flexible fields, scales to SaaS unchanged, strong audit/row-level-security features we'll use for multi-tenancy. We bundle a portable Postgres with the installer so the owner needs zero DB setup. *(Alternative for ultra-simple single-file: SQLite. We are NOT using it as the primary because moving from SQLite to Postgres later is exactly the kind of rework we're trying to avoid. Build on Postgres now.)* |
| **ORM / DB layer** | **Prisma** | Type-safe queries, automatic migrations, readable schema file. Migrations are auditable and reversible — feeds our quality gates. |
| **Frontend** | **React + TypeScript + Vite** | Component reuse, huge ecosystem, easy responsive design. Vite is fast and simple. |
| **Styling** | **Tailwind CSS** + CSS variables for theming | The white-label theme tokens become CSS variables driven by a per-deployment theme config. Matches how the prototype already themes with `--gold`, `--darkbg`, etc. |
| **Auth** | **Lucia** or **Auth.js**, session-based, with **argon2** password hashing and a separate PIN flow | Session cookies (not long-lived JWTs) are safer for a browser app on a LAN. PIN login is a second credential type on the same user. |
| **File storage** | **Local filesystem** (in the app data dir) behind an abstraction layer, with an **S3-compatible adapter** ready for SaaS | The abstraction means local-disk now, cloud object storage later, no code rewrite. |
| **PDF generation** | **Playwright** (render an HTML template to PDF) or **pdf-lib** | Quotes and invoices render as branded PDFs. Playwright gives pixel-perfect HTML-to-PDF using the same theme. |
| **Email** | **Nodemailer**, SMTP configured by Super Admin | Owner sets their email provider in settings. Works with Gmail/Office365/etc. |
| **Background jobs** | **node-cron** (in-process) for v1; **BullMQ + Redis** if volume grows | Overdue-job checks, nightly backups, low-stock scans run on a schedule. |
| **Testing** | **Vitest** (unit), **Supertest** (API), **Playwright** (end-to-end) | Covers the strict-gate requirement across all layers. |
| **CI/CD** | **GitHub Actions** | Runs lint + typecheck + tests + build on every PR. Blocks merge on failure. |

### 3.2 Why not simpler?
A beginner might wonder why this isn't just "one HTML file forever." The prototype proves the *idea*; it can't enforce security, multi-user data integrity, audit logging, backups, or resale. Those are exactly the things that bite later. We invest in the real stack now so Phase work is additive, never a rewrite.

---

## 4. Security & access-control architecture

Security is a first-class requirement, not a phase. Apply these from commit one.

### 4.1 Role hierarchy (RBAC)

```
SUPER_ADMIN  — full control; manages users & roles; system settings; backups;
               auth-method toggle; white-label/theme; sees & edits everything.
ADMIN        — full operational control: jobs, inventory, customers, quoting,
               invoicing, reporting, traveler production data, costs.
OPERATOR     — sees job board, job list, dashboard, inventory (read), customers (no),
               quoting (no). In the job traveler, OPERATOR can ONLY add/edit the
               "Operator Notes" field and clock in/out. All other traveler data is
               read-only. Cannot create/edit/delete jobs.
```

Implement as a **permissions matrix**, not hardcoded role checks scattered in code. One source of truth (e.g. a `can(user, action, resource)` function backed by a permissions table). This makes adding roles (Estimator, Lead Operator) trivial later without touching every endpoint.

**Enforce on the server, always.** The UI hides what a user can't do, but the API must independently reject unauthorized actions. Never trust the client. Every endpoint checks permission server-side.

### 4.2 Authentication
- Passwords hashed with **argon2id** (never plaintext, never MD5/SHA alone).
- **Super Admin sets the operator login mode** (system setting): `PASSWORD` or `PIN`. A user can have both a password and a numeric PIN; the active mode governs the shop-floor login screen.
- Sessions: HTTP-only, Secure, SameSite cookies. Reasonable idle timeout (configurable).
- Rate-limit login attempts; lockout after N failures.
- First-run wizard creates the Super Admin; no default credentials ship in the build.

### 4.3 Multi-tenancy readiness (build now, even single-tenant)
- Every domain table carries a `tenant_id` (a.k.a. `company_id`) from day one, even though Hess is the only tenant in a given install.
- Wrap all queries so they're automatically scoped to the current tenant (Prisma middleware or Postgres Row-Level Security). This is the single most important "don't make it hard to sell later" decision.
- Theme/branding, settings, and users all hang off the tenant.

### 4.4 Audit log
- A dedicated `audit_log` table: `who, when, action, entity_type, entity_id, old_value (JSON), new_value (JSON), ip`.
- Write to it from a central service on every create/update/delete of business data (jobs, costs, customers, users, settings, invoices).
- Immutable: append-only, never updated or deleted through the app.

### 4.5 General hardening
- Validate and sanitize **all** input server-side (Zod schemas on every endpoint).
- Parameterized queries only (Prisma handles this).
- File uploads: validate type + size, store outside web root, generate safe filenames, scan extension/MIME, never execute.
- Secrets (SMTP creds, cloud backup tokens) encrypted at rest in the DB or OS credential store — never in plain config files or Git.
- HTTPS for the remote-access phase (self-signed or Let's Encrypt depending on deployment).
- Dependency scanning in CI (`npm audit`, Dependabot).

---

## 5. Data model (initial schema sketch)

Prisma-style, abbreviated. Claude Code will refine, but these entities and the multi-tenant + audit fields are mandatory. Every table includes `id`, `tenantId`, `createdAt`, `updatedAt`.

```
Tenant            id, name, slug, themeConfig(JSON), settings(JSON)

User              id, tenantId, name, email(unique per tenant), passwordHash,
                  pinHash(nullable), role(SUPER_ADMIN|ADMIN|OPERATOR),
                  active, lastLoginAt

Customer          id, tenantId, businessName, address, email, phone,
                  billingMethod, shippingMethod, notes
                  // schema ready for future portal login: portalEnabled, portalUserId(nullable)

Job               id, tenantId, jobNumber(unique per tenant), customerId,
                  partName, partNumber, quantity, dueDate, createdDate,
                  department(enum: 10 stages), priority(High|Normal|Low),
                  progressPct, rfqNumber, poNumber, adminNotes

Department enum:  QUOTING, QUOTE_ACCEPTED, ORDER_STOCK, STOCK_RECEIVED,
                  ON_DECK, ON_MACHINE, FINISHING, QUALITY_CONTROL,
                  SHIPPING, SHIPPED

Traveler          id, tenantId, jobId(1:1), runTimePerPiece, laborTime,
                  shippedDate, partsScrapped, shippingMethod, jobCost,
                  quotedMaterialCostPerPart, actualMaterialCostPerPart,
                  materialCertRequired(bool), shopLocation, operatorNotes
                  // operatorNotes is the only field OPERATOR may write

TravelerTool      id, tenantId, travelerId, position(1-20), description

FileAttachment    id, tenantId, jobId, kind(BLUEPRINT|SETUP_PHOTO|JOB_PHOTO),
                  fileName, storagePath, mimeType, sizeBytes, uploadedBy

Quote             id, tenantId, customerId, jobId(nullable), laborRate,
                  estRunTime, materialCost, markupPct, calculatedPrice,
                  status(DRAFT|SENT|ACCEPTED|REJECTED), pdfPath
                  // ADMIN+ visibility only — enforce in permission layer

Invoice           id, tenantId, customerId, jobId(nullable), invoiceNumber,
                  lineItems(JSON), subtotal, tax, total,
                  status(DRAFT|SENT|PAID|OVERDUE), pdfPath, dueDate, paidDate

InventoryItem     id, tenantId, sku(unique per tenant), name, category,
                  quantity, unit, reorderPoint, unitCost

StockMovement     id, tenantId, itemId, delta, reason, userId
                  // every adjustment logged, feeds audit + reporting

TimeEntry         id, tenantId, userId, jobId(nullable), type(JOB|DAILY),
                  clockIn, clockOut, durationMinutes
                  // JOB = per-job tracking; DAILY = daily shift clock in/out

Notification      id, tenantId, type, message, targetUserId(nullable),
                  read, emailedAt, createdAt

AuditLog          id, tenantId, userId, action, entityType, entityId,
                  oldValue(JSON), newValue(JSON), ip, createdAt

SystemSetting     id, tenantId, key, value(JSON)
                  // authMode, smtp config, backup config, theme, etc.
```

---

## 6. The phased build plan (multi-agent, GitHub, strict gates)

Each phase = a branch → PR → all checks green → merge → tag. Do not start a phase until the previous one is merged and tagged. Use **conventional commits** and a PR template with the DoD checklist.

### Multi-agent approach
Run distinct "agent roles" (you can use separate Claude Code sessions or clearly-scoped task runs):
- **Architect agent** — sets up scaffolding, schema, CI, conventions. (Phase 0–1)
- **Backend agent** — API endpoints, services, permissions, audit. (Phases 2–7)
- **Frontend agent** — React UI matching the prototype. (Phases 2–7, after each backend slice)
- **QA agent** — writes/extends tests, runs the gate, reviews coverage before merge. Acts as the gatekeeper on every PR.
- **Packaging agent** — Electron wrapper, installer, backups. (Phase 8)

The QA agent must approve every PR. No self-merge without QA-agent sign-off.

---

### Phase 0 — Foundations & guardrails
**Goal:** A repo a beginner can run, with the quality machine already enforcing standards on an empty app.

**Tasks**
1. Initialize Git repo + GitHub remote. Set up branch protection on `main` (require PR, require checks).
2. Scaffold the monorepo: `/server` (NestJS), `/web` (React+Vite), `/desktop` (Electron), `/packages/shared` (types).
3. Configure TypeScript (strict mode), ESLint, Prettier across all packages.
4. Set up Prisma + a local Postgres (dockerized for dev; document the beginner path).
5. GitHub Actions pipeline: install → lint → typecheck → test → build. Wire it to block merges.
6. Add PR template with DoD checklist + conventional-commit guide.
7. Write a top-level `README` with copy-paste setup steps for a beginner.

**Quality gate / DoD**
- [ ] `main` is protected; a failing check blocks merge (prove it with a deliberately failing test, then fix).
- [ ] `npm run dev` brings up an empty but running app on all three surfaces.
- [ ] CI is green on an empty "hello world" endpoint + component.
- [ ] README setup steps validated by following them from scratch.

---

### Phase 1 — Data layer, tenancy, and security spine
**Goal:** The schema, multi-tenant scoping, RBAC skeleton, and audit logging exist before any feature uses them.

**Tasks**
1. Implement the full Prisma schema from §5 (all tables, `tenantId` everywhere, enums).
2. Seed script: one Tenant (Hess), one Super Admin (created via wizard later; seed a dev one), sample data mirroring the prototype.
3. Tenant-scoping middleware (Prisma extension or Postgres RLS). Write a test proving cross-tenant data is invisible.
4. RBAC permissions matrix + `can()` service. Unit-test every role × action combination.
5. Audit-log service + a global interceptor that records create/update/delete with old/new values.
6. Auth foundation: argon2 hashing, session management, login/logout endpoints, rate limiting.

**Quality gate / DoD**
- [ ] Cross-tenant isolation test passes (Tenant A cannot read Tenant B).
- [ ] Permission matrix tests cover all roles; unauthorized calls return 403.
- [ ] Audit entries written and verified for a sample mutation.
- [ ] Passwords never stored in plaintext (test asserts hash format).
- [ ] 100% of critical-path (auth, tenancy, permissions, audit) lines tested.

---

### Phase 2 — Auth UI, first-run wizard, user management
**Goal:** Owner can install-equivalent (run the wizard), create the Super Admin, and manage users with role assignment + the auth-mode toggle.

**Tasks**
1. First-run setup wizard (2–3 screens): organization name, Super Admin account, data folder/port. (Web flow now; Electron wraps it in Phase 8.)
2. Login screen supporting both PASSWORD and PIN modes; honor the system setting.
3. Super Admin user-management UI: create/edit/deactivate users, set roles, set PIN/password.
4. System Settings page (Super Admin): auth-mode toggle, theme, SMTP, backup config placeholders.
5. Apply white-label theme tokens from tenant config (CSS variables; Hess gold/black default).

**Quality gate / DoD**
- [ ] E2E test: fresh install → wizard → Super Admin login → create an Operator.
- [ ] Switching auth mode changes the operator login screen (tested).
- [ ] Operator cannot reach user-management endpoints (403, tested).
- [ ] Theme swap verified (change tokens → UI re-skins).

---

### Phase 3 — Jobs, Job Board (drag & drop), Job List
**Goal:** Core job tracking matching the prototype, server-backed, permission-aware.

**Tasks**
1. Job CRUD endpoints (Admin+ to write; Operator read + department-move only).
2. Job Board: 10 department columns, oldest-on-top sort, due-date urgency colors, **drag-and-drop** to move departments (writes to server, audit-logged).
3. Job List spreadsheet view: search, filters, inline department change, progress.
4. Dashboard: active/overdue/urgent/shipped counts, jobs-by-department, urgent alerts.
5. Responsive layout verified on tablet width.

**Quality gate / DoD**
- [ ] Drag-and-drop persists and audit-logs the move; reload reflects it.
- [ ] Operator can move department but cannot edit/create/delete (tested both UI + API).
- [ ] Sorting and urgency-color logic unit-tested against fixed dates.
- [ ] Works at tablet and desktop breakpoints (E2E viewport tests).

---

### Phase 4 — Job Traveler (role-gated) + file uploads
**Goal:** The traveler with strict operator/admin field gating and real file storage.

**Tasks**
1. Traveler view: read-only job info; admin-editable production data (incl. **Quoted Material Cost/Part** and **Actual Material Cost/Part**), cert checkbox, tool list (1–20), shop location.
2. **Operator can only edit Operator Notes** and clock in/out — enforced server-side.
3. File upload service (blueprints/PDF, setup & job photos) via the storage abstraction; thumbnails for images; size/type validation.
4. File list + download/preview in the traveler.

**Quality gate / DoD**
- [ ] API rejects operator writes to any field except operatorNotes (tested).
- [ ] Upload validates type/size; malicious filename neutralized (tested).
- [ ] Files persist, download intact, and are tenant-scoped.
- [ ] Cost fields visible to Admin+; behavior matches prototype.

---

### Phase 5 — Quoting module + PDF
**Goal:** Admin-only quoting workflow producing a branded PDF.

**Tasks**
1. Quote builder: labor rate × est run time + material cost + markup% → calculated price.
2. Quote statuses (Draft/Sent/Accepted/Rejected); accepting can spawn/link a Job.
3. Branded PDF generation (theme-aware) for the quote.
4. **Admin+ visibility only**, enforced server-side and hidden in Operator UI.

**Quality gate / DoD**
- [ ] Price calculation unit-tested with multiple scenarios (rounding correct).
- [ ] Operator cannot list/read/create quotes (403 tested).
- [ ] PDF renders with correct branding and figures (snapshot/E2E).

---

### Phase 6 — Inventory + Time tracking
**Goal:** Inventory management with movement logging, and both time-tracking modes.

**Tasks**
1. Inventory CRUD (Admin+ write), stock-level bars, reorder status.
2. Stock adjustments → `StockMovement` + audit; low-stock detection feeds notifications.
3. **Per-job time tracking** (clock on/off a specific job) and **daily clock in/out** per operator.
4. Time reports per job and per user (foundation for payroll export later).

**Quality gate / DoD**
- [ ] Stock math correct; movements logged and audited.
- [ ] Both time modes record accurate durations (tested across edge cases: midnight, missing clock-out).
- [ ] Low-stock crossing triggers a notification (tested).

---

### Phase 7 — Invoicing, Reporting, Notifications (email)
**Goal:** Money-out, insight, and alerts.

**Tasks**
1. Invoicing module (build our own): line items, totals/tax, statuses, branded PDF, mark-paid.
2. Reporting: revenue per customer, job profitability (quoted vs actual material + labor), on-time %.
3. Email notifications via Super-Admin-configured SMTP: overdue jobs, low stock, (extensible).
4. Scheduled jobs (node-cron): nightly overdue scan, low-stock scan.

**Quality gate / DoD**
- [ ] Invoice math + tax tested; PDF correct; mark-paid audited.
- [ ] Reports reconcile against seeded data (deterministic test fixtures).
- [ ] Email sends in a test harness (mock SMTP); failures handled gracefully.

---

### Phase 8 — Windows packaging, backups, install wizard
**Goal:** A double-clickable Windows installer the owner runs with a short wizard.

**Tasks**
1. Electron wrapper bundling the server + portable Postgres + web build.
2. Installer via electron-builder (NSIS): 2–3 screen wizard (folder, Super Admin, port/data location).
3. **Backups (Super Admin configurable):** local folder, external drive/NAS, cloud (OneDrive/Google Drive/Dropbox). Scheduled + on-demand; backs up DB **and** uploaded files; test a restore.
4. Auto-start option; first-run launches the setup wizard in the default browser.
5. Signed build (code-signing cert) to reduce Windows SmartScreen warnings — note this needs a cert the owner purchases; document it.

**Quality gate / DoD**
- [ ] Clean Windows VM: install → wizard → app runs in browser, no extra installs.
- [ ] Backup runs to each configured target; **restore verified** on a fresh install.
- [ ] Uninstall is clean; data folder behavior documented.

---

### Phase 9 — Remote access (later milestone)
**Goal:** Securely reach the shop server from outside the LAN.

**Tasks (defer until owner is ready)**
1. HTTPS/TLS, reverse proxy, hardened session/cookie config for WAN.
2. Choose approach: secure tunnel (e.g. Tailscale/Cloudflare Tunnel — easiest for a beginner) vs port-forward + dynamic DNS.
3. Optional 2FA for Admin+ when exposed to the internet.

**Quality gate / DoD**
- [ ] Pen-test checklist passed; no plaintext transport; brute-force protections verified.

---

## 7. SaaS evolution path (keep in view, don't build yet)
- **Tenancy is already in the schema**, so the leap to hosted multi-tenant is mostly infrastructure, not rewrite.
- White-label theming already per-tenant.
- File storage abstraction swaps local disk → S3-compatible object storage.
- Add: billing/seat management, central tenant provisioning, the deferred **customer portal** (schema is ready).
- The "each company gets their own DB" model the owner chose maps to **database-per-tenant** — strongest isolation, easiest to sell on data-privacy grounds. Keep the option open by not coupling code to a single shared schema.

---

## 8. Conventions & quality standards (apply throughout)
- **Branches:** `phase-N/short-description`. PR into `main`. Squash-merge.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`…).
- **Every PR:** lint + typecheck + unit + API + relevant E2E all green; QA-agent review; DoD checklist ticked.
- **Coverage:** critical paths (auth, tenancy, permissions, audit, money) require full coverage; UI/feature code pragmatic-but-meaningful. (Owner chose strict — bias toward more tests when unsure.)
- **No secrets in Git.** Use a local `.env` (gitignored) for dev and OS credential store / encrypted settings in the packaged app.
- **Accessibility & responsiveness** checked on tablet + desktop each UI phase.
- **Every mutation audit-logged.** If a new write path skips the audit interceptor, the PR fails review.

---

## 9. First message to give Claude Code

> "Read `HANDOFF.md` in full. We're building the Hess Solutions Shop ERP per this spec. I'm a non-technical owner — give me copy-paste commands with plain-English explanations and tell me what I should see after each. Start with **Phase 0** only. Set up the repo, scaffolding, and the strict CI quality gate. Do not begin Phase 1 until Phase 0 is merged and tagged, and confirm with me before merging. Use the accompanying `hess_shop_erp.html` prototype as the UX and data-shape reference."

---

## 10. Open items for the owner to provide when asked
- A code-signing certificate (Phase 8) to avoid Windows security warnings — Claude Code will explain how/where to get one when we reach packaging.
- SMTP email account details (Phase 7) for sending alerts.
- The high-resolution Hess Solutions logo file (the prototype embeds a web-sized copy).
- Decisions on cloud backup provider account (Phase 8).

*End of handoff.*
