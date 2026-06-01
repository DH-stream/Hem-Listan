export const LIST_TYPES = [
  {
    id: "grocery",
    label: "Mathandling",
    icon: "🛒",
    color: "#1a5319",
    bg: "#d0e9d2",
    desc: "Veckoschema + inköpslista",
    hasSchedule: true,
  },
  {
    id: "generic",
    label: "Fri lista",
    icon: "📋",
    color: "#41493e",
    bg: "#e8f0e5",
    desc: "Enkel checklista",
    hasSchedule: false,
  },
  {
    id: "renovation",
    label: "Renovering",
    icon: "🔧",
    color: "#7c2e00",
    bg: "#ffe8d9",
    desc: "Bygg, verktyg, material",
    hasSchedule: false,
  },
  {
    id: "gifts",
    label: "Presenter",
    icon: "🎁",
    color: "#5b3a8e",
    bg: "#ede7f6",
    desc: "Julklappar & födelsedagar",
    hasSchedule: false,
  },
  {
    id: "packing",
    label: "Packlista",
    icon: "🏕️",
    color: "#0277bd",
    bg: "#e1f5fe",
    desc: "Resa, camping, semester",
    hasSchedule: false,
  },
  {
    id: "kids",
    label: "Barn",
    icon: "🧸",
    color: "#e91e63",
    bg: "#fce4ec",
    desc: "Dagis, aktiviteter, utrustning",
    hasSchedule: false,
  },
];

export const CATEGORIES = [
  { id:"produce",  label:"Frukt & Grönt", icon:"🥦", color:"#d0e9d2" },
  { id:"meat",     label:"Kött & Fisk",   icon:"🥩", color:"#ffdad6" },
  { id:"dairy",    label:"Mejeri & Ägg",  icon:"🧀", color:"#fff8e1" },
  { id:"frozen",   label:"Fryst",         icon:"❄️", color:"#e1f5fe" },
  { id:"pantry",   label:"Skafferi",      icon:"🫙", color:"#eae7e7" },
  { id:"bread",    label:"Bröd",          icon:"🍞", color:"#fff3e0" },
  { id:"drinks",   label:"Dryck",         icon:"🥤", color:"#e8f5e9" },
  { id:"other",    label:"Övrigt",        icon:"🛍️", color:"#f0eded" },
];

export const DAYS = ["Måndag","Tisdag","Onsdag","Torsdag","Fredag","Lördag","Söndag"];

export const MEALS = [
  { id:"breakfast", label:"Frukost", emoji:"☀️" },
  { id:"lunch",     label:"Lunch",   emoji:"🌤️" },
  { id:"dinner",    label:"Middag",  emoji:"🌙" },
];

export const detectCat = (s) => {
  const l = s.toLowerCase();
  if (/(mjölk|ost|yoghurt|grädde|smör|ägg|kvarg|fil)/.test(l))         return "dairy";
  if (/(kyckling|nöt|fläsk|fisk|lax|räk|kött|köttfärs|biff)/.test(l)) return "meat";
  if (/(fryst|glass)/.test(l))                                          return "frozen";
  if (/(bröd|toast|knäcke|bagel|bulle)/.test(l))                       return "bread";
  if (/(juice|vatten|läsk|öl|vin|kaffe|te|saft)/.test(l))              return "drinks";
  if (/(tomat|gurka|paprika|lök|vitlök|morot|potatis|äpple|banan|citron|sallad|spenat|broccoli|avokado)/.test(l)) return "produce";
  if (/(pasta|ris|mjöl|socker|olja|sås|konserv|krydda|buljong)/.test(l)) return "pantry";
  return "other";
};

export const uid = () => Math.random().toString(36).slice(2, 9);

export const mkSchedule = () => {
  const s = {};
  DAYS.forEach(d => {
    s[d] = { breakfast: null, lunch: null, dinner: null };
  });
  return s;
};
