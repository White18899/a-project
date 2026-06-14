# SlideEngine

SlideEngine is a next-generation interactive presentation creator featuring GPU-accelerated WebGL slide layouts, branching choice quizzes, and dynamic RPG-style dialogue decks.

This repository contains both the frontend interface and two backend options: a local Node.js server for offline development and a Cloudflare Workers serverless API for production deployment.

---

## Repository Structure

- `index.html` — The main presentation creator application entry point.
- `styles.css` — Core styles for the user interface.
- `js/` — Client-side JavaScript modules:
  - `js/api.js` — Client API library that communicates with the backend.
  - `js/landing-webgl.js` — Core WebGL engine for the landing page visual effects.
- `server.js` — Zero-dependency local Node.js server for local development.
- `worker.js` — Cloudflare Workers backend script utilizing Cloudflare KV.
- `wrangler.toml` — Wrangler deployment configuration for Cloudflare Workers.

---

## 1. Local Development (Offline Mode)

The project includes a built-in Node.js server that hosts the static frontend and provides a simulated API. Data is saved locally in a `db_data/` directory.

### Running the Local Server
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuring Frontend for Local Development
By default, the client is configured to connect to your production backend. To point it to your local environment, open `js/api.js` and set the `baseUrl`:
```javascript
window.SlideEngineAPI = {
    baseUrl: 'http://localhost:3000',
    // ...
};
```

---

## 2. Cloudflare Serverless Deployment (Production Mode)

This separates the frontend (static hosting via Cloudflare Pages) from the backend API (Cloudflare Workers with KV storage).

### Step A: Deploy the Backend (Cloudflare Workers)

1. Make sure you have Wrangler installed:
   ```bash
   npm install -g wrangler
   ```
2. Log in to your Cloudflare account:
   ```bash
   npx wrangler login
   ```
3. Create a production Cloudflare KV namespace:
   ```bash
   npx wrangler kv namespace create SLIDE_ENGINE_KV
   ```
   *Copy the outputted binding information.*
4. Open `wrangler.toml` and update the `id` under `[[kv_namespaces]]` with your new namespace ID:
   ```toml
   [[kv_namespaces]]
   binding = "SLIDE_ENGINE_KV"
   id = "YOUR_KV_NAMESPACE_ID"
   ```
5. Deploy the worker:
   ```bash
   npx wrangler deploy
   ```
   *Note down the live Worker URL returned by Cloudflare (e.g. `https://slide-engine-api.<your-subdomain>.workers.dev`).*

### Step B: Configure and Deploy the Frontend (Cloudflare Pages)

1. Connect the frontend to your live Worker API. Open `js/api.js` and set the `baseUrl` to your live Worker URL:
   ```javascript
   window.SlideEngineAPI = {
       baseUrl: 'https://slide-engine-api.<your-subdomain>.workers.dev',
       // ...
   };
   ```
2. Deploy the static assets using Wrangler Pages:
   ```bash
   npx wrangler pages deploy .
   ```
3. Follow the CLI prompts:
   - **Project Name**: Choose a name (e.g., `slide-engine-frontend`).
   - **Production Branch**: Press **Enter** to confirm `main`.
4. Cloudflare will upload your assets and output a live website URL (e.g., `https://<hash>.slide-engine-frontend.pages.dev`).

> [!NOTE]
> **SSL Cipher Mismatch Warning:** If you visit a newly created Pages URL and get an `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` page, wait 1–5 minutes. Cloudflare is simply provisioning the SSL/TLS certificate for your new subdomain on their edge network.

---

## 3. Workflow for Editing Code

Once deployed, follow this workflow to make updates:

### Modifying Frontend Code
1. Edit your HTML, CSS, or `js/` files.
2. Run `npm run dev` to test your changes locally.
3. Make sure `js/api.js` points to your production Worker URL.
4. Deploy the updates:
   ```bash
   npx wrangler pages deploy .
   ```

### Modifying Backend Code
1. Edit `worker.js`.
2. Deploy the updates:
   ```bash
   npx wrangler deploy
   ```
