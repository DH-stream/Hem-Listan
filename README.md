# Hem-Listan

Smarta listor för hemmet – mathandling, renovering, presenter m.m.

## Stack

- **React 19** + TypeScript + Vite
- **Supabase** för autentisering, profiler och delade listor
- **PWA** via `vite-plugin-pwa` (offline-kapabel, installerbar)
- **Express/Vercel API routes** för serverfunktioner som receptimport
- **Tailwind CSS** och komponentnära styling

## Projektstruktur

```
src/
├── components/           ← Vyer, modaler och delade UI-komponenter
├── lib/                  ← Supabase, profil-, versions- och listlogik
├── App.tsx               ← Applikationsflöde och state
├── data.ts               ← Startdata och mallar
├── index.css             ← Globala stilar och designtokens
├── main.tsx              ← Entry point
└── types.ts              ← Delade domäntyper
api/                      ← Vercel API routes och receptimport
supabase/migrations/      ← Databasfunktioner och schemaändringar
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

## Produktidé: receptbank och mattips

Importerade recept ska på sikt kunna sparas som återanvändbara recept i Supabase, inte bara skapa en måltid och en inköpslista vid importtillfället.

Grundidé:

- När användaren importerar en receptlänk och bekräftar den sparas receptet i en privat receptbank.
- Spara titel, källa, bildlänk, ingredienser, instruktioner och när receptet användes/importerades.
- Bild är viktig för mattipskortet. I första versionen räcker det att spara `image_url` från receptets metadata/JSON-LD om den finns.
- Importerade recept ska vara privata som standard.
- Mattipskortet kan först föreslå recept från användarens egna sparade recept.
- Senare kan användaren aktivt välja att dela ett recept till en gemensam receptbank.
- Publika/community-recept ska inte automatiskt återpublicera externa bilder från t.ex. ICA/Arla/Köket som om de vore Hem-Listans egna.
- För publika recept kan appen senare använda neutral AI-genererad bild, egen uppladdad bild eller fallback-visual.
- Originalkälla ska alltid sparas och kunna visas/länkas.

Föreslagen ordning:

1. Privat receptbank i Supabase för importerade recept.
2. Mattipskort från egna sparade recept med bild.
3. Receptdetalj från måltid/importerat recept.
4. Aktiv publicering till gemensam receptbank.
5. Community-tips från publika recept.
6. Eventuellt AI-genererade neutrala bilder för publika receptkort.

Viktiga gränser:

- Börja inte med community direkt.
- Importerade recept ska inte publiceras automatiskt.
- AI ska inte vara first implementation för receptimporten; AI kan senare vara fallback eller bildgenerering.
- Håll isär måltid i schema, sparat recept och inköpsrader.

## Nästa steg

- [ ] Supabase-integration (delar tabeller med Homeboard-projektet)
- [ ] Riktigt receptscraping via Edge Function + ld+json / regex
- [ ] Privat receptbank i Supabase för importerade recept
- [ ] Mattipskort från sparade recept med bild
- [ ] Delade hushåll (Supabase Row Level Security)
- [ ] RunAI MCP-integration
- [ ] Homeboard-widget (läs lista via Supabase Realtime)
- [ ] Swipe-to-delete på listitems
- [ ] Veckonavigering (← Vecka 23 →)

