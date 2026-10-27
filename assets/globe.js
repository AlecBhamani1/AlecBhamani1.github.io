// Restored connected-world background from the original portfolio.
// Real coastlines (Natural Earth 110m) drawn with a d3-geo orthographic
// projection, glowing city lights at real coordinates, and animated
// "internet connection" arcs. Motion stays on the globe — nothing drifts
// across the screen. Falls back to a plain dark backdrop if assets fail.
(function () {
  const canvas = document.getElementById("globe-canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const TILT = -22;        // degrees; tilts the view slightly north
  const START_LON = -12;   // initial center longitude — Europe / Africa facing us
  const SPIN = 3.2;        // degrees per second — slow, contained rotation

  // Real coordinates [longitude, latitude] of major world cities.
  const CITIES = [
    [-74.0, 40.7], [-118.2, 34.0], [-87.6, 41.8], [-79.4, 43.7], [-99.1, 19.4],
    [-46.6, -23.5], [-58.4, -34.6], [-0.12, 51.5], [2.35, 48.85], [-3.7, 40.4],
    [13.4, 52.5], [12.5, 41.9], [37.6, 55.75], [28.98, 41.0], [31.24, 30.05],
    [3.39, 6.45], [28.05, -26.2], [36.82, -1.29], [55.27, 25.2], [72.88, 19.07],
    [77.21, 28.6], [103.82, 1.35], [100.5, 13.75], [114.17, 22.3], [121.47, 31.23],
    [116.4, 39.9], [139.69, 35.69], [126.98, 37.57], [151.21, -33.87], [106.85, -6.21]
  ];

  let width = 0, height = 0, cx = 0, cy = 0, R = 0;
  let projection = null, path = null;
  let geoFill = null, geoCoast = null, geoBorders = null, graticule = null;
  let ready = false;
  let cityState = [];
  let travelers = [];
  let animationFrame = 0;
  let elapsed = 0;
  let lastTime = null;

  function buildExtras() {
    cityState = CITIES.map(function () { return { tw: Math.random() * Math.PI * 2 }; });
    travelers = [];
    for (let i = 0; i < 8; i += 1) travelers.push(makeTraveler(i * 420));
  }

  // Angular length of a hop, in radians (0..PI) — used to pace each hop.
  function geoDist(a, b) {
    return (typeof d3 !== "undefined" && d3.geoDistance) ? d3.geoDistance(a, b) : 1;
  }

  // A traveler never disappears: it rides one arc, then bounces on to the
  // next city, hop after hop. Longer hops take a little longer to cross.
  function hopDur(a, b) {
    return 1500 + (geoDist(CITIES[a], CITIES[b]) / Math.PI) * 2400;
  }

  function makeTraveler(delay) {
    const from = (Math.random() * CITIES.length) | 0;
    let to = (Math.random() * CITIES.length) | 0;
    if (to === from) to = (to + 1) % CITIES.length;
    return { from: from, to: to, start: -delay, dur: hopDur(from, to),
             prevFrom: -1, prevTo: -1, prevEnd: -1e9 };
  }

  // Pick the next stop, preferring cities on the near side of the globe so
  // the connection keeps bouncing across what the viewer can actually see.
  function pickNext(from, center) {
    const visible = [];
    for (let i = 0; i < CITIES.length; i += 1) {
      if (i === from) continue;
      if (Math.cos(geoDist(CITIES[i], center)) > 0.12) visible.push(i);
    }
    const pool = visible.length ? visible : CITIES.map(function (_, i) { return i; });
    let next = pool[(Math.random() * pool.length) | 0];
    if (next === from) next = (from + 1) % CITIES.length;
    return next;
  }

  function resizeCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const compact = width < 760;
    R = compact
      ? Math.min(width * 0.46, height * 0.34)
      : Math.min(width * 0.30, height * 0.46, 460);
    cx = compact ? width * 0.68 : width * 0.78;
    cy = compact ? Math.min(height * 0.68, 630) : Math.min(height * 0.46, 390);

    if (projection) projection.scale(R).translate([cx, cy]);
    if (!cityState.length) buildExtras();
  }

  function quad(p0, p1, cxp, cyp, u) {
    const m = 1 - u;
    return {
      x: m * m * p0[0] + 2 * m * u * cxp + u * u * p1[0],
      y: m * m * p0[1] + 2 * m * u * cyp + u * u * p1[1]
    };
  }

  // Draw one connection arc (lifting off the surface). When withPacket is
  // true, a glowing packet rides along it at position t (0..1). The arc
  // stays lit for the whole hop and only dims as an endpoint nears the limb.
  function drawArc(ai, bi, center, t, intensity, withPacket) {
    const ca = CITIES[ai], cb = CITIES[bi];
    const fa = Math.cos(d3.geoDistance(ca, center));
    const fb = Math.cos(d3.geoDistance(cb, center));
    if (fa <= 0.02 || fb <= 0.02) return;

    const pa = projection(ca), pb = projection(cb);
    const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
    const ddx = mx - cx, ddy = my - cy;
    const lift = 1 + 0.22 + Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) / (R * 7);
    const ctrlX = cx + ddx * lift, ctrlY = cy + ddy * lift;
    const fade = Math.min(1, fa / 0.18) * Math.min(1, fb / 0.18) * intensity;

    ctx.strokeStyle = "rgba(175, 190, 207, " + (0.34 * fade) + ")";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(pa[0], pa[1]);
    ctx.quadraticCurveTo(ctrlX, ctrlY, pb[0], pb[1]);
    ctx.stroke();

    if (!withPacket) return;

    const head = quad(pa, pb, ctrlX, ctrlY, t);
    const tail = quad(pa, pb, ctrlX, ctrlY, Math.max(0, t - 0.12));
    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, "rgba(190, 204, 220, 0)");
    grad.addColorStop(1, "rgba(220, 229, 239, " + (0.95 * fade) + ")");
    ctx.strokeStyle = grad; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();

    ctx.fillStyle = "rgba(234, 240, 247, " + fade + ")";
    ctx.beginPath(); ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  function drawGlobe(elapsed) {
    ctx.clearRect(0, 0, width, height);

    // Atmosphere glow.
    const glow = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.45);
    glow.addColorStop(0, "rgba(152, 172, 197, 0.14)");
    glow.addColorStop(0.55, "rgba(132, 153, 178, 0.06)");
    glow.addColorStop(1, "rgba(152, 172, 197, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.45, 0, Math.PI * 2); ctx.fill();

    // Ocean sphere, lit from the upper-left.
    const body = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.05, cx, cy, R * 1.02);
    body.addColorStop(0, "rgba(23, 28, 34, 1)");
    body.addColorStop(0.55, "rgba(13, 17, 22, 1)");
    body.addColorStop(1, "rgba(8, 11, 15, 1)");
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    if (ready) {
      const lon = START_LON + (elapsed / 1000) * SPIN;
      projection.rotate([lon, TILT, 0]);

      // Graticule (faint globe grid).
      ctx.beginPath(); path(graticule);
      ctx.strokeStyle = "rgba(150, 168, 190, 0.07)";
      ctx.lineWidth = 0.6; ctx.stroke();

      // Land fill (real continents).
      ctx.beginPath(); path(geoFill);
      ctx.fillStyle = "rgba(34, 42, 53, 0.92)";
      ctx.fill();

      // Country borders (faint).
      ctx.beginPath(); path(geoBorders);
      ctx.strokeStyle = "rgba(152, 172, 197, 0.12)";
      ctx.lineWidth = 0.5; ctx.stroke();

      // Coastlines (silver outline).
      ctx.beginPath(); path(geoCoast);
      ctx.strokeStyle = "rgba(174, 192, 214, 0.42)";
      ctx.lineWidth = 0.9; ctx.stroke();

      const rot = projection.rotate();
      const center = [-rot[0], -rot[1]];

      // City lights.
      for (let i = 0; i < CITIES.length; i += 1) {
        const front = Math.cos(d3.geoDistance(CITIES[i], center));
        if (front <= 0.04) continue;
        const p = projection(CITIES[i]);
        const twinkle = 0.62 + 0.38 * Math.sin(elapsed * 0.002 + cityState[i].tw);
        const aa = (0.3 + 0.7 * front) * twinkle;
        const r = 1.0 + 1.1 * front;
        const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 4);
        g.addColorStop(0, "rgba(214, 226, 241, " + aa + ")");
        g.addColorStop(0.5, "rgba(156, 179, 208, " + (aa * 0.42) + ")");
        g.addColorStop(1, "rgba(156, 179, 208, 0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p[0], p[1], r * 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(234, 240, 247, " + Math.min(1, aa + 0.18) + ")";
        ctx.beginPath(); ctx.arc(p[0], p[1], r * 0.6, 0, Math.PI * 2); ctx.fill();
      }

      // Connections that keep bouncing place to place — each traveler rides
      // an arc, then hops on to the next city without ever vanishing.
      for (let i = 0; i < travelers.length; i += 1) {
        const tr = travelers[i];
        let t = (elapsed - tr.start) / tr.dur;

        // Advance through any hops that completed since the last frame.
        let guard = 0;
        while (t >= 1 && guard < 6) {
          tr.prevFrom = tr.from; tr.prevTo = tr.to; tr.prevEnd = tr.start + tr.dur;
          tr.from = tr.to;
          tr.to = pickNext(tr.from, center);
          tr.start += tr.dur;
          tr.dur = hopDur(tr.from, tr.to);
          t = (elapsed - tr.start) / tr.dur;
          guard += 1;
        }
        if (t >= 1) { tr.start = elapsed; t = 0; }  // resync after a long pause
        if (t < 0) continue;                        // still in its start delay

        // Brief afterglow of the hop just finished, so the path feels linked.
        const since = elapsed - tr.prevEnd;
        if (tr.prevFrom >= 0 && since < 520) {
          drawArc(tr.prevFrom, tr.prevTo, center, 1, (1 - since / 520) * 0.5, false);
        }

        drawArc(tr.from, tr.to, center, t, 1, true);
      }
    }

    // Bright rim crescent (top atmosphere highlight).
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 0.86, Math.PI * 1.7);
    ctx.strokeStyle = "rgba(214, 226, 240, 0.42)";
    ctx.lineWidth = 1.6;
    ctx.shadowColor = "rgba(222, 233, 247, 0.5)"; ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();
  }

  function loop(time) {
    if (lastTime !== null) elapsed += Math.min(time - lastTime, 64);
    lastTime = time;
    drawGlobe(elapsed);
    animationFrame = requestAnimationFrame(loop);
  }

  function restartAnimation() {
    cancelAnimationFrame(animationFrame);
    lastTime = null;
    resizeCanvas();
    if (document.hidden) return;
    if (reducedMotion.matches) {
      drawGlobe(0);   // static frame: Europe / Africa centered
    } else {
      animationFrame = requestAnimationFrame(loop);
    }
  }

  function init() {
    try {
      if (typeof d3 === "undefined" || typeof topojson === "undefined") return;
      fetch("assets/globe/countries-110m.json")
        .then(function (r) { return r.json(); })
        .then(function (world) {
          const obj = world.objects.countries;
          geoFill = topojson.merge(world, obj.geometries);
          geoCoast = topojson.mesh(world, obj, function (a, b) { return a === b; });
          geoBorders = topojson.mesh(world, obj, function (a, b) { return a !== b; });
          graticule = d3.geoGraticule10();
          projection = d3.geoOrthographic().clipAngle(90).precision(0.5)
            .scale(R).translate([cx, cy]);
          path = d3.geoPath(projection, ctx);
          ready = true;
          restartAnimation();
        })
        .catch(function () { /* keep the plain dark backdrop */ });
    } catch (e) { /* keep the plain dark backdrop */ }
  }

  document.addEventListener("visibilitychange", restartAnimation);
  window.addEventListener("resize", restartAnimation);
  reducedMotion.addEventListener("change", restartAnimation);
  resizeCanvas();
  restartAnimation();   // draw the ocean immediately while coastlines load
  init();
})();
