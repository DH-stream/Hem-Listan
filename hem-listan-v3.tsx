import { useState, useRef, useEffect } from "react";

// ── Design tokens (Organic Vitality) ────────────────────────────────────────
const C = {
  primary:        "#003b05",
  primaryContainer:"#1a5319",
  onPrimaryContainer:"#89c67e",
  secondary:      "#4e6452",
  secondaryContainer:"#d0e9d2",
  onSecondaryContainer:"#546a58",
  tertiary:       "#591f00",
  tertiaryContainer:"#7e2f00",
  onTertiaryContainer:"#ff9f72",
  tertiaryFixed:  "#ffdbcc",
  surface:        "#fcf9f8",
  surfaceDim:     "#dcd9d9",
  surfaceContainerLowest:"#ffffff",
  surfaceContainerLow:"#f6f3f2",
  surfaceContainer:"#f0eded",
  surfaceContainerHigh:"#eae7e7",
  surfaceContainerHighest:"#e5e2e1",
  onSurface:      "#1b1c1c",
  onSurfaceVariant:"#41493e",
  outline:        "#71796d",
  outlineVariant: "#c1c9bb",
  error:          "#ba1a1a",
  errorContainer: "#ffdad6",
  onError:        "#ffffff",
};

const F = {
  display: "'Epilogue', Georgia, serif",
  body:    "'Be Vietnam Pro', 'Trebuchet MS', sans-serif",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

const DAYS  = ["Måndag","Tisdag","Onsdag","Torsdag","Fredag","Lördag","Söndag"];
const MEALS = [
  { id:"breakfast", label:"Frukost", icon:"bakery_dining" },
  { id:"lunch",     label:"Lunch",   icon:"restaurant" },
  { id:"dinner",    label:"Middag",  icon:"dinner_dining" },
];
const CATEGORIES = [
  { id:"produce",  label:"Frukt & Grönt", icon:"nutrition",          color: C.secondaryContainer },
  { id:"meat",     label:"Kött & Fisk",   icon:"set_meal",           color: C.errorContainer },
  { id:"dairy",    label:"Mejeri & Ägg",  icon:"egg",                color: C.tertiaryFixed },
  { id:"frozen",   label:"Fryst",         icon:"ac_unit",            color: "#e1f5fe" },
  { id:"pantry",   label:"Skafferi",      icon:"kitchen",            color: C.surfaceContainerHigh },
  { id:"bread",    label:"Bröd",          icon:"bakery_dining",      color: "#fff8e1" },
  { id:"drinks",   label:"Dryck",         icon:"local_drink",        color: "#e8f5e9" },
  { id:"other",    label:"Övrigt",        icon:"shopping_bag",       color: C.surfaceContainerHighest },
];

const detectCat = (s) => {
  const l = s.toLowerCase();
  if (/(mjölk|ost|yoghurt|grädde|smör|ägg|kvarg|fil)/.test(l))       return "dairy";
  if (/(kyckling|nöt|fläsk|fisk|lax|räk|kött|köttfärs|biff)/.test(l)) return "meat";
  if (/(fryst|glass|frys)/.test(l))                                    return "frozen";
  if (/(bröd|toast|knäcke|bagel|bulle)/.test(l))                      return "bread";
  if (/(juice|vatten|läsk|öl|vin|kaffe|te|saft)/.test(l))             return "drinks";
  if (/(tomat|gurka|paprika|lök|vitlök|morot|potatis|äpple|banan|citron|sallad|spenat|broccoli|avokado|frukt)/.test(l)) return "produce";
  if (/(pasta|ris|mjöl|socker|olja|sås|konserv|burk|krydda|buljong)/.test(l)) return "pantry";
  return "other";
};

const mkSchedule = () => {
  const s = {};
  DAYS.forEach(d => { s[d] = { breakfast:null, lunch:null, dinner:null }; });
  return s;
};

// ── Shared components ────────────────────────────────────────────────────────

// Material Symbol icon (subset via text content — works without native support)
const Icon = ({ name, size=24, fill=0, style={} }) => (
  <span className="material-symbols-outlined" style={{
    fontFamily:"'Material Symbols Outlined'",
    fontVariationSettings:`'FILL' ${fill},'wght' 400,'GRAD' 0,'opsz' ${size}`,
    fontSize: size, lineHeight:1, display:"inline-block",
    userSelect:"none", ...style,
  }}>{name}</span>
);

const Checkbox = ({ checked, onChange, color=C.primaryContainer }) => (
  <div onClick={onChange} style={{
    width:22, height:22, borderRadius:6, flexShrink:0, cursor:"pointer",
    border:`2px solid ${checked ? color : C.outlineVariant}`,
    background: checked ? color : C.surfaceContainerLowest,
    display:"flex", alignItems:"center", justifyContent:"center",
    transition:"all 0.15s", boxShadow: checked ? `0 2px 8px ${color}60` : "none",
  }}>
    {checked && (
      <svg width="12" height="9" viewBox="0 0 12 9">
        <polyline points="1,4.5 4.5,8 11,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )}
  </div>
);

// Bottom sheet
const Sheet = ({ onClose, children, zIndex=200 }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex,
      background:"rgba(0,0,0,0.35)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"flex-end",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:"100%", background:C.surface,
        borderRadius:"28px 28px 0 0",
        boxShadow:"0 -8px 40px rgba(0,0,0,0.15)",
        maxHeight:"92dvh", overflowY:"auto",
        fontFamily: F.body,
      }}>
        <div style={{ padding:"12px 20px 4px", position:"sticky", top:0, background:C.surface, zIndex:1 }}>
          <div style={{ width:36, height:4, background:C.outlineVariant, borderRadius:99, margin:"0 auto 8px" }} />
        </div>
        <div style={{ padding:"4px 20px 40px" }}>{children}</div>
      </div>
    </div>
  );
};

