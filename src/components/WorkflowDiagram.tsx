'use client';

import React, { useState, useEffect, useRef } from 'react';

// ─── Data ──────────────────────────────────────────────────────
const STATION_ICONS: Record<string, string> = {
  profile: '/workflow-icons/profile.png',
  match:   '/workflow-icons/field.png',
  draft:   '/workflow-icons/draft.png',
  send:    '/workflow-icons/send.png',
  reply:   '/workflow-icons/reply.png',
};

const STATIONS = [
  { x: 138, y: 74,  icon: 'profile', label: 'Profile', status: 'Building your profile…' },
  { x: 350, y: 158, icon: 'match',   label: 'Match',   status: 'Finding faculty…' },
  { x: 130, y: 250, icon: 'draft',   label: 'Draft',   status: 'Drafting emails…' },
  { x: 352, y: 344, icon: 'send',    label: 'Send',    status: 'Sending…' },
  { x: 160, y: 428, icon: 'reply',   label: 'Reply',   status: 'Tracking replies…' },
];

// Catmull-Rom spline through station points
function buildPath(pts: typeof STATIONS) {
  const p = pts.map(s => ({ x: s.x, y: s.y }));
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x} ${p2.y}`;
  }
  return d;
}
const PATH_D = buildPath(STATIONS);

// ─── Color helpers ─────────────────────────────────────────────
const C_WHITE = [255, 255, 255];
const C_TEAL  = [103, 142, 141]; // #678E8D
const C_SKY   = [187, 210, 221]; // #BBD2DD
const C_JET   = [35,  44,  51];  // #232C33
const C_SLATE = [60,  83,  82];  // #3C5352

function mix(a: number[], b: number[], t: number) {
  t = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// ─── Main component ────────────────────────────────────────────
export default function WorkflowDiagram() {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeRef      = useRef(0);
  const svgRef         = useRef<SVGSVGElement>(null);
  const baseRef        = useRef<SVGPathElement>(null);
  const totalLenRef    = useRef(0);
  const stationLenRef  = useRef<number[]>([]);
  const ringTimeRef    = useRef<number[]>(STATIONS.map(() => -9999));
  const actRef         = useRef<number[]>(STATIONS.map(() => 0));
  const lastLenRef     = useRef(0);
  const startRef       = useRef(performance.now());

  // ── Timing (ms) ───────────────────────────────────────────────
  const LOOP  = 7200;
  const REST  = 1300;
  const TRAIL = 132;

  // ── Path measurement + animation rAF loop ─────────────────────
  useEffect(() => {
    let raf: number;
    let last = performance.now();

    const tick = (now: number) => {
      const dt  = Math.min(now - last, 40);
      last = now;
      const svg  = svgRef.current;
      const base = baseRef.current;
      if (!svg || !base) { raf = requestAnimationFrame(tick); return; }

      let L = totalLenRef.current;
      if (!L) {
        L = base.getTotalLength();
        if (!L) { raf = requestAnimationFrame(tick); return; }
        totalLenRef.current = L;
        const best = STATIONS.map(() => ({ d: Infinity, len: 0 }));
        for (let l = 0; l <= L; l += 2) {
          const pt = base.getPointAtLength(l);
          STATIONS.forEach((s, i) => {
            const d2 = (pt.x - s.x) ** 2 + (pt.y - s.y) ** 2;
            if (d2 < best[i].d) { best[i].d = d2; best[i].len = l; }
          });
        }
        stationLenRef.current = best.map(b => b.len);
        startRef.current = now;
      }

      const cycle    = LOOP + REST;
      const cyclePos = (now - startRef.current) % cycle;
      const traveling = cyclePos < LOOP;
      const progLen   = (traveling ? cyclePos / LOOP : 1) * L;

      const stLens   = stationLenRef.current;
      const prevLen  = lastLenRef.current;
      const restarted = progLen < prevLen - 1;

      if (!restarted) {
        stLens.forEach((sl, i) => {
          if (prevLen < sl && progLen >= sl) ringTimeRef.current[i] = now;
        });
      }
      lastLenRef.current = progLen;

      const comet = svg.querySelector('[data-comet]');
      if (comet) {
        const pt = base.getPointAtLength(Math.min(progLen, L));
        comet.setAttribute('transform', `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`);
        (comet as SVGElement).style.opacity = (traveling ? 1 : 1 - smoothstep(0, REST * 0.6, cyclePos - LOOP)).toFixed(3);
      }

      const trail = svg.querySelector('[data-trail]');
      if (trail) {
        trail.setAttribute('stroke-dasharray', `${TRAIL} ${L + TRAIL}`);
        trail.setAttribute('stroke-dashoffset', (TRAIL - progLen).toFixed(2));
        (trail as SVGElement).style.opacity = (0.9 * (traveling ? 1 : 1 - smoothstep(0, REST * 0.7, cyclePos - LOOP))).toFixed(3);
      }

      let curActive = 0;
      STATIONS.forEach((_, i) => {
        const targetAct = progLen >= stLens[i] - 0.5 ? 1 : 0;
        const k   = Math.min(1, dt / 260);
        const act = actRef.current[i] + (targetAct - actRef.current[i]) * k;
        actRef.current[i] = act;
        if (progLen >= stLens[i] - 0.5) curActive = i;

        const g = svg.querySelector(`[data-station="${i}"]`);
        if (!g) return;

        const tile  = g.querySelector('[data-tile]');
        const iconG = g.querySelector('[data-icon]');
        const label = g.querySelector('[data-label]');
        const scale = g.querySelector('[data-scale]');
        const ring  = g.querySelector('[data-ring]');
        const badge = g.querySelector('[data-badge]');

        if (tile)  { tile.setAttribute('fill', mix(C_WHITE, C_TEAL, act)); tile.setAttribute('stroke', mix(C_SKY, C_TEAL, act)); }
        if (iconG) { (iconG as SVGElement).style.color = mix(C_JET, C_WHITE, act); }
        if (label) { label.setAttribute('fill', mix(C_SLATE, C_JET, act)); (label as SVGElement).style.opacity = (0.55 + 0.45 * act).toFixed(3); }
        if (badge) { badge.setAttribute('fill', mix(C_SKY, C_TEAL, act)); }
        if (scale) { scale.setAttribute('transform', `scale(${(0.9 + 0.12 * act).toFixed(3)})`); }

        if (ring) {
          const age = now - ringTimeRef.current[i];
          if (age >= 0 && age < 760) {
            const tt = age / 760;
            ring.setAttribute('r', (24 + 26 * tt).toFixed(1));
            (ring as SVGElement).style.opacity = ((1 - tt) * 0.55).toFixed(3);
          } else {
            (ring as SVGElement).style.opacity = '0';
          }
        }
      });

      if (traveling && curActive !== activeRef.current) {
        activeRef.current = curActive;
        setActiveIdx(curActive);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="wd-wrap">
      <div className="wd-status">
        <span className="wd-spinner" aria-hidden="true" />
        <span className="wd-label" key={STATIONS[activeIdx].status}>
          {STATIONS[activeIdx].status}
        </span>
      </div>

      <svg ref={svgRef} className="wd-svg" viewBox="0 0 480 480" aria-hidden="true">
        <defs>
          <filter id="wd-comet-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* dashed base path */}
        <path ref={baseRef} d={PATH_D} fill="none"
              stroke="#BBD2DD" strokeWidth="2" strokeLinecap="round"
              strokeDasharray="1 8" opacity="0.7" />

        {/* teal trail */}
        <path data-trail="" d={PATH_D} fill="none"
              stroke="#678E8D" strokeWidth="2.5" strokeLinecap="round"
              style={{ opacity: 0 }} />

        {/* stations */}
        {STATIONS.map((s, i) => (
          <g key={i} data-station={i} transform={`translate(${s.x} ${s.y})`}>
            <circle data-ring="" r="24" fill="none" stroke="#678E8D" strokeWidth="1.4" style={{ opacity: 0 }} />
            <g data-scale="" transform="scale(0.9)">
              <rect data-tile="" x="-23" y="-23" width="46" height="46" rx="13"
                    fill="#FFFFFF" stroke="#BBD2DD" strokeWidth="1.4" />
              <g data-icon="" style={{ color: 'rgb(35,44,51)' }}>
                <image href={STATION_ICONS[s.icon]} x="-13" y="-13" width="26" height="26" preserveAspectRatio="xMidYMid meet" />
              </g>
            </g>
            <g transform="translate(20 -20)">
              <circle data-badge="" r="9" fill="#BBD2DD" />
              <text textAnchor="middle" y="3.2" fontSize="10" fontWeight="700"
                    fill="#FFFFFF" style={{ fontFamily: 'inherit' }}>{i + 1}</text>
            </g>
            <text data-label="" textAnchor="middle" y="42" fontSize="13" fontWeight="600"
                  fill="#3C5352" letterSpacing="-0.01em"
                  style={{ fontFamily: 'inherit', opacity: 0.55 }}>{s.label}</text>
          </g>
        ))}

        {/* comet */}
        <g data-comet="" style={{ opacity: 0 }}>
          <circle r="11" fill="#678E8D" opacity="0.16" filter="url(#wd-comet-glow)" />
          <circle r="6"  fill="#678E8D" opacity="0.9" />
          <circle r="2.6" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  );
}
