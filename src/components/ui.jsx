import { useEffect } from "react";
import { C, F, SHADOW } from "../data/tokens.js";

// ── Organic animated background ──────────────────────────────────────────────
export const LivingBg = () => (
  <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@600;700&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body, #root { height: 100%; background: ${C.surface}; }
      ::-webkit-scrollbar { display: none; }
      input, textarea, button { font-family: inherit; }
      @keyframes blobFloat {
        0%,100% { transform: translateY(0) scale(1) rotate(0deg); }
        33%      { transform: translateY(-22px) scale(1.05) rotate(3deg); }
        66%      { transform: translateY(10px) scale(0.97) rotate(-2deg); }
      }
      .blob1 { animation: blobFloat 18s ease-in-out infinite; }
      .blob2 { animation: blobFloat 22s ease-in-out infinite; animation-delay: -7s; }
      .blob3 { animation: blobFloat 15s ease-in-out infinite; animation-delay: -12s; }
    `}</style>
    <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
      <div className="blob1" style={{ position:"absolute", top:"-15%", left:"-15%",
        width:"60vw", height:"60vw", borderRadius:"50%",
        background: C.onTertiaryContainer, opacity:0.15, filter:"blur(80px)" }} />
      <div className="blob2" style={{ position:"absolute", top:"35%", right:"-20%",
        width:"65vw", height:"65vw", borderRadius:"50%",
        background: C.secondaryContainer, opacity:0.25, filter:"blur(100px)" }} />
      <div className="blob3" style={{ position:"absolute", bottom:"-10%", left:"15%",
        width:"45vw", height:"45vw", borderRadius:"50%",
        background: C.primaryContainer, opacity:0.10, filter:"blur(70px)" }} />
    </div>
  </>
);

// ── Checkbox ─────────────────────────────────────────────────────────────────
export const Checkbox = ({ checked, onChange, color = C.primaryContainer }) => (
  <div onClick={onChange} style={{
    width:22, height:22, borderRadius:6, flexShrink:0, cursor:"pointer",
    border:`2px solid ${checked ? color : C.outlineVariant}`,
    background: checked ? color : C.surfaceContainerLowest,
    display:"flex", alignItems:"center", justifyContent:"center",
    transition:"all 0.15s",
    boxShadow: checked ? `0 2px 8px ${color}55` : "none",
  }}>
    {checked && (
      <svg width="12" height="9" viewBox="0 0 12 9">
        <polyline points="1,4.5 4.5,8 11,1" fill="none" stroke="#fff"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </div>
);

// ── Bottom sheet ──────────────────────────────────────────────────────────────
export const Sheet = ({ onClose, children, zIndex = 200 }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex,
      background:"rgba(0,0,0,0.38)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"flex-end",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:"100%", background:C.surface,
        borderRadius:"28px 28px 0 0",
        boxShadow: SHADOW.lg,
        maxHeight:"92dvh", overflowY:"auto",
        fontFamily: F.body,
      }}>
        <div style={{ padding:"12px 20px 0", position:"sticky", top:0, background:C.surface, zIndex:1 }}>
          <div style={{ width:36, height:4, background:C.outlineVariant,
            borderRadius:99, margin:"0 auto 8px" }} />
        </div>
        <div style={{ padding:"4px 20px 40px" }}>{children}</div>
      </div>
    </div>
  );
};

// ── Input ─────────────────────────────────────────────────────────────────────
export const Input = ({ style={}, ...props }) => (
  <input {...props} style={{
    width:"100%", padding:"13px 15px", borderRadius:14,
    border:`1.5px solid ${C.outlineVariant}`,
    background:C.surfaceContainerLow,
    fontSize:15, fontFamily:F.body, color:C.onSurface,
    outline:"none", transition:"border-color 0.15s",
    ...style,
  }} />
);

export const Textarea = ({ style={}, ...props }) => (
  <textarea {...props} style={{
    width:"100%", padding:"13px 15px", borderRadius:14,
    border:`1.5px solid ${C.outlineVariant}`,
    background:C.surfaceContainerLow,
    fontSize:14, fontFamily:F.body, color:C.onSurface,
    outline:"none", resize:"none", lineHeight:1.65,
    ...style,
  }} />
);

// ── Primary button ────────────────────────────────────────────────────────────
export const Btn = ({ children, onClick, color=C.primary, disabled=false, style={} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding:"14px 20px", borderRadius:14, border:"none", cursor: disabled ? "default" : "pointer",
    background: disabled ? C.surfaceContainerHigh : color,
    color: disabled ? C.outline : "#fff",
    fontFamily:F.body, fontWeight:700, fontSize:15,
    boxShadow: disabled ? "none" : `0 4px 16px ${color}50`,
    transition:"all 0.18s", ...style,
  }}>{children}</button>
);

export const BtnOutline = ({ children, onClick, style={} }) => (
  <button onClick={onClick} style={{
    padding:"14px 20px", borderRadius:14,
    border:`1.5px solid ${C.outlineVariant}`,
    background:"transparent", cursor:"pointer",
    color:C.onSurfaceVariant, fontFamily:F.body,
    fontWeight:600, fontSize:15, transition:"all 0.18s", ...style,
  }}>{children}</button>
);

// ── Glass card ────────────────────────────────────────────────────────────────
export const Card = ({ children, style={}, onClick }) => (
  <div onClick={onClick} style={{
    background:"rgba(255,255,255,0.72)",
    backdropFilter:"blur(14px)",
    borderRadius:20,
    border:"1px solid rgba(255,255,255,0.6)",
    boxShadow: SHADOW.md,
    ...style,
  }}>{children}</div>
);
