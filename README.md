# Hem-Listan

Smarta listor för hemmet – mathandling, renovering, presenter m.m.

## Stack

- **React 18** + Vite
- **PWA** via `vite-plugin-pwa` (offline-kapabel, installerbar)
- Ingen CSS-ramverk – all styling inline med design tokens (`src/data/tokens.js`)
- Datalagring i React state (inga externa beroenden i v0.1)

## Projektstruktur

```
src/
├── data/
│   ├── tokens.js        ← Design tokens (Organic Vitality)
│   └── constants.js     ← Listtyper, kategorier, dagar, hjälpfunktioner
├── components/
│   └── ui.jsx           ← Delade komponenter (Card, Sheet, Checkbox, Btn …)
├── screens/
│   ├── HubScreen.jsx    ← Startsida – lista med alla listor + ny lista
│   ├── GroceryScreen.jsx← Mathandling: veckoschema ↔ inköpslista (swipe)
│   ├── GenericScreen.jsx← Generisk checklista (renovering, presenter m.m.)
│   └── SettingsScreen.jsx
├── App.jsx              ← Router
└── main.jsx             ← Entry point
```

## Kom igång

```bash
npm install
npm run dev
```

Öppna `http://localhost:5173` i mobil-läge (DevTools → Toggle device toolbar).

## Bygga för produktion / Vercel

```bash
npm run build
# dist/ är redo att deployas
```

## Nästa steg

- [ ] Supabase-integration (delar tabeller med Homeboard-projektet)
- [ ] Riktigt receptscraping via Edge Function + ld+json / regex
- [ ] Delade hushåll (Supabase Row Level Security)
- [ ] RunAI MCP-integration
- [ ] Homeboard-widget (läs lista via Supabase Realtime)
- [ ] Swipe-to-delete på listitems
- [ ] Veckonavigering (← Vecka 23 →)
