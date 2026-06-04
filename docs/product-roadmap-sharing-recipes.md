# Hem-Listan: delning, presence och receptbibliotek

Det här dokumentet samlar produkt- och teknikplanen för nästa större steg i Hem-Listan efter att Supabase-synken är stabil.

Målet är att appen ska kännas lokal och snabb först, men kunna växa till en riktig delad hushålls-/familjeupplevelse utan att användaren behöver förstå backend, konton eller synk.

## Grundprinciper

Hem-Listan ska fortsätta vara individcentrerad först. Användaren ska kunna prova appen utan konto, skapa listor lokalt och först senare logga in när appen känns värd att spara.

När användaren loggar in ska befintliga lokala listor migreras till Supabase automatiskt. Det är viktigt att migrationen bara markeras som klar när listor, tasks och meals faktiskt har sparats korrekt.

E-post är teknisk identitet. I UI ska vi använda visningsnamn, till exempel `Max`, `Anna` eller `Mamma`, inte primärt e-postadresser. E-post kan visas sekundärt i konto-/invite-flöden.

Delning ska vara tydlig för användaren. Det finns två olika delningsmodeller:

- **Skicka lista** betyder att skicka en fristående kopia.
- **Dela lista** betyder att bjuda in någon till gemensam redigering.

De två flödena ska inte blandas ihop.

## Fas 1: stabil Supabase-synk

Det här är basen som måste vara stabil innan resten byggs ovanpå.

Krav:

- Google/email-login fungerar via Supabase Auth.
- Lokala användarskapade listor migreras till Supabase efter signup/login.
- `hl_lists` får rader med `owner_id = auth.uid()`.
- `hl_tasks` och `hl_meals` sparas mot riktig Supabase UUID, inte temporära `list-*` id:n.
- Appen får inte markera migration som klar om någon list/task/meal misslyckas.
- Realtime-tabellerna `hl_lists`, `hl_tasks`, `hl_meals`, `hl_list_members` ska vara aktiverade i Supabase realtime-publicationen.

Sannolik backend-risk:

- RLS för `hl_tasks` och `hl_meals` kan behöva justeras så att listägaren alltid får insert/update/delete även om ägaren inte har en separat rad i `hl_list_members`.

## Fas 2: profiler och visningsnamn

För delning, presence och snyggare UI behövs en riktig profilmodell.

Föreslagen tabell:

