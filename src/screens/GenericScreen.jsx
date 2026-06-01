import { useState } from "react";
import { C, F, SHADOW } from "../data/tokens.js";
import { uid } from "../data/constants.js";
import { Checkbox, Sheet, Btn, BtnOutline } from "../components/ui.jsx";

export default function GenericScreen({ list, onUpdate, onBack }) {
  const [items,    setItems]    = useState(list.items || []);
  const [checked,  setChecked]  = useState(list.checked || {});
  const [newTxt,   setNewTxt]   = useState("");
  const [editItem, setEditItem] = useState(null); // { id, title }

  const color = list.type.color;

  const persist = (ni, nc) => {
    onUpdate({ ...list, items: ni ?? items, checked: nc ?? checked });
  };

  const addItem = () => {
    if (!newTxt.trim()) return;
    const ni = [...items, { id:uid(), title:newTxt.trim(), key:uid(), checked:false }];
    setItems(ni); persist(ni, checked); setNewTxt("");
  };

  const toggleItem = key => {
    const nc = { ...checked, [key]: !checked[key] };
    setChecked(nc); persist(items, nc);
  };

  const deleteItem = id => {
    const ni = items.filter(i => i.id !== id);
    setItems(ni); persist(ni, checked);
  };

  const saveEdit = () => {
    if (!editItem?.title.trim()) return;
    const ni = items.map(i => i.id===editItem.id ? {...i, title:editItem.title.trim()} : i);
    setItems(ni); persist(ni, checked); setEditItem(null);
  };

  const done  = Object.values(checked).filter(Boolean).length;
  const total = items.length;
  const pct   = total > 0 ? (done / total) * 100 : 0;

  const active   = items.filter(i => !checked[i.key]);
  const finished = items.filter(i =>  checked[i.key]);

  return (
    <div style={{ minHeight:"100dvh", background:C.surface, fontFamily:F.body }}>

      {/* Background blobs */}
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-15%", right:"-15%", width:"60vw", height:"60vw",
          borderRadius:"50%", background:list.type.bg, opacity:0.3, filter:"blur(80px)" }} />
        <div style={{ position:"absolute", bottom:"-10%", left:"-10%", width:"50vw", height:"50vw",
          borderRadius:"50%", background:C.secondaryContainer, opacity:0.2, filter:"blur(70px)" }} />
      </div>

      {/* Top bar */}
      <header style={{
        position:"sticky", top:0, zIndex:20,
        background:"rgba(252,249,248,0.88)", backdropFilter:"blur(14px)",
        borderBottom:`1px solid ${C.outlineVariant}25`,
        padding:"44px 16px 12px", boxShadow: SHADOW.sm,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <button onClick={onBack} style={{ width:38, height:38, borderRadius:12, border:"none",
            background:C.surfaceContainerHigh, cursor:"pointer", fontSize:18,
            display:"flex", alignItems:"center", justifyContent:"center" }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700,
              color:C.primary, letterSpacing:"-0.02em" }}>{list.name}</div>
            <div style={{ fontSize:12, color:C.outline, marginTop:1 }}>
              {done}/{total} klara
            </div>
          </div>
          <div style={{ width:42, height:42, borderRadius:14, background:list.type.bg,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
            {list.type.icon}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height:4, background:C.surfaceContainerHigh, borderRadius:99, overflow:"hidden" }}>
          <div style={{ height:"100%", background:color, borderRadius:99,
            width:`${pct}%`, transition:"width 0.4s" }} />
        </div>
      </header>

      <div style={{ position:"relative", zIndex:1, padding:"16px 16px 40px" }}>

        {/* Active items */}
        {active.length === 0 && total === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0 40px", color:C.outline }}>
            <div style={{ fontSize:52, marginBottom:12 }}>{list.type.icon}</div>
            <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700, color:C.onSurface }}>Tom lista</div>
            <div style={{ fontSize:14, marginTop:6 }}>Lägg till ditt första objekt nedan</div>
          </div>
        )}

        {active.length > 0 && (
          <div style={{
            background:"rgba(255,255,255,0.72)", backdropFilter:"blur(14px)",
            borderRadius:20, border:"1px solid rgba(255,255,255,0.6)",
            boxShadow: SHADOW.sm, padding:"6px 6px", marginBottom:12,
          }}>
            {active.map((item, idx) => (
              <div key={item.id} style={{
                display:"flex", alignItems:"center", gap:12,
                padding:"12px 10px", borderRadius:14, cursor:"pointer",
                borderBottom: idx < active.length-1 ? `1px solid ${C.outlineVariant}20` : "none",
                transition:"background 0.15s",
              }}>
                <Checkbox checked={false} color={color} onChange={()=>toggleItem(item.key)} />
                <div style={{ flex:1, fontFamily:F.body, fontWeight:600, fontSize:15,
                  color:C.onSurface }}
                  onClick={()=>setEditItem({id:item.id,title:item.title})}>
                  {item.title}
                </div>
                <button onClick={()=>deleteItem(item.id)} style={{
                  width:28, height:28, borderRadius:99, border:"none",
                  background:"transparent", cursor:"pointer", fontSize:14, color:C.outline,
                }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Done items */}
        {finished.length > 0 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontFamily:F.body, fontSize:11, fontWeight:700,
              letterSpacing:"0.07em", color:C.outline, marginBottom:8, padding:"0 4px" }}>
              KLARA ({finished.length})
            </div>
            <div style={{
              background:"rgba(255,255,255,0.5)", backdropFilter:"blur(10px)",
              borderRadius:20, border:"1px solid rgba(255,255,255,0.5)",
              padding:"6px 6px",
            }}>
              {finished.map((item, idx) => (
                <div key={item.id} style={{
                  display:"flex", alignItems:"center", gap:12, padding:"10px 10px",
                  borderRadius:14, opacity:0.5,
                  borderBottom: idx < finished.length-1 ? `1px solid ${C.outlineVariant}15` : "none",
                }}>
                  <Checkbox checked={true} color={color} onChange={()=>toggleItem(item.key)} />
                  <div style={{ flex:1, fontFamily:F.body, fontWeight:500, fontSize:14,
                    color:C.onSurface, textDecoration:"line-through" }}>{item.title}</div>
                  <button onClick={()=>deleteItem(item.id)} style={{
                    width:28, height:28, borderRadius:99, border:"none",
                    background:"transparent", cursor:"pointer", fontSize:14, color:C.outline,
                  }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add input */}
        <div style={{
          background:"rgba(255,255,255,0.72)", backdropFilter:"blur(14px)",
          borderRadius:20, border:"1px solid rgba(255,255,255,0.6)",
          boxShadow: SHADOW.sm, padding:"12px 14px",
        }}>
          <div style={{ display:"flex", gap:8 }}>
            <input value={newTxt} onChange={e=>setNewTxt(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addItem()}
              placeholder="Lägg till objekt…"
              style={{ flex:1, padding:"11px 13px", borderRadius:12,
                border:`1.5px solid ${C.outlineVariant}`,
                background:C.surfaceContainerLowest, fontSize:14,
                fontFamily:F.body, color:C.onSurface, outline:"none" }} />
            <button onClick={addItem} style={{
              width:44, height:44, borderRadius:12, border:"none",
              background:color, cursor:"pointer", fontSize:22, color:"#fff",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:`0 4px 12px ${color}50`,
            }}>＋</button>
          </div>
        </div>
      </div>

      {/* Edit item sheet */}
      {editItem && (
        <Sheet onClose={()=>setEditItem(null)} zIndex={200}>
          <div style={{ fontFamily:F.display, fontSize:20, fontWeight:700,
            color:C.primary, marginBottom:18 }}>Redigera</div>
          <input value={editItem.title}
            onChange={e=>setEditItem(p=>({...p,title:e.target.value}))}
            autoFocus
            onKeyDown={e=>e.key==="Enter"&&saveEdit()}
            style={{ width:"100%", padding:"13px 15px", borderRadius:14,
              border:`1.5px solid ${C.outlineVariant}`,
              background:C.surfaceContainerLow, fontSize:16,
              fontFamily:F.body, color:C.onSurface, outline:"none", marginBottom:20 }} />
          <div style={{ display:"flex", gap:10 }}>
            <BtnOutline onClick={()=>setEditItem(null)} style={{ flex:1 }}>Avbryt</BtnOutline>
            <Btn onClick={saveEdit} color={color} style={{ flex:2 }}>Spara</Btn>
          </div>
        </Sheet>
      )}
    </div>
  );
}
