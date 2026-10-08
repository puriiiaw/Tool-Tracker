# Site Tool Tracker

Phone-first checkout and return tracking for the EX-4002 site. Requirements: `docs/PRD.md`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 on the laptop, or http://<laptop-ip>:3000 from a phone on the same Wi-Fi.

First sign-in on your own PC: email `admin`, password `admin`. (On a server, a new database prints a random first password in the log: `journalctl -u tracker`.) Go to **Accounts** straight away, set a real
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

## Using it on a phone (no signal on site)

Open the site once with signal, sign in, then add it to the Home Screen so the phone keeps its saved data:

- **iPhone (Safari):** Share button, then **Add to Home Screen**.
- **Android (Chrome):** menu (three dots), then **Install app** or **Add to Home screen**.

Open it from that icon. With no signal you can still check out and scan returns: a bar at the top shows
how many items are waiting, and they send by themselves when the signal returns. If the bar is red
(waiting over a day), get signal soon. Anything the server could not apply as asked shows on the
Dashboard for an admin.
