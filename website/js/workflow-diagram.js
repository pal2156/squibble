// Animated hero diagram: a comet travels a spline through five workflow
// stations (profile → match → draft → send → reply), looping forever.
// Ported 1:1 from the original React component — same math, same timings —
// just re-targeted at plain DOM nodes instead of refs.
(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";

  const STATION_ICONS = {
    profile: "assets/workflow-icons/profile.png",
    match: "assets/workflow-icons/field.png",
    draft: "assets/workflow-icons/draft.png",
    send: "assets/workflow-icons/send.png",
    reply: "assets/workflow-icons/reply.png",
  };

  const STATIONS = [
    { x: 138, y: 74, icon: "profile", label: "Profile", status: "Building your profile…" },
    { x: 350, y: 158, icon: "match", label: "Match", status: "Finding faculty…" },
    { x: 130, y: 250, icon: "draft", label: "Draft", status: "Drafting emails…" },
    { x: 352, y: 344, icon: "send", label: "Send", status: "Sending…" },
    { x: 160, y: 428, icon: "reply", label: "Reply", status: "Tracking replies…" },
  ];

  function buildPath(pts) {
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x} ${p2.y}`;
    }
    return d;
  }
  const PATH_D = buildPath(STATIONS);

  const C_WHITE = [255, 255, 255];
  const C_TEAL = [103, 142, 141];
  const C_SKY = [187, 210, 221];
  const C_JET = [35, 44, 51];
  const C_SLATE = [60, 83, 82];

  function mix(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }
  function smoothstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  function el(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function mount(container) {
    const wrap = document.createElement("div");
    wrap.className = "wd-wrap";

    const status = document.createElement("div");
    status.className = "wd-status";
    status.innerHTML = `<span class="wd-spinner" aria-hidden="true"></span><span class="wd-label" data-wd-status>${STATIONS[0].status}</span>`;
    wrap.appendChild(status);

    const svg = el("svg", { class: "wd-svg", viewBox: "0 0 480 480", "aria-hidden": "true" });

    const defs = el("defs", {});
    const filter = el("filter", { id: "wd-comet-glow", x: "-120%", y: "-120%", width: "340%", height: "340%" });
    filter.appendChild(el("feGaussianBlur", { stdDeviation: "4", result: "b" }));
    const merge = el("feMerge", {});
    merge.appendChild(el("feMergeNode", { in: "b" }));
    merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
    filter.appendChild(merge);
    defs.appendChild(filter);
    svg.appendChild(defs);

    const base = el("path", {
      d: PATH_D, fill: "none", stroke: "#BBD2DD", "stroke-width": "2",
      "stroke-linecap": "round", "stroke-dasharray": "1 8", opacity: "0.7",
    });
    svg.appendChild(base);

    const trail = el("path", { d: PATH_D, fill: "none", stroke: "#678E8D", "stroke-width": "2.5", "stroke-linecap": "round" });
    trail.style.opacity = "0";
    trail.setAttribute("data-trail", "");
    svg.appendChild(trail);

    const comet = el("g", {});
    comet.setAttribute("data-comet", "");
    comet.style.opacity = "0";
    comet.appendChild(el("circle", { r: "11", fill: "#678E8D", opacity: "0.16", filter: "url(#wd-comet-glow)" }));
    comet.appendChild(el("circle", { r: "6", fill: "#678E8D", opacity: "0.9" }));
    comet.appendChild(el("circle", { r: "2.6", fill: "#FFFFFF" }));
    svg.appendChild(comet);

    STATIONS.forEach((s, i) => {
      const g = el("g", { transform: `translate(${s.x} ${s.y})` });
      g.setAttribute("data-station", String(i));

      const ring = el("circle", { r: "24", fill: "none", stroke: "#678E8D", "stroke-width": "1.4" });
      ring.style.opacity = "0";
      ring.setAttribute("data-ring", "");
      g.appendChild(ring);

      const scale = el("g", { transform: "scale(0.9)" });
      scale.setAttribute("data-scale", "");
      const tile = el("rect", { x: "-23", y: "-23", width: "46", height: "46", rx: "13", fill: "#FFFFFF", stroke: "#BBD2DD", "stroke-width": "1.4" });
      tile.setAttribute("data-tile", "");
      scale.appendChild(tile);
      const iconG = el("g", {});
      iconG.setAttribute("data-icon", "");
      iconG.style.color = "rgb(35,44,51)";
      const image = el("image", { x: "-13", y: "-13", width: "26", height: "26", preserveAspectRatio: "xMidYMid meet" });
      image.setAttributeNS("http://www.w3.org/1999/xlink", "href", STATION_ICONS[s.icon]);
      image.setAttribute("href", STATION_ICONS[s.icon]);
      iconG.appendChild(image);
      scale.appendChild(iconG);
      g.appendChild(scale);

      const badgeG = el("g", { transform: "translate(20 -20)" });
      const badge = el("circle", { r: "9", fill: "#BBD2DD" });
      badge.setAttribute("data-badge", "");
      badgeG.appendChild(badge);
      const badgeText = el("text", { "text-anchor": "middle", y: "3.2", "font-size": "10", "font-weight": "700", fill: "#FFFFFF" });
      badgeText.style.fontFamily = "inherit";
      badgeText.textContent = String(i + 1);
      badgeG.appendChild(badgeText);
      g.appendChild(badgeG);

      const label = el("text", { "text-anchor": "middle", y: "42", "font-size": "13", "font-weight": "600", fill: "#3C5352", "letter-spacing": "-0.01em" });
      label.setAttribute("data-label", "");
      label.style.fontFamily = "inherit";
      label.style.opacity = "0.55";
      label.textContent = s.label;
      g.appendChild(label);

      svg.appendChild(g);
    });

    wrap.appendChild(svg);
    container.appendChild(wrap);

    animate(svg, base, status.querySelector("[data-wd-status]"));
  }

  function animate(svg, base, statusLabel) {
    const LOOP = 7200;
    const REST = 1300;
    const TRAIL = 132;

    let totalLen = 0;
    let stationLens = [];
    const ringTime = STATIONS.map(() => -9999);
    const act = STATIONS.map(() => 0);
    let lastLen = 0;
    let start = performance.now();
    let last = performance.now();
    let activeIdx = 0;

    function tick(now) {
      const dt = Math.min(now - last, 40);
      last = now;

      let L = totalLen;
      if (!L) {
        L = base.getTotalLength();
        if (!L) { requestAnimationFrame(tick); return; }
        totalLen = L;
        const best = STATIONS.map(() => ({ d: Infinity, len: 0 }));
        for (let l = 0; l <= L; l += 2) {
          const pt = base.getPointAtLength(l);
          STATIONS.forEach((s, i) => {
            const d2 = (pt.x - s.x) ** 2 + (pt.y - s.y) ** 2;
            if (d2 < best[i].d) { best[i].d = d2; best[i].len = l; }
          });
        }
        stationLens = best.map((b) => b.len);
        start = now;
      }

      const cycle = LOOP + REST;
      const cyclePos = (now - start) % cycle;
      const traveling = cyclePos < LOOP;
      const progLen = (traveling ? cyclePos / LOOP : 1) * L;

      const prevLen = lastLen;
      const restarted = progLen < prevLen - 1;
      if (!restarted) {
        stationLens.forEach((sl, i) => {
          if (prevLen < sl && progLen >= sl) ringTime[i] = now;
        });
      }
      lastLen = progLen;

      const comet = svg.querySelector("[data-comet]");
      if (comet) {
        const pt = base.getPointAtLength(Math.min(progLen, L));
        comet.setAttribute("transform", `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)})`);
        comet.style.opacity = (traveling ? 1 : 1 - smoothstep(0, REST * 0.6, cyclePos - LOOP)).toFixed(3);
      }

      const trail = svg.querySelector("[data-trail]");
      if (trail) {
        trail.setAttribute("stroke-dasharray", `${TRAIL} ${L + TRAIL}`);
        trail.setAttribute("stroke-dashoffset", (TRAIL - progLen).toFixed(2));
        trail.style.opacity = (0.9 * (traveling ? 1 : 1 - smoothstep(0, REST * 0.7, cyclePos - LOOP))).toFixed(3);
      }

      let curActive = 0;
      STATIONS.forEach((_, i) => {
        const targetAct = progLen >= stationLens[i] - 0.5 ? 1 : 0;
        const k = Math.min(1, dt / 260);
        act[i] += (targetAct - act[i]) * k;
        if (progLen >= stationLens[i] - 0.5) curActive = i;

        const g = svg.querySelector(`[data-station="${i}"]`);
        if (!g) return;

        const tile = g.querySelector("[data-tile]");
        const iconG = g.querySelector("[data-icon]");
        const label = g.querySelector("[data-label]");
        const scale = g.querySelector("[data-scale]");
        const ring = g.querySelector("[data-ring]");
        const badge = g.querySelector("[data-badge]");

        if (tile) { tile.setAttribute("fill", mix(C_WHITE, C_TEAL, act[i])); tile.setAttribute("stroke", mix(C_SKY, C_TEAL, act[i])); }
        if (iconG) iconG.style.color = mix(C_JET, C_WHITE, act[i]);
        if (label) { label.setAttribute("fill", mix(C_SLATE, C_JET, act[i])); label.style.opacity = (0.55 + 0.45 * act[i]).toFixed(3); }
        if (badge) badge.setAttribute("fill", mix(C_SKY, C_TEAL, act[i]));
        if (scale) scale.setAttribute("transform", `scale(${(0.9 + 0.12 * act[i]).toFixed(3)})`);

        if (ring) {
          const age = now - ringTime[i];
          if (age >= 0 && age < 760) {
            const tt = age / 760;
            ring.setAttribute("r", (24 + 26 * tt).toFixed(1));
            ring.style.opacity = ((1 - tt) * 0.55).toFixed(3);
          } else {
            ring.style.opacity = "0";
          }
        }
      });

      if (traveling && curActive !== activeIdx) {
        activeIdx = curActive;
        if (statusLabel) {
          statusLabel.textContent = STATIONS[activeIdx].status;
          statusLabel.style.animation = "none";
          // Force reflow so the fade-in keyframe restarts on each station change.
          void statusLabel.offsetWidth;
          statusLabel.style.animation = "";
        }
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector("[data-workflow-diagram]");
    if (container) mount(container);
  });
})();
