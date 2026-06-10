
# SpeakEasy — Speech Assist MVP

A mobile-first mockup app that simulates predicting words from mouth movements. Real ML is out of scope — you'll plug in your own model later. This delivers the full UX shell, picking the **Warm human centered** design direction (calm, dignified, accessible).

## What gets built

### 1. Main Speak screen (`/`)
The core experience. Always available without an account.
- **Camera viewport** with a placeholder mouth-tracking overlay (no real camera access required for the mockup; shows a static face image with animated tracking reticle to convey what the feature does).
- **Primary predicted word** — large, tappable, hero element. Tapping it speaks the word aloud via the browser's built-in `speechSynthesis` API.
- **Alternative suggestions** — 4–5 horizontally scrollable word chips. Tapping any one replaces the primary, speaks it, and (for logged-in users) logs it as a correction.
- **Speak Selection button** — explicit primary action at the bottom.
- **Recent phrases strip** — tap to re-speak.
- **"Start tracking" / "Stop"** toggle that cycles through a small pre-scripted list of demo predictions on a timer (so the mockup feels alive without real ML).
- **Guest Mode badge** in the header with a subtle "Log in" link.
- **Personalization disclosure card** (visible for guests) — explains: "Creating an account lets us store your mouth-movement data to personalize predictions over time. Your data stays tied to your account."

### 2. Auth screen (`/auth`)
- Email + password sign in / sign up (toggle).
- Google sign-in button.
- "Continue as guest" link back to `/`.
- Honest copy reinforcing why an account improves accuracy.

### 3. Profile screen (`/_authenticated/profile`)
For logged-in users only.
- Display name + email.
- A **"Personalization progress"** card showing a fake-but-honest score (e.g., "Profile strength: 14 corrections logged") to make the personalization story tangible.
- Recent corrections list.
- Sign out.

### Backend (Lovable Cloud)
- Email/password + Google auth.
- `profiles` table (display_name, created_at) auto-created on signup.
- `corrections` table (user_id, original_prediction, corrected_word, created_at) — populated when a logged-in user taps an alternative. This is your future training-data feed.
- `phrases` table (user_id, text, last_used_at) — for recent/favorite phrases.
- RLS so users only see their own rows.

### Design
**Warm human centered** direction: off-white background, Inter + Instrument Sans typography, soft white cards with subtle rings, large touch targets, dignified tone. All colors live as semantic tokens in `src/styles.css`.

## Out of scope (you'll handle later)
- Real mouth-movement detection and ML model — the prediction loop is a scripted placeholder you can swap with your model output.
- Per-user model fine-tuning — corrections are stored and counted, but no training happens.
- Real camera access — easy add later; left out so the mockup runs anywhere.

## Technical notes
- TanStack Start with file routes: `index.tsx`, `auth.tsx`, `_authenticated/route.tsx`, `_authenticated/profile.tsx`.
- TTS via the browser's `window.speechSynthesis` (no API needed).
- Lovable Cloud for auth + DB; Google OAuth wired via the broker.
- Mobile viewport by default; layout still works on desktop centered in a max-width container.
- A small `mockPredictions.ts` array drives the demo loop — clearly commented as the swap point for your future model.
