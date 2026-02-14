# Sumomo Blog

A modern blog created with **Astro** (SSR), **Tailwind CSS**, and **Docker**. It features a "Zero Trust" infrastructure pipeline using Cloudflare Tunnels, R2 object storage, and a specialized Nginx reverse proxy for simultaneous HTTP and SSH stream forwarding.

## 🏗 Architecture

### Server Roles

| Hostname | IP | Role | Configuration | Domain |
| --- | --- | --- | --- | --- |
| **satono-crown** | `192.168.1.13` | **Dev Environment** | Bare Metal  | - |
| **satono-diamond** | `192.168.1.12` | **Production** | Docker Compose | `https://sumomo.horse` |
| **seiun-sky** | `192.168.1.11` | **SSH Target** | *(Planned Isolation)* | `https://george.sumomo.horse` |

### Technology Stack

* **Frontend:** Astro (Server-Side Rendering mode)
* **Adapter:** `@astrojs/node` (Standalone)
* **Styling:** Tailwind CSS
* **Ingress:** Cloudflare Tunnel (`cloudflared`)
* **Proxy:** Nginx (Alpine Unprivileged) - Handles Layer 7 (Web) & Layer 4 (SSH)
* **Storage:** Cloudflare R2 (S3-compatible) + Aggressive Edge Caching

---

## 🚀 Getting Started

### Prerequisites

* Node.js v20+
* Docker & Docker Compose
* **Rclone** (Required for syncing assets)

### 1. Local Development (`satono-crown`)

The development environment runs directly on the metal for speed, bypassing Docker.

```bash
# Clone & Install
git clone https://github.com/sumomomomomo/sumomo-blog.git
cd sumomo-blog/app
npm install

# Run Dev Server (Exposed to LAN)
npm run dev
# Access at http://192.168.1.13:3000

```

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
| **HTTP (Web)** | `80` | Proxies to Astro App (`app:3000`) | `nginx/default.conf` |
| **SSH (Stream)** | `2222` | Forwards to `seiun-sky` (`192.168.1.11:22`) | `nginx/nginx.conf` |

**Note on Permissions:**
We use the `nginxinc/nginx-unprivileged:alpine` image. The `nginx.conf` is strictly configured to write PIDs to `/tmp/nginx.pid` to avoid root permission errors.

### 2. CI/CD Pipeline (GitHub Actions)

Deployments utilize a **Hard Reset Strategy** to prevent configuration drift.

**Workflow (`deploy.yml`):**

1. **Connect:** SSH into `satono-diamond` via Cloudflare Tunnel.
2. **Reset:** `git reset --hard origin/main` (Destroys local changes).
3. **Rebuild:** `docker compose up -d --build app nginx`.

The deployment script **explicitly excludes** the `tunnel` container from the rebuild command. Restarting the tunnel would sever the active SSH connection, causing the pipeline to fail mid-deployment.

---

## 📂 Project Structure

```text
.
├── .github/workflows/
│   └── deploy.yml       # CI/CD Pipeline (Cloudflare SSH)
├── app/                 # Astro Application
│   ├── src/             # Pages, Layouts, Components
│   ├── astro.config.mjs # Configured with { host: true }
│   └── Dockerfile       # Multi-stage Node.js build
├── nginx/
│   ├── default.conf     # HTTP Block (Web)
│   └── nginx.conf       # Main Config + Stream Block (SSH)
├── docker-compose.yml   # Orchestration
└── README.md            # Documentation

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

