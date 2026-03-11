import { useState, useEffect, useRef, useCallback } from "react";

const C = {
  terra: "#C1603A", terraL: "#D4785A", terraD: "#A04A28",
  yellow: "#F5C842", yellowL: "#FAD85A",
  cream: "#FAF3E0", creamD: "#F0E6CC",
  espresso: "#2C1A0E", espressoL: "#4A2E1A",
  sage: "#8BA888", white: "#FFFDF7",
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@400;500;600&display=swap');`;

// PWA meta-tags voor installatie op telefoon
function usePWAMeta() {
  useEffect(() => {
    document.title = "DeegTimer";
    const metas = [
      ["name","application-name","DeegTimer"],
      ["name","apple-mobile-web-app-title","DeegTimer"],
      ["name","apple-mobile-web-app-capable","yes"],
      ["name","apple-mobile-web-app-status-bar-style","black-translucent"],
      ["name","mobile-web-app-capable","yes"],
      ["name","theme-color","#2C1A0E"],
      ["name","description","Timer app voor thuisbakkers"],
    ];
    metas.forEach(([k,v,c]) => {
      let el = document.querySelector(`meta[${k}="${v}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(k,v); document.head.appendChild(el); }
      el.setAttribute("content", c);
    });
    // Apple touch icon (terracotta achtergrond met brood emoji als SVG)
    const svgIcon = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect width='192' height='192' rx='40' fill='%232C1A0E'/><text x='96' y='130' font-size='110' text-anchor='middle'>🌾</text><text x='96' y='178' font-size='28' text-anchor='middle' font-family='serif' font-weight='900' fill='%23F5C842'>DeegTimer</text></svg>`;
    const iconUrl = `data:image/svg+xml,${svgIcon}`;
    ["apple-touch-icon","icon"].forEach(rel => {
      let link = document.querySelector(`link[rel='${rel}']`);
      if (!link) { link = document.createElement("link"); link.rel = rel; document.head.appendChild(link); }
      link.href = iconUrl;
    });
    // Manifest
    const manifest = {
      name: "DeegTimer",
      short_name: "DeegTimer",
      description: "Timer app voor thuisbakkers",
      start_url: "/",
      display: "standalone",
      background_color: "#FAF3E0",
      theme_color: "#2C1A0E",
      icons: [{ src: iconUrl, sizes: "192x192", type: "image/svg+xml" }]
    };
    let mlink = document.querySelector("link[rel='manifest']");
    if (!mlink) { mlink = document.createElement("link"); mlink.rel = "manifest"; document.head.appendChild(mlink); }
    const blob = new Blob([JSON.stringify(manifest)], {type:"application/json"});
    mlink.href = URL.createObjectURL(blob);
  }, []);
}

const CARD_COLORS = [C.terra, "#E8944A", C.sage, "#7B9E87", "#B07CC6", "#5B8FD4"];

const DEFAULT_TIMERS = [
  { id: "tpl1", name: "Autolyse",        emoji: "💧", duration: 30 * 60 },
  { id: "tpl2", name: "Traag kneden",    emoji: "🤲", duration:  7 * 60 },
  { id: "tpl3", name: "Snel kneden",     emoji: "⚡", duration:  3 * 60 },
  { id: "tpl4", name: "Vouwen",          emoji: "🔁", duration: 20 * 60 },
  { id: "tpl5", name: "Voorrijs",        emoji: "🌡️", duration: 45 * 60 },
  { id: "tpl6", name: "Narijs koelkast", emoji: "❄️", duration: 35 * 60 },
  { id: "tpl7", name: "Bakken",          emoji: "🔥", duration: 25 * 60 },
];

const DEFAULT_PLANS = [
  {
    id: "plan1", name: "Zuurdesembrood", emoji: "🌾",
    steps: [
      { id: "s1", name: "Autolyse",        duration: 30 * 60, repeat: 1 },
      { id: "s2", name: "Traag kneden",    duration:  7 * 60, repeat: 1 },
      { id: "s3", name: "Snel kneden",     duration:  3 * 60, repeat: 1 },
      { id: "s4", name: "Vouwen",          duration: 20 * 60, repeat: 4 },
      { id: "s5", name: "Voorrijs",        duration: 45 * 60, repeat: 1 },
      { id: "s6", name: "Narijs koelkast", duration: 35 * 60, repeat: 1 },
    ],
  },
  {
    id: "plan2", name: "Croissants", emoji: "🥐",
    steps: [
      { id: "s1", name: "Deeg kneden", duration: 10 * 60, repeat: 1 },
      { id: "s2", name: "Koelen",      duration: 60 * 60, repeat: 1 },
      { id: "s3", name: "Toeren",      duration: 30 * 60, repeat: 3 },
      { id: "s4", name: "Narijs",      duration: 120* 60, repeat: 1 },
      { id: "s5", name: "Bakken",      duration: 18 * 60, repeat: 1 },
    ],
  },
];

let _audioCtx = null;
function beep() {
  try {
    if (!_audioCtx || _audioCtx.state === 'closed')
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    const ctx = _audioCtx;
    [0, 0.3, 0.6].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = "sine";
      g.gain.setValueAtTime(0.4, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.25);
    });
  } catch (_) {}
}

const alarmRefs = {};
function startAlarm(id) {
  if (alarmRefs[id]) return;
  beep();
  alarmRefs[id] = setInterval(() => beep(), 2500);
}
function stopAlarm(id) {
  if (alarmRefs[id]) { clearInterval(alarmRefs[id]); delete alarmRefs[id]; }
}

function fmt(s) {
  if (s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

function parseDur(str) {
  const p = str.trim().split(":");
  if (p.length === 2) return (parseInt(p[0])||0)*60 + (parseInt(p[1])||0);
  return (parseInt(p[0])||0)*60;
}

let _cIdx = 0;
function nextColor() { return _cIdx++; }

const API = import.meta.env.VITE_API_URL ?? '';
let _pushSubCache = null;
async function getPushSub() {
  if (_pushSubCache) return _pushSubCache;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await fetch(`${API}/api/vapid-public-key`).then(r => r.json());
      const key = Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
    _pushSubCache = sub;
    return sub;
  } catch { return null; }
}

function makeTimer(name, emoji, steps) {
  return {
    id: `a${Date.now()}`, name, emoji, steps,
    currentStep: 0, currentRepeat: 0, remaining: steps[0].duration,
    started: false, paused: false, done: false, colorIndex: nextColor(),
  };
}

function Btn({ onClick, bg=C.terra, color=C.white, children, style={} }) {
  return (
    <button onClick={onClick} style={{
      background: bg, color, border:"none", borderRadius:12,
      padding:"9px 16px", fontFamily:"DM Sans", fontWeight:700,
      fontSize:14, cursor:"pointer", ...style,
    }}>{children}</button>
  );
}

function GhostBtn({ onClick, color="#999", children, style={} }) {
  return (
    <button onClick={onClick} style={{
      background:"transparent", border:`1.5px solid ${C.creamD}`,
      borderRadius:10, padding:"6px 14px", fontFamily:"DM Sans",
      fontWeight:600, fontSize:13, color, cursor:"pointer", ...style,
    }}>{children}</button>
  );
}

function CircularTimer({ progress, size=88, color, children }) {
  const r = (size-12)/2, circ = 2*Math.PI*r;
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.creamD} strokeWidth={10}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={circ*(1-Math.max(0,Math.min(1,progress)))}
          strokeLinecap="round" style={{ transition:"stroke-dashoffset 0.5s ease" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        {children}
      </div>
    </div>
  );
}

function SkipModal({ stepIndex, stepName, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(44,26,14,0.55)", zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:C.white, borderRadius:24, padding:28, maxWidth:340, width:"100%",
        boxShadow:"0 8px 40px rgba(44,26,14,0.25)" }}>
        <div style={{ fontFamily:"Fraunces", fontSize:20, fontWeight:700, color:C.espresso, marginBottom:8, lineHeight:1.3 }}>
          Ga naar stap {stepIndex+1}?
        </div>
        <div style={{ fontFamily:"DM Sans", fontSize:15, color:C.espressoL, marginBottom:4 }}>
          "{stepName}"
        </div>
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <GhostBtn onClick={onCancel} style={{ flex:1, padding:"12px" }}>Annuleer</GhostBtn>
          <Btn onClick={onConfirm} style={{ flex:2, padding:"12px", borderRadius:14,
            boxShadow:"0 4px 14px rgba(193,96,58,0.35)" }}>Ja, ga verder</Btn>
        </div>
      </div>
    </div>
  );
}

function ActiveTimerCard({ timer, onStop, onToggle, onStart, onSkip, onAdjust, onConfirmAlert }) {
  const [skipTarget, setSkipTarget] = useState(null);
  const step     = timer.steps[timer.currentStep];
  const progress = step ? (step.duration - timer.remaining) / step.duration : 1;
  const repeatInf= step?.repeat > 1 ? ` (${timer.currentRepeat+1}/${step.repeat})` : "";
  const color    = CARD_COLORS[timer.colorIndex % CARD_COLORS.length];
  const isMulti  = timer.steps.length > 1;
  const hasPrev  = timer.currentStep > 0;
  const hasNext  = timer.currentStep < timer.steps.length - 1;

  const isDone   = timer.alerting==="done";
  const isRepeat = timer.alerting==="repeat";
  const alertMsg = isDone
    ? `✅ ${timer.name} is klaar!`
    : isRepeat
      ? `🔁 "${step?.name}" klaar — herhaling ${(timer.pendingRepeat)+1}/${step?.repeat}`
      : `✅ "${step?.name}" klaar!`;

  return (
    <>
      {skipTarget && (
        <SkipModal
          stepIndex={skipTarget.index}
          stepName={skipTarget.name}
          onConfirm={() => { onSkip(timer.id, skipTarget.index); setSkipTarget(null); }}
          onCancel={() => setSkipTarget(null)}
        />
      )}
      <div style={{ background:timer.alerting ? C.yellow : C.white, borderRadius:24, padding:"16px 16px 13px",
        boxShadow: timer.alerting ? "0 0 0 3px "+C.terra+", 0 4px 24px rgba(44,26,14,0.15)" : "0 4px 24px rgba(44,26,14,0.09)",
        border: timer.alerting ? `2px solid ${C.terra}` : `2px solid ${C.creamD}`,
        position:"relative", overflow:"hidden",
        animation: timer.alerting ? "pulse 1s ease-in-out infinite" : "none" }}>
        <div style={{ position:"absolute", top:0, left:0, width:6, height:"100%",
          background:color, borderRadius:"24px 0 0 24px" }}/>

        {/* ALARM OVERLAY */}
        {timer.alerting && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontFamily:"Fraunces", fontSize:22, fontWeight:900, color:C.espresso, lineHeight:1.2, marginBottom:10 }}>
              {alertMsg}
            </div>

            <div style={{ display:"flex", gap:8 }}>
              <Btn onClick={()=>onConfirmAlert(timer.id)}
                style={{ flex:2, padding:"13px", fontSize:16, borderRadius:14,
                  boxShadow:"0 4px 16px rgba(193,96,58,0.4)",
                  background: isDone ? C.sage : C.terra }}>
                ✓ Bevestig
              </Btn>
              <button onClick={()=>onStop(timer.id)} style={{
                background:"rgba(193,96,58,0.12)", border:"none", borderRadius:12,
                padding:"13px 16px", fontFamily:"DM Sans", fontWeight:600,
                fontSize:13, color:C.terra, cursor:"pointer" }}>✕ Stop</button>
            </div>
          </div>
        )}

        {!timer.alerting && (<>
          <div style={{ display:"flex", gap:14, alignItems:"center" }}>
            <CircularTimer progress={progress} size={88} color={timer.started ? color : C.creamD}>
              <span style={{ fontFamily:"Fraunces", fontSize:17, fontWeight:700, color:timer.started ? C.espresso : "#BBB" }}>
                {fmt(timer.remaining)}
              </span>
            </CircularTimer>

            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"Fraunces", fontSize:19, fontWeight:700, color:C.espresso, lineHeight:1.1 }}>
                {timer.emoji} {timer.name}
              </div>
              {isMulti && (
                <div style={{ fontFamily:"DM Sans", fontSize:13, color:C.terra, fontWeight:600, marginTop:2 }}>
                  Stap {timer.currentStep+1}/{timer.steps.length}: {step?.name}{repeatInf}
                </div>
              )}
              {hasNext && (
                <div style={{ fontFamily:"DM Sans", fontSize:12, color:"#AAA", marginTop:1 }}>
                  Volgende: {timer.steps[timer.currentStep+1]?.name}
                </div>
              )}

              {/* +/- tijd */}
              <div style={{ display:"flex", gap:5, marginTop:9, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ fontFamily:"DM Sans", fontSize:10, color:"#CCC", fontWeight:600, letterSpacing:.5 }}>TIJD</span>
                {[-5,-1,1,5].map(d=>(
                  <button key={d} onClick={()=>onAdjust(timer.id,d*60)} style={{
                    background: d<0 ? "#FFE8E0" : "#E8F4E8",
                    border:"none", borderRadius:7, padding:"3px 9px",
                    fontFamily:"DM Sans", fontWeight:700, fontSize:12,
                    color: d<0 ? C.terra : "#3A7A3A", cursor:"pointer",
                  }}>{d>0?"+":""}{d}m</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display:"flex", gap:6, marginTop:12, alignItems:"center" }}>
            {isMulti && (
              <button onClick={()=>hasPrev&&setSkipTarget({index:timer.currentStep-1,name:timer.steps[timer.currentStep-1]?.name})}
                style={{ background:hasPrev?C.creamD:"transparent",
                  border:`1.5px solid ${hasPrev?C.creamD:"#EEE8DE"}`,
                  borderRadius:10, padding:"8px 11px", fontSize:14,
                  cursor:hasPrev?"pointer":"default", color:hasPrev?C.espresso:"#DDD" }}>◀</button>
            )}

            {!timer.started
              ? <Btn onClick={()=>onStart(timer.id)}
                  style={{ flex:1, borderRadius:14, padding:"10px", fontSize:15,
                    boxShadow:"0 4px 12px rgba(193,96,58,0.35)" }}>▶ Start</Btn>
              : <button onClick={()=>onToggle(timer.id)} style={{
                  flex:1, background:timer.paused?C.yellow:C.creamD, border:"none",
                  borderRadius:12, padding:"10px", fontFamily:"DM Sans",
                  fontWeight:600, fontSize:14, color:C.espresso, cursor:"pointer" }}>
                  {timer.paused?"▶ Verder":"⏸ Pauze"}
                </button>
            }

            <button onClick={()=>onStop(timer.id)} style={{
              background:"#FFE8E0", border:"none", borderRadius:12, padding:"10px 14px",
              fontFamily:"DM Sans", fontWeight:600, fontSize:13, color:C.terra, cursor:"pointer" }}>
              ✕ Stop
            </button>

            {isMulti && (
              <button onClick={()=>hasNext&&setSkipTarget({index:timer.currentStep+1,name:timer.steps[timer.currentStep+1]?.name})}
                style={{ background:hasNext?C.creamD:"transparent",
                  border:`1.5px solid ${hasNext?C.creamD:"#EEE8DE"}`,
                  borderRadius:10, padding:"8px 11px", fontSize:14,
                  cursor:hasNext?"pointer":"default", color:hasNext?C.espresso:"#DDD" }}>▶▶</button>
            )}
          </div>
        </>)}
      </div>
    </>
  );
}

