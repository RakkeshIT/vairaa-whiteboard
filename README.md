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
│   ├── .env              # VITE_API_URL=http://localhost:5000/api
│   └── package.json
│
├── server/               # Express Backend API
│   ├── config/           # MongoDB Atlas & High-Security Global CORS
│   ├── models/           # User, Otp, Whiteboard Mongoose Models
│   ├── middleware/       # JWT Auth Protection
│   ├── routes/           # Auth (/api/auth) & Whiteboard (/api/whiteboard)
│   ├── utils/            # OTP Mailer with Dev Fallback
│   ├── .env              # MongoDB Atlas URI, JWT Secret, Client Origins
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
- MongoDB Atlas will connect automatically to `whiteboard_db`.
- When an OTP is requested, it will be logged directly to the server terminal:
  ```
  🔑 [OTP GENERATED] Email: you@domain.com | CODE: [ 123456 ]
  ```
  (And sent via SMTP if SMTP credentials are added to `server/.env`).

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

1. Click **Sign In / Cloud Sync** in the top-left menu.
2. Enter your email and click **Continue with OTP**.
3. **If New User (Sign Up)**:
   - Enter the 6-digit OTP.
   - Enter your **User Name** and **Company / Organization**.
   - Account is created in MongoDB Atlas and personal whiteboard is initialized.
4. **If Existing User (Sign In)**:
   - Enter the 6-digit OTP.
   - Verified and automatically signed in with JWT token.
5. **Per-User Whiteboard Separation**:
   - Each user's whiteboard elements and canvas states are stored independently in MongoDB under their unique `userId`.
   - Edits are automatically auto-synced to MongoDB Atlas.

