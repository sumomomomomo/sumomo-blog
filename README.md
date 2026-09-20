# Sumomo Blog

A modern blog created with **Astro** (Static Site Generation), **React**, and **Docker**. It features a "Zero Trust" infrastructure pipeline using Cloudflare Tunnels, R2 object storage, and a specialized Nginx reverse proxy for simultaneous HTTP and SSH stream forwarding.

## 🏗 Architecture

### Server Roles

| Hostname | IP | Role | Configuration | Domain |
| --- | --- | --- | --- | --- |
| **satono-crown** | `192.168.1.13` | **Dev Environment** | Bare Metal  | - |
| **satono-diamond** | `192.168.1.12` | **Production** | Docker Compose | `https://sumomo.horse` |
| **seiun-sky** | `192.168.1.11` | **SSH Target** | *(Planned Isolation)* | `https://george.sumomo.horse` |

### Technology Stack

* **Frontend:** Astro (Static Site Generation)
* **Client-side:** React (TTS component and POS document portal with `client:load`)
* **Styling:** Tailwind CSS v4 (inline utility classes with dark mode support)
* **Ingress:** Cloudflare Tunnel (`cloudflared`)
* **Proxy:** Nginx (Alpine Unprivileged) - Handles Layer 7 (Web) & Layer 4 (SSH)
* **Storage:** Cloudflare R2 (S3-compatible) + Aggressive Edge Caching

---

## 🚀 Getting Started

### Prerequisites

* Node.js v24+
* Docker & Docker Compose
* **Rclone** (Required for syncing assets)

### 1. Local Development (`satono-crown`)

The development environment runs directly on the metal for speed, bypassing Docker.

```bash
# Clone & Install
git clone https://github.com/sumomomomomo/sumomo-blog.git
cd sumomo-blog
npm install          # Root - installs Husky
cd app
npm install          # App - installs Astro + dependencies

# Run Dev Server (Exposed to LAN)
npm run dev
# Access at http://192.168.1.13:3000

# Test production-like build locally
npm run build        # Builds static files to dist/
npm run preview      # Serves static files (same as production)
# Access at http://192.168.1.13:3000
```

**Development vs Production:**
- `npm run dev` — Runs Astro's dev server with hot-reload (requires Node.js)
- `npm run build && npm run preview` — Tests the static build locally (matches production behavior)

### 2. Production Deployment (`satono-diamond`)

Production runs in a strictly isolated Docker stack.

1. **Set Environment Variables:**
Create a `.env` file in the project root:
```env
CF_TOKEN=<your_tunnel_token>

```


2. **Build & Start:**
```bash
docker compose up -d --build

```



### 3. Asset Management (R2)

Images are **not** stored in Git. They are hosted on Cloudflare R2 and served via `cdn.sumomo.horse` to maximize performance and minimize repository size.

**Upload Workflow:**
*(Planned)*
We use `rclone` to sync local assets to the R2 bucket.

```bash
# Sync local folder to Cloudflare R2
rclone sync ./content/images sumomo-r2:sumomo-assets/

```

---

## 🔧 Infrastructure Details

### 1. Nginx: The Hybrid Proxy

We use a custom `nginx.conf` to multiplex traffic based on the incoming port from the Cloudflare Tunnel.

| Traffic Type | Port | Route | Config File |
| --- | --- | --- | --- |
| **HTTP (Web)** | `80` | Proxies to Static App (`app:80`) | `nginx/default.conf` |
| **HTTP (API)** | `80` | Forwards `/api/v1/*` to the POS Spring backend (`192.168.1.35:18080`), path preserved | `nginx/default.conf` |
| **SSH (Stream)** | `2222` | Forwards to `seiun-sky` (`192.168.1.11:22`) | `nginx/nginx.conf` |

> ⚠️ **Warning:** `192.168.1.34:8080` is the OCR endpoint. It must never be exposed
> through Nginx, Cloudflare, or any public route — only the Spring backend may reach it.
> Public API access goes through `https://sumomo.horse/api/v1/` only.

**Note on Permissions:**
We use the `nginxinc/nginx-unprivileged:alpine` image. The `nginx.conf` is strictly configured to write PIDs to `/tmp/nginx.pid` to avoid root permission errors.

### 2. CI/CD Pipeline (GitHub Actions)

**CI Workflow (`ci.yml`):**
Runs on every PR to `main`. Installs root and app dependencies, runs Biome linting, and builds the project to ensure code quality before merging.

**Deploy Workflow (`deploy.yml`):**
Deployments utilize a **Hard Reset Strategy** to prevent configuration drift.

1. **Connect:** SSH into `satono-diamond` via Cloudflare Tunnel.
2. **Reset:** `git reset --hard origin/main` (Destroys local changes).
3. **Rebuild:** `docker compose up -d --build app nginx`.

