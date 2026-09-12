# Listening index

A personal Spotify dashboard that tracks and stores your streaming history.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon%20Serverless-00e599?style=for-the-badge&logo=postgresql)](https://neon.tech/)

---

## Demo and screenshots

See the [live demo](https://listening-index.vercel.app/) or [run it locally](#local-development) with sample data.

### Overview

Shows listening time, track count, daily averages, rank changes, top tracks and artists, and a listening activity graph across six time ranges.

![Overview](public/screenshots/overview.png)

### Stream log

A chronological list of every track played with timestamps, track lengths, album names, and current day streak.

![Stream log](public/screenshots/stream-log.png)

### Sessions

Groups continuous listening into sessions, marks first-time plays, and tracks session lengths over time.

![Sessions](public/screenshots/sessions.png)

### Customization menu

Change the accent color, page title, timezone, and links directly in the browser.

![Customization modal](public/screenshots/config-modal.png)

---

## Prerequisites

- A Spotify Premium account (Spotify requires Premium to create apps in its developer dashboard)
- A free GitHub account
- A free Vercel account
- A free cron-job.org account

---

## Deploy to Vercel

### Step 1: Deploy the repository

Click the button to clone the project to your GitHub account and create the Vercel deployment:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBlairqiao%2Flistening_index&env=SPOTIFY_CLIENT_ID,SPOTIFY_CLIENT_SECRET,SPOTIFY_REFRESH_TOKEN,CRON_SECRET&envDefaults=%7B%22SPOTIFY_CLIENT_ID%22%3A%22todo%22%2C%22SPOTIFY_CLIENT_SECRET%22%3A%22todo%22%2C%22SPOTIFY_REFRESH_TOKEN%22%3A%22todo%22%2C%22CRON_SECRET%22%3A%22todo%22%7D&envDescription=Credentials%20for%20Spotify%20API%20and%20Database&project-name=listening-index)

Leave the environment variable inputs as their default values and click Deploy. The site will deploy in demo mode with sample data. You will add real credentials in the next steps.

---

### Step 2: Connect Neon database

1. In your Vercel project dashboard, open the **Storage** tab.
2. Click **Connect Database** and select **Neon Postgres**.
3. Vercel provisions the database and sets `DATABASE_URL` automatically.
4. You do not need to create tables manually. The app creates the schema on its first sync.

---

### Step 3: Get Spotify API credentials

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in.
2. Click **Create App**:
   - App name: `Listening Index`
   - App description: `Personal music tracking dashboard`
   - Redirect URIs: `http://127.0.0.1:8888/callback`
   - Select **Web API**
3. Save the app, open **Settings**, and copy:
   - Client ID (`SPOTIFY_CLIENT_ID`)
   - Client Secret (`SPOTIFY_CLIENT_SECRET`)

Spotify redirects back to `http://127.0.0.1:8888/callback` during the login step so the local script can capture your auth code.

---

### Step 4: Get your Spotify refresh token

Choose one of two options:

#### Option A: Terminal script (Fastest)

Clone your repository and run:

```bash
npm install
npm run auth:spotify
```

The script asks for your Client ID and Secret, opens Spotify in your browser, and prints your `SPOTIFY_REFRESH_TOKEN`.

Add these three values in **Vercel Project Dashboard -> Settings -> Environment Variables**:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

#### Option B: In-browser curl (No clone needed)

1. Open this URL in your browser, replacing `YOUR_CLIENT_ID`:
   ```text
   https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A8888%2Fcallback&scope=user-read-recently-played%20user-read-playback-state%20user-read-currently-playing
   ```
2. Click **Agree**. The browser redirects to a page starting with `http://127.0.0.1:8888/callback?code=...`.
3. Copy the code from the address bar after `?code=`.
4. Run this curl command:
   ```bash
   curl -X POST https://accounts.spotify.com/api/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -u "YOUR_CLIENT_ID:YOUR_CLIENT_SECRET" \
     --data-urlencode "grant_type=authorization_code" \
     --data-urlencode "code=YOUR_COPIED_CODE" \
     --data-urlencode "redirect_uri=http://127.0.0.1:8888/callback"
   ```
5. Copy the `"refresh_token"` string from the JSON response and add all three variables to Vercel.

---

### Step 5: Set up scheduled sync

Spotify only keeps your last 50 played tracks, so a regular sync keeps your history complete.

1. Generate a secret key to protect the sync endpoint. Use [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32) or run `npm run generate:cron`.
2. Add `CRON_SECRET` to your Vercel environment variables.
3. In [cron-job.org](https://cron-job.org), create a job:
   - Title: `Listening Index Sync`
   - URL: `https://<your-app>.vercel.app/api/sync?key=YOUR_CRON_SECRET`
   - Schedule: Every 30 minutes
4. Save the job.

---

### Step 6: Run your first sync

1. Redeploy Vercel to ensure all env variables are updated.
2. Open `https://<your-app>.vercel.app/api/sync?key=YOUR_CRON_SECRET` in your browser.
3. The endpoint returns a JSON confirmation when complete:
   ```json
   { "success": true, "processed": 50 }
   ```
4. Open your homepage. Your live Spotify data will appear.

---

## Local development

Run the site locally with mock data:

```bash
git clone https://github.com/Blairqiao/listening-index.git
cd listening-index
npm install
npm run dev
```

Open `http://localhost:3000`.

### Connect real data locally

0. Use your Vercel database connection string (go to **Storage** tab in Vercel dashboard and copy connection string).
1. Or, create a free database at [neon.tech](https://neon.tech).
2. Add it to `.env.local`:
   ```bash
   echo 'DATABASE_URL="postgresql://user:password@endpoint.neon.tech/neondb?sslmode=require"' >> .env.local
   ```
3. Run the setup scripts to authorize Spotify and generate your cron key:
   ```bash
   npm run auth:spotify
   npm run generate:cron
   npm run sync
   npm run dev
   ```

---

## Customization

Press `C` or click **[ C · CONFIG ]** in the top navigation to open the customization menu:
- Change the accent color with a color picker or preset swatches.
- Select your timezone to match your daily activity graph.
- Update your display title, name, Spotify link, and GitHub repository link.
- Click **Save & Apply**. When connected to Neon, settings save to the database and update for all visitors. In local development or demo mode, settings save to your local setup.
- Click **Reset Defaults** to restore values from `src/config.ts`.

To set permanent defaults in code, edit `src/config.ts`:

```typescript
export const siteConfig = {
  title: "Listening Index",
  ownerName: "YOUR NAME",
  accentColor: "#76ff49ff",
  siteUrl: "https://open.spotify.com/",
  githubUrl: "https://github.com/Blairqiao/listening_index",
  timezone: "America/Chicago",
};
```

---

## Keyboard shortcuts

| Key | Action |
| :--- | :--- |
| `1` | Switch to overview |
| `2` | Switch to stream log |
| `3` | Switch to sessions |
| `←` / `→` | Change time range |
| `C` | Open customization menu |
| `Esc` | Close modal |

---

## Environment variables

| Variable | Description | Where to find |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | Neon dashboard or Vercel Storage |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID | Spotify Developer Dashboard |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret | Spotify Developer Dashboard |
| `SPOTIFY_REFRESH_TOKEN` | OAuth refresh token | Generated via `npm run auth:spotify` or curl |
| `CRON_SECRET` | Secret token to secure `/api/sync` | Generated key |

---

## Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start development server on `localhost:3000` |
| `npm run build` | Build production application |
| `npm run auth:spotify` | Get Spotify refresh token and save to `.env.local` |
| `npm run generate:cron` | Generate a cron secret and save to `.env.local` |
| `npm run sync` | Fetch recent tracks and write to database |

---

## Tech stack

- [Next.js 16](https://nextjs.org/)
- [Neon](https://neon.tech/) Serverless PostgreSQL
- [Tailwind CSS v4](https://tailwindcss.com/)
- Spotify Web API

---

## License

MIT