function QuickTimer({ onStart }) {
  const [min, setMin]     = useState("10");
  const [label, setLabel] = useState("");
  return (
    <div style={{ background:C.yellow, borderRadius:22, padding:18,
      boxShadow:"0 4px 20px rgba(44,26,14,0.10)" }}>
      <div style={{ fontFamily:"Fraunces", fontSize:19, fontWeight:700, color:C.espresso, marginBottom:10 }}>
        ⚡ Snelle timer
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Naam (optioneel)"
          style={{ flex:2, minWidth:90, padding:"9px 13px", borderRadius:11,
            border:"2px solid rgba(44,26,14,0.12)", fontFamily:"DM Sans", fontSize:14,
            background:"rgba(255,255,255,0.75)", color:C.espresso, outline:"none" }}/>
        <input value={min} onChange={e=>setMin(e.target.value)} type="number" min="1" placeholder="min"
          style={{ width:66, padding:"9px 10px", borderRadius:11, border:"2px solid rgba(44,26,14,0.12)",
            fontFamily:"Fraunces", fontWeight:700, fontSize:16,
            background:"rgba(255,255,255,0.75)", color:C.espresso, outline:"none" }}/>
        <Btn onClick={()=>{const s=parseInt(min)*60;if(s>0)onStart(label||"Timer",s);}}>Start</Btn>
      </div>
    </div>
  );
}

