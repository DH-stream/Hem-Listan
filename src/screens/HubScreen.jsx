import { useState } from "react";
import { C, F, SHADOW } from "../data/tokens.js";
import { LIST_TYPES, uid, mkSchedule } from "../data/constants.js";
import { LivingBg, Sheet, Input, Btn, BtnOutline, Card } from "../components/ui.jsx";

// ── Type tile ─────────────────────────────────────────────────────────────────
const TypeTile = ({ type, onPick }) => (
  <div onClick={() => onPick(type)} style={{
    background: C.surfaceContainerLowest,
    border:`2px solid ${type.bg}`,
    borderRadius:20, padding:"20px 14px 18px",
    display:"flex", flexDirection:"column", alignItems:"center",
    gap:10, cursor:"pointer", textAlign:"center",
    boxShadow: SHADOW.sm,
    transition:"transform 0.15s, box-shadow 0.15s",
  }}
    onMouseEnter={e => { e.currentTarget.style.transform="scale(1.03)"; e.currentTarget.style.boxShadow=SHADOW.md; }}
    onMouseLeave={e => { e.currentTarget.style.transform="scale(1)";    e.currentTarget.style.boxShadow=SHADOW.sm; }}
  >
    <div style={{ width:58, height:58, borderRadius:16,
      background:type.bg, display:"flex", alignItems:"center",
      justifyContent:"center", fontSize:28 }}>{type.icon}</div>
    <div style={{ fontFamily:F.display, fontWeight:700, fontSize:15,
      color:C.onSurface, letterSpacing:"-0.01em" }}>{type.label}</div>
    <div style={{ fontFamily:F.body, fontSize:12, color:C.outline,
      lineHeight:1.4 }}>{type.desc}</div>
  </div>
);

