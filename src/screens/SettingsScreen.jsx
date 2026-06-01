import { C, F, SHADOW } from "../data/tokens.js";
import { LivingBg } from "../components/ui.jsx";

const Row = ({ icon, label, value, onClick }) => (
  <div onClick={onClick} style={{
    display:"flex", alignItems:"center", gap:14, padding:"14px 16px",
    cursor: onClick ? "pointer" : "default",
    borderBottom:`1px solid ${C.outlineVariant}20`,
  }}>
    <span style={{ fontSize:20, width:28, textAlign:"center" }}>{icon}</span>
    <div style={{ flex:1 }}>
      <div style={{ fontFamily:F.body, fontWeight:600, fontSize:15, color:C.onSurface }}>{label}</div>
      {value && <div style={{ fontFamily:F.body, fontSize:12, color:C.outline, marginTop:1 }}>{value}</div>}
    </div>
    {onClick && (
      <svg width="7" height="12" viewBox="0 0 7 12">
        <polyline points="1,1 6,6 1,11" fill="none"
          stroke={C.outlineVariant} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )}
  </div>
);

export default function SettingsScreen({ onBack }) {
  return (
    <div style={{ minHeight:"100dvh", background:C.surface, fontFamily:F.body }}>
      <LivingBg />
      <div style={{ position:"relative", zIndex:1 }}>
        <div style={{ padding:"54px 20px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={onBack} style={{ width:38, height:38, borderRadius:12, border:"none",
            background:C.surfaceContainerHigh, cursor:"pointer", fontSize:18,
            display:"flex", alignItems:"center", justifyContent:"center" }}>←</button>
          <div style={{ fontFamily:F.display, fontSize:26, fontWeight:700,
            color:C.primary, letterSpacing:"-0.02em" }}>Inställningar</div>
        </div>

        <div style={{ padding:"0 20px", display:"flex", flexDirection:"column", gap:14 }}>
          {/* App info */}
          <div style={{
            background:"rgba(255,255,255,0.72)", backdropFilter:"blur(14px)",
            borderRadius:20, border:"1px solid rgba(255,255,255,0.6)",
            boxShadow: SHADOW.sm, overflow:"hidden",
          }}>
            <Row icon="🏠" label="Hem-Listan" value="Version 0.1 · Prototyp" />
            <Row icon="🌿" label="Tema" value="Organic Vitality" />
          </div>

          {/* Upcoming */}
          <div style={{
            background:"rgba(255,255,255,0.72)", backdropFilter:"blur(14px)",
            borderRadius:20, border:"1px solid rgba(255,255,255,0.6)",
            boxShadow: SHADOW.sm, overflow:"hidden",
          }}>
            <div style={{ padding:"12px 16px 8px", fontFamily:F.body, fontSize:11,
              fontWeight:700, letterSpacing:"0.08em", color:C.outline }}>KOMMANDE FUNKTIONER</div>
            {[
              ["🏘️","Delade hushåll","Bjud in familj & sambo"],
              ["🔗","Receptimport","Riktigt scraping från ICA m.fl."],
              ["🤖","RunAI-integration","AI lägger till varor automatiskt"],
              ["📱","Homeboard-widget","Visa listan på din anslagstavla"],
              ["☁️","Supabase-sync","Sparas i molnet, synkas i realtid"],
            ].map(([icon, label, value]) => (
              <Row key={label} icon={icon} label={label} value={value} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
