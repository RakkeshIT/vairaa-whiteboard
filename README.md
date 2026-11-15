# Vairaa Whiteboard (Full Stack)

Full-stack collaborative whiteboard application with secure Express API, MongoDB Atlas integration, passwordless OTP authentication (Sign In & Sign Up), and isolated whiteboards per user.

---

## Project Structure

```
whiteboard/
├── web/                  # React + Vite Frontend (Canvas, Tools, Top Menu, Auth Modal)
│   ├── src/
│   │   ├── components/   # Toolbar, TopMenu, AuthModal, BottomBar, PropsPanel
│   │   ├── lib/          # API Client, Canvas Render, Storage, Cursors
│   │   └── App.jsx       # Main Whiteboard Canvas & Cloud Sync state
│   ├── .env              # VITE_API_URL=/api (proxied to the backend)
│   └── package.json
│
├── server/               # Express Backend API
│   ├── config/           # MongoDB Atlas, CORS, Better Auth (email OTP)
│   ├── models/           # User, Whiteboard Mongoose Models
│   ├── middleware/       # Session Auth Protection (Better Auth)
│   ├── routes/           # Whiteboard (/api/whiteboard); auth served by Better Auth at /api/auth
│   ├── utils/            # OTP Mailer (Gmail or SMTP)
│   ├── .env              # MongoDB URI, Better Auth secret/URL, email, client origins
│   └── server.js         # Express Server Entry Point
│
└── package.json
```

---

## Getting Started

### 1. Run the Express Backend Server
```bash
cd server
npm install
npm run dev
```
The server will start at: `http://localhost:5000`
- Copy `server/.env.example` to `server/.env` and fill in `MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and email credentials.
- Verification codes are only delivered by email; they are never logged.

### 2. Run the Web Frontend
In another terminal:
```bash
cd web
npm install
npm run dev
```
Open: `http://localhost:5173`

---

## Authentication Flow

Passwordless email OTP via [Better Auth](https://better-auth.com) (`emailOTP` plugin). Sessions are httpOnly cookies.

1. Click **Sign In / Cloud Sync** in the top-left menu.
2. **Create Account**: enter name, optional company and email, then the 6-digit code from your inbox. The account is created only after the code is verified, and a personal whiteboard is initialized.
3. **Sign In**: enter your email, then the 6-digit code.
4. Codes expire after 10 minutes, allow 5 attempts, and can be resent after 60 seconds (max 5 codes per email per 15 minutes).
5. **Sign Out** revokes the session on the server.
6. **Per-User Whiteboard Separation**: each user's whiteboards are stored under their `userId` and auto-synced.

The Vite dev server proxies `/api` to `http://localhost:5000`; in production `web/vercel.json` rewrites `/api/*` to the backend so the session cookie stays first-party.
