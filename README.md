# Orbit App

This is a minimal Vite + React wrapper for the existing `App.jsx` UI.

Quick start

```bash
cd "Apps/orbit-app"
npm install
npm run dev
```

Notes

- The UI expects a Firebase config and optional initial auth token in `window.__firebase_config` and `window.__initial_auth_token` respectively. If you don't provide these the app will run in demo mode (no remote data).
- To provide a Firebase config, add a small inline script in `index.html` before the app loads, e.g.:

```html
<script>
  window.__firebase_config = JSON.stringify({
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    // ...other Firebase config
  });
  // optionally:
  // window.__initial_auth_token = "<CUSTOM_TOKEN>";
</script>
```

- Tailwind classes are used; the development build includes the Tailwind CDN for quick styling.
