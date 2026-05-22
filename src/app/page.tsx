"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import "./landing.css";

// ─── Google OAuth ──────────────────────────────────────────────
async function handleGoogleLogin() {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: "email profile https://www.googleapis.com/auth/gmail.send",
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
}

// ─── Brand mark ────────────────────────────────────────────────
function Mark({ height = 26 }: { height?: number }) {
  return (
    <img
      src="/landing/Logo2Squibble.png"
      alt=""
      style={{
        display: "block",
        height: `${height}px`,
        width: "auto",
        flexShrink: 0,
        marginRight: "-4px",
      }}
      aria-hidden="true"
    />
  );
}

// ─── Navbar ────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className={`nav-wrap ${scrolled ? "scrolled" : ""}`}>
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-brand">
            <Mark height={28} />
            <span>Squibble</span>
          </div>
          <div className="nav-links">
            <a className="nav-link" href="#product">Product</a>
            <a className="nav-link" href="#pricing">Pricing</a>
            <a className="nav-link" href="#company">Company</a>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleGoogleLogin}
          >
            Get started
          </button>
        </div>
      </nav>
    </div>
  );
}

// ─── Animated node diagram ─────────────────────────────────────
const DIA_PHASES = [
  { id: "scan",    label: "Scanning professors…",      duration: 2600 },
  { id: "match",   label: "Matching to your profile…", duration: 2600 },
  { id: "rank",    label: "Ranking opportunities…",    duration: 2200 },
  { id: "contact", label: "Contacting them…",          duration: 2800 },
  { id: "reply",   label: "Getting replies…",          duration: 3600 },
  { id: "reset",   label: "Scanning professors…",      duration: 700  },
];

const CX = 240, CY = 240;

const RAW_NODES = [
  { id: 0,  angle: 312, radius: 175, strength: 0.96 },
  { id: 1,  angle:  18, radius: 170, strength: 0.90 },
  { id: 2,  angle:  78, radius: 180, strength: 0.82 },
  { id: 3,  angle: 144, radius: 175, strength: 0.74 },
  { id: 4,  angle: 210, radius: 168, strength: 0.66 },
  { id: 5,  angle: 256, radius: 178, strength: 0.60 },
  { id: 6,  angle: 340, radius: 215, strength: 0.42 },
  { id: 7,  angle:  50, radius: 220, strength: 0.36 },
  { id: 8,  angle: 110, radius: 215, strength: 0.30 },
  { id: 9,  angle: 175, radius: 225, strength: 0.34 },
  { id: 10, angle: 230, radius: 220, strength: 0.40 },
  { id: 11, angle: 285, radius: 215, strength: 0.28 },
  { id: 12, angle:  20, radius:  98, strength: 0.45 },
  { id: 13, angle: 200, radius: 105, strength: 0.42 },
];

const SURVIVORS = [...RAW_NODES]
  .filter((n) => n.strength >= 0.55)
  .sort((a, b) => b.strength - a.strength)
  .slice(0, 6);
const SURVIVOR_RANK = new Map(SURVIVORS.map((s, i) => [s.id, i]));

function homePos(node: typeof RAW_NODES[0]) {
  const a = (node.angle * Math.PI) / 180;
  return { x: CX + Math.cos(a) * node.radius, y: CY + Math.sin(a) * node.radius };
}
function rankPos(rank: number) {
  const a = -Math.PI / 2 + (rank * Math.PI * 2) / 6;
  const r = 142 + rank * 10;
  return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r };
}
function farPos(node: typeof RAW_NODES[0]) {
  const a = (node.angle * Math.PI) / 180;
  return { x: CX + Math.cos(a) * (node.radius + 90), y: CY + Math.sin(a) * (node.radius + 90) };
}

