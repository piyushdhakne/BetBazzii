# BetBazziidiff --git a/README.md b/README.md
index b54e2b5a888e8ddeeaed54dffe75981d57439eef..d9eb7ce384bf4e712fae6f67e51a1a670a3a53cd 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,59 @@
-# BetBazzii
\ No newline at end of file
+# BetBazzii Spinner
+
+A multiplayer spinner betting game with:
+
+- ID + password authentication (no OTP)
+- Google-style colorful spinner wheel with animation
+- Admin-only outcome control (`admin` ID)
+- Admin controls for any player's points
+- Admin controls for minimum bet and minimum points required to play
+- Real-time online player count
+
+## Backend modes
+
+The app auto-selects backend at runtime:
+
+- **Firebase realtime mode** (default if Firestore is reachable)
+- **Local mode fallback** (uses `localStorage` so the site still runs if Firebase is blocked/unavailable)
+
+You can see the active mode in the game header.
+
+## Local run
+
+Use a static server (recommended), for example:
+
+```bash
+python3 -m http.server 8080
+```
+
+Then open: `http://localhost:8080`
+
+## Admin account
+
+Login with player ID `admin` (create it first if it doesn't exist) to access:
+
+- Set any player total points
+- Set minimum bet points
+- Set minimum points required for users to spin
+- Force the next result number (hidden from players)
+
+## Deploy on GitHub Pages
+
+This repo now includes a GitHub Actions workflow at:
+
+- `.github/workflows/deploy-pages.yml`
+
+To deploy:
+
+1. Push this repo to GitHub.
+2. In GitHub repo settings:
+   - Go to **Settings → Pages**.
+   - Set **Build and deployment** source to **GitHub Actions**.
+3. Push to `main` branch (or run workflow manually from **Actions** tab).
+4. Your site will be published on your GitHub Pages URL.
+
+## Tech
+
+- HTML/CSS/Vanilla JS
+- Firebase Firestore (modular SDK)
+- LocalStorage fallback backend for offline/dev reliability