function TimerDefCard({ tpl, onStart, onEdit, onDelete }) {
  return (
    <div style={{ background:C.white, borderRadius:18, padding:"14px 16px",
      display:"flex", alignItems:"center", gap:12,
      boxShadow:"0 2px 12px rgba(44,26,14,0.07)", border:`2px solid ${C.creamD}` }}>
      <span style={{ fontSize:26, flexShrink:0 }}>{tpl.emoji}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"Fraunces", fontSize:18, fontWeight:700, color:C.espresso }}>{tpl.name}</div>
        <div style={{ fontFamily:"DM Sans", fontSize:13, color:C.terra, fontWeight:600 }}>{fmt(tpl.duration)}</div>
      </div>
      <div style={{ display:"flex", gap:6, flexShrink:0 }}>
        <Btn onClick={()=>onStart(tpl)} style={{ padding:"8px 14px", fontSize:13, borderRadius:11,
          boxShadow:"0 3px 10px rgba(193,96,58,0.28)" }}>▶</Btn>
        <GhostBtn onClick={()=>onEdit(tpl)} style={{ padding:"7px 10px" }}>✏️</GhostBtn>
        <GhostBtn onClick={()=>onDelete(tpl.id)} color={C.terra}
          style={{ padding:"7px 10px", borderColor:"#FFD5C8" }}>🗑</GhostBtn>
      </div>
    </div>
  );
}