function targetFor(phaseId: string, node: typeof RAW_NODES[0]) {
  const home = homePos(node);
  const rank = SURVIVOR_RANK.get(node.id);
  const isSurv = rank !== undefined;

  if (phaseId === "reset") {
    const far = farPos(node);
    return { x: far.x, y: far.y, opacity: 0, scale: 0.5, ring: 0, fill: 0, check: 0, lineO: 0 };
  }
  if (phaseId === "scan") {
    return { x: home.x, y: home.y, opacity: 0.85, scale: 1, ring: 0, fill: 0, check: 0, lineO: 0.35 };
  }
  if (phaseId === "match") {
    if (isSurv) {
      const a = (node.angle * Math.PI) / 180;
      const r = node.radius * 0.82;
      return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, opacity: 1, scale: 1.06, ring: 1, fill: 0, check: 0, lineO: 0.6 };
    }
    return { x: home.x, y: home.y, opacity: 0.1, scale: 0.7, ring: 0, fill: 0, check: 0, lineO: 0.04 };
  }
  if (phaseId === "rank" || phaseId === "contact") {
    if (isSurv) {
      const { x, y } = rankPos(rank!);
      return { x, y, opacity: 1, scale: 1.06, ring: 1, fill: 0, check: 0, lineO: 0.7 };
    }
    const dim = farPos(node);
    return { x: dim.x * 0.6 + home.x * 0.4, y: dim.y * 0.6 + home.y * 0.4, opacity: 0, scale: 0.5, ring: 0, fill: 0, check: 0, lineO: 0 };
  }
  if (phaseId === "reply") {
    if (isSurv) {
      const { x, y } = rankPos(rank!);
      return { x, y, opacity: 1, scale: 1.06, ring: 0.4, fill: 1, check: 1, lineO: 0.55 };
    }
    const dim = farPos(node);
    return { x: dim.x * 0.6 + home.x * 0.4, y: dim.y * 0.6 + home.y * 0.4, opacity: 0, scale: 0.5, ring: 0, fill: 0, check: 0, lineO: 0 };
  }
  return { x: home.x, y: home.y, opacity: 0, scale: 1, ring: 0, fill: 0, check: 0, lineO: 0 };
}

function lerpFill(t: number) {
  const r = Math.round(255 + (103 - 255) * t);
  const g = Math.round(255 + (142 - 255) * t);
  const b = Math.round(255 + (141 - 255) * t);
  return `rgb(${r},${g},${b})`;
}
function lerpStroke(t: number) {
  const r = Math.round(187 + (103 - 187) * t);
  const g = Math.round(210 + (142 - 210) * t);
  const b = Math.round(221 + (141 - 221) * t);
  return `rgb(${r},${g},${b})`;
}
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

