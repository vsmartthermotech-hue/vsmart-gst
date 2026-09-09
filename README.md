# 📊 Ledger Buddy

A high-performance, full-stack **Ledger Reconciliation Engine** built with modern web technologies. This application allows users to upload, parse, and reconcile financial ledgers (CSV/Excel) with high accuracy and speed, all wrapped in a sleek, responsive dashboard.

---

## 🚀 Tech Stack

-   **Frontend & Routing**: [TanStack Start](https://tanstack.com/start) (React 19, TanStack Router, TanStack Query)
-   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
-   **Components & Icons**: Radix UI primitives & Lucide React
-   **Parsing Utilities**: PapaParse (for CSV processing) & XLSX (for Excel processing)
-   **Build Tool**: Vite
-   **Deployment Support**: Dual-target configuration for **Vercel** (Edge Runtime) and **Cloudflare Pages** (Workers)

---

## 🛠️ Getting Started

### Prerequisites

You will need [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/) installed.

### Installation

Clone the repository and install dependencies:

```bash
# Using npm
npm install

# Using Bun
bun install
```

### Local Development

Start the Vite development server locally:

```bash
# Using npm
npm run dev

# Using Bun
bun run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser to view the application.

---

## ⚡ Deployment Options

The project is uniquely configured to run smoothly in either serverless environments (like Vercel) or edge platforms (like Cloudflare Pages). The bundler dynamically detects the target platform and adjusts the runtime build.

### 📐 Option 1: Deploy to Vercel (Edge Runtime)

Your repository contains a pre-configured Edge handler (`api/server.js`) and routing configurations (`vercel.json`).

#### Step-by-Step Vercel Setup:
1.  **Commit and Push** your changes to your Git repository (GitHub, GitLab, or Bitbucket).
2.  Go to the [Vercel Dashboard](https://vercel.com/) and click **"Add New..."** > **"Project"**.
3.  Import your repository.
4.  Configure the build settings:
    -   **Framework Preset**: Select **"Other"**.
    -   **Build Command**: `npm run build`
    -   **Output Directory**: `dist/client`
5.  Click **"Deploy"**. Vercel will build the React SPA, publish your static assets, and run the SSR engine as a high-speed Edge Function.

---

### ☁️ Option 2: Deploy to Cloudflare Pages (Workers)

The project includes built-in wrangler configurations (`wrangler.jsonc`) and SSR wraps (`src/server.ts`) tailored for Cloudflare Pages.

#### Step-by-Step Cloudflare Setup:
1.  Initialize deployment using wrangler:
    ```bash
    # Build the Cloudflare-specific bundle
    npm run build
    ```
2.  Deploy using Wrangler CLI:
    ```bash
    npx wrangler pages deploy dist/client
    ```
    *Alternatively, you can connect your repository directly via the Cloudflare Dashboard, choosing **Vite** as the framework framework preset and `npm run build` as the build command.*

---

## 📂 Project Architecture

```
├── api/                  # Vercel Edge function entry point
├── src/
│   ├── components/       # Reusable React UI components (Radix + Tailwind)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Core reconciliation engine & spreadsheet parsers
│   ├── routes/           # TanStack file-based router pages
│   ├── router.tsx        # TanStack router setup with React Query
│   ├── server.ts         # Cloudflare Pages custom SSR entry wrapper
│   ├── start.ts          # Client bootstrap entry
│   └── styles.css        # Main tailwind imports and custom classes
├── vite.config.ts        # Dynamic multi-target bundler configuration
├── wrangler.jsonc        # Cloudflare Pages worker deployment descriptor
└── vercel.json           # Vercel router rewrite mappings
```

---

## 🧮 How the Reconciliation Engine Works

1.  **Parsing**: Financial files are read chunk-by-chunk on the client side using either PapaParse (CSVs) or XLSX (Excel sheets) to handle memory efficiently.
2.  **Matching**: An advanced matching algorithm groups transactions by dates, descriptions, and values, isolating exceptions.
3.  **Visual Analytics**: Unreconciled entries and reconciliation rates are plotted using Recharts dashboards for easy visual tracking.