function TimerEditorModal({ initial, onSave, onCancel }) {
  const [name, setName]   = useState(initial?.name||"");
  const [emoji, setEmoji] = useState(initial?.emoji||"⏱");
  const [dur, setDur]     = useState(()=>{
    if(!initial) return "5";
    const m=Math.floor(initial.duration/60),s=initial.duration%60;
    return s?`${m}:${String(s).padStart(2,"0")}`:String(m);
  });

  function save() {
    const d=parseDur(dur);
    if(name&&d>0) onSave({id:initial?.id||`tpl${Date.now()}`,name,emoji,duration:d});
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(44,26,14,0.55)", zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:C.white, borderRadius:24, padding:28, maxWidth:360, width:"100%",
        boxShadow:"0 8px 40px rgba(44,26,14,0.25)" }}>
        <div style={{ fontFamily:"Fraunces", fontSize:22, fontWeight:900, color:C.espresso, marginBottom:16 }}>
          {initial?"Timer bewerken":"Nieuwe timer"}
        </div>
        <div style={{ display:"flex", gap:10, marginBottom:12 }}>
          <input value={emoji} onChange={e=>setEmoji(e.target.value)} maxLength={2}
            style={{ width:52, textAlign:"center", padding:"10px 6px", borderRadius:12,
              border:`2px solid ${C.creamD}`, fontSize:22, background:C.white, outline:"none" }}/>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Naam"
            style={{ flex:1, padding:"10px 13px", borderRadius:12, border:`2px solid ${C.creamD}`,
              fontFamily:"Fraunces", fontSize:17, fontWeight:700, color:C.espresso,
              background:C.white, outline:"none" }}/>
        </div>
        <div style={{ fontFamily:"DM Sans", fontSize:11, color:"#AAA", fontWeight:600,
          letterSpacing:.5, marginBottom:6 }}>DUUR (minuten of mm:ss)</div>
        <input value={dur} onChange={e=>setDur(e.target.value)} placeholder="bijv. 30 of 7:30"
          style={{ width:"100%", padding:"11px 14px", borderRadius:12, border:`2px solid ${C.creamD}`,
            fontFamily:"Fraunces", fontWeight:700, fontSize:22, color:C.espresso,
            background:C.white, outline:"none", marginBottom:20 }}/>
        <div style={{ display:"flex", gap:10 }}>
          <GhostBtn onClick={onCancel} style={{ flex:1, padding:"12px" }}>Annuleer</GhostBtn>
          <Btn onClick={save} style={{ flex:2, padding:"12px", borderRadius:14,
            boxShadow:"0 4px 14px rgba(193,96,58,0.35)" }}>💾 Opslaan</Btn>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, onStart, onEdit, onDelete }) {
  const total = plan.steps.reduce((a,s)=>a+s.duration*s.repeat,0);
  return (
    <div style={{ background:C.white, borderRadius:20, padding:18,
      boxShadow:"0 2px 16px rgba(44,26,14,0.08)", border:`2px solid ${C.creamD}` }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontFamily:"Fraunces", fontSize:21, fontWeight:700, color:C.espresso }}>{plan.emoji} {plan.name}</div>
          <div style={{ fontFamily:"DM Sans", fontSize:12, color:"#AAA", marginTop:2 }}>
            {plan.steps.length} stappen · {fmt(total)} totaal
          </div>
        </div>
        <Btn onClick={()=>onStart(plan)} style={{ borderRadius:13, padding:"10px 18px", flexShrink:0,
          boxShadow:"0 4px 12px rgba(193,96,58,0.32)" }}>▶ Start</Btn>
      </div>
      <div style={{ marginTop:10, display:"flex", flexWrap:"wrap", gap:5 }}>
        {plan.steps.map(s=>(
          <span key={s.id} style={{ background:C.creamD, borderRadius:8, padding:"3px 10px",
            fontFamily:"DM Sans", fontSize:12, color:C.espressoL }}>
            {s.name}{s.repeat>1?` ×${s.repeat}`:""} · {fmt(s.duration)}
          </span>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, marginTop:11 }}>
        <GhostBtn onClick={()=>onEdit(plan)} style={{ fontSize:12, padding:"5px 12px" }}>✏️ Bewerk</GhostBtn>
        <GhostBtn onClick={()=>onDelete(plan.id)} color={C.terra}
          style={{ fontSize:12, padding:"5px 12px", borderColor:"#FFD5C8" }}>🗑 Verwijder</GhostBtn>
      </div>
    </div>
  );
}