function NodeDiagram() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phaseRef = useRef(0);
  const phaseStartRef = useRef(performance.now());
  const svgRef = useRef<SVGSVGElement>(null);
  const stateRef = useRef(RAW_NODES.map((n) => ({ ...targetFor("reset", n) })));

  useEffect(() => {
    phaseRef.current = phaseIdx;
    phaseStartRef.current = performance.now();
    const t = setTimeout(() => {
      setPhaseIdx((p) => (p + 1) % DIA_PHASES.length);
    }, DIA_PHASES[phaseIdx].duration);
    return () => clearTimeout(t);
  }, [phaseIdx]);

  useEffect(() => {
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 33);
      last = now;
      const phase = DIA_PHASES[phaseRef.current].id;
      const phaseT = now - phaseStartRef.current;

      for (let i = 0; i < RAW_NODES.length; i++) {
        const node = RAW_NODES[i];
        const t = targetFor(phase, node);
        let fillT = t.fill, checkT = t.check;
        if (phase === "reply") {
          const rank = SURVIVOR_RANK.get(node.id);
          if (rank !== undefined) {
            const delay = rank * 480;
            const dur = 500;
            const p = Math.max(0, Math.min(1, (phaseT - delay) / dur));
            fillT = easeOutCubic(p);
            checkT = easeOutCubic(p);
          } else {
            fillT = 0; checkT = 0;
          }
        }
        const s = stateRef.current[i];
        const k = Math.min(1, dt / 320);
        const kFast = Math.min(1, dt / 200);
        s.x += (t.x - s.x) * k;
        s.y += (t.y - s.y) * k;
        s.opacity += (t.opacity - s.opacity) * k;
        s.scale += (t.scale - s.scale) * k;
        s.ring += (t.ring - s.ring) * k;
        s.fill += (fillT - s.fill) * kFast;
        s.check += (checkT - s.check) * kFast;
        s.lineO += (t.lineO - s.lineO) * k;
      }

      const svg = svgRef.current;
      if (svg) {
        for (let i = 0; i < RAW_NODES.length; i++) {
          const s = stateRef.current[i];
          const g = svg.querySelector(`[data-node="${i}"]`);
          if (g) {
            g.setAttribute("transform", `translate(${s.x.toFixed(2)} ${s.y.toFixed(2)}) scale(${s.scale.toFixed(3)})`);
            (g as SVGGElement).style.opacity = s.opacity.toFixed(3);
            const fillEl = g.querySelector(".node-fill");
            if (fillEl) {
              fillEl.setAttribute("fill", lerpFill(s.fill));
              fillEl.setAttribute("stroke", lerpStroke(s.fill));
            }
            const ringEl = g.querySelector(".node-ring");
            if (ringEl) (ringEl as SVGElement).style.opacity = s.ring.toFixed(3);
            const checkEl = g.querySelector(".node-check");
            if (checkEl) {
              const cs = Math.max(0.001, s.check);
              checkEl.setAttribute("transform", `scale(${cs.toFixed(3)})`);
              (checkEl as SVGElement).style.opacity = s.check.toFixed(3);
            }
          }
          const ln = svg.querySelector(`[data-line="${i}"]`);
          if (ln) {
            const s = stateRef.current[i];
            ln.setAttribute("x2", s.x.toFixed(2));
            ln.setAttribute("y2", s.y.toFixed(2));
            (ln as SVGElement).style.opacity = s.lineO.toFixed(3);
            const isSurv = SURVIVOR_RANK.has(i);
            const lineStrength = isSurv ? Math.max(stateRef.current[i].ring, stateRef.current[i].fill) : 0;
            ln.setAttribute("stroke", lerpStroke(lineStrength * 0.7));
          }
        }

        for (let r = 0; r < SURVIVORS.length; r++) {
          const pulse = svg.querySelector(`[data-pulse="${r}"]`);
          if (!pulse) continue;
          if (phase === "contact") {
            const delay = r * 220;
            const dur = 1100;
            const p = (phaseT - delay) / dur;
            if (p >= 0 && p <= 1) {
              const eased = easeOutCubic(p);
              const nodeIdx = SURVIVORS[r].id;
              const ns = stateRef.current[nodeIdx];
              const px = CX + (ns.x - CX) * eased;
              const py = CY + (ns.y - CY) * eased;
              pulse.setAttribute("cx", px.toFixed(2));
              pulse.setAttribute("cy", py.toFixed(2));
              const fade = Math.sin(p * Math.PI);
              (pulse as SVGElement).style.opacity = (fade * 0.95).toFixed(3);
            } else {
              (pulse as SVGElement).style.opacity = "0";
            }
          } else {
            (pulse as SVGElement).style.opacity = "0";
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const phase = DIA_PHASES[phaseIdx];

  return (
    <div className="diagram-wrap">
      <div className="diagram-status">
        <span className="spinner" aria-hidden="true"></span>
        <span className="status-text" key={phase.label}>{phase.label}</span>
      </div>
      <svg ref={svgRef} className="diagram-svg" viewBox="0 0 480 480" aria-hidden="true">
        <circle cx={CX} cy={CY} r={195} fill="none" stroke="#BBD2DD" strokeWidth="1" strokeDasharray="2 6" opacity="0.45" />
        {RAW_NODES.map((_, i) => (
          <line key={`line-${i}`} data-line={i} x1={CX} y1={CY} x2={CX} y2={CY}
            stroke="#BBD2DD" strokeWidth="1" strokeLinecap="round"
            style={{ opacity: 0, transition: "stroke 0.5s ease" }} />
        ))}
        {SURVIVORS.map((_, r) => (
          <circle key={`pulse-${r}`} data-pulse={r} r="4.5" fill="#678E8D" style={{ opacity: 0 }} />
        ))}
        {RAW_NODES.map((n, i) => {
          const isSurv = SURVIVOR_RANK.has(i);
          return (
            <g key={`n-${i}`} data-node={i} style={{ opacity: 0 }}>
              <circle className="node-ring" r="15" fill="none" stroke="#678E8D" strokeWidth="1.3" strokeDasharray="2 3" style={{ opacity: 0 }} />
              <circle className="node-fill" r={isSurv ? 9 : 7} fill="#FFFFFF" stroke="#BBD2DD" strokeWidth="1.3" />
              <circle r="1.6" fill="#3C5352" opacity="0.5" />
              {isSurv && (
                <g className="node-check" style={{ opacity: 0, transformOrigin: "0 0" }}>
                  <path d="M -3.5 0 L -1 2.4 L 3.6 -2.6" fill="none" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              )}
            </g>
          );
        })}
        <g transform={`translate(${CX} ${CY})`}>
          <circle r="28" fill="none" stroke="#678E8D" strokeWidth="1.2" opacity="0.4">
            <animate attributeName="r" values="28;34;28" dur="4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="4s" repeatCount="indefinite" />
          </circle>
          <image href="/landing/profile-icon.png" x={-44} y={-36} width={88} height={103} preserveAspectRatio="xMidYMid meet" />
        </g>
      </svg>
    </div>
  );
}

// ─── Demo mock components ──────────────────────────────────────
function FormMock() {
  return (
    <div className="mini-app">
      <div className="mini-app-head">
        <span className="chip-dot"></span>
        <span className="label">Profile</span>
      </div>
      <div className="mini-field">
        <div className="mini-label">Full name</div>
        <div className="mini-input">Priya Subramanian</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="mini-field">
          <div className="mini-label">School</div>
          <div className="mini-input">UC Berkeley</div>
        </div>
        <div className="mini-field">
          <div className="mini-label">Major</div>
          <div className="mini-input">Physics</div>
        </div>
      </div>
      <div className="mini-field" style={{ marginBottom: 0 }}>
        <div className="mini-label">Research experience</div>
        <div className="mini-input tall">Two semesters in a condensed matter lab. Worked on cryogenic STM measurements of topological insulators.</div>
      </div>
    </div>
  );
}

const PROF_LIST = [
  { initials: "MH", name: "Maya Hartwell",  dept: "Condensed Matter · Stanford",  match: "94%", research: "Topological phases in 2D materials, STM imaging.", selected: true },
  { initials: "DO", name: "Daniel Okonkwo", dept: "Quantum Materials · MIT",       match: "91%", research: "Superconducting heterostructures and Josephson effects." },
  { initials: "HP", name: "Hye-Jin Park",   dept: "Condensed Matter · Princeton", match: "87%", research: "Quantum Hall states in moiré graphene." },
];

function ProfMock() {
  return (
    <div className="mini-app">
      <div className="mini-app-head">
        <span className="chip-dot"></span>
        <span className="label">14 ranked · 3 selected</span>
      </div>
      {PROF_LIST.map((p, i) => (
        <div key={i} className={`prof-row ${p.selected ? "selected" : ""}`}>
          <div className="prof-avatar">{p.initials}</div>
          <div className="prof-body">
            <div className="prof-name">{p.name}</div>
            <div className="prof-dept">{p.dept}</div>
            <div className="prof-research">{p.research}</div>
          </div>
          <div className="match-badge">{p.match}</div>
        </div>
      ))}
    </div>
  );
}

function EmailMock() {
  return (
    <div className="mini-app">
      <div className="mini-app-head">
        <span className="chip-dot"></span>
        <span className="label">Draft 1 of 5</span>
      </div>
      <div className="email-meta">
        <div className="email-meta-row">
          <span className="k">To</span>
          <span className="v">m.hartwell@stanford.edu</span>
        </div>
        <div className="email-meta-row">
          <span className="k">Subject</span>
          <span className="v">Undergraduate interest — topological STM measurements</span>
        </div>
      </div>
      <div className="email-body">
        Dear Professor Hartwell,<br /><br />
        I&apos;m a sophomore physics major at UC Berkeley with two semesters of cryogenic STM work, and your group&apos;s recent paper on edge modes in WTe₂ was the most exciting thing I read last quarter.<br /><br />
        I&apos;d love to ask about a summer position…
      </div>
      <div className="email-actions">
        <button className="approve">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Approve
        </button>
        <button className="edit">Edit</button>
        <button className="skip">Skip</button>
      </div>
    </div>
  );
}

const TRACK_ROWS = [
  { name: "Maya Hartwell",  uni: "Stanford",  status: "positive", label: "Positive Reply" },
  { name: "Daniel Okonkwo", uni: "MIT",       status: "positive", label: "Positive Reply" },
  { name: "Hye-Jin Park",   uni: "Princeton", status: "neutral",  label: "No Response" },
  { name: "Elena Russo",    uni: "Columbia",  status: "positive", label: "Positive Reply" },
  { name: "Tobias Mehring", uni: "Caltech",   status: "neutral",  label: "No Response" },
];

function TrackMock() {
  return (
    <div className="mini-app">
      <div className="mini-app-head">
        <span className="chip-dot"></span>
        <span className="label">Last 30 days</span>
      </div>
      <div className="track-stat">
        <div>
          <div className="l">Response rate</div>
          <div className="v" style={{ marginTop: 4 }}>42%</div>
        </div>
        <span className="change" style={{ marginLeft: "auto" }}>+8% this month</span>
      </div>
      <div className="track-table">
        {TRACK_ROWS.map((r, i) => (
          <div key={i} className="track-row">
            <div className="who">
              {r.name}
              <span className="uni">{r.uni}</span>
            </div>
            <div className={`status-pill ${r.status}`}>
              <span className="pd"></span>
              {r.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FAQ ───────────────────────────────────────────────────────
const FAQS = [
  { q: "How does Squibble find professors?", a: "Squibble uses AI to search the faculty pages of any university and rank professors by how well they match your research interests and background." },
  { q: "Will the emails actually sound like me?", a: "Yes. Every email is written using your specific profile, your coursework, your experience, and the professor's actual research. No two emails are the same." },
  { q: "What happens after a professor replies?", a: "Squibble detects the reply instantly via Gmail and classifies it as positive or negative. You see it in your dashboard and can reply directly." },
  { q: "Is my Gmail data private?", a: "Squibble only reads replies from professors you contacted through the platform. We never access any other emails in your inbox." },
  { q: "Can I use this for paid internships or just unpaid research?", a: "Both. You choose the position type when setting up each campaign." },
];

function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <div className="faq-list">
      {FAQS.map((f, i) => (
        <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
          <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            <span>{f.q}</span>
            <span className="faq-toggle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
          </button>
          <div className="faq-a">
            <div className="faq-a-inner">{f.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Reveal hook ───────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ─── Social proof ──────────────────────────────────────────────
/* MARQUEE DATA + COMPONENTS — commented out, restore to re-enable scrolling tickers
const UNIS = [
  { name: "Columbia",      logo: "/landing/logos/columbia.png" },
  { name: "Yale",          logo: "/landing/logos/yale.png" },
  { name: "Stanford",      logo: "/landing/logos/stanford.png" },
  { name: "MIT",           logo: "/landing/logos/mit.png" },
  { name: "Princeton",     logo: "/landing/logos/princeton.png" },
  { name: "Harvard",       logo: "/landing/logos/harvard.png" },
  { name: "UC Berkeley",   logo: "/landing/logos/berkeley.png" },
  { name: "Caltech",       logo: "/landing/logos/caltech.png" },
  { name: "Johns Hopkins", logo: "/landing/logos/johns-hopkins.png" },
  { name: "Chicago",       logo: "/landing/logos/chicago.png" },
];

const FIELDS = [
  "Condensed Matter Physics", "Behavioral Economics", "Computational Neuroscience",
  "Machine Learning", "Quantum Computing", "Cell Biology", "Political Theory",
  "Astrophysics", "Climate Science", "Cognitive Psychology",
];

function LogoTicker({ items, reverse }: { items: typeof UNIS; reverse: boolean }) {
  const seq = [...items, ...items];
  return (
    <div className="ticker-row logos">
      <div className={`ticker ${reverse ? "reverse" : ""}`}>
        {seq.map((it, i) => (
          <span key={i} className="ticker-logo">
            <img src={it.logo} alt={it.name} />
          </span>
        ))}
      </div>
    </div>
  );
}

function Ticker({ items, reverse }: { items: string[]; reverse: boolean }) {
  const seq = [...items, ...items];
  return (
    <div className={`ticker-row ${reverse ? "fields" : "unis"}`}>
      <div className={`ticker ${reverse ? "reverse" : ""}`}>
        {seq.map((it, i) => (
          <span key={i} className="ticker-item">
            {it}
            <span className="ticker-dot"></span>
          </span>
        ))}
      </div>
    </div>
  );
}
*/

// ─── Proof card ────────────────────────────────────────────────
function ProofCard() {
  return (
    <div className="proof-image reveal">
      <img src="/landing/proof-email.png" alt="Real reply email from a professor" />
    </div>
  );
}

// ─── Pricing helpers ───────────────────────────────────────────
function Check() {
  return (
    <span className="ck">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function ArrowRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

const FREE_FEATURES = [
  "3 professor searches",
  "2 personalized emails",
  "Basic reply tracking",
  "Gmail integration",
];
const PRO_FEATURES = [
  "Unlimited professor searches",
  "Unlimited personalized emails",
  "Full reply tracking dashboard",
  "Follow-up automation",
  "Priority email drafting",
];

// ─── Landing page ──────────────────────────────────────────────
export default function LandingPage() {
  useReveal();

  return (
    <div className="lp-page">
      <Nav />

      {/* HERO */}
      <section className="hero" data-screen-label="01 Hero">
        <div className="hero-grid">
          <div className="hero-left">
            <h1 className="hero-headline">Land Research Positions</h1>
            <p className="hero-sub">Squibble finds professors, contacts them, and gets you replies.</p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={handleGoogleLogin}>
                Get Started <ArrowRight />
              </button>
              <a className="btn btn-secondary" href="#product">See How It Works</a>
            </div>
          </div>
          <div className="hero-right">
            <NodeDiagram />
          </div>
        </div>
      </section>

      {/* PRODUCT DEMO */}
      <section className="demo" id="product" data-screen-label="02 Demo">
        <div className="container">
          <div className="section-header reveal">
            <div className="eyebrow"><span className="dot"></span>How it works</div>
            <h2>See Squibble in action</h2>
            <p>From profile to professor reply in minutes.</p>
          </div>
          <div className="demo-grid">
            <div className="demo-card reveal">
              <div className="demo-step">01 · Build your profile</div>
              <div className="demo-title">Tell Squibble who you are.</div>
              <FormMock />
            </div>
            <div className="demo-card reveal">
              <div className="demo-step">02 · Find ranked professors</div>
              <div className="demo-title">Faculty matched to your background.</div>
              <ProfMock />
            </div>
            <div className="demo-card reveal">
              <div className="demo-step">03 · Review your emails</div>
              <div className="demo-title">Personalized drafts, ready to send.</div>
              <EmailMock />
            </div>
            <div className="demo-card reveal">
              <div className="demo-step">04 · Track replies</div>
              <div className="demo-title">Every response, classified.</div>
              <TrackMock />
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="social" data-screen-label="03 Social proof">
        <div className="container">
          <div className="social-label">Research opportunities landed at</div>
          {/* MARQUEE TICKERS — commented out, restore with LogoTicker/Ticker components above
          <LogoTicker items={UNIS} reverse={false} />
          <div style={{ height: 20 }} />
          <Ticker items={FIELDS} reverse={true} />
          */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, justifyContent: "center", padding: "24px 0" }}>
            <span className="ticker-logo">
              <img src="/landing/logos/columbia.png" alt="Columbia" />
            </span>
            <span className="ticker-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Condensed Matter Physics
            </span>
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section className="proof" data-screen-label="04 Proof">
        <div className="container">
          <div className="section-header reveal">
            <div className="eyebrow"><span className="dot"></span>Proven results</div>
            <h2>Real replies from real professors.</h2>
          </div>
          <ProofCard />
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" data-screen-label="05 Pricing">
        <div className="container-narrow">
          <div className="section-header reveal">
            <div className="eyebrow"><span className="dot"></span>Pricing</div>
            <h2>Simple pricing</h2>
            <p>Start free. Upgrade when you&apos;re ready.</p>
          </div>
          <div className="pricing-grid">
            <div className="price-card reveal">
              <div className="price-name">Starter</div>
              <div className="price-amount">
                <span className="num">$0</span>
                <span className="per">forever</span>
              </div>
              <div className="price-sub">No credit card required.</div>
              <ul className="price-features">
                {FREE_FEATURES.map((f, i) => <li key={i}><Check />{f}</li>)}
              </ul>
              <button className="price-cta" onClick={handleGoogleLogin}>Get started free</button>
            </div>
            <div className="price-card featured reveal">
              <div className="price-tag">Most popular</div>
              <div className="price-name">Pro</div>
              <div className="price-amount">
                <span className="num">$12</span>
                <span className="per">/ month</span>
              </div>
              <div className="price-sub">For serious applicants.</div>
              <ul className="price-features">
                {PRO_FEATURES.map((f, i) => <li key={i}><Check />{f}</li>)}
              </ul>
              <button className="price-cta" onClick={handleGoogleLogin}>Upgrade to Pro</button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section data-screen-label="06 FAQ">
        <div className="container-narrow">
          <div className="section-header reveal">
            <div className="eyebrow"><span className="dot"></span>FAQ</div>
            <h2>Questions? Answered.</h2>
          </div>
          <div className="reveal">
            <FAQ />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="company" data-screen-label="08 Footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="mark-row">
              <Mark height={28} />
              <span className="name">Squibble</span>
            </div>
            <div className="tag">Land research positions, effortlessly.</div>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li><a href="#">Features</a></li>
              <li><a href="#">How it works</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#">Changelog</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <ul>
              <li><a href="#">FAQ</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Support</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          © 2025 Squibble. Built for students, by students.
        </div>
      </footer>
    </div>
  );
}
