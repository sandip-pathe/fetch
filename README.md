<div align="center">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <rect width="800" height="500" fill="#f5f5f7" rx="24" />

  <text x="400" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="600" fill="#1d1d1f" text-anchor="middle">Fetch</text>
  <text x="400" y="100" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="16" font-weight="400" fill="#86868b" text-anchor="middle">Instantly share text between devices</text>

  <g transform="translate(150, 180)">
    <rect x="0" y="0" width="280" height="180" rx="12" fill="#ffffff" stroke="#e5e5ea" stroke-width="2" />
    <path d="M -20 180 L 300 180 Q 310 180 310 185 L -30 185 Q -30 180 -20 180 Z" fill="#d1d1d6" />
    <path d="M 100 180 L 180 180 Q 185 180 185 182 L 95 182 Q 95 180 100 180 Z" fill="#c7c7cc" />
    
    <rect x="20" y="20" width="240" height="40" rx="8" fill="#f2f2f7" />
    <circle cx="35" cy="40" r="4" fill="#d1d1d6" />
    <rect x="45" y="36" width="100" height="8" rx="4" fill="#d1d1d6" />
    
    <rect x="20" y="75" width="240" height="70" rx="12" fill="#ffffff" stroke="#e5e5ea" stroke-width="1" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.03))" />
    <text x="35" y="100" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="600" fill="#86868b" letter-spacing="0.5">FROM IPHONE</text>
    <rect x="35" y="115" width="180" height="6" rx="3" fill="#1d1d1f" />
    <rect x="35" y="128" width="140" height="6" rx="3" fill="#1d1d1f" />
  </g>

  <g transform="translate(520, 160)">
    <rect x="0" y="0" width="130" height="260" rx="24" fill="#ffffff" stroke="#e5e5ea" stroke-width="3" filter="drop-shadow(0 8px 24px rgba(0,0,0,0.06))" />
    <path d="M 45 3 L 85 3 Q 90 3 90 8 L 90 12 Q 90 17 85 17 L 45 17 Q 40 17 40 12 L 40 8 Q 40 3 45 3 Z" fill="#e5e5ea" />
    
    <rect x="15" y="40" width="100" height="90" rx="12" fill="#f2f2f7" />
    <rect x="25" y="55" width="80" height="6" rx="3" fill="#1d1d1f" />
    <rect x="25" y="68" width="60" height="6" rx="3" fill="#1d1d1f" />
    
    <rect x="85" y="100" width="22" height="22" rx="6" fill="#C15C37" />
    <path d="M 96 104 L 92 111 L 95 111 L 94 118 L 100 110 L 97 110 Z" fill="#ffffff" />
  </g>

  <path d="M 430 250 Q 475 220 520 250" fill="none" stroke="#C15C37" stroke-width="2" stroke-dasharray="6 6" stroke-linecap="round" opacity="0.5" />
  
  <g transform="translate(460, 220)">
    <circle cx="16" cy="16" r="20" fill="#ffffff" filter="drop-shadow(0 4px 12px rgba(193,92,55,0.2))" />
    <path d="M 18 8 L 10 18 L 15 18 L 13 25 L 23 15 L 18 15 Z" fill="#C15C37" />
  </g>

  <g transform="translate(450, 185)">
    <rect x="0" y="0" width="40" height="20" rx="6" fill="#ffffff" stroke="#e5e5ea" stroke-width="1" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.05))" />
    <rect x="8" y="9" width="24" height="3" rx="1.5" fill="#1d1d1f" />
  </g>
</svg>
</div>

> Fetch is a shared clipboard. Copy on your phone, it appears instantly on your laptop.

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## How It Works

```
paste text → Firestore write → snapshot fires → other devices receive clip
```

Every device logged in under the same account subscribes to a real-time Firestore stream. No polling. No refresh.

## Architecture

```
Browser / PWA
  └─ Firebase Auth     (user identity)
  └─ Firestore         (real-time clip stream)
       └─ onSnapshot   (live updates across devices)
```

## Data Model

```
clips/{clipId}
  content      string
  contentHtml  string?   (rich formatting preserved silently — not shown in UI)
  device       string
  createdAt    timestamp
  userId       string
```

## Features

- Instant cross-device text sharing
- Real-time updates via Firestore `onSnapshot` — no refresh needed
- **Rich-text formatting preserved** on copy/paste (stored silently, restored on paste)
- Tap anywhere on a clip to copy
- Clipboard suggestion on app focus
- Drag & drop text to save instantly
- Searchable history
- Local cache for instant startup
- PWA — installs on Android, iOS, and desktop

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with **Firestore** and **Email/Password Auth** enabled

### Install

```bash
git clone https://github.com/sandip-pathe/fetch.git
cd fetch
npm install
```

### Configure

```bash
cp .env.example .env
# fill in your Firebase credentials
```

### Run

```bash
npm run dev
```

---

## Firebase Firestore Rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /clips/{clipId} {
      allow read, update, delete: if request.auth != null
                                  && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
                    && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

---

## PWA Install

| Platform | How |
|---|---|
| **Android Chrome** | Address bar → "Add to Home Screen" |
| **iOS Safari** | Share button → "Add to Home Screen" |
| **Desktop Chrome / Edge** | Address bar install icon |

---

## Tech Stack

| Layer | Choice |
|---|---|
| UI | React 19 + Vite 6 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth + DB | Firebase 12 |
| Animation | Motion (Framer) |
| Icons | Lucide React |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Sandip Pathe
