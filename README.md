# BetBazzii Spinner

A Firebase-powered multiplayer spinner betting game with:

- ID + password authentication (no OTP)
- Google-style colorful spinner wheel with animation
- Admin-only outcome control (`admin` ID)
- Admin controls for any player's points
- Admin controls for minimum bet and minimum points required to play
- Real-time online player count

## How admin works

Login with player ID `admin` (create it first if it doesn't exist) to access:

- Set any player total points
- Set minimum bet points
- Set minimum points required for users to spin
- Force the next result number (hidden from players)

## Tech

- HTML/CSS/Vanilla JS
- Firebase Firestore (modular SDK)
