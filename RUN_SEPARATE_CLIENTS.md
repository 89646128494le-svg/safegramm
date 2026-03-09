# SafeGram Separate Clients

Goal: one backend, three independent clients.

- `web/` = browser client.
- `desktop/` or `electron/` = desktop app with local bundled UI (no remote URL/web link).
- `rn/` = native Expo React Native app (no WebView wrapper).

## 1) Start backend

```powershell
cd server-go
go run .
```

## 2) Start web client

```powershell
cd web
npm run dev
```

## 3) Start desktop client (standalone)

Option A (new desktop app):

```powershell
cd desktop
npm run dev
```

Option B (legacy electron app):

```powershell
cd electron
npm run start:standalone
```

## 4) Start mobile client (native RN)

```powershell
cd rn
npm run start
```

Set API base in mobile settings to your backend URL (`http://<LAN-IP>:8080` or HTTPS endpoint).

## Expected architecture

- All clients connect to the same backend/API.
- Desktop loads only local bundle files.
- Mobile uses native screens and direct API calls.
- Web remains browser-only.
