# FROST Aura Web App

React and TypeScript conversion of the FROST Aura clock interface.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

The existing Aura API fallback behavior is retained. The Device page now uses Web Bluetooth with the Python controller's `FROST`/`ESP32_RTC` name filters, characteristic UUID, write-without-response mode, timing delays, status reads, and 40-byte JSON chunks.

## Authentication

Firebase Authentication is configured in `src/firebase.ts`. Enable **Email/Password** and **Google** under Firebase Console > Authentication > Sign-in method, and add the local development host plus the production host under Authorized domains. The dashboard is rendered only after Firebase reports an authenticated user.

## Source organization

- `src/config/defaultConfig.ts` contains the default device schema sent to the controller.
- `src/reminders/` contains one TSX module per reminder category plus the shared registry.
- `src/pages/ConfigurePage.tsx` and `src/components/configure/` are the Configure tab UI: the 24-hour dial (`ConfigureDial.tsx`), the reminder list (`ReminderRail.tsx`), the timing editor (`TimingEditor.tsx`) and shared form controls (`fields.tsx`). Their styles are in `configure.css`, scoped to `#page-configure`. They render from `configureBridge`, which `src/legacy.ts` returns from `mountFrost()`; the schedule state and every edit still live in `legacy.ts`, so device sync, Aura and the JSON export are unchanged.
- `src/HomeScreen.tsx` is the authenticated dashboard host; the existing clock renderer remains behaviorally unchanged in `src/legacy.ts` and consumes the extracted config/registry.

Web Bluetooth is available in Chrome or Edge on `localhost` or HTTPS. The browser may ask for the firmware's custom service UUID during discovery; the Python protocol only specifies the characteristic UUID, so the service must be exposed by the device firmware for browser access.

Before connecting, copy `.env.example` to `.env` and set `VITE_FROST_SERVICE_UUID` to the parent GATT service UUID from the ESP32 firmware. Do not set it to `4af12345-6789-abcd-ef12-3456789abcde`; that is the characteristic UUID.

## Device Music Library

Pomodoro, Meditation, and Healing read selectable music tracks from a published Google Sheets CSV. The sheet must have a header row with `music` and `music_id` columns; `music_id` values are written as numbers into the corresponding `audio.*.tracks` array in the device JSON.

To connect a sheet:

1. In Google Sheets, use the first row for the exact headers `music` and `music_id`, then add one track per row.
2. Choose **File > Share > Publish to web**. Select the sheet tab and **Comma-separated values (.csv)**, then publish it.
3. Copy the published CSV URL into `.env.local` as `VITE_MUSIC_SHEET_CSV_URL=<published CSV URL>`. The sheet must be publicly published for the browser to fetch it.
4. Restart the Vite development server. In the Configure tab, open Pomodoro, Meditation, or Healing and click **Music Library**. Select tracks; their numeric IDs update the JSON immediately.

The web app fetches the published CSV directly from the browser, so the published sheet is public. Do not put private information in it.