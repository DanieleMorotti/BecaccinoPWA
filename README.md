<h1 align="center">Becaccino PWA</h1>

<p align="center">
  <img src="./public/icons/icon-512.png" alt="Becaccino PWA icon" width="96" height="96" />
</p>

<p align="center">
  A fast, multiplayer PWA to play the Italian card game "Becaccino" with friends.
</p>

## About

Becaccino is a trick-taking card game played in teams. This app lets you create a room, join with friends, and play from any device with a modern, installable PWA interface.

## Story & Screenshots

Becaccino is best enjoyed as a quick, social ritual: create a room, share the code, and start the match. The app stays lightweight and focused so the table feels like the real thing, just faster to set up.

**Homepage**  
Create or join a room, then invite your teammates.

<p align="center">
  <img src="./docs/screenshots/homepage.png" alt="Homepage (portrait)" width="260" />
</p>

**Table**  
Once everyone is in, the table view keeps the pace: hands, trick flow, and score all in one place.

<p align="center">
  <img src="./docs/screenshots/in_game.png" alt="Game table (portrait)" width="260" />
</p>

## Features

- Multiplayer rooms backed by Firebase/Firestore
- PWA support with offline caching
- Responsive UI for mobile and desktop

## Requirements

- Node.js 18+
- A Firebase project (Web app config + Firestore)

## Local Setup

Run all commands from the project root.

```bash
npm install
```

Create `.env` based on `.env.example`:

```bash
# .env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Start a local dev server:

```bash
npm run dev
```

Build for production (outputs to `dist/`):

```bash
npm run build
```

## Deployment (GitHub Pages)

This repo ships with a GitHub Actions workflow that builds and publishes `dist/` to GitHub Pages.

1. In your GitHub repo: Settings > Pages > Source = **GitHub Actions**.
2. Add the following **repository secrets** (or environment secrets on `github-pages`, see below):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

Notes:
- These values are **not secret** in a client app; they will appear in the built JS bundle.
- Firebase security comes from **Firestore rules** and **Auth**, not by hiding these values.

## License

Licensed under **CC BY-NC 4.0** (Attribution-NonCommercial). See `LICENSE`.


