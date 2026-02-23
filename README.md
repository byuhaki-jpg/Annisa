# Kost Annisa - Boarding House Finance Tracker (MVP UI)

Phase 1 frontend-only implementation for Kost Annisa's boarding house management system. Built with Next.js (App Router), Tailwind CSS, and shadcn/ui. Uses mock data for rapid UI prototyping and validation.

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4 + `shadcn/ui`
- **State Management:** React Context (`src/lib/store.tsx`) with Mock Data
- **Icons:** `lucide-react`
- **Date Utilities:** `date-fns`

## Local Development

1. Clone the repository and navigate to the project directory:
   ```bash
   cd kostannisa
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. You will be redirected to the login page (Mock Auth).

## Connecting to API Later (Phase 2)

Currently, all application state relies on a single React Context (`src/lib/store.tsx`) populated with mock data from `src/lib/mock-data.ts`.

To migrate to the Cloudflare Workers API in Phase 2:
1. **Remove the mock store:** Replace the React Context provider (`AppProvider` in `store.tsx`) with data fetching logic.
2. **Implement Fetch/SWR/React Query:** Inside each page or component, fetch data via your Cloudflare API route (e.g., `fetch("https://api.kosannisa.my.id/invoices")`).
3. **Handle Mutations:** Replace store mutation methods (`addTenant`, `markInvoicePaid`) with POST/PUT/DELETE API requests.
4. **Authentication:** Integrate with Cloudflare Access. The `/login` UI is currently a mock wrapper, but in production, traffic will be authenticated edge-side, and you may receive user credentials via HTTP headers (e.g., `Cf-Access-Authenticated-User-Email`).

## How to Deploy to Cloudflare Pages

1. **Push your code to GitHub/GitLab.**
2. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com), and navigate to **Workers & Pages**.
3. Click **Create Application** > **Pages** > **Connect to Git**.
4. Select the `kostannisa` repository.
5. In the Build Settings:
   - **Framework preset:** `Next.js`
   - **Build command:** `npx @cloudflare/next-on-pages`
   - **Build output directory:** `.vercel/output/static` (Automatically mapped by `@cloudflare/next-on-pages`)
   
> **Note on App Router on CF Pages:** Ensure you install `@cloudflare/next-on-pages` and set it up if you want edge rendering. Since this MVP is fully client-side initialized and data is mocked, you might also do a static export if preferred by adding `output: "export"` in `next.config.mjs` and deploying the `out` folder directly.
