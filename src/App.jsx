import { useState } from "react";
import HubScreen      from "./screens/HubScreen.jsx";
import GroceryScreen  from "./screens/GroceryScreen.jsx";
import GenericScreen  from "./screens/GenericScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import { uid, mkSchedule } from "./data/constants.js";

// Seed data so the app feels alive on first load
const SEED = [
  {
    id: uid(),
    name: "ICA Vecka 23",
    type: {
      id:"grocery", label:"Mathandling", icon:"🛒",
      color:"#1a5319", bg:"#d0e9d2", desc:"Veckoschema + inköpslista", hasSchedule:true,
    },
    items: [
      { id:uid(), title:"Pasta", key:uid(), category:"pantry",  fromMeal:"Måndag · Middag", checked:false },
      { id:uid(), title:"Nötfärs 500g", key:uid(), category:"meat", fromMeal:"Måndag · Middag", checked:false },
      { id:uid(), title:"Mjölk", key:uid(), category:"dairy",   fromMeal:null, checked:true },
    ],
    checked: {},
    schedule: (() => {
      const s = mkSchedule();
      s["Måndag"].dinner = { name:"Pasta Bolognese" };
      s["Onsdag"].dinner = { name:"Laxpasta" };
      return s;
    })(),
    pinned: false,
  },
  {
    id: uid(),
    name: "Badrumsrenovering",
    type: {
      id:"renovation", label:"Renovering", icon:"🔧",
      color:"#7c2e00", bg:"#ffe8d9", desc:"Bygg, verktyg, material", hasSchedule:false,
    },
    items: [
      { id:uid(), title:"Kakel 10m²",  key:uid(), checked:false },
      { id:uid(), title:"Spackel",     key:uid(), checked:true  },
      { id:uid(), title:"Borrmaskin",  key:uid(), checked:false },
    ],
    checked: {},
    schedule: null,
    pinned: false,
  },
];

export default function App() {
  const [screen,     setScreen]     = useState("hub");
  const [lists,      setLists]      = useState(SEED);
  const [activeList, setActiveList] = useState(null);

  const openList = (list) => {
    setActiveList(list);
    setScreen("list");
  };

  const createList = (list) => {
    setLists(p => [...p, list]);
    setActiveList(list);
    setScreen("list");
  };

  const updateList = (updated) => {
    setLists(p => p.map(l => l.id === updated.id ? updated : l));
    setActiveList(updated);
  };

  const currentList = activeList
    ? lists.find(l => l.id === activeList.id) || activeList
    : null;

  if (screen === "settings") {
    return <SettingsScreen onBack={() => setScreen("hub")} />;
  }

  if (screen === "list" && currentList) {
    const isGrocery = currentList.type.id === "grocery";
    if (isGrocery) {
      return <GroceryScreen list={currentList} onUpdate={updateList} onBack={() => setScreen("hub")} />;
    }
    return <GenericScreen list={currentList} onUpdate={updateList} onBack={() => setScreen("hub")} />;
  }

  return (
    <HubScreen
      lists={lists}
      onOpen={openList}
      onCreate={createList}
      onSettings={() => setScreen("settings")}
    />
  );
}
