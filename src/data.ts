import { List } from "./types";

export const INITIAL_LISTS: List[] = [
  {
    id: "renovation-1",
    name: "Badrumsrenovering",
    icon: "construction",
    themeColor: "#7C2E00", // accent-rust
    category: "renovation",
    tasks: [
      { id: "r-t-1", text: "Måla gästrummet", checked: false },
      { id: "r-t-2", text: "Beställa klinkers", checked: false },
      { id: "r-t-3", text: "Ringa rörmokaren", checked: false },
      { id: "r-t-4", text: "Slipa trägolvet", checked: false, notes: "Hyr golvslip under helgen" },
      { id: "r-t-5", text: "Fönsterinstallation", checked: false, progress: 66, notes: "Hantverkare anländer kl. 10:00" },
      { id: "r-t-6", text: "Riva gamla garderoben", checked: true },
      { id: "r-t-7", text: "Bila bort gammalt golv", checked: true },
      { id: "r-t-8", text: "Frakta bort byggavfall", checked: true },
      { id: "r-t-9", text: "Dra om ventilationsrör", checked: true },
      { id: "r-t-10", text: "Köpa tätskiktsfolie", checked: true },
      { id: "r-t-11", text: "Måla taket", checked: true },
      { id: "r-t-12", text: "Montera handfat & blandare", checked: false }
    ]
  },
  {
    id: "grocery-1",
    name: "ICA Vecka 23",
    icon: "shopping_cart",
    themeColor: "#346a2f", // secondary green
    category: "grocery",
    tasks: [
      { id: "g-t-1", text: "Äpplen (6st)", checked: false, notes: "Frukt & Grönt" },
      { id: "g-t-2", text: "Bananer (1 klase)", checked: false, notes: "Frukt & Grönt" },
      { id: "g-t-3", text: "Avokado (2st)", checked: true, notes: "Frukt & Grönt" },
      { id: "g-t-4", text: "Mjölk (2L)", checked: false, notes: "Mejeri" },
      { id: "g-t-5", text: "Smör (500g)", checked: false, notes: "Mejeri" },
      { id: "g-t-6", text: "Pasta (1kg)", checked: false, notes: "Skafferi" },
      { id: "g-t-7", text: "Krossade tomater (2 burkar)", checked: false, notes: "Skafferi" },
      { id: "g-t-8", text: "Kycklingbröst (1kg)", checked: true, notes: "Kött & Fisk" },
      { id: "g-t-9", text: "Laxfilé (4st)", checked: false, notes: "Kött & Fisk" },
      { id: "g-t-10", text: "Hushållspapper (1 förp)", checked: false, notes: "Övrigt" }
    ],
    meals: [
      { id: "m-1", day: "Måndag", type: "middag", name: "Pasta Bolognese" },
      { id: "m-2", day: "Tisdag", type: "middag", name: "Lax med potatis" },
      { id: "m-3", day: "Onsdag", type: "middag", name: "Grillad kyckling" }
    ]
  },
  {
    id: "daily-1",
    name: "Dagliga sysslor",
    icon: "today",
    themeColor: "#003b05", // primary dark green
    category: "general",
    tasks: [
      { id: "d-t-1", text: "Vattna blommorna", checked: true },
      { id: "d-t-2", text: "Städa köket", checked: true },
      { id: "d-t-3", text: "Gå ut med soporna", checked: true },
      { id: "d-t-4", text: "Bädda sängen", checked: true },
      { id: "d-t-5", text: "Träna 30 min", checked: false }
    ]
  }
];

export const QUICK_TEMPLATES = [
  {
    name: "Weekendresa",
    icon: "flight",
    themeColor: "#792e4c",
    category: "general" as const,
    tasks: [
      { id: "temp-1", text: "Packa pass & biljetter", checked: false },
      { id: "temp-2", text: "Köpa reseförpackningar", checked: false },
      { id: "temp-3", text: "Ladda powerbank", checked: false },
      { id: "temp-4", text: "Låsa fönster & släcka lampor", checked: false }
    ]
  },
  {
    name: "Vårstädning",
    icon: "today",
    themeColor: "#326a2d",
    category: "general" as const,
    tasks: [
      { id: "temp-5", text: "Putsa alla fönster", checked: false },
      { id: "temp-6", text: "Tvätta mattorna", checked: false },
      { id: "temp-7", text: "Organisera garderoben", checked: false },
      { id: "temp-8", text: "Rensa ut förrådet", checked: false }
    ]
  },
  {
    name: "Jobb-Fokus",
    icon: "book",
    themeColor: "#003b05",
    category: "general" as const,
    tasks: [
      { id: "temp-9", text: "Planera veckans möten", checked: false },
      { id: "temp-10", text: "Rensa inkorgen", checked: false },
      { id: "temp-11", text: "Skriva statusrapport", checked: false }
    ]
  }
];