// ── Organic Living Background ─────────────────────────────────────────────────
const LivingBg = () => (
  <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@600;700&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: ${C.surface}; }
      @keyframes blobFloat {
        0%,100% { transform: translateY(0) scale(1); }
        50%      { transform: translateY(-18px) scale(1.04); }
      }
      .blob1 { animation: blobFloat 16s ease-in-out infinite; }
      .blob2 { animation: blobFloat 20s ease-in-out infinite; animation-delay:-6s; }
      .blob3 { animation: blobFloat 13s ease-in-out infinite; animation-delay:-11s; }
      input:focus, textarea:focus { outline: none; }
      ::-webkit-scrollbar { display: none; }
    `}</style>
    <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
      <div className="blob1" style={{ position:"absolute", top:"-12%", left:"-12%", width:"55vw", height:"55vw",
        borderRadius:"50%", background:C.onTertiaryContainer, opacity:0.18, filter:"blur(90px)" }} />
      <div className="blob2" style={{ position:"absolute", top:"38%", right:"-18%", width:"60vw", height:"60vw",
        borderRadius:"50%", background:C.secondaryContainer, opacity:0.28, filter:"blur(110px)" }} />
      <div className="blob3" style={{ position:"absolute", bottom:"-8%", left:"18%", width:"40vw", height:"40vw",
        borderRadius:"50%", background:C.primaryContainer, opacity:0.10, filter:"blur(70px)" }} />
    </div>
  </>
);

// ── Top App Bar ───────────────────────────────────────────────────────────────
const TopBar = ({ title, page, onMenu, onProfile }) => (
  <header style={{
    position:"sticky", top:0, zIndex:50,
    background:"rgba(252,249,248,0.82)", backdropFilter:"blur(14px)",
    borderBottom:`1px solid ${C.outlineVariant}30`,
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"0 16px", height:60, flexShrink:0,
    boxShadow:"0 2px 12px rgba(0,0,0,0.05)",
  }}>
    <button onClick={onMenu} style={{ width:40, height:40, borderRadius:20, border:"none",
      background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Icon name="menu" size={24} style={{ color:C.primary }} />
    </button>
    <div style={{ textAlign:"center" }}>
      <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700, color:C.primary, letterSpacing:"-0.02em" }}>
        {title}
      </div>
      <div style={{ display:"flex", gap:6, justifyContent:"center", marginTop:3 }}>
        {[0,1].map(i => (
          <div key={i} style={{ width:6, height:6, borderRadius:99,
            background: page===i ? C.primary : `${C.primary}30`,
            transition:"background 0.3s" }} />
        ))}
      </div>
    </div>
    <button onClick={onProfile} style={{ width:40, height:40, borderRadius:20, border:"none",
      background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Icon name="account_circle" size={24} style={{ color:C.primary }} />
    </button>
  </header>
);

// ── Bottom Nav ────────────────────────────────────────────────────────────────
const BottomNav = ({ page, onNav }) => (
  <nav style={{
    position:"fixed", bottom:0, left:0, right:0, zIndex:50,
    background:"rgba(252,249,248,0.88)", backdropFilter:"blur(16px)",
    borderTop:`1px solid ${C.outlineVariant}30`,
    display:"flex", justifyContent:"space-around", alignItems:"center",
    padding:"8px 24px 20px",
    boxShadow:"0 -4px 16px rgba(0,0,0,0.06)",
  }}>
    {[
      { label:"Schema",  icon:"calendar_today",      p:0 },
      { label:"Listor",  icon:"format_list_bulleted", p:1 },
    ].map(({ label, icon, p }) => {
      const active = page === p;
      return (
        <button key={p} onClick={() => onNav(p)} style={{
          display:"flex", flexDirection:"column", alignItems:"center", gap:2,
          background: active ? C.tertiaryFixed : "transparent",
          border:"none", cursor:"pointer", padding:"8px 24px", borderRadius:99,
          transition:"all 0.2s",
        }}>
          <Icon name={icon} size={22} fill={active?1:0} style={{ color: active ? C.tertiary : C.onSurfaceVariant }} />
          <span style={{ fontFamily:F.body, fontSize:11, fontWeight:600,
            color: active ? C.tertiary : C.onSurfaceVariant }}>{label}</span>
        </button>
      );
    })}
  </nav>
);

// ── Day Card ──────────────────────────────────────────────────────────────────
const accentColors = [C.onTertiaryContainer, C.secondaryContainer, C.onPrimaryContainer,
  "#b3f3a6", C.tertiaryFixed, "#c8e6c9", "#ffe082"];

const DayCard = ({ day, dayIndex, slots, onAddMeal, onRemoveMeal }) => {
  const isToday = dayIndex === 0;
  const accent = accentColors[dayIndex % accentColors.length];
  return (
    <article style={{
      background:"rgba(255,255,255,0.72)", backdropFilter:"blur(12px)",
      borderRadius:24, border:"1px solid rgba(255,255,255,0.6)",
      boxShadow:"0 4px 24px rgba(0,0,0,0.04)",
      overflow:"hidden", position:"relative",
      transition:"transform 0.2s",
    }}>
      {/* Accent top bar */}
      <div style={{ height:5, background:accent, width:"100%" }} />
      <div style={{ padding:"14px 16px" }}>
        {/* Day header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontFamily:F.display, fontSize:17, fontWeight:700, color:C.onSurface }}>{day}</span>
            {isToday && (
              <span style={{ fontFamily:F.body, fontSize:11, fontWeight:600,
                background:`${C.tertiary}18`, color:C.tertiary,
                padding:"2px 8px", borderRadius:99 }}>Idag</span>
            )}
          </div>
        </div>
        {/* Meal slots */}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {MEALS.map(meal => {
            const data = slots[meal.id];
            if (data) {
              return (
                <div key={meal.id} style={{
                  background:C.surfaceContainerLow, borderRadius:14,
                  padding:"10px 12px", display:"flex", alignItems:"center", gap:10,
                  position:"relative",
                }}>
                  <div style={{ width:10, height:10, borderRadius:99,
                    background:accent, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:F.body, fontSize:10, fontWeight:600,
                      color:C.outline, letterSpacing:"0.06em", marginBottom:1 }}>
                      {meal.label.toUpperCase()}
                    </div>
                    <div style={{ fontFamily:F.body, fontSize:14, fontWeight:600,
                      color:C.onSurface, whiteSpace:"nowrap", overflow:"hidden",
                      textOverflow:"ellipsis" }}>{data.name}</div>
                  </div>
                  <button onClick={() => onRemoveMeal(day, meal.id)} style={{
                    width:28, height:28, borderRadius:99, border:"none",
                    background:"transparent", cursor:"pointer", display:"flex",
                    alignItems:"center", justifyContent:"center", flexShrink:0,
                  }}>
                    <Icon name="close" size={16} style={{ color:C.outline }} />
                  </button>
                </div>
              );
            }
            return (
              <button key={meal.id} onClick={() => onAddMeal(day, meal.id)} style={{
                border:`1.5px dashed ${C.outlineVariant}`,
                background:"transparent", borderRadius:14,
                padding:"10px 14px", display:"flex", alignItems:"center",
                justifyContent:"space-between", cursor:"pointer", width:"100%",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Icon name={meal.icon} size={18} style={{ color:`${C.outline}80` }} />
                  <span style={{ fontFamily:F.body, fontSize:13, fontWeight:500,
                    color:`${C.onSurfaceVariant}90` }}>{meal.label}</span>
                </div>
                <Icon name="add_circle" size={18} style={{ color:`${C.primary}60` }} />
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
};

// ── Category Card (shopping list) ─────────────────────────────────────────────
const CategoryCard = ({ cat, items, checked, onToggle }) => {
  const remaining = items.filter(i => !checked[i.key]);
  if (!items.length) return null;
  return (
    <section style={{
      background:"rgba(255,255,255,0.72)", backdropFilter:"blur(12px)",
      borderRadius:20, border:"1px solid rgba(255,255,255,0.6)",
      boxShadow:"0 4px 24px rgba(0,0,0,0.04)", padding:"16px",
      marginBottom:12,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <div style={{ width:36, height:36, borderRadius:10,
          background:cat.color, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Icon name={cat.icon} size={20} style={{ color:C.onSurface }} />
        </div>
        <span style={{ fontFamily:F.display, fontSize:16, fontWeight:700, color:C.onSurface, flex:1 }}>{cat.label}</span>
        <span style={{ fontFamily:F.body, fontSize:12, fontWeight:600,
          background:C.secondaryContainer, color:C.onSecondaryContainer,
          padding:"2px 10px", borderRadius:99 }}>
          {remaining.length} kvar
        </span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {items.map(item => (
          <div key={item.key} onClick={() => onToggle(item.key)} style={{
            display:"flex", alignItems:"center", gap:10, padding:"10px 10px",
            borderRadius:12, background: checked[item.key] ? C.surfaceContainer : C.surfaceContainerLowest,
            cursor:"pointer", opacity: checked[item.key] ? 0.5 : 1, transition:"all 0.18s",
          }}>
            <Checkbox checked={!!checked[item.key]} color={C.primaryContainer} />
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:F.body, fontSize:14, fontWeight:600, color:C.onSurface,
                textDecoration: checked[item.key] ? "line-through" : "none" }}>{item.title}</div>
              {item.fromMeal && (
                <div style={{ fontFamily:F.body, fontSize:11, color:C.outline, marginTop:1 }}>{item.fromMeal}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]             = useState(0);     // 0=schema, 1=list
  const [listName, setListName]     = useState("");    // user-defined list name
  const [nameSet, setNameSet]       = useState(false);
  const [schedule, setSchedule]     = useState(mkSchedule());
  const [items, setItems]           = useState([]);
  const [checkedMap, setCheckedMap] = useState({});
  const [addMeal, setAddMeal]       = useState(null);  // { day, mealId }
  const [mealForm, setMealForm]     = useState({ name:"", ingredients:"" });
  const [linkUrl, setLinkUrl]       = useState("");
  const [linkStep, setLinkStep]     = useState(null);  // null | "input" | "loading" | "confirm"
  const [scraped, setScraped]       = useState(null);
  const [linkTarget, setLinkTarget] = useState({ day:DAYS[0], mealId:"dinner" });
  const [addItem, setAddItem]       = useState("");
  const [showNameSheet, setShowNameSheet] = useState(false);
  const [tempName, setTempName]     = useState("");

  const sliderRef = useRef(null);
  const swipeStartX = useRef(null);

  // ── Swipe handlers ──
  const onTouchStart = (e) => { swipeStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e) => {
    if (swipeStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(diff) > window.innerWidth * 0.22) setPage(diff < 0 ? 1 : 0);
    swipeStartX.current = null;
  };

  // ── Add meal from schedule ──
  const saveMeal = () => {
    if (!addMeal || !mealForm.name.trim()) return;
    setSchedule(p => ({ ...p, [addMeal.day]: { ...p[addMeal.day],
      [addMeal.mealId]: { name: mealForm.name.trim() }
    }}));
    if (mealForm.ingredients.trim()) {
      const newItems = mealForm.ingredients.split("\n").map(s=>s.trim()).filter(Boolean)
        .map(title => ({ id:uid(), title, key:uid(), category:detectCat(title),
          fromMeal:`${addMeal.day} · ${MEALS.find(m=>m.id===addMeal.mealId)?.label}` }));
      setItems(p => [...p, ...newItems]);
    }
    setAddMeal(null); setMealForm({ name:"", ingredients:"" });
  };

  const removeMeal = (day, mealId) => {
    setSchedule(p => ({ ...p, [day]: { ...p[day], [mealId]: null } }));
  };

  // ── Simulated recipe scrape ──
  const scrapeLink = () => {
    setLinkStep("loading");
    setTimeout(() => {
      const mock = [
        { name:"Pasta Bolognese",   ingredients:"500g nötfärs\nPasta 400g\nKrossade tomater\nLök\nVitlök\nOlivolja" },
        { name:"Laxpasta med dill", ingredients:"400g laxfilé\nPasta 350g\nCrème fraiche\nCitron\nDill\nSalt" },
        { name:"Kycklingwok",       ingredients:"500g kycklingbröst\nPaprika röd\nBroccoli\nSojanötsås\nRis 300g" },
      ];
      setScraped(mock[Math.floor(Math.random()*mock.length)]);
      setLinkStep("confirm");
    }, 1800);
  };

  const confirmScrape = () => {
    setSchedule(p => ({ ...p, [linkTarget.day]: { ...p[linkTarget.day],
      [linkTarget.mealId]: { name: scraped.name }
    }}));
    const newItems = scraped.ingredients.split("\n").map(s=>s.trim()).filter(Boolean)
      .map(title => ({ id:uid(), title, key:uid(), category:detectCat(title),
        fromMeal:`${linkTarget.day} · ${MEALS.find(m=>m.id===linkTarget.mealId)?.label}` }));
    setItems(p => [...p, ...newItems]);
    setLinkStep(null); setLinkUrl(""); setScraped(null);
  };

  // ── Manual item add ──
  const pushItem = () => {
    if (!addItem.trim()) return;
    setItems(p => [...p, { id:uid(), title:addItem.trim(), key:uid(),
      category:detectCat(addItem), fromMeal:null }]);
    setAddItem("");
  };

  // ── Build grouped list ──
  const grouped = CATEGORIES.map(cat => ({
    cat,
    items: items.filter(i => i.category === cat.id),
  })).filter(g => g.items.length > 0);

  const totalItems   = items.length;
  const doneItems    = Object.values(checkedMap).filter(Boolean).length;
  const listTitle    = nameSet && listName.trim() ? listName : "Inköpslista";
  const pageTitle    = page === 0 ? "Matsedeln" : listTitle;

  return (
    <div style={{ fontFamily:F.body, background:C.surface, minHeight:"100dvh",
      display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
      <LivingBg />

      <TopBar title={pageTitle} page={page}
        onMenu={() => { setShowNameSheet(true); setTempName(listName); }}
        onProfile={() => {}} />

      {/* Slider */}
      <div ref={sliderRef} style={{ flex:1, overflow:"hidden", position:"relative", zIndex:10 }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div style={{ display:"flex", width:"200%",
          transform:`translateX(${page === 0 ? "0" : "-50%"})`,
          transition:"transform 0.4s cubic-bezier(0.4,0,0.2,1)",
        }}>

          {/* ── PAGE 0: SCHEMA ── */}
          <div style={{ width:"50%", height:"calc(100dvh - 130px)", overflowY:"auto", padding:"16px 16px 120px" }}>

            {/* Recipe import */}
            <div style={{
              background:"rgba(255,255,255,0.70)", backdropFilter:"blur(12px)",
              borderRadius:24, border:"1px solid rgba(255,255,255,0.55)",
              boxShadow:"0 8px 32px rgba(0,0,0,0.04)",
              padding:"18px 18px", marginBottom:20, position:"relative", overflow:"hidden",
            }}>
              <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg, ${C.primaryContainer}12, transparent)`, pointerEvents:"none" }} />
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ width:36, height:36, borderRadius:10,
                  background:C.secondaryContainer, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon name="link" size={20} style={{ color:C.primary }} />
                </div>
                <span style={{ fontFamily:F.display, fontSize:17, fontWeight:700, color:C.primary }}>Importera recept</span>
              </div>
              <p style={{ fontSize:13, color:C.onSurfaceVariant, marginBottom:12, lineHeight:1.5 }}>
                Klistra in en länk från ICA, Tasteline eller Arla — vi extraherar ingredienserna åt dig.
              </p>
              <div style={{ display:"flex", gap:8 }}>
                <input value={linkUrl} onChange={e=>setLinkUrl(e.target.value)}
                  placeholder="Klistra in länk här…" type="url"
                  style={{ flex:1, padding:"10px 14px", borderRadius:12,
                    border:`1.5px solid ${C.outlineVariant}`, background:C.surfaceContainerLowest,
                    fontSize:13, fontFamily:F.body, color:C.onSurface }} />
                <button onClick={() => { if(linkUrl.trim()){ setLinkStep("input"); } }} style={{
                  padding:"10px 16px", background:C.primary, color:"#fff", border:"none",
                  borderRadius:12, fontFamily:F.body, fontWeight:700, fontSize:13, cursor:"pointer",
                  display:"flex", alignItems:"center", gap:6,
                  boxShadow:`0 4px 14px ${C.primary}50`,
                }}>
                  <Icon name="auto_awesome" size={16} style={{ color:"#fff" }} />
                  Lägg till
                </button>
              </div>
            </div>

            {/* Week header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:14, padding:"0 4px" }}>
              <div>
                <div style={{ fontFamily:F.body, fontSize:11, fontWeight:700,
                  letterSpacing:"0.08em", color:C.tertiary, marginBottom:2 }}>DENNA VECKA</div>
                <div style={{ fontFamily:F.display, fontSize:26, fontWeight:700,
                  color:C.onSurface, letterSpacing:"-0.02em" }}>Din Meny</div>
              </div>
            </div>

            {/* Day cards */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {DAYS.map((day, di) => (
                <DayCard key={day} day={day} dayIndex={di}
                  slots={schedule[day]}
                  onAddMeal={(d,m) => { setAddMeal({day:d,mealId:m}); setMealForm({name:"",ingredients:""}); }}
                  onRemoveMeal={removeMeal} />
              ))}
            </div>
          </div>

          {/* ── PAGE 1: SHOPPING LIST ── */}
          <div style={{ width:"50%", height:"calc(100dvh - 130px)", overflowY:"auto", padding:"16px 16px 120px" }}>

            {/* List name + progress */}
            <div style={{
              background:"rgba(255,255,255,0.72)", backdropFilter:"blur(12px)",
              borderRadius:20, border:"1px solid rgba(255,255,255,0.6)",
              boxShadow:"0 4px 24px rgba(0,0,0,0.04)",
              padding:"16px 18px", marginBottom:16,
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div>
                  <div style={{ fontFamily:F.display, fontSize:18, fontWeight:700,
                    color:C.onSurface, letterSpacing:"-0.01em" }}>{listTitle}</div>
                  <div style={{ fontFamily:F.body, fontSize:12, color:C.outline, marginTop:2 }}>
                    {doneItems}/{totalItems} klara
                  </div>
                </div>
                <button onClick={() => { setShowNameSheet(true); setTempName(listName); }} style={{
                  width:34, height:34, borderRadius:10, border:`1.5px solid ${C.outlineVariant}`,
                  background:C.surfaceContainerLowest, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <Icon name="edit" size={16} style={{ color:C.onSurfaceVariant }} />
                </button>
              </div>
              <div style={{ height:6, background:C.surfaceContainerHigh, borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:99,
                  background:`linear-gradient(90deg, ${C.primaryContainer}, ${C.onPrimaryContainer})`,
                  width:`${totalItems>0?(doneItems/totalItems)*100:0}%`,
                  transition:"width 0.4s" }} />
              </div>
            </div>

            {/* Categories */}
            {grouped.length === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 0", color:C.outline }}>
                <Icon name="shopping_cart" size={52} style={{ color:C.outlineVariant, display:"block", margin:"0 auto 12px" }} />
                <div style={{ fontFamily:F.display, fontSize:17, fontWeight:700, color:C.onSurface }}>Tom lista</div>
                <div style={{ fontSize:13, marginTop:6 }}>Lägg till måltider i schemat eller lägg till manuellt</div>
              </div>
            ) : (
              grouped.map(({ cat, items: catItems }) => (
                <CategoryCard key={cat.id} cat={cat} items={catItems}
                  checked={checkedMap} onToggle={key => setCheckedMap(p=>({...p,[key]:!p[key]}))} />
              ))
            )}

            {/* Manual add */}
            <div style={{
              background:"rgba(255,255,255,0.72)", backdropFilter:"blur(12px)",
              borderRadius:20, border:"1px solid rgba(255,255,255,0.6)",
              boxShadow:"0 4px 24px rgba(0,0,0,0.04)",
              padding:"14px 16px", marginTop:4,
            }}>
              <div style={{ fontFamily:F.body, fontSize:11, fontWeight:700,
                letterSpacing:"0.07em", color:C.outline, marginBottom:10 }}>LÄGG TILL MANUELLT</div>
              <div style={{ display:"flex", gap:8 }}>
                <input value={addItem} onChange={e=>setAddItem(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&pushItem()}
                  placeholder="Vara eller objekt…"
                  style={{ flex:1, padding:"11px 14px", borderRadius:12,
                    border:`1.5px solid ${C.outlineVariant}`, background:C.surfaceContainerLowest,
                    fontSize:14, fontFamily:F.body, color:C.onSurface }} />
                <button onClick={pushItem} style={{
                  width:44, height:44, borderRadius:12, border:"none",
                  background:C.primaryContainer, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:`0 4px 12px ${C.primaryContainer}60`,
                }}>
                  <Icon name="add" size={22} style={{ color:"#fff" }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav page={page} onNav={setPage} />

      {/* ── SHEET: Name list ── */}
      {showNameSheet && (
        <Sheet onClose={() => setShowNameSheet(false)} zIndex={200}>
          <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700, color:C.primary,
            marginBottom:20 }}>Döp listan</div>
          <input value={tempName} onChange={e=>setTempName(e.target.value)}
            autoFocus placeholder="t.ex. ICA Vecka 23"
            style={{ width:"100%", padding:"13px 15px", borderRadius:14,
              border:`1.5px solid ${C.outlineVariant}`, background:C.surfaceContainerLow,
              fontSize:16, fontFamily:F.body, color:C.onSurface, marginBottom:16 }} />
          <button onClick={() => { setListName(tempName); setNameSet(true); setShowNameSheet(false); }} style={{
            width:"100%", padding:"14px", borderRadius:14, border:"none",
            background:C.primary, color:"#fff", fontFamily:F.body,
            fontWeight:700, fontSize:15, cursor:"pointer",
            boxShadow:`0 4px 16px ${C.primary}50`,
          }}>Spara</button>
        </Sheet>
      )}

      {/* ── SHEET: Add meal ── */}
      {addMeal && (
        <Sheet onClose={() => setAddMeal(null)} zIndex={210}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
            <Icon name={MEALS.find(m=>m.id===addMeal.mealId)?.icon||"restaurant"} size={28} style={{ color:C.primary }} />
            <div>
              <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700, color:C.primary }}>
                {MEALS.find(m=>m.id===addMeal.mealId)?.label}
              </div>
              <div style={{ fontSize:13, color:C.outline }}>{addMeal.day}</div>
            </div>
          </div>
          <label style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em", color:C.outline, display:"block", marginBottom:6 }}>MATRÄTT</label>
          <input value={mealForm.name} autoFocus onChange={e=>setMealForm(p=>({...p,name:e.target.value}))}
            placeholder="t.ex. Pasta Bolognese"
            style={{ width:"100%", padding:"13px 15px", borderRadius:14, boxSizing:"border-box",
              border:`1.5px solid ${C.outlineVariant}`, background:C.surfaceContainerLow,
              fontSize:16, fontFamily:F.body, color:C.onSurface, marginBottom:16 }} />
          <label style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em", color:C.outline, display:"block", marginBottom:6 }}>
            INGREDIENSER <span style={{ fontWeight:400 }}>(en per rad)</span>
          </label>
          <textarea value={mealForm.ingredients} onChange={e=>setMealForm(p=>({...p,ingredients:e.target.value}))}
            placeholder={"500g nötfärs\nPasta 400g\nKrossade tomater"}
            rows={5} style={{ width:"100%", padding:"13px 15px", borderRadius:14, boxSizing:"border-box",
              border:`1.5px solid ${C.outlineVariant}`, background:C.surfaceContainerLow,
              fontSize:14, fontFamily:F.body, color:C.onSurface,
              resize:"none", lineHeight:1.6, marginBottom:20 }} />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setAddMeal(null)} style={{ flex:1, padding:"14px", borderRadius:14,
              border:`1.5px solid ${C.outlineVariant}`, background:"transparent",
              color:C.onSurfaceVariant, fontFamily:F.body, fontWeight:600, fontSize:15, cursor:"pointer" }}>Avbryt</button>
            <button onClick={saveMeal} style={{ flex:2, padding:"14px", borderRadius:14,
              border:"none", background:C.primary, color:"#fff",
              fontFamily:F.body, fontWeight:700, fontSize:15, cursor:"pointer",
              boxShadow:`0 4px 16px ${C.primary}50` }}>Spara 🎉</button>
          </div>
        </Sheet>
      )}

      {/* ── SHEET: Recipe link – confirm URL ── */}
      {linkStep === "input" && (
        <Sheet onClose={()=>setLinkStep(null)} zIndex={220}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
            <Icon name="link" size={26} style={{ color:C.primary }} />
            <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700, color:C.primary }}>Importera recept</div>
          </div>
          <input value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} autoFocus
            placeholder="https://www.ica.se/recept/…" type="url"
            style={{ width:"100%", padding:"13px 15px", borderRadius:14, boxSizing:"border-box",
              border:`1.5px solid ${C.outlineVariant}`, background:C.surfaceContainerLow,
              fontSize:14, fontFamily:F.body, color:C.onSurface, marginBottom:20 }} />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setLinkStep(null)} style={{ flex:1, padding:"14px", borderRadius:14,
              border:`1.5px solid ${C.outlineVariant}`, background:"transparent",
              color:C.onSurfaceVariant, fontFamily:F.body, fontWeight:600, fontSize:15, cursor:"pointer" }}>Avbryt</button>
            <button onClick={scrapeLink} style={{ flex:2, padding:"14px", borderRadius:14,
              border:"none", background:C.primary, color:"#fff",
              fontFamily:F.body, fontWeight:700, fontSize:15, cursor:"pointer",
              boxShadow:`0 4px 16px ${C.primary}50` }}>Hämta recept →</button>
          </div>
        </Sheet>
      )}

      {/* ── SHEET: Recipe link – loading ── */}
      {linkStep === "loading" && (
        <Sheet onClose={()=>{}} zIndex={220}>
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
            <div style={{ fontSize:48, animation:"spin 1.2s linear infinite", display:"inline-block", marginBottom:14 }}>🔄</div>
            <div style={{ fontFamily:F.display, fontSize:18, fontWeight:700, color:C.primary }}>Hämtar recept…</div>
            <div style={{ fontSize:13, color:C.outline, marginTop:6 }}>Letar efter ingredienser</div>
          </div>
        </Sheet>
      )}

      {/* ── SHEET: Recipe link – confirm ── */}
      {linkStep === "confirm" && scraped && (
        <Sheet onClose={()=>setLinkStep(null)} zIndex={220}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
            <span style={{ fontSize:26 }}>✅</span>
            <div>
              <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700, color:C.primary }}>Recept hittades!</div>
              <div style={{ fontSize:12, color:C.outline }}>Kontrollera och välj dag & måltid</div>
            </div>
          </div>
          {/* Preview */}
          <div style={{ background:C.surfaceContainerLow, borderRadius:16, padding:"14px 16px", marginBottom:18 }}>
            <div style={{ fontFamily:F.display, fontSize:16, fontWeight:700, marginBottom:10 }}>🍽️ {scraped.name}</div>
            {scraped.ingredients.split("\n").map((ing,i) => (
              <div key={i} style={{ fontSize:13, fontFamily:F.body, color:C.onSurface,
                padding:"5px 0", borderBottom:`1px solid ${C.outlineVariant}30`,
                display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:C.primary, fontSize:8 }}>●</span>{ing}
              </div>
            ))}
          </div>
          {/* Day picker */}
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em", color:C.outline, marginBottom:8 }}>VÄLJ DAG</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
            {DAYS.map(day => (
              <button key={day} onClick={()=>setLinkTarget(p=>({...p,day}))} style={{
                padding:"6px 12px", borderRadius:99, border:"none", cursor:"pointer",
                background: linkTarget.day===day ? C.primary : C.surfaceContainerHigh,
                color: linkTarget.day===day ? "#fff" : C.onSurfaceVariant,
                fontFamily:F.body, fontWeight:600, fontSize:12, transition:"all 0.15s",
              }}>{day.slice(0,3)}</button>
            ))}
          </div>
          {/* Meal picker */}
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.07em", color:C.outline, marginBottom:8 }}>VÄLJ MÅLTID</div>
          <div style={{ display:"flex", gap:8, marginBottom:20 }}>
            {MEALS.map(meal => (
              <button key={meal.id} onClick={()=>setLinkTarget(p=>({...p,mealId:meal.id}))} style={{
                flex:1, padding:"10px 4px", borderRadius:14, border:"none", cursor:"pointer",
                background: linkTarget.mealId===meal.id ? C.primary : C.surfaceContainerHigh,
                color: linkTarget.mealId===meal.id ? "#fff" : C.onSurfaceVariant,
                fontFamily:F.body, fontWeight:600, fontSize:13, display:"flex",
                flexDirection:"column", alignItems:"center", gap:3, transition:"all 0.15s",
              }}>
                <Icon name={meal.icon} size={20} style={{ color: linkTarget.mealId===meal.id ? "#fff" : C.onSurfaceVariant }} />
                {meal.label}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setLinkStep(null)} style={{ flex:1, padding:"14px", borderRadius:14,
              border:`1.5px solid ${C.outlineVariant}`, background:"transparent",
              color:C.onSurfaceVariant, fontFamily:F.body, fontWeight:600, fontSize:15, cursor:"pointer" }}>Avbryt</button>
            <button onClick={confirmScrape} style={{ flex:2, padding:"14px", borderRadius:14,
              border:"none", background:C.primary, color:"#fff",
              fontFamily:F.body, fontWeight:700, fontSize:14, cursor:"pointer",
              boxShadow:`0 4px 16px ${C.primary}50` }}>
              Lägg till i {linkTarget.day.slice(0,3)} · {MEALS.find(m=>m.id===linkTarget.mealId)?.label} 🎉
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