The deployment script **explicitly excludes** the `tunnel` container from the rebuild command. Restarting the tunnel would sever the active SSH connection, causing the pipeline to fail mid-deployment.

---

## 🔐 POS Document Portal (`/pos/`)

The POS portal is served at `https://sumomo.horse/pos/` (not linked in the public
navigation). It signs in via Google OAuth2, uploads ZIP archives, monitors ingestion
jobs, searches records, and views record/document metadata.

- **Frontend route:** `/pos/` (static Astro page mounting a React app with `client:load`)
- **API path:** same-origin `/api/v1/...` (the browser never talks to LAN addresses directly)
- **Nginx upstream:** `http://192.168.1.35:18080` (`/api/v1/` prefix is preserved)
- **Google callback URL (production):** `https://sumomo.horse/api/v1/login/oauth2/code/google`
- **Post-login redirect:** `/pos/`
- Upload limit: 10 MiB ZIP (`client_max_body_size 11m` in Nginx)

### Frontend commands

```bash
cd app
npm ci
npm run dev        # dev server (POS portal at /pos/)
npm test -- --run  # Vitest + Testing Library (mocked backend)
npm run typecheck  # astro check
npm run lint       # biome check
npm run build      # static build to dist/
```

### Nginx gateway verification

```bash
./nginx/test-gateway.sh   # spins up a stub backend; never touches the LAN
docker compose config --quiet
```

---

## 📂 Project Structure

```text
.
├── package.json           # Root - Husky setup
├── package-lock.json      # Root lock file
├── .husky/
│   └── pre-commit         # Auto-format on commit
├── .github/workflows/
│   ├── ci.yml             # CI checks (lint + build)
│   └── deploy.yml         # Production deployment
├── app/                   # Astro Application
│   ├── src/               # Pages, Layouts, Components
│   ├── astro.config.mjs   # Static output mode
│   └── Dockerfile         # Multi-stage: Node.js build → Nginx serve
├── nginx/
│   ├── default.conf       # HTTP Block (Web)
│   └── nginx.conf         # Main Config + Stream Block (SSH)
├── docker-compose.yml     # Orchestration
└── README.md              # Documentation

```

---

## 🖥 Host Infrastructure (Home Lab)

This project is deployed on a private, bare-metal infrastructure to demonstrate full-stack control from the hypervisor to the frontend.

| Component | Technology | Description |
| --- | --- | --- |
| **Hypervisor** | **Proxmox VE** | Managed bare-metal virtualization node (`ecclesiastes`). |
| **Virtualization** | **LXC** | Lightweight system containers (`satono-diamond`, `satono-crown`) used to partition development and production environments with minimal overhead. |
| **Orchestration** | **Docker Compose** | Application-level containerization nested within LXC for portability and isolation. |
| **Network Security** | **Cloudflare Zero Trust** | Eliminates the need for open ports or public static IPs. |
| **Storage** | **ZFS** | ZFS pools provide snapshotting and data integrity. |

### Infrastructure Topology

* **Node: `ecclesiastes` (Proxmox VE)**
    * **LXC: `satono-diamond` (Production)**
        * Runs the active Docker Compose stack (`app` + `nginx` + `tunnel`).
        * Connected to Cloudflare Edge via secure outbound tunnel.
    * **LXC: `satono-crown` (Development)**
        * Mirror environment for development.
    * **LXC: `seiun-sky` (Utility)**
        * Accessible via SSH Stream forwarding through `satono-diamond`'s Nginx proxy.

---

## 🤝 Contributing

### Code Style & Linting

This project uses **Biome** for linting and formatting. A pre-commit hook is configured to automatically format code and run lint checks before each commit.

**Before creating a PR:**

1. **Install dependencies:**
  ```bash
  npm install          # Root - installs Husky
  cd app
  npm install          # App - installs Astro + dependencies
  ```

> **Note:** After cloning, run `npm install` at the project root to activate Husky pre-commit hooks. The hook runs `biome check --write src/` in the `app/` directory before each commit.

2. **Run the linter manually** (the pre-commit hook does this automatically):
  ```bash
  npm run lint      # Check for issues
  npm run format    # Auto-fix formatting issues
  ```

3. **Ensure the build passes:**
  ```bash
  npm run build
  ```

### Automated Checks

- **Pre-commit Hook:** Runs `biome check --write src/` in the `app/` directory automatically before each commit (requires root `npm install` to activate)
- **CI Workflow (`ci.yml`):** Runs linting and build checks on every PR to `main`

### VSCode Setup

The project includes `.vscode/settings.json` for automatic format-on-save. Install the [Biome VSCode extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) for the best experience.

