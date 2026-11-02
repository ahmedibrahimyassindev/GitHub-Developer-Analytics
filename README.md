# GitHub Developer Analytics

A web app for exploring public GitHub profiles, repositories, language byte counts, and contribution history.

## Run locally

Requires Node.js 20 or later. No npm packages are required.

```bash
npm run dev
```

Open <http://localhost:5173>. A token is optional. Copy `.env.example` to `.env` and set `GITHUB_TOKEN` if you want the full GraphQL contribution calendar; without it, the app uses recent public push events.

## Deploy to Vercel

The frontend is served as static files from `public/`; the GitHub proxy runs as Vercel Functions under `api/github/`. The repository includes `vercel.json` with `outputDirectory: public` and the **Other** framework preset, so use the repository root as the Vercel Root Directory. Leave Build Command and Install Command empty. Add `GITHUB_TOKEN` as a Vercel environment variable for Preview and Production deployments if you want the full contribution calendar and authenticated API requests; it is optional for the app to run.

## Data and limits

- Profile and repository responses use server memory caching and browser `sessionStorage`; expired REST cache entries are revalidated with ETags when available.
- Repositories are fetched in 100-item pages, up to 1,000 repositories.
- Language charts use GitHub language endpoint byte counts for up to the 20 most-starred repositories in the selected fork filter. Language responses are cached for 24 hours.
- Forks are excluded from summary totals and language sampling by default.
- With `GITHUB_TOKEN`, contribution history uses GraphQL `contributionsCollection`. Without a token, the chart uses public PushEvents, limited by GitHub to the last 30 days and at most 300 events. Unauthenticated REST requests are limited to 60 per hour per IP.

## Features

- Search profiles and share them with `?user=octocat` URLs.
- Compare a second profile, switch dark/light themes, and export the loaded report to JSON.
- Sort repositories and inspect byte-level language tables.
- Open an accessible weekly contribution table under the contribution chart.

## Project files

```text
public/               Static dashboard and browser modules
api/github/           Vercel serverless routes for the GitHub API proxy
vercel-handler.js     Shared adapter for Vercel function routes
server.js             Local development server and shared proxy logic
vercel.json           Vercel static output and security headers
```
