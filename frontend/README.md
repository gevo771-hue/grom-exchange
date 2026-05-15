# GROM Frontend

Placeholder for Week 4 of the roadmap. Port the polished `grom-preview.html` (at repo root) into a real React + Vite app:

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Spot.tsx
│   │   ├── Binary.tsx
│   │   ├── Wallet.tsx
│   │   └── Markets.tsx
│   ├── components/
│   │   ├── Chart.tsx       (lightweight-charts)
│   │   ├── OrderBook.tsx
│   │   ├── BinaryTradePanel.tsx
│   │   └── Analytics.tsx
│   ├── hooks/
│   │   ├── useWallet.ts    (wagmi + viem)
│   │   ├── useSiwe.ts
│   │   ├── useWsFeed.ts
│   │   └── useBinaryRounds.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── ws.ts
│   └── styles/
│       └── grom.css        (palette from tailwind.config.js)
├── index.html
├── vite.config.ts
└── package.json
```

Recommended deps:
- `wagmi ^2` + `viem ^2` + `@walletconnect/modal`
- `siwe ^2.3`
- `lightweight-charts ^4.2` for candlesticks
- `zustand` for state
- `@tanstack/react-query` for REST
- `tailwindcss ^3.4`

Copy Tailwind palette from `grom-preview.html` CSS variables into `tailwind.config.js` under `theme.extend.colors`:
```js
colors: {
  bg: { 0: '#070b16', 1: '#0b1220', 2: '#101a2c', 3: '#152338', 4: '#1c2e47' },
  steel: { 1: '#4a9eff', 2: '#2b7fd9', 3: '#1a5fa8', 4: '#0f4480' },
  silver: { 1: '#e8eef8', 2: '#c8d4e8', 3: '#8fa2bf', 4: '#5a6d8a' },
  success: '#22c17c',
  danger:  '#e8576b',
  warn:    '#f5b94d',
}
```
