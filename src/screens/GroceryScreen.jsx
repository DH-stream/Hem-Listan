import { useState, useRef } from "react";
import { C, F, SHADOW } from "../data/tokens.js";
import { DAYS, MEALS, CATEGORIES, detectCat, uid } from "../data/constants.js";
import { Checkbox, Sheet, Input, Textarea, Btn, BtnOutline, Card } from "../components/ui.jsx";

// ── Day card ──────────────────────────────────────────────────────────────────
const ACCENTS = ["#ffdbcc","#d0e9d2","#89c67e","#b3f3a6","#ffdbcc","#d0e9d2","#fff8e1"];

const DayCard = ({ day, dayIdx, slots, onAdd, onRemove }) => (
  <div style={{
    background:"rgba(255,255,255,0.72)", backdropFilter:"blur(14px)",
    borderRadius:22, border:"1px solid rgba(255,255,255,0.6)",
    boxShadow: SHADOW.md, overflow:"hidden",
  }}>
    <div style={{ height:4, background: ACCENTS[dayIdx % ACCENTS.length] }} />
    <div style={{ padding:"12px 14px" }}>
      <div style={{ fontFamily:F.display, fontWeight:700, fontSize:16,
        color:C.onSurface, marginBottom:10 }}>{day}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {MEALS.map(meal => {
          const data = slots[meal.id];
          return data ? (
            <div key={meal.id} style={{
              background:C.surfaceContainerLow, borderRadius:12,
              padding:"9px 12px", display:"flex", alignItems:"center", gap:10,
            }}>
              <span style={{ fontSize:16 }}>{meal.emoji}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.outline,
                  letterSpacing:"0.06em" }}>{meal.label.toUpperCase()}</div>
                <div style={{ fontSize:13, fontWeight:600, color:C.onSurface,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                  marginTop:1 }}>{data.name}</div>
              </div>
              <button onClick={() => onRemove(day, meal.id)} style={{
                width:26, height:26, borderRadius:99, border:"none",
                background:"transparent", cursor:"pointer", fontSize:14,
                color:C.outline, flexShrink:0,
              }}>✕</button>
            </div>
          ) : (
            <button key={meal.id} onClick={() => onAdd(day, meal.id)} style={{
              border:`1.5px dashed ${C.outlineVariant}`,
              background:"transparent", borderRadius:12,
              padding:"9px 14px", display:"flex", alignItems:"center",
              justifyContent:"space-between", cursor:"pointer", width:"100%",
              transition:"border-color 0.15s",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:15, opacity:0.5 }}>{meal.emoji}</span>
                <span style={{ fontFamily:F.body, fontSize:13, fontWeight:500,
                  color:`${C.onSurfaceVariant}80` }}>{meal.label}</span>
              </div>
              <span style={{ fontSize:18, color:`${C.primary}60` }}>+</span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

// ── Category section ──────────────────────────────────────────────────────────
const CatSection = ({ cat, items, checkedMap, onToggle }) => {
  if (!items.length) return null;
  const remaining = items.filter(i => !checkedMap[i.key]).length;
  return (
    <div style={{
      background:"rgba(255,255,255,0.72)", backdropFilter:"blur(14px)",
      borderRadius:20, border:"1px solid rgba(255,255,255,0.6)",
      boxShadow: SHADOW.sm, padding:"14px 16px", marginBottom:10,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:cat.color,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
          {cat.icon}
        </div>
        <span style={{ fontFamily:F.display, fontWeight:700, fontSize:15,
          color:C.onSurface, flex:1 }}>{cat.label}</span>
        <span style={{ fontFamily:F.body, fontSize:12, fontWeight:600,
          background: C.secondaryContainer, color:C.onSecondaryContainer,
          padding:"2px 10px", borderRadius:99 }}>{remaining} kvar</span>
      </div>
      {items.map(item => (
        <div key={item.key} onClick={() => onToggle(item.key)} style={{
          display:"flex", alignItems:"center", gap:10, padding:"9px 8px",
          borderRadius:12, cursor:"pointer", marginBottom:4,
          background: checkedMap[item.key] ? C.surfaceContainer : "transparent",
          opacity: checkedMap[item.key] ? 0.5 : 1, transition:"all 0.15s",
        }}>
          <Checkbox checked={!!checkedMap[item.key]} color={C.primaryContainer} />
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:F.body, fontWeight:600, fontSize:14, color:C.onSurface,
              textDecoration: checkedMap[item.key] ? "line-through" : "none" }}>{item.title}</div>
            {item.fromMeal && (
              <div style={{ fontFamily:F.body, fontSize:11, color:C.outline, marginTop:1 }}>{item.fromMeal}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main grocery screen ───────────────────────────────────────────────────────
export default function GroceryScreen({ list, onUpdate, onBack }) {
  const [page,       setPage]       = useState(0); // 0=schema 1=lista
  const [checkedMap, setCheckedMap] = useState(list.checked || {});
  const [schedule,   setSchedule]   = useState(list.schedule);
  const [items,      setItems]      = useState(list.items || []);
  const [addMeal,    setAddMeal]    = useState(null);
  const [mealForm,   setMealForm]   = useState({ name:"", ingredients:"" });
  const [addItemTxt, setAddItemTxt] = useState("");

  // recipe link
  const [linkUrl,    setLinkUrl]    = useState("");
  const [linkStep,   setLinkStep]   = useState(null);
  const [scraped,    setScraped]    = useState(null);
  const [linkTarget, setLinkTarget] = useState({ day:DAYS[0], mealId:"dinner" });

  const swipeStartX = useRef(null);
  const color = list.type.color;

  // persist up
  const persist = (newItems, newSched, newChecked) => {
    onUpdate({ ...list,
      items:    newItems    ?? items,
      schedule: newSched    ?? schedule,
      checked:  newChecked  ?? checkedMap,
    });
  };

  // swipe
  const onTouchStart = e => { swipeStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = e => {
    if (swipeStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(diff) > 60) setPage(diff < 0 ? 1 : 0);
    swipeStartX.current = null;
  };

  // save meal
  const saveMeal = () => {
    if (!addMeal || !mealForm.name.trim()) return;
    const newSched = { ...schedule,
      [addMeal.day]: { ...schedule[addMeal.day], [addMeal.mealId]: { name:mealForm.name.trim() } }
    };
    let newItems = [...items];
    if (mealForm.ingredients.trim()) {
      const mealLabel = MEALS.find(m => m.id === addMeal.mealId)?.label;
      const extra = mealForm.ingredients.split("\n").map(s=>s.trim()).filter(Boolean)
        .map(title => ({ id:uid(), title, key:uid(), category:detectCat(title),
          fromMeal:`${addMeal.day} · ${mealLabel}`, checked:false }));
      newItems = [...newItems, ...extra];
    }
    setSchedule(newSched);
    setItems(newItems);
    persist(newItems, newSched, checkedMap);
    setAddMeal(null); setMealForm({ name:"", ingredients:"" });
  };

  const removeMeal = (day, mealId) => {
    const ns = { ...schedule, [day]: { ...schedule[day], [mealId]: null } };
    setSchedule(ns); persist(items, ns, checkedMap);
  };

  // toggle item
  const toggleItem = key => {
    const nc = { ...checkedMap, [key]: !checkedMap[key] };
    setCheckedMap(nc); persist(items, schedule, nc);
  };

  // add item manually
  const pushItem = () => {
    if (!addItemTxt.trim()) return;
    const ni = [...items, { id:uid(), title:addItemTxt.trim(), key:uid(),
      category:detectCat(addItemTxt), fromMeal:null, checked:false }];
    setItems(ni); persist(ni, schedule, checkedMap);
    setAddItemTxt("");
  };

  // recipe scrape (mock)
  const scrapeLink = () => {
    setLinkStep("loading");
    setTimeout(() => {
      const mock = [
        { name:"Pasta Bolognese",   ingredients:"500g nötfärs\nPasta 400g\nKrossade tomater\nLök\nVitlök\nOlivolja" },
        { name:"Laxpasta med dill", ingredients:"400g laxfilé\nPasta 350g\nCrème fraiche\nCitron\nDill" },
        { name:"Kycklingwok",       ingredients:"500g kycklingbröst\nPaprika\nBroccoli\nSojanötsås\nRis 300g" },
      ];
      setScraped(mock[Math.floor(Math.random() * mock.length)]);
      setLinkStep("confirm");
    }, 1800);
  };

  const confirmScrape = () => {
    const ns = { ...schedule,
      [linkTarget.day]: { ...schedule[linkTarget.day],
        [linkTarget.mealId]: { name: scraped.name }
      }
    };
    const mealLabel = MEALS.find(m => m.id === linkTarget.mealId)?.label;
    const extra = scraped.ingredients.split("\n").map(s=>s.trim()).filter(Boolean)
      .map(title => ({ id:uid(), title, key:uid(), category:detectCat(title),
        fromMeal:`${linkTarget.day} · ${mealLabel}`, checked:false }));
    const ni = [...items, ...extra];
    setSchedule(ns); setItems(ni);
    persist(ni, ns, checkedMap);
    setLinkStep(null); setLinkUrl(""); setScraped(null);
  };

  const done  = Object.values(checkedMap).filter(Boolean).length;
  const total = items.length;
  const grouped = CATEGORIES.map(cat => ({
    cat, items: items.filter(i => i.category === cat.id),
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ height:"100dvh", display:"flex", flexDirection:"column",
      background:C.surface, fontFamily:F.body, overflow:"hidden", position:"relative" }}>

      {/* Background blobs */}
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-15%", left:"-15%", width:"60vw", height:"60vw",
          borderRadius:"50%", background:C.onTertiaryContainer, opacity:0.12, filter:"blur(80px)" }} />
        <div style={{ position:"absolute", bottom:"-10%", right:"-10%", width:"50vw", height:"50vw",
          borderRadius:"50%", background:C.secondaryContainer, opacity:0.18, filter:"blur(80px)" }} />
      </div>

      {/* ── Top bar ── */}
      <header style={{
        position:"relative", zIndex:20,
        background:"rgba(252,249,248,0.85)", backdropFilter:"blur(14px)",
        borderBottom:`1px solid ${C.outlineVariant}25`,
        padding:"0 16px", height:62, flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        boxShadow: SHADOW.sm,
      }}>
        <button onClick={onBack} style={{ width:38, height:38, borderRadius:12, border:"none",
          background:C.surfaceContainerHigh, cursor:"pointer", fontSize:18,
          display:"flex", alignItems:"center", justifyContent:"center" }}>←</button>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:F.display, fontSize:18, fontWeight:700,
            color:C.primary, letterSpacing:"-0.02em" }}>{list.name}</div>
          {/* Page dots */}
          <div style={{ display:"flex", gap:5, justifyContent:"center", marginTop:3 }}>
            {[0,1].map(i => (
              <div key={i} style={{ width:6, height:6, borderRadius:99,
                background: page===i ? C.primary : `${C.primary}30`,
                transition:"all 0.25s ease",
                transform: page===i ? "scale(1.3)" : "scale(1)" }} />
            ))}
          </div>
        </div>
        <div style={{ fontSize:22 }}>{list.type.icon}</div>
      </header>

      {/* ── Slider ── */}
      <div style={{ flex:1, overflow:"hidden", position:"relative", zIndex:10 }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div style={{
          display:"flex", width:"200%", height:"100%",
          transform:`translateX(${page===0?"0":"-50%"})`,
          // GPU acceleration – no lag
          transition:"transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          willChange:"transform",
        }}>

          {/* PAGE 0 – Schema */}
          <div style={{ width:"50%", height:"100%", overflowY:"auto",
            padding:"14px 16px 100px", WebkitOverflowScrolling:"touch" }}>

            {/* Import card */}
            <div style={{
              background:"rgba(255,255,255,0.72)", backdropFilter:"blur(14px)",
              borderRadius:22, border:"1px solid rgba(255,255,255,0.6)",
              boxShadow: SHADOW.md, padding:"16px", marginBottom:18,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ width:34, height:34, borderRadius:10,
                  background:C.secondaryContainer, display:"flex",
                  alignItems:"center", justifyContent:"center", fontSize:18 }}>🔗</div>
                <span style={{ fontFamily:F.display, fontSize:16, fontWeight:700,
                  color:C.primary }}>Importera recept</span>
              </div>
              <p style={{ fontSize:13, color:C.onSurfaceVariant, marginBottom:10, lineHeight:1.5 }}>
                Klistra in en länk från ICA, Tasteline, Arla m.fl.
              </p>
              <div style={{ display:"flex", gap:8 }}>
                <input value={linkUrl} onChange={e=>setLinkUrl(e.target.value)}
                  placeholder="https://…" type="url"
                  style={{ flex:1, padding:"10px 12px", borderRadius:12,
                    border:`1.5px solid ${C.outlineVariant}`,
                    background:C.surfaceContainerLowest, fontSize:13,
                    fontFamily:F.body, color:C.onSurface, outline:"none" }} />
                <button onClick={()=>{ if(linkUrl.trim()){setLinkStep("input");} }} style={{
                  padding:"10px 14px", background:color, color:"#fff",
                  border:"none", borderRadius:12, fontFamily:F.body, fontWeight:700,
                  fontSize:13, cursor:"pointer",
                  boxShadow:`0 4px 12px ${color}50`,
                }}>Hämta</button>
              </div>
            </div>

            {/* Day cards */}
            <div style={{ fontFamily:F.body, fontSize:11, fontWeight:700,
              letterSpacing:"0.08em", color:C.tertiary, marginBottom:12 }}>DENNA VECKA</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {DAYS.map((day, di) => (
                <DayCard key={day} day={day} dayIdx={di} slots={schedule[day]}
                  onAdd={(d,m) => { setAddMeal({day:d,mealId:m}); setMealForm({name:"",ingredients:""}); }}
                  onRemove={removeMeal} />
              ))}
            </div>
          </div>

          {/* PAGE 1 – Lista */}
          <div style={{ width:"50%", height:"100%", overflowY:"auto",
            padding:"14px 16px 100px", WebkitOverflowScrolling:"touch" }}>

            {/* Progress card */}
            <div style={{
              background:"rgba(255,255,255,0.72)", backdropFilter:"blur(14px)",
              borderRadius:20, border:"1px solid rgba(255,255,255,0.6)",
              boxShadow: SHADOW.sm, padding:"16px 18px", marginBottom:16,
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontFamily:F.display, fontWeight:700, fontSize:16,
                  color:C.onSurface }}>Inköpslista</span>
                <span style={{ fontFamily:F.body, fontSize:14, fontWeight:700,
                  color:color }}>{done}/{total}</span>
              </div>
              <div style={{ height:6, background:C.surfaceContainerHigh,
                borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:99,
                  background:`linear-gradient(90deg,${color},${C.onPrimaryContainer})`,
                  width:`${total>0?(done/total)*100:0}%`, transition:"width 0.4s" }} />
              </div>
            </div>

            {/* Items */}
            {grouped.length === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 0", color:C.outline }}>
                <div style={{ fontSize:52, marginBottom:10 }}>🥬</div>
                <div style={{ fontFamily:F.display, fontWeight:700, fontSize:17,
                  color:C.onSurface }}>Tom lista</div>
                <div style={{ fontSize:13, marginTop:6, lineHeight:1.5 }}>
                  Lägg till måltider i schemat<br/>eller lägg till manuellt nedan
                </div>
              </div>
            ) : (
              grouped.map(({ cat, items:ci }) => (
                <CatSection key={cat.id} cat={cat} items={ci}
                  checkedMap={checkedMap} onToggle={toggleItem} />
              ))
            )}

            {/* Manual add */}
            <div style={{
              background:"rgba(255,255,255,0.72)", backdropFilter:"blur(14px)",
              borderRadius:20, border:"1px solid rgba(255,255,255,0.6)",
              boxShadow: SHADOW.sm, padding:"14px 16px", marginTop:4,
            }}>
              <div style={{ fontFamily:F.body, fontSize:11, fontWeight:700,
                letterSpacing:"0.07em", color:C.outline, marginBottom:10 }}>LÄGG TILL MANUELLT</div>
              <div style={{ display:"flex", gap:8 }}>
                <input value={addItemTxt}
                  onChange={e=>setAddItemTxt(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&pushItem()}
                  placeholder="Vara eller objekt…"
                  style={{ flex:1, padding:"11px 13px", borderRadius:12,
                    border:`1.5px solid ${C.outlineVariant}`,
                    background:C.surfaceContainerLowest, fontSize:14,
                    fontFamily:F.body, color:C.onSurface, outline:"none" }} />
                <button onClick={pushItem} style={{
                  width:44, height:44, borderRadius:12, border:"none",
                  background:color, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:22, color:"#fff",
                  boxShadow:`0 4px 12px ${color}50`,
                }}>＋</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <nav style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:30,
        background:"rgba(252,249,248,0.9)", backdropFilter:"blur(16px)",
        borderTop:`1px solid ${C.outlineVariant}25`,
        display:"flex", justifyContent:"center", gap:8,
        padding:"10px 24px 22px",
        boxShadow:"0 -4px 16px rgba(0,0,0,0.05)",
      }}>
        {[["📅","Schema",0],["🛒","Lista",1]].map(([icon,label,p]) => (
          <button key={p} onClick={()=>setPage(p)} style={{
            flex:1, maxWidth:140, padding:"10px 16px", borderRadius:99, border:"none",
            background: page===p ? C.tertiaryFixed : "transparent",
            cursor:"pointer", display:"flex", alignItems:"center",
            justifyContent:"center", gap:7, transition:"all 0.2s",
          }}>
            <span style={{ fontSize:18 }}>{icon}</span>
            <span style={{ fontFamily:F.body, fontWeight:600, fontSize:14,
              color: page===p ? C.tertiary : C.onSurfaceVariant }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Add meal sheet ── */}
      {addMeal && (
        <Sheet onClose={()=>setAddMeal(null)} zIndex={210}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
            <span style={{ fontSize:28 }}>{MEALS.find(m=>m.id===addMeal.mealId)?.emoji}</span>
            <div>
              <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700, color:C.primary }}>
                {MEALS.find(m=>m.id===addMeal.mealId)?.label}
              </div>
              <div style={{ fontSize:13, color:C.outline }}>{addMeal.day}</div>
            </div>
          </div>
          <label style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em",
            color:C.outline, display:"block", marginBottom:6 }}>MATRÄTT</label>
          <Input value={mealForm.name} autoFocus
            onChange={e=>setMealForm(p=>({...p,name:e.target.value}))}
            placeholder="t.ex. Pasta Bolognese" style={{ marginBottom:16 }} />
          <label style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em",
            color:C.outline, display:"block", marginBottom:6 }}>
            INGREDIENSER <span style={{ fontWeight:400 }}>(en per rad – läggs i listan)</span>
          </label>
          <Textarea value={mealForm.ingredients}
            onChange={e=>setMealForm(p=>({...p,ingredients:e.target.value}))}
            placeholder={"500g nötfärs\nPasta 400g\nKrossade tomater"}
            rows={5} style={{ marginBottom:20 }} />
          <div style={{ display:"flex", gap:10 }}>
            <BtnOutline onClick={()=>setAddMeal(null)} style={{ flex:1 }}>Avbryt</BtnOutline>
            <Btn onClick={saveMeal} color={color} style={{ flex:2 }}>Spara 🎉</Btn>
          </div>
        </Sheet>
      )}

      {/* ── Recipe link sheets ── */}
      {linkStep==="input" && (
        <Sheet onClose={()=>setLinkStep(null)} zIndex={220}>
          <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700, color:C.primary, marginBottom:18 }}>
            🔗 Importera recept
          </div>
          <Input value={linkUrl} autoFocus onChange={e=>setLinkUrl(e.target.value)}
            placeholder="https://www.ica.se/recept/…" type="url" style={{ marginBottom:20 }} />
          <div style={{ display:"flex", gap:10 }}>
            <BtnOutline onClick={()=>setLinkStep(null)} style={{ flex:1 }}>Avbryt</BtnOutline>
            <Btn onClick={scrapeLink} color={color} style={{ flex:2 }}>Hämta →</Btn>
          </div>
        </Sheet>
      )}

      {linkStep==="loading" && (
        <Sheet onClose={()=>{}} zIndex={220}>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:48, animation:"spin 1.1s linear infinite",
              display:"inline-block", marginBottom:14 }}>🔄</div>
            <div style={{ fontFamily:F.display, fontSize:18, fontWeight:700, color:C.primary }}>Hämtar recept…</div>
            <div style={{ fontSize:13, color:C.outline, marginTop:6 }}>Letar efter ingredienser</div>
          </div>
        </Sheet>
      )}

      {linkStep==="confirm" && scraped && (
        <Sheet onClose={()=>setLinkStep(null)} zIndex={220}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
            <span style={{ fontSize:26 }}>✅</span>
            <div>
              <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700, color:C.primary }}>Recept hittades!</div>
              <div style={{ fontSize:12, color:C.outline }}>Kontrollera och välj dag & måltid</div>
            </div>
          </div>
          <div style={{ background:C.surfaceContainerLow, borderRadius:16,
            padding:"14px", marginBottom:18 }}>
            <div style={{ fontFamily:F.display, fontSize:15, fontWeight:700, marginBottom:10 }}>
              🍽️ {scraped.name}
            </div>
            {scraped.ingredients.split("\n").map((ing,i)=>(
              <div key={i} style={{ fontSize:13, padding:"5px 0",
                borderBottom:`1px solid ${C.outlineVariant}30`,
                display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ color:color, fontSize:8 }}>●</span>{ing}
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em",
            color:C.outline, marginBottom:8 }}>VÄLJ DAG</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
            {DAYS.map(day=>(
              <button key={day} onClick={()=>setLinkTarget(p=>({...p,day}))} style={{
                padding:"6px 12px", borderRadius:99, border:"none", cursor:"pointer",
                background: linkTarget.day===day ? color : C.surfaceContainerHigh,
                color: linkTarget.day===day ? "#fff" : C.onSurfaceVariant,
                fontFamily:F.body, fontWeight:600, fontSize:12, transition:"all 0.15s",
              }}>{day.slice(0,3)}</button>
            ))}
          </div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em",
            color:C.outline, marginBottom:8 }}>VÄLJ MÅLTID</div>
          <div style={{ display:"flex", gap:8, marginBottom:20 }}>
            {MEALS.map(meal=>(
              <button key={meal.id} onClick={()=>setLinkTarget(p=>({...p,mealId:meal.id}))} style={{
                flex:1, padding:"10px 4px", borderRadius:14, border:"none", cursor:"pointer",
                background: linkTarget.mealId===meal.id ? color : C.surfaceContainerHigh,
                color: linkTarget.mealId===meal.id ? "#fff" : C.onSurfaceVariant,
                fontFamily:F.body, fontWeight:600, fontSize:13,
                display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                transition:"all 0.15s",
              }}>
                <span style={{ fontSize:20 }}>{meal.emoji}</span>
                {meal.label}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <BtnOutline onClick={()=>setLinkStep(null)} style={{ flex:1 }}>Avbryt</BtnOutline>
            <Btn onClick={confirmScrape} color={color} style={{ flex:2 }}>
              Lägg till i {linkTarget.day.slice(0,3)} · {MEALS.find(m=>m.id===linkTarget.mealId)?.label} 🎉
            </Btn>
          </div>
        </Sheet>
      )}
    </div>
  );
}
