# GitHub Developer Analytics

A web app for exploring public GitHub profiles, repositories, language byte counts, and contribution history.

## Run locally

Requires Node.js 20 or later. No npm packages are required.

```bash
npm run dev
```

Open <http://localhost:5173>. For contribution history locally, copy `.env.example` to `.env` and set `GITHUB_TOKEN`. The token stays in the Node server.

## Deploy to Vercel

The frontend is served as static files from `public/`; the GitHub proxy runs as a Vercel Function under `api/github/`. The repository includes `vercel.json` with `outputDirectory: public`, so use the repository root as the Vercel Root Directory and select the **Other** framework preset. Leave Build Command and Install Command empty. Add `GITHUB_TOKEN` as a Vercel environment variable for Preview and Production deployments to enable contribution history and authenticated API requests.

## Data and limits

- Profile and repository responses use server memory caching and browser `sessionStorage`; expired REST cache entries are revalidated with ETags when available.
- Repositories are fetched in 100-item pages, up to 1,000 repositories.
- Language charts use GitHub language endpoint byte counts for up to the 20 most-starred repositories in the selected fork filter. Language responses are cached for 24 hours.
- Forks are excluded from summary totals and language sampling by default.
- Contribution history uses GraphQL `contributionsCollection` and requires a server-side token.

## Features

- Search profiles and share them with `?user=octocat` URLs.
- Compare a second profile, switch dark/light themes, and export the loaded report to JSON.
- Sort repositories and inspect byte-level language tables.
- Open an accessible weekly contribution table under the contribution chart.

## Project files

```text
public/               Static dashboard and browser modules
api/github/[...path].js Vercel serverless GitHub API proxy
server.js             Local development server and shared proxy logic
vercel.json           Vercel static output and security headers
```