function StepRow({ step, index, onChange, onRemove }) {
  const [durStr, setDurStr] = useState(()=>{
    const m=Math.floor(step.duration/60),s=step.duration%60;
    return s?`${m}:${String(s).padStart(2,"0")}`:String(m);
  });
  return (
    <div style={{ background:C.creamD, borderRadius:13, padding:10,
      display:"flex", gap:7, alignItems:"center", flexWrap:"wrap" }}>
      <span style={{ fontFamily:"Fraunces", fontWeight:700, color:C.terra, fontSize:14, minWidth:20 }}>{index+1}.</span>
      <input value={step.name} onChange={e=>onChange({...step,name:e.target.value})} placeholder="Naam"
        style={{ flex:2, minWidth:80, padding:"7px 10px", borderRadius:9, border:"none",
          fontFamily:"DM Sans", fontSize:13, background:C.white, color:C.espresso, outline:"none" }}/>
      <input value={durStr} onChange={e=>{setDurStr(e.target.value);const p=parseDur(e.target.value);if(p>0)onChange({...step,duration:p});}}
        placeholder="min of mm:ss"
        style={{ width:84, padding:"7px 9px", borderRadius:9, border:"none",
          fontFamily:"DM Sans", fontSize:13, background:C.white, color:C.espresso, outline:"none" }}/>
      <div style={{ display:"flex", alignItems:"center", gap:3 }}>
        <span style={{ fontSize:11, color:"#AAA" }}>×</span>
        <input type="number" min="1" max="20" value={step.repeat}
          onChange={e=>onChange({...step,repeat:parseInt(e.target.value)||1})}
          style={{ width:42, padding:"7px 5px", borderRadius:9, border:"none", fontFamily:"DM Sans",
            fontSize:13, background:C.white, color:C.espresso, outline:"none", textAlign:"center" }}/>
      </div>
      <button onClick={onRemove} style={{ background:"#FFE8E0", border:"none", borderRadius:7,
        width:28, height:28, cursor:"pointer", color:C.terra, fontSize:13,
        display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
    </div>
  );
}

function PlanEditor({ initial, timers, onSave, onCancel }) {
  const [name, setName]   = useState(initial?.name||"");
  const [emoji, setEmoji] = useState(initial?.emoji||"🍞");
  const [steps, setSteps] = useState(initial?.steps||[]);

  const addBlank = ()  => setSteps(s=>[...s,{id:`s${Date.now()}`,name:"",duration:5*60,repeat:1}]);
  const addFrom  = tpl => setSteps(s=>[...s,{id:`s${Date.now()}`,name:tpl.name,duration:tpl.duration,repeat:1}]);
  const upd = (id,u)   => setSteps(s=>s.map(st=>st.id===id?u:st));
  const rem = id       => setSteps(s=>s.filter(st=>st.id!==id));

  return (
    <div style={{ paddingBottom:90 }}>
      <div style={{ fontFamily:"Fraunces", fontSize:24, fontWeight:900, color:C.espresso, marginBottom:14 }}>
        {initial?"✏️ Bakplan bewerken":"✨ Nieuw bakplan"}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:14 }}>
        <input value={emoji} onChange={e=>setEmoji(e.target.value)} maxLength={2}
          style={{ width:50, textAlign:"center", padding:"10px 4px", borderRadius:13,
            border:`2px solid ${C.creamD}`, fontSize:22, background:C.white, outline:"none" }}/>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Naam bakplan"
          style={{ flex:1, padding:"10px 13px", borderRadius:13, border:`2px solid ${C.creamD}`,
            fontFamily:"Fraunces", fontSize:17, fontWeight:700, color:C.espresso,
            background:C.white, outline:"none" }}/>
      </div>

      {timers.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontFamily:"DM Sans", fontSize:11, fontWeight:600, color:"#AAA",
            letterSpacing:.5, marginBottom:7 }}>VOEG TOE UIT TIMERS</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {timers.map(tpl=>(
              <button key={tpl.id} onClick={()=>addFrom(tpl)} style={{
                background:C.creamD, border:"none", borderRadius:9, padding:"5px 11px",
                fontFamily:"DM Sans", fontSize:12, color:C.espresso, cursor:"pointer" }}>
                {tpl.emoji} {tpl.name} · {fmt(tpl.duration)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontFamily:"DM Sans", fontSize:11, fontWeight:600, color:"#AAA",
        letterSpacing:.5, marginBottom:7 }}>STAPPEN — naam / duur / herhaling</div>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {steps.map((step,i)=>(
          <StepRow key={step.id} step={step} index={i}
            onChange={u=>upd(step.id,u)} onRemove={()=>rem(step.id)}/>
        ))}
      </div>
      <button onClick={addBlank} style={{ marginTop:9, width:"100%", padding:"10px", borderRadius:13,
        border:`2px dashed ${C.terra}`, background:"transparent",
        fontFamily:"DM Sans", fontWeight:600, fontSize:13, color:C.terra, cursor:"pointer" }}>
        + Lege stap toevoegen
      </button>
      <div style={{ display:"flex", gap:10, marginTop:16 }}>
        <GhostBtn onClick={onCancel} style={{ flex:1, padding:"12px" }}>Annuleer</GhostBtn>
        <Btn onClick={()=>{if(name&&steps.length>0)onSave({id:initial?.id||`plan${Date.now()}`,name,emoji,steps});}}
          style={{ flex:2, padding:"12px", borderRadius:14, boxShadow:"0 4px 16px rgba(193,96,58,0.4)" }}>
          💾 Opslaan</Btn>
      </div>
    </div>
  );
}

export default function App() {
  usePWAMeta();
  const [screen, setScreen]           = useState("home");
  const [timers, setTimers]           = useState(() => {
    try { const s = localStorage.getItem("deegtimer_timers"); return s ? JSON.parse(s) : DEFAULT_TIMERS; } catch { return DEFAULT_TIMERS; }
  });
  const [plans, setPlans]             = useState(() => {
    try { const s = localStorage.getItem("deegtimer_plans"); return s ? JSON.parse(s) : DEFAULT_PLANS; } catch { return DEFAULT_PLANS; }
  });
  const [active, setActive]           = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editingTpl, setEditingTpl]   = useState(null);

  // Sla timers en plannen op bij elke wijziging
  useEffect(() => { try { localStorage.setItem("deegtimer_timers", JSON.stringify(timers)); } catch {} }, [timers]);
  useEffect(() => { try { localStorage.setItem("deegtimer_plans", JSON.stringify(plans)); } catch {} }, [plans]);

  // Registreer Service Worker en vraag toestemming voor notificaties
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/deegtimer/sw.js', { scope: '/deegtimer/' }).catch(() => {});
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Sleutels die bepalen of de server opnieuw gepland moet worden — remaining zit er bewust NIET in
  const scheduleKey = active.map(t =>
    [t.id, +t.started, +t.paused, +t.done, t.alerting||'', t.stepStartMs||0, t.currentStep, t.currentRepeat].join(':')
  ).join('|');

  // Plan alarm via server alleen bij echte start/stop/pauze-wijzigingen, niet elke tick
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return;
    activeRef.current.forEach(t => {
      const running = t.started && !t.paused && !t.done && !t.alerting && t.stepStartMs;
      if (running) {
        const fireAt = t.stepStartMs + t.steps[t.currentStep].duration * 1000;
        getPushSub().then(sub => {
          if (!sub) return;
          fetch(`${API}/api/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub.toJSON(), timerId: t.id, name: t.name, emoji: t.emoji || '⏱', fireAt }),
          }).catch(() => {});
        });
      } else {
        fetch(`${API}/api/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timerId: t.id }),
        }).catch(() => {});
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleKey]);

  const tick = useCallback(() => {
    const now = Date.now();
    setActive(prev => prev.map(t => {
      if (!t.started || t.paused || t.done || t.alerting || !t.stepStartMs) return t;
      const remaining = Math.max(0, t.steps[t.currentStep].duration - Math.round((now - t.stepStartMs) / 1000));
      if (remaining <= 0) {
        const step = t.steps[t.currentStep];
        const nr = t.currentRepeat + 1;
        if (nr < step.repeat) { startAlarm(t.id); return { ...t, remaining: 0, alerting: "repeat", pendingRepeat: nr, stepStartMs: null }; }
        const ns = t.currentStep + 1;
        if (ns < t.steps.length) { startAlarm(t.id); return { ...t, remaining: 0, alerting: "next", pendingStep: ns, stepStartMs: null }; }
        startAlarm(t.id); return { ...t, remaining: 0, alerting: "done", stepStartMs: null };
      }
      return { ...t, remaining };
    }));
  }, []);

  useEffect(()=>{ const iv=setInterval(tick,1000); return ()=>clearInterval(iv); },[tick]);

  // Onmiddellijke alarm-check bij terugkeer uit slaapstand / achtergrond
  useEffect(() => {
    const handler = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", handler);
    window.addEventListener("pageshow", tick); // iOS
    return () => {
      document.removeEventListener("visibilitychange", handler);
      window.removeEventListener("pageshow", tick);
    };
  }, [tick]);

  function launchTimer(tpl) {
    setActive(a=>[...a, makeTimer(tpl.name, tpl.emoji, [{id:"q1",name:tpl.name,duration:tpl.duration,repeat:1}])]);
    setScreen("home");
  }
  function launchPlan(plan) {
    setActive(a=>[...a, makeTimer(plan.name, plan.emoji, plan.steps)]);
    setScreen("home");
  }
  function launchQuick(label, secs) {
    setActive(a=>[...a, makeTimer(label, "⏱", [{id:"q1",name:label,duration:secs,repeat:1}])]);
  }

  const startTimer  = id  => setActive(a=>a.map(t=>t.id===id?{...t,started:true,paused:false,stepStartMs:Date.now()}:t));
  const togglePause = id  => setActive(a=>a.map(t=>{
    if(t.id!==id) return t;
    if(t.paused) {
      // Hervatten: zet stepStartMs zodat remaining klopt
      const startMs = Date.now() - (t.steps[t.currentStep].duration - t.remaining) * 1000;
      return {...t, paused:false, stepStartMs:startMs};
    } else {
      // Pauzeren: sla werkelijke remaining op
      const rem = t.stepStartMs ? Math.max(1, t.steps[t.currentStep].duration - Math.round((Date.now()-t.stepStartMs)/1000)) : t.remaining;
      return {...t, paused:true, remaining:rem, stepStartMs:null};
    }
  }));
  const stopTimer   = id  => { stopAlarm(id); setActive(a=>a.filter(t=>t.id!==id)); };
  const skipStep    = (id,idx) => setActive(a=>a.map(t=>{
    if(t.id!==id) return t;
    const dur = t.steps[idx].duration;
    return {...t, currentStep:idx, currentRepeat:0, remaining:dur, alerting:null,
      stepStartMs:(t.started && !t.paused) ? Date.now() : null};
  }));
  const adjust      = (id,s)   => setActive(a=>a.map(t=>{
    if(t.id!==id) return t;
    const rem = Math.max(1, t.remaining+s);
    const diff = rem - t.remaining;
    return {...t, remaining:rem, stepStartMs:t.stepStartMs ? t.stepStartMs - diff*1000 : null};
  }));

  function confirmAlert(id) {
    stopAlarm(id);
    setActive(a=>a.map(t=>{
      if(t.id!==id) return t;
      if(t.alerting==="done") return {...t, alerting:null, done:true};
      // Herhaling: zelfde stap opnieuw, klaar voor start
      if(t.alerting==="repeat") return {...t, alerting:null, pendingRepeat:undefined, currentRepeat:t.pendingRepeat, remaining:t.steps[t.currentStep].duration, started:false};
      // Volgende stap: laad direct, klaar voor start
      if(t.alerting==="next") return {...t, alerting:null, pendingStep:undefined, currentStep:t.pendingStep, currentRepeat:0, remaining:t.steps[t.pendingStep].duration, started:false};
      return t;
    }));
  }

  const saveTpl = tpl => {
    setTimers(ts=>{ const ex=ts.find(x=>x.id===tpl.id); return ex?ts.map(x=>x.id===tpl.id?tpl:x):[...ts,tpl]; });
    setEditingTpl(null);
  };
  const deleteTpl = id => setTimers(ts=>ts.filter(t=>t.id!==id));

  const savePlan = plan => {
    setPlans(ps=>{ const ex=ps.find(x=>x.id===plan.id); return ex?ps.map(x=>x.id===plan.id?plan:x):[...ps,plan]; });
    setEditingPlan(null); setScreen("plans");
  };

  const running = active.filter(t => !t.done);
  const done    = active.filter(t => t.done);

  const NAV = [
    { id:"home",   label:"Home",       icon:"🏠" },
    { id:"timers", label:"Timers",     icon:"⏱" },
    { id:"plans",  label:"Bakplannen", icon:"📋" },
  ];

  return (
    <>
      <style>{FONTS}</style>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${C.cream};}
        input:focus{box-shadow:0 0 0 3px rgba(193,96,58,0.15);}
        button{transition:opacity .1s,transform .1s;}
        button:active{opacity:.82;transform:scale(.96);}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 3px #C1603A,0 4px 24px rgba(44,26,14,0.15);}50%{box-shadow:0 0 0 6px #C1603A88,0 4px 24px rgba(44,26,14,0.15);}}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:${C.creamD};border-radius:2px;}
      `}</style>

      {editingTpl !== null && (
        <TimerEditorModal
          initial={editingTpl.id ? editingTpl : null}
          onSave={saveTpl}
          onCancel={()=>setEditingTpl(null)}/>
      )}

      <div style={{ maxWidth:480, margin:"0 auto", minHeight:"100vh",
        background:C.cream, fontFamily:"DM Sans, sans-serif" }}>

        <div style={{ background:C.espresso, padding:"24px 22px 16px", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ fontFamily:"Fraunces", fontSize:28, fontWeight:900,
            color:C.yellow, letterSpacing:"-0.5px", lineHeight:1 }}>
            DeegTimer 🌾
          </div>
          <div style={{ fontFamily:"DM Sans", fontSize:12, color:"rgba(250,243,224,0.45)", marginTop:2 }}>
            {running.length>0 ? `${running.length} timer${running.length>1?"s":""} actief` : "Geen actieve timers"}
          </div>
        </div>

        <div style={{ padding:"18px 16px 100px" }}>

          {screen==="home" && (
            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
              <QuickTimer onStart={launchQuick}/>
              {running.length===0 && done.length===0 && (
                <div style={{ textAlign:"center", padding:"40px 20px",
                  fontFamily:"Fraunces", fontSize:16, color:"#C8B89A", fontStyle:"italic" }}>
                  Nog geen timers actief.<br/>
                  <span style={{ fontSize:13, fontFamily:"DM Sans" }}>
                    Start een timer of bakplan via de tabs onderaan.
                  </span>
                </div>
              )}
              {running.map(t=>(
                <ActiveTimerCard key={t.id} timer={t}
                  onStop={stopTimer} onStart={startTimer}
                  onToggle={togglePause} onSkip={skipStep} onAdjust={adjust}
                  onConfirmAlert={confirmAlert}/>
              ))}
              {done.length>0 && (
                <>
                  <div style={{ fontFamily:"DM Sans", fontSize:11, fontWeight:600, color:"#CCC", letterSpacing:1, marginTop:6 }}>KLAAR</div>
                  {done.map(t=>(
                    <div key={t.id} style={{ background:C.sage+"22", borderRadius:17, padding:"11px 15px",
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      border:`2px solid ${C.sage}44` }}>
                      <span style={{ fontFamily:"Fraunces", fontSize:16, color:C.espresso }}>✅ {t.emoji} {t.name}</span>
                      <button onClick={()=>stopTimer(t.id)} style={{ background:"transparent",
                        border:"none", fontSize:18, cursor:"pointer", color:"#AAA" }}>✕</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {screen==="timers" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontFamily:"Fraunces", fontSize:24, fontWeight:900, color:C.espresso }}>Timers</div>
                <Btn onClick={()=>setEditingTpl({})} style={{ padding:"9px 16px", fontSize:13 }}>+ Nieuw</Btn>
              </div>
              {timers.map(tpl=>(
                <TimerDefCard key={tpl.id} tpl={tpl}
                  onStart={launchTimer}
                  onEdit={t=>setEditingTpl(t)}
                  onDelete={deleteTpl}/>
              ))}
              {timers.length===0 && (
                <div style={{ textAlign:"center", padding:"40px 20px",
                  fontFamily:"Fraunces", fontSize:16, color:"#C8B89A", fontStyle:"italic" }}>
                  Nog geen timers aangemaakt.
                </div>
              )}
            </div>
          )}

          {screen==="plans" && !editingPlan && (
            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontFamily:"Fraunces", fontSize:24, fontWeight:900, color:C.espresso }}>Bakplannen</div>
                <Btn onClick={()=>setEditingPlan({})} style={{ padding:"9px 16px", fontSize:13 }}>+ Nieuw</Btn>
              </div>
              {plans.map(plan=>(
                <PlanCard key={plan.id} plan={plan}
                  onStart={launchPlan}
                  onEdit={p=>setEditingPlan(p)}
                  onDelete={id=>setPlans(ps=>ps.filter(x=>x.id!==id))}/>
              ))}
            </div>
          )}

          {screen==="plans" && editingPlan && (
            <PlanEditor
              initial={editingPlan.id?editingPlan:null}
              timers={timers}
              onSave={savePlan}
              onCancel={()=>setEditingPlan(null)}/>
          )}
        </div>

        <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
          width:"100%", maxWidth:480, background:C.espresso,
          display:"flex", borderTop:`3px solid ${C.yellow}` }}>
          {NAV.map(item=>(
            <button key={item.id}
              onClick={()=>{ setScreen(item.id); setEditingPlan(null); }}
              style={{ flex:1, padding:"13px 0 17px", background:"transparent", border:"none",
                fontFamily:"DM Sans", fontWeight:600, fontSize:12, cursor:"pointer",
                color:screen===item.id?C.yellow:"rgba(250,243,224,0.38)",
                display:"flex", flexDirection:"column", alignItems:"center", gap:2,
                position:"relative", transition:"color 0.15s" }}>
              <span style={{ fontSize:20 }}>{item.icon}</span>
              {item.label}
              {item.id==="home" && running.length>0 && (
                <span style={{ position:"absolute", top:7, marginLeft:22,
                  background:C.terra, color:C.white, borderRadius:10,
                  fontSize:10, fontWeight:700, padding:"1px 5px" }}>
                  {running.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