// ── List row ──────────────────────────────────────────────────────────────────
const ListRow = ({ list, onOpen }) => {
  const done  = list.items.filter(i => i.checked).length;
  const total = list.items.length;
  const pct   = total > 0 ? (done / total) * 100 : 0;
  return (
    <div onClick={() => onOpen(list)} style={{
      background: C.surfaceContainerLowest,
      border:`1.5px solid ${C.surfaceContainerHigh}`,
      borderRadius:18, padding:"14px 16px",
      display:"flex", alignItems:"center", gap:14,
      cursor:"pointer", boxShadow: SHADOW.sm,
      transition:"transform 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.transform="translateX(4px)"}
      onMouseLeave={e => e.currentTarget.style.transform="translateX(0)"}
    >
      <div style={{ width:46, height:46, borderRadius:14,
        background:list.type.bg, display:"flex", alignItems:"center",
        justifyContent:"center", fontSize:22, flexShrink:0 }}>{list.type.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:F.display, fontWeight:700, fontSize:15,
          color:C.onSurface, whiteSpace:"nowrap", overflow:"hidden",
          textOverflow:"ellipsis" }}>{list.name}</div>
        <div style={{ fontFamily:F.body, fontSize:12, color:C.outline, marginTop:2 }}>
          {total === 0 ? "Tom lista" : `${done}/${total} klara`}
        </div>
        {total > 0 && (
          <div style={{ marginTop:6, height:3, background:C.surfaceContainerHigh,
            borderRadius:99, overflow:"hidden" }}>
            <div style={{ height:"100%", background:list.type.color,
              borderRadius:99, width:`${pct}%`, transition:"width 0.4s" }} />
          </div>
        )}
      </div>
      <svg width="7" height="12" viewBox="0 0 7 12">
        <polyline points="1,1 6,6 1,11" fill="none"
          stroke={C.outlineVariant} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    </div>
  );
};

// ── Hub screen ────────────────────────────────────────────────────────────────
export default function HubScreen({ lists, onOpen, onCreate, onSettings }) {
  const [showNew,     setShowNew]     = useState(false);
  const [pickedType,  setPickedType]  = useState(null);
  const [newName,     setNewName]     = useState("");

  const handlePick = (type) => { setPickedType(type); setNewName(""); };
  const handleCreate = () => {
    if (!newName.trim() || !pickedType) return;
    const list = {
      id:       uid(),
      name:     newName.trim(),
      type:     pickedType,
      items:    [],
      checked:  {},
      schedule: pickedType.hasSchedule ? mkSchedule() : null,
    };
    onCreate(list);
    setShowNew(false); setPickedType(null); setNewName("");
  };

  const pinned = lists.filter(l => l.pinned);
  const rest   = lists.filter(l => !l.pinned);

  return (
    <div style={{ minHeight:"100dvh", background:C.surface, fontFamily:F.body,
      position:"relative" }}>
      <LivingBg />

      <div style={{ position:"relative", zIndex:1 }}>
        {/* Header */}
        <div style={{ padding:"54px 20px 16px",
          display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div>
            <div style={{ fontFamily:F.body, fontSize:12, fontWeight:700,
              letterSpacing:"0.1em", color:C.tertiary, marginBottom:4 }}>VÄLKOMMEN TILLBAKA</div>
            <div style={{ fontFamily:F.display, fontSize:32, fontWeight:700,
              color:C.primary, letterSpacing:"-0.03em", lineHeight:1.1 }}>Hem-Listan</div>
          </div>
          <button onClick={onSettings} style={{
            width:42, height:42, borderRadius:14,
            border:`1.5px solid ${C.outlineVariant}40`,
            background:"rgba(255,255,255,0.7)", backdropFilter:"blur(10px)",
            cursor:"pointer", fontSize:20,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow: SHADOW.sm,
          }}>⚙️</button>
        </div>

        {/* Stats row */}
        {lists.length > 0 && (
          <div style={{ display:"flex", gap:10, padding:"0 20px 20px" }}>
            {[
              { label:"Listor", val:lists.length },
              { label:"Varor kvar", val:lists.reduce((a,l)=>a+l.items.filter(i=>!i.checked).length,0) },
              { label:"Klara", val:lists.reduce((a,l)=>a+l.items.filter(i=>i.checked).length,0) },
            ].map(s => (
              <div key={s.label} style={{ flex:1, background:"rgba(255,255,255,0.65)",
                backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.6)",
                borderRadius:14, padding:"10px 12px", textAlign:"center", boxShadow:SHADOW.sm }}>
                <div style={{ fontFamily:F.display, fontSize:22, fontWeight:700,
                  color:C.primary }}>{s.val}</div>
                <div style={{ fontFamily:F.body, fontSize:11, color:C.outline,
                  marginTop:1, fontWeight:500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Lists */}
        <div style={{ padding:"0 20px" }}>
          {lists.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 0 40px", color:C.outline }}>
              <div style={{ fontSize:56, marginBottom:14 }}>📋</div>
              <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700,
                color:C.onSurface, marginBottom:6 }}>Inga listor ännu</div>
              <div style={{ fontSize:14, lineHeight:1.5 }}>
                Skapa din första lista för att komma igång
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[...pinned, ...rest].map(list => (
                <ListRow key={list.id} list={list} onOpen={onOpen} />
              ))}
            </div>
          )}
        </div>

        {/* New list button */}
        <div style={{ padding:"20px 20px 48px" }}>
          <button onClick={() => { setShowNew(true); setPickedType(null); setNewName(""); }} style={{
            width:"100%", padding:"16px",
            borderRadius:18, border:`2px dashed ${C.onPrimaryContainer}`,
            background:"transparent", cursor:"pointer", color:C.primaryContainer,
            fontFamily:F.body, fontWeight:700, fontSize:16,
            display:"flex", alignItems:"center", justifyContent:"center", gap:10,
            transition:"all 0.18s",
          }}>
            <span style={{ fontSize:22 }}>＋</span> Ny lista
          </button>
        </div>
      </div>

      {/* ── New list sheet ── */}
      {showNew && (
        <Sheet onClose={() => setShowNew(false)} zIndex={200}>
          {!pickedType ? (
            <>
              <div style={{ fontFamily:F.display, fontSize:22, fontWeight:700,
                color:C.primary, marginBottom:6 }}>Ny lista</div>
              <div style={{ fontFamily:F.body, fontSize:14, color:C.outline,
                marginBottom:22 }}>Välj typ</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:8 }}>
                {LIST_TYPES.map(type => (
                  <TypeTile key={type.id} type={type} onPick={handlePick} />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Back */}
              <button onClick={() => setPickedType(null)} style={{
                background:"transparent", border:"none", cursor:"pointer",
                color:C.outline, fontFamily:F.body, fontWeight:600, fontSize:14,
                marginBottom:16, display:"flex", alignItems:"center", gap:6, padding:0,
              }}>← Byt typ</button>

              {/* Type badge */}
              <div style={{ display:"flex", alignItems:"center", gap:12,
                background:pickedType.bg, borderRadius:16, padding:"14px 18px", marginBottom:24 }}>
                <span style={{ fontSize:30 }}>{pickedType.icon}</span>
                <div>
                  <div style={{ fontFamily:F.display, fontWeight:700, fontSize:17,
                    color:pickedType.color }}>{pickedType.label}</div>
                  <div style={{ fontFamily:F.body, fontSize:12, color:C.outline,
                    marginTop:2 }}>{pickedType.desc}</div>
                </div>
              </div>

              <label style={{ fontFamily:F.body, fontSize:11, fontWeight:700,
                letterSpacing:"0.07em", color:C.outline, display:"block", marginBottom:8 }}>
                LISTNAMN
              </label>
              <Input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder={`t.ex. ICA Vecka 23`}
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                style={{ marginBottom:20 }} />
              <div style={{ display:"flex", gap:10 }}>
                <BtnOutline onClick={() => setShowNew(false)} style={{ flex:1 }}>Avbryt</BtnOutline>
                <Btn onClick={handleCreate}
                  disabled={!newName.trim()}
                  color={pickedType.color}
                  style={{ flex:2 }}>Skapa lista →</Btn>
              </div>
            </>
          )}
        </Sheet>
      )}
    </div>
  );
}
