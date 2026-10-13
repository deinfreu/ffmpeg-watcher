# Technische Documentatie: REST API & TypeScript Internals (`ffmpeg-watcher` Orchestrator)

Dit document beschrijft de technische architectuur, de **REST API routes** (gebouwd met **ElysiaJS** en **Bun**), en de onderliggende **TypeScript-implementatie** van de Headless Orchestrator Server. 

> ⚠️ **Let op: Headless Architectuur & Decoupled GUI**
> Deze codebase (`ffmpeg-watcher`) omvat uitsluitend de **headless Orchestrator-server**. Deze draait 100% zonder ingebouwde grafische schermen. De grafische interface (GUI) is een **volledig losstaande applicatie** (gebouwd met React, Tailwind CSS en Shadcn UI) die in een eigen container of domein draait en communiceert met deze Orchestrator via REST API's en Server-Sent Events (SSE).

---

## 🛠️ Technische Stack & Architectuur

- **Runtime & Web Framework**: [Bun](https://bun.sh/) & [ElysiaJS](https://elysiajs.com/) (snelle, type-safe HTTP server).
- **Database**: PostgreSQL (via `postgres.js` client in `server/src/db/client.ts`) met automatische migraties.
- **Job Queue / Cache**: Valkey / Redis (via `ioredis` in `server/src/core/queue.ts`) voor in-memory taakverdeling.
- **Taal**: TypeScript (beheerd in `server/tsconfig.json`).
- **Synchronisatie**: NTP (Network Time Protocol) voor exacte timestamps tussen de server en workers.

---

## 📋 REST API Routes & TypeScript Internals

Hieronder staan alle REST API endpoints per categorie, afgestemd op de "11-stappen executie flow" en pull-based tasking van de workers.

### 1. Workers & Handshake (`/api/workers`)
Beheert de registratie en prestatiescores van verbonden workers.

| Methode | Route | Omschrijving |
| :--- | :--- | :--- |
| `POST` | `/api/workers/register` | Worker handshake: registreert de worker inclusief zijn FFMPEG-benchmark score en target pool. |
| `GET` | `/api/workers` | Haalt een lijst op met alle actieve geregistreerde workers. |
| `DELETE`| `/api/workers/:id` | Ontkoppelt een specifieke worker. |

### 2. Job Queue & Task Pulling (`/api/jobs`)
Beheert actieve en historische transcoding taken via Valkey en PostgreSQL, volgens het pull-based taakmodel.

| Methode | Route | Omschrijving |
| :--- | :--- | :--- |
| `GET` | `/api/jobs/next` | **Cruciaal:** Laat een worker de volgende beschikbare taak claimen (obv pool en complexity score). |
| `GET` | `/api/jobs/queue` | Inspecteert de actieve taken in de Valkey queue (`main_queue`). |
| `POST` | `/api/jobs` | Voegt een nieuwe transcode-taak toe (wordt intern geactiveerd na file stability check). |
| `GET` | `/api/jobs` | Haalt de jobgeschiedenis op uit PostgreSQL (historische data & parent-child relaties). |
| `GET` | `/api/jobs/:id` | Haalt gedetailleerde job-metadata op (incl. ffprobe data en xxHash checksums). |

### 3. Traffic Control & File Transfers (`/api/tickets` & `/api/files`)
Beveiligt disk I/O en netwerkbandbreedte via semaphores en HTTP chunking.

| Methode | Route | Omschrijving |
| :--- | :--- | :--- |
| `POST` | `/api/tickets/download` | Worker vraagt toestemming (ticket) om een brondocument te mogen downloaden. |
| `POST` | `/api/tickets/upload` | Worker vraagt toestemming (ticket) om een gerenderde video te mogen uploaden. |
| `GET` | `/api/files/download/:id`| Start de chunked HTTP-download van het videobestand (vereist geldig ticket). |
| `POST` | `/api/files/upload/:id` | Start de chunked HTTP-upload van de gerenderde video (vereist geldig ticket). |

### 4. Observability & Logging (`/api/logs`)
Voedt de persistente KPI header en log-exploratie van de losstaande web-GUI.

| Methode | Route | Omschrijving |
| :--- | :--- | :--- |
| `GET` | `/api/logs/stream` | **SSE Endpoint:** Server-Sent Events stream voor real-time logs en KPI's naar de React frontend. |
| `GET` | `/api/logs` | Haalt historische logs op met optionele filters en meertalige labels. |

### 5. Worker Pools (`/api/pools`)
Beheert de groepen waarin workers worden ingedeeld (bijv. `gpu-heavy`, `cpu-fast`).

| Methode | Route | Omschrijving |
| :--- | :--- | :--- |
| `GET` | `/api/pools` | Haalt alle worker pools op. |
| `POST` | `/api/pools` | Maakt een nieuwe worker pool aan. |

### 6. Workflows & Pipelines (`/api/workflows`)
Beheert visuele FFmpeg-pipeline workflows (opgeslagen als nodes en edges voor XYFlow).

| Methode | Route | Omschrijving |
| :--- | :--- | :--- |
| `GET` | `/api/workflows` | Overzicht van alle workflows. |
| `POST` | `/api/workflows` | Slaat een workflow op (JSONB voor nodes/edges en configuratie). |

### 7. Encoder Presets (`/api/presets`)
Beheert FFMPEG configuraties.

| Methode | Route | Omschrijving |
| :--- | :--- | :--- |
| `GET` | `/api/presets` | Haalt alle encoder presets op. |
| `POST` | `/api/presets` | Maakt een nieuwe encoder preset aan. |

### 8. System Settings (`/api/settings`)
Beheert configuraties zoals thema-voorkeuren en taalbestanden voor de externe GUI.

| Methode | Route | Omschrijving |
| :--- | :--- | :--- |
| `GET` | `/api/settings/:key` | Haalt een instelling op (bijv. global theme configuratie). |
| `PUT` | `/api/settings/:key` | Slaat een instelling op in de PostgreSQL database. |

---

## 📁 Overzicht Bestandsstructuur

```text
server/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                 # Applicatie entrypoint (init DB, migrations, Valkey, Elysia)
    ├── core/
    │   ├── queue.ts             # Valkey client & queue helpers (Complexity score integratie)
    │   ├── fileWatcher.ts       # Bestandsdetectie & Stability Polling logica
    │   └── tickets.ts           # Traffic control semaphores (Download/Upload lock logic)
    ├── db/
    │   ├── client.ts            # PostgreSQL connection pool (postgres.js)
    │   └── migrations.ts        # Automatische migraties (pools, workflows, jobs, settings)
    ├── utils/
    │   ├── logger.ts            # Gestructureerde stdout logging incl. NTP-timestamps
    │   └── checksum.ts          # xxHash generatie voor file integrity verificatie
    └── api/
        ├── index.ts             # ElysiaJS app setup, middleware & SSE configuratie
        └── routes/
            ├── workers.ts       # Handshake & Benchmark registratie endpoints
            ├── jobs.ts          # /jobs/next task-pulling & geschiedenis endpoints
            ├── tickets.ts       # Ticket toewijzing endpoints
            ├── files.ts         # Chunked HTTP file transfers
            ├── logs.ts          # SSE streams en historische logs
            ├── pools.ts         # Worker pools CRUD
            ├── workflows.ts     # Workflow & pipeline CRUD
            ├── presets.ts       # Encoder presets CRUD
            └── settings.ts      # Instellingen CRUD
```
