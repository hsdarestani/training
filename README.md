# A+Trainer

A mobile-first marketplace and booking platform for independent personal trainers and their clients.

## What is included

- Client and trainer registration/login
- Trainer discovery with search, specialty and price filters
- Public trainer profiles with specialties, pricing, languages and venues
- Private-session booking with date/time selection and collision protection
- Client booking dashboard with cancellation
- Trainer booking dashboard with completion/decline actions
- Trainer self-registration and editable profile API
- Responsive mobile navigation and installable PWA shell
- Persistent lightweight JSON storage for the MVP
- PM2 + Nginx production setup via GitHub Actions

## Local development

```bash
npm install
npm start
```

The app runs on `http://localhost:3087` by default.

## Production

Target: https://training.smarbiz.sbs

Pushing to `main` triggers `.github/workflows/deploy.yml`. The workflow expects these GitHub Actions repository secrets:

- `HOST` — production server host/IP
- `PASS` — root SSH password

Production data lives in `/opt/a-trainer/data/db.json` and is intentionally not committed.

## Architecture

The MVP uses a dependency-light Node/Express API plus a build-free responsive SPA. This keeps deployment simple while leaving clean upgrade paths for PostgreSQL, payments, chat, calendar sync, reviews and native wrappers later.
