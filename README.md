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
- `src/HomeScreen.tsx` is the authenticated dashboard host; the existing clock renderer remains behaviorally unchanged in `src/legacy.ts` and consumes the extracted config/registry.

Web Bluetooth is available in Chrome or Edge on `localhost` or HTTPS. The browser may ask for the firmware's custom service UUID during discovery; the Python protocol only specifies the characteristic UUID, so the service must be exposed by the device firmware for browser access.

Before connecting, copy `.env.example` to `.env` and set `VITE_FROST_SERVICE_UUID` to the parent GATT service UUID from the ESP32 firmware. Do not set it to `4af12345-6789-abcd-ef12-3456789abcde`; that is the characteristic UUID.