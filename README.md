# Site Tool Tracker

Phone-first checkout and return tracking for the EX-4002 site. Requirements: `docs/PRD.md`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 on the laptop, or http://<laptop-ip>:3000 from a phone on the same Wi-Fi.

First sign-in: email `admin`, password `admin`. Go to **Accounts** straight away, set a real
password, and create the foremen's accounts. The database is one file, `data/tracker.db`.
Back it up by copying that file.

## First-time setup

1. **Import** (super-admin only): upload the ON!Track `Assets_Details.xlsx`. Review the name
   table in the preview, then confirm. Re-run whenever the fleet changes; it never closes a
   checkout or retires a tool.
2. **Workers**: add the crew, or let foremen quick-add from the checkout screen.
3. **Checkout**: worker, tool, quantity, save.

## Checks

```bash
npm test
npm run build
```
