# Homio Essentials Admin — desktop app (Electron)

The Windows admin app for the Homio Essentials team: medicines, requests from the mobile app, brands and prices,
promotions, contact info, app settings (including the AdMob switch), backups and the team list. English and বাংলা.

Same technology and app experience as **bondhu-fund-desktop** (Electron + Vite + React + TypeScript + Tailwind, the same
motion system, sidebar, top bar, dialogs, toasts and button rules) in the Homio Essentials design (teal / peach,
Plus Jakarta Sans, Hind Siliguri, Newsreader italic for Latin names).

## Run
```
# once: writes config/supabase.json (server URL + public anon key) — run in the backend folder
node --env-file=.env scripts/app-env.mjs

npm install
npm run electron:dev      # Vite + Electron with hot reload
npm run typecheck         # renderer + main process
npm run test:smoke        # read-only checks of the API core against the live server
npm run dist              # Windows installer + portable exe in release/
```
`npm run dev` alone opens the screens in a browser. Add `#demo` to the address (http://localhost:5173/#demo) for
sample data that never touches the server.

## How it fits together
```
electron/main.ts      window, IPC, sign-in session (encrypted with the OS key store), daily backup
electron/preload.ts   window.electronAPI (call, backups, open links)
electron/backup.ts    full backup to Documents\Homio Essentials Backups + private `backups` bucket, verify, restore
shared/core.ts        Supabase over HTTPS (Auth, PostgREST, Storage) + every admin operation (makeApi) + role check (authorize)
shared/types.ts       types shared by both sides
src/services/api.ts   the only way screens reach the server: call('method', …args)
src/context/          AppContext: active screen, t(), language, day/night, toasts, session
src/components/       layout (Sidebar, TopBar) and common pieces (Modal, SegmentedTabs, ChipTabs, SearchableSelect, ui)
src/views/            one file per screen
src/locales/          Bangla text, one file per area
src/theme/            colour themes (CSS variables) and the press ripple
```
Like bondhu-fund, the screen code never talks to the server or the disk: it calls the main process, which checks
the staff role first. The database checks it again through row-level security and the admin RPCs
(`admin_dashboard_stats`, `approve_remedy_request`).

## Accounts and roles
Staff sign in with email + password (Supabase Auth). An account must also be in `public.staff`:
- **reviewer** — reads everything
- **editor** — changes content, answers requests
- **owner** — plus backups, restore and the team list

First owner: create the user in Supabase Auth, then
`insert into public.staff (user_id, display_name, role) values ('<auth user id>', 'Name', 'owner');`
After that, owners add people from **Team & roles**.

## Backups
Owners get one automatic backup a day on first sign-in (and **Back up now** any time). Each backup is every table as
gzip-compressed JSON with a SHA-256 checksum, saved on this PC and in the private `backups` bucket, and recorded in
`backup_runs`. **Check a backup file** opens one, counts every table and marks it verified. **Restore** writes the
content tables back (insert or update); it does not delete newer rows, accounts or history.