```sql
create table public.hl_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Beteende:

- Vid första login skapas profil om den saknas.
- `display_name` seedas från Google metadata om möjligt, annars från befintligt lokalt visningsnamn.
- SettingsModal uppdaterar både lokal UI-state och `hl_profiles.display_name` när användaren är inloggad.
- UI använder `display_name` för listmedlemmar, invites och presence.
- E-post visas bara som sekundär detalj där det behövs.

## Profilbild

Nuvarande profilbild finns lokalt via `user_profile_image`. Det är okej offline, men när konto finns bör bilden sparas molnmässigt.

Rekommenderad modell:

- Lagra själva bilden i Supabase Storage, inte som base64 i Postgres.
- Bucket: `avatars`.
- Path: `avatars/{userId}/profile.jpg`.
- Spara bara `avatar_path` eller public/signed URL-referens i `hl_profiles`.

Varför inte base64 i tabell:

- En komprimerad 200x200 JPEG kan ändå bli 10–40 KB eller mer.
- Base64 i Postgres gör profilrader tyngre än nödvändigt.
- Presence och list-header behöver bara en URL/path, inte bildbytes.

Viktigt UI-beteende:

- Om användaren har satt profilbild: visa den.
- Om användaren inte har satt profilbild: visa ingen avatar, om inte ytan specifikt är en presence-stack där neutral fallback senare beslutas separat.
- Inga random fallback-avatars.
- Inga externa `googleusercontent/aida-public` placeholderbilder.

## Fas 3: Skicka lista

**Skicka lista** är lågfriktionsdelning. Det ska fungera även om mottagaren inte har konto.

Produktdefinition:

- Mottagaren får en kopia/snapshot.
- Mottagaren redigerar inte originalet.
- Ingen realtime.
- Ingen gemensam historik.
- Mottagaren ska helst kunna öppna länken utan konto.

Föreslagen tabell:

```sql
create table public.hl_list_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_list_id uuid references public.hl_lists(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  share_token text not null unique,
  snapshot jsonb not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
```

UX:

När användaren trycker delningsikonen i en lista visas val:

```text
Skicka lista
Skicka en kopia som någon kan öppna utan konto. Mottagaren kan inte ändra din lista.

Dela lista
Bjud in någon att redigera listan tillsammans med dig. Kräver konto och synkas i realtid.
```

## Fas 4: Dela lista

**Dela lista** är gemensam redigering.

Produktdefinition:

- Mottagaren bjuds in till samma lista.
- Konto/login krävs.
- Alla redigerar samma data.
- Realtime gäller.
- Presence kan visas i själva listan.

Befintlig/planerad medlemsmodell:

```sql
public.hl_list_members
  list_id uuid
  user_id uuid
  role text -- owner/admin/member/viewer senare
  created_at timestamptz
```

Föreslagen invite-tabell:

```sql
create table public.hl_list_invites (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.hl_lists(id) on delete cascade,
  invited_email text not null,
  invite_token text not null unique,
  role text not null default 'member',
  status text not null default 'pending',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
```

UX-principer:

- Knappen ska heta **Dela lista**, inte bara “Bjud in”.
- Förklara kort: “Bjud in någon att redigera listan tillsammans med dig”.
- Mottagaren får invite via e-post/länk.
- När invite accepteras skapas rad i `hl_list_members`.
- Listan visas i bådas app.

## Fas 5: Presence i listan

Presence ska vara per lista, inte globalt per app.

Rätt mental modell:

- “Anna är också här” betyder att Anna är inne i samma lista.
- Inte “Anna är online i appen”.

Teknisk modell:

Supabase Presence-kanal per lista:

```ts
const channel = supabase.channel(`hl_list_presence:${listId}`);

channel.track({
  user_id,
  display_name,
  avatar_url,
  list_id,
  active_view: 'schedule' | 'shopping_list' | 'detail',
  updated_at: new Date().toISOString(),
});
```

UI:

- Google Docs-lik avatar-stack i list-headern.
- Visa bara andra personer som är i samma lista.
- Om användaren själv har profilbild kan den visas i stacken vid behov.
- När någon annan kommer in: liten lokal toast i listan, t.ex. “Anna är också i listan”.
- När någon lämnar: eventuellt diskret fade, inte global toast.

Första version:

- Visa små cirklar i headern.
- Visa toast när en ny annan användare dyker upp.
- Ingen avancerad cursor/field-level editing.

Senare version:

- Aktivitetstext: “Anna redigerar listan”.
- Små live-hints när någon bockar av en vara.
- Patcha realtime-events lokalt istället för full reload vid varje ändring.

## Fas 6: Spara recept från länk

Receptimport via länk ska inte bara skapa ingredienser/tasks. Användaren ska kunna spara receptet som ett eget objekt.

Produktmål:

- Importera recept från länk.
- Visa maträtt + ingredienser + instruktioner.
- Låt användaren bekräfta receptet innan det sparas.
- Låt användaren välja: “Lägg till i veckan”, “Lägg till ingredienser” och/eller “Spara recept”.
- Sparade recept ska kunna återanvändas senare.
- En måltid i veckovyn ska kunna öppna receptinformationen igen.

Föreslagen tabell:

```sql
create table public.hl_recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_url text,
  source_site text,
  title text not null,
  image_url text,
  image_path text,
  base_servings int,
  ingredients jsonb,
  instructions jsonb,
  notes text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Koppling till meals:

```sql
alter table public.hl_meals
add column recipe_id uuid references public.hl_recipes(id) on delete set null,
add column recipe_snapshot jsonb,
add column servings int,
add column completed_instruction_indices int[] not null default '{}';
```

`recipe_snapshot` gör att en planerad måltid kan behålla receptinformationen även om originalreceptet senare uppdateras. Det är extra värdefullt om receptet kommer från extern länk.

UX efter lyckad import:

```text
Recept hämtat
Bananplättar
2 portioner

[ Lägg till i veckan ] [ Lägg till ingredienser ] [ Spara recept ]
```

Senare vy:

- Sparade recept.
- Favoriter.
- Sök recept.
- Lägg recept i veckoschema.
- Lägg ingredienser i inköpslista.

## Receptimport, bekräftelse och cook mode

Tänkt huvudflöde:

```text
Klistra in receptlänk
→ Backend extraherar receptdata
→ Appen visar bekräftelsevy
→ Användaren justerar portioner och väljer vad som ska sparas
→ Måltiden läggs i veckovyn
→ Användaren kan trycka på måltiden och öppna receptet igen
→ Cook mode med bockbara instruktioner och valfri skärm-vaken-toggle
```

### Extrahering

Receptlänkar ska hämtas via backend, inte direkt från frontend, för att undvika CORS och för att hålla parsinglogiken samlad.

Föreslagen funktion:

```text
extract-recipe-from-url
```

Input:

```json
{
  "url": "https://www.ica.se/recept/bananplattar-722309/"
}
```

Output ska vara stabilt oavsett källa:

```ts
type ExtractedRecipe = {
  sourceUrl: string;
  sourceSite?: string;
  title: string;
  imageUrl?: string;
  baseServings?: number;
  timeLabel?: string;
  difficulty?: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  confidence: 'high' | 'medium' | 'low';
  extractionMethod: 'json_ld' | 'open_graph' | 'site_adapter' | 'ai_fallback';
};

type RecipeIngredient = {
  raw: string;
  quantity?: number;
  unit?: string;
  name?: string;
  section?: string;
  note?: string;
  scalable?: boolean;
};

type RecipeInstruction = {
  order: number;
  text: string;
};
```

Extraktionsordning:

1. JSON-LD / schema.org `Recipe`.
2. Open Graph fallback för titel/bild/beskrivning.
3. Site-adapters för viktiga receptsidor, först t.ex. `ica.se`.
4. AI fallback endast om strukturerad parsing misslyckas.

AI ska alltså inte vara first implementation.

### Bekräftelsevy

Efter att länken hämtats ska användaren få en bekräftelsevy innan något sparas.

Vyn bör visa:

- Titel.
- Bild om den finns.
- Källa och länk till originalrecept.
- Portioner.
- Ingredienser.
- Instruktioner.
- Confidence/varning om parsing verkar osäker.

Användaren ska kunna:

- Justera portioner.
- Lägga receptet i veckovyn.
- Lägga de skalade ingredienserna i inköpslistan.
- Spara receptet i receptbiblioteket.
- Avbryta utan att spara.

### Portionsskalning

Ingredienser ska kunna skalas upp/ner med enkel matte:

```ts
scaledQuantity = quantity * (currentServings / baseServings)
```

Exempel från ett recept på 2 portioner:

```text
1 banan → 2 bananer vid 4 portioner
2 ägg → 4 ägg vid 4 portioner
1/2 tsk vaniljsocker → 1 tsk vid 4 portioner
```

Regler:

- Spara alltid `raw` originaltext.
- Skala bara ingredienser där `quantity` kan tolkas säkert.
- Ingredienser som “salt”, “peppar”, “efter smak”, “lite olja” eller liknande ska inte skalas automatiskt.
- Instruktionstext ska inte skalas i första versionen. Den visas som originalinstruktioner.
- När användaren trycker “Lägg till ingredienser” ska appen använda de skalade ingredienserna.

### Cook mode

När användaren trycker på en måltid i veckovyn som har `recipe_id` eller `recipe_snapshot` ska receptinformationen öppnas igen.

Cook mode bör visa:

- Receptbild och titel.
- Portioner med möjlighet att justera.
- Ingredienser, helst skalade enligt aktuell portionsinställning.
- Bockbara instruktioner.
- Källa/originalrecept.
- Toggle för att hålla skärmen tänd.

Instruktioner:

```text
Gör så här
☐ Mosa bananen.
☐ Vispa ihop med ägg och vaniljsocker.
☐ Stek små plättar i smör.
☐ Servera med kanel, kokos, banan eller lönnsirap.
```

Bockade steg kan sparas på måltiden via `completed_instruction_indices`. Det gör att användaren kan lämna receptet och komma tillbaka utan att tappa var den var.

### Håll skärmen tänd

Cook mode kan ha en liten opt-in-toggle:

```text
☐ Håll skärmen tänd medan jag lagar
```

Tekniskt kan webben använda Screen Wake Lock API där det stöds:

```ts
const wakeLock = await navigator.wakeLock.request('screen');
```

Regler:

- Funktionen ska vara opt-in, inte alltid på.
- Wake lock ska släppas när receptvyn stängs.
- Wake lock ska släppas när användaren stänger av togglen.
- Wake lock ska släppas när sista instruktionen bockas av, om det känns naturligt i UX-test.
- Om API:t inte stöds ska appen bara dölja eller disabla togglen utan att visa tekniskt fel.

## Receptbild och tipskort

Shopping-tips-kortet i inköpslistan ska gärna visa bild på en faktisk rekommenderad maträtt. Det känns mer fräscht än en generisk gradient.

Rekommenderad modell:

- Kortet visar ett relevant recepttips baserat på listans ingredienser, veckoschema eller sparade recept.
- Bild hämtas från receptets `image_url` eller `image_path`.
- Om ingen bild finns, använd en lokal grafisk fallback/gradient, inte extern placeholder.
- Bilden ska inte vara random; den ska höra ihop med maträtten/tipset.

Exempel:

```text
Middagstips från din lista
Krämig laxpasta med tomat
Du har redan laxfilé och krossade tomater i listan.
[Visa recept]
```

Möjlig datamodell för kuraterade tips:

```sql
create table public.hl_tips (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  subtitle text,
  body text,
  cta_label text,
  cta_url text,
  source_name text,
  image_url text,
  image_path text,
  match_keywords text[],
  priority int not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
```

Första implementation:

- Visa ett enkelt kuraterat tips eller receptkort.
- Matcha på enkla keywords från listans varor.
- Ingen AI-first implementation.

AI kan senare användas som fallback för receptdelen, men inte som första implementation för hela tipsflödet.

## Rekommenderad ordning

1. Verifiera att Supabase-synk fungerar end-to-end.
2. Fixa eventuell RLS för `hl_tasks` och `hl_meals`.
3. Inför `hl_profiles` med display name.
4. Flytta inloggad profilbild till Supabase Storage + `avatar_path`.
5. Bygg `Dela lista` med invites + `hl_list_members`.
6. Lägg till listbaserad presence-stack och lokal presence-toast.
7. Bygg `Skicka lista` som snapshot/kopia utan konto.
8. Bygg `extract-recipe-from-url` med JSON-LD först och ICA-adapter som tidigt testfall.
9. Bygg `hl_recipes` och “Spara recept” efter länkimport.
10. Koppla recept till `hl_meals` så måltider i veckovyn kan öppna receptinfo igen.
11. Bygg cook mode med bockbara instruktioner och opt-in wake lock.
12. Uppgradera shopping-tips-kortet till riktig recept-/tipsyta med relevant bild.

## Saker som inte ska blandas ihop

- Skicka lista och Dela lista är olika flöden.
- Presence är per lista, inte per app.
- Profilbild ska vara användarvald/appägd, inte extern placeholder.
- Receptimport ska inte vara Gemini-first. AI får vara fallback endast för receptdelen senare.
- SettingsModal ska inte bli huvudplatsen för listdelning. Delning ska ske från den faktiska listan.
