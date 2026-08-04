(() => {
  'use strict';

  /* ================= Config ================= */
  const EMOJI_POOL = [
    '😀','😂','🤩','😎','🥳','🤔','😴','🙄','😱','🥶',
    '👍','👏','🔥','✨','🎉','🚀','🌈','⭐','💎','🎯',
    '🍕','🍔','🎮','⚽','🎵','🐱','🐶','🦄','🌸','☀️'
  ];
  const COUNT_PRESETS = [1, 5, 10, 25, 50, 100, 250, 500, 750, 1000, 1250, 1500, 1750, 2000];
  const AUTO_UP = [0, 1, 5, 10, 25, 50, 100, 250, 500, 750, 1000, 1250, 1500, 1750, 2000];
  const AUTO_DOWN = [1750, 1500, 1250, 1000, 750, 500, 250, 100, 50, 25, 10, 5, 1, 0];
  const AUTO_SEQUENCE = AUTO_UP.concat(AUTO_DOWN);
  const SPRITE_SIZE = 40;
  const WARMUP_FRAMES = 15;

  /* ================= DOM refs ================= */
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const el = {
    fpsLive: document.getElementById('fpsLive'),
    fpsDot: document.getElementById('fpsDot'),
    countLive: document.getElementById('countLive'),
    fpsCurrent: document.getElementById('fpsCurrent'),
    fpsMax: document.getElementById('fpsMax'),
    fpsMin: document.getElementById('fpsMin'),
    fpsAvg: document.getElementById('fpsAvg'),
    countCurrent: document.getElementById('countCurrent'),
    countMax: document.getElementById('countMax'),
    countMin: document.getElementById('countMin'),
    countAvg: document.getElementById('countAvg'),
    autoBanner: document.getElementById('autoBanner'),
    autoBannerText: document.getElementById('autoBannerText'),
    autoBannerStep: document.getElementById('autoBannerStep'),
    autoProgressFill: document.getElementById('autoProgressFill'),
    autoStopBtn: document.getElementById('autoStopBtn'),
    controlPanel: document.getElementById('controlPanel'),
    collapseBtn: document.getElementById('collapseBtn'),
    btnGrid: document.getElementById('btnGrid'),
  };

  let dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));

  /* ================= Canvas sizing ================= */
  function resizeCanvas() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const prevDpr = dpr;
    dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (dpr !== prevDpr && Object.keys(spriteCache).length) warmSpriteCache();
    // keep existing particles inside the new bounds
    for (const p of particles) {
      p.x = Math.min(Math.max(p.x, 0), Math.max(w, 1));
      p.y = Math.min(Math.max(p.y, 0), Math.max(h, 1));
    }
  }
  let resizePending = false;
  window.addEventListener('resize', () => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => { resizeCanvas(); resizePending = false; });
  });

  /* ================= Sprite cache ================= */
  const spriteCache = {};
  function buildSprite(char) {
    const c = document.createElement('canvas');
    c.width = SPRITE_SIZE * dpr;
    c.height = SPRITE_SIZE * dpr;
    const cctx = c.getContext('2d');
    cctx.scale(dpr, dpr);
    cctx.font = `${Math.round(SPRITE_SIZE * 0.78)}px sans-serif`;
    cctx.textAlign = 'center';
    cctx.textBaseline = 'middle';
    cctx.fillText(char, SPRITE_SIZE / 2, SPRITE_SIZE / 2 + 2);
    return c;
  }
  function warmSpriteCache() {
    for (const key in spriteCache) delete spriteCache[key];
    EMOJI_POOL.forEach((ch) => { spriteCache[ch] = buildSprite(ch); });
  }

  /* ================= Particles ================= */
  let particles = [];

  function makeParticle(now) {
    const w = Math.max(canvas.clientWidth, 1);
    const h = Math.max(canvas.clientHeight, 1);
    const speed = 35 + Math.random() * 55;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      char: EMOJI_POOL[(Math.random() * EMOJI_POOL.length) | 0],
      size: SPRITE_SIZE * (0.65 + Math.random() * 0.55),
      spawnAt: now,
    };
  }

  function setParticleCount(target, now) {
    target = Math.max(0, Math.round(target));
    if (particles.length < target) {
      while (particles.length < target) particles.push(makeParticle(now));
    } else if (particles.length > target) {
      particles.length = target;
    }
    el.countLive.textContent = particles.length;
    el.countCurrent.textContent = particles.length;
  }

  function updateParticles(dt) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
      else if (p.x > w) { p.x = w; p.vx = -Math.abs(p.vx); }
      if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
      else if (p.y > h) { p.y = h; p.vy = -Math.abs(p.vy); }
    }
  }

  function render(now) {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const sprite = spriteCache[p.char];
      if (!sprite) continue;
      const age = now - p.spawnAt;
      const scale = age < 220 ? Math.min(1, age / 220) : 1;
      const s = p.size * (0.4 + 0.6 * scale);
      ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
    }
  }

  /* ================= FPS + count stats ================= */
  let frameTimes = [];
  let warmup = WARMUP_FRAMES;
  const fpsStats = { current: 0, max: 0, min: Infinity, sum: 0, n: 0 };
  const countStats = { max: 0, min: Infinity, sum: 0, n: 0 };

  function fpsTier(fps) {
    if (fps >= 50) return 'good';
    if (fps >= 30) return 'warn';
    return 'bad';
  }
  const tierColor = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)' };

  function updateFpsUI() {
    const tier = fpsTier(fpsStats.current);
    el.fpsLive.textContent = Math.round(fpsStats.current);
    el.fpsCurrent.textContent = Math.round(fpsStats.current);
    el.fpsCurrent.style.color = tierColor[tier];
    el.fpsMax.textContent = Math.round(fpsStats.max);
    el.fpsMin.textContent = fpsStats.min === Infinity ? 0 : Math.round(fpsStats.min);
    el.fpsAvg.textContent = fpsStats.n ? Math.round(fpsStats.sum / fpsStats.n) : 0;
    el.fpsDot.style.background = tierColor[tier];
    el.fpsDot.style.boxShadow = `0 0 6px ${tierColor[tier]}`;
  }

  function updateCountUI() {
    const n = particles.length;
    if (n > countStats.max) countStats.max = n;
    if (n < countStats.min) countStats.min = n;
    countStats.sum += n;
    countStats.n++;
    el.countMax.textContent = countStats.max === -Infinity ? 0 : countStats.max;
    el.countMin.textContent = countStats.min === Infinity ? 0 : countStats.min;
    el.countAvg.textContent = countStats.n ? Math.round(countStats.sum / countStats.n) : 0;
  }

  function resetStats() {
    fpsStats.current = 0; fpsStats.max = 0; fpsStats.min = Infinity; fpsStats.sum = 0; fpsStats.n = 0;
    countStats.max = -Infinity; countStats.min = Infinity; countStats.sum = 0; countStats.n = 0;
    frameTimes = [];
    warmup = WARMUP_FRAMES;
    updateFpsUI();
  }

  /* ================= Auto sweep state machine ================= */
  let autoState = null; // { mode:'auto'|'auto60', index, stepStartTime, token }
  let autoRunToken = 0;

  function isUpPhase(index) { return index < AUTO_UP.length - 1; }

  function frameStdDev() {
    if (frameTimes.length < 10) return Infinity;
    const recent = frameTimes.slice(-10);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((a, b) => a + (b - mean) * (b - mean), 0) / recent.length;
    return Math.sqrt(variance);
  }

  function startAuto(mode, now) {
    cancelAuto();
    autoRunToken++;
    autoState = { mode, index: 0, stepStartTime: now, token: autoRunToken };
    resetStats();
    setParticleCount(AUTO_SEQUENCE[0], now);
    updateCountUI();
    setActiveKey(mode);
    el.autoBanner.hidden = false;
    el.autoStopBtn.onclick = () => cancelAuto();
    updateAutoBannerUI();
  }

  function cancelAuto() {
    autoState = null;
    el.autoBanner.hidden = true;
  }

  function updateAutoBannerUI() {
    if (!autoState) return;
    const { index, mode } = autoState;
    const phaseLabel = index < AUTO_UP.length ? 'Đang tăng dần' : 'Đang giảm dần';
    const modeLabel = mode === 'auto60' ? 'Auto 60s' : 'Auto';
    el.autoBannerText.textContent = `${modeLabel} · ${phaseLabel} · ${AUTO_SEQUENCE[index]} emoji`;
    el.autoBannerStep.textContent = `${index + 1}/${AUTO_SEQUENCE.length}`;
    el.autoProgressFill.style.width = `${Math.round(((index + 1) / AUTO_SEQUENCE.length) * 100)}%`;
  }

  function advanceAuto(now) {
    const nextIndex = autoState.index + 1;
    if (nextIndex >= AUTO_SEQUENCE.length) {
      el.autoBannerText.textContent = 'Hoàn tất bài đo!';
      el.autoBannerStep.textContent = `${AUTO_SEQUENCE.length}/${AUTO_SEQUENCE.length}`;
      el.autoProgressFill.style.width = '100%';
      autoState.finished = true;
      const token = autoState.token;
      setTimeout(() => {
        // Only clean up if this exact run is still the active one — prevents a
        // stale timeout from a finished run cancelling a fresh restart.
        if (!autoState || autoState.token !== token) return;
        cancelAuto();
        const active = el.btnGrid.querySelector('.preset-btn.active');
        if (active && (active.dataset.key === 'auto' || active.dataset.key === 'auto60')) {
          active.classList.remove('active');
        }
      }, 1400);
      return;
    }
    autoState.index = nextIndex;
    autoState.stepStartTime = now;
    setParticleCount(AUTO_SEQUENCE[nextIndex], now);
    updateAutoBannerUI();
  }

  function tickAuto(now) {
    if (!autoState || autoState.finished) return;
    const elapsed = now - autoState.stepStartTime;

    if (autoState.mode === 'auto60') {
      const timePerStep = 60000 / AUTO_SEQUENCE.length;
      if (elapsed >= timePerStep) advanceAuto(now);
      return;
    }

    // adaptive "auto": wait for lag to settle, faster on the way up, slower on the way down
    const up = isUpPhase(autoState.index);
    const minWait = up ? 450 : 800;
    const maxWait = up ? 1700 : 3200;
    if (elapsed < minWait) return;
    const settled = frameStdDev() < 4;
    if (settled || elapsed >= maxWait) advanceAuto(now);
  }

  /* ================= Buttons ================= */
  function setActiveKey(key) {
    el.btnGrid.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.key === String(key));
    });
  }

  function handlePresetClick(cfg, now) {
    if (cfg.type === 'auto') { startAuto('auto', now); return; }
    if (cfg.type === 'auto60') { startAuto('auto60', now); return; }
    cancelAuto();
    resetStats();
    setParticleCount(cfg.value, now);
    updateCountUI();
    setActiveKey(cfg.key);
  }

  function buildButton(cfg) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn' + (cfg.type !== 'count' ? ' special-btn' : '');
    btn.dataset.key = cfg.key;
    btn.setAttribute('aria-label', cfg.label + (cfg.type === 'count' ? ' emoji' : ''));
    const label = document.createElement('span');
    label.className = 'btn-label';
    label.textContent = cfg.label;
    const check = document.createElement('span');
    check.className = 'check-icon';
    check.setAttribute('aria-hidden', 'true');
    btn.appendChild(label);
    btn.appendChild(check);
    btn.addEventListener('click', () => handlePresetClick(cfg, performance.now()));
    return btn;
  }

  function buildControls() {
    const autoRow = document.createElement('div');
    autoRow.className = 'auto-row';
    autoRow.appendChild(buildButton({ key: 'auto', label: 'Auto', type: 'auto' }));
    autoRow.appendChild(buildButton({ key: 'auto60', label: 'Auto 60s', type: 'auto60' }));

    const numberGrid = document.createElement('div');
    numberGrid.className = 'number-grid';
    COUNT_PRESETS.forEach((n) => {
      numberGrid.appendChild(buildButton({ key: String(n), label: String(n), type: 'count', value: n }));
    });

    el.btnGrid.appendChild(autoRow);
    el.btnGrid.appendChild(numberGrid);
  }

  el.collapseBtn.addEventListener('click', () => {
    const collapsed = el.controlPanel.classList.toggle('collapsed');
    el.collapseBtn.setAttribute('aria-expanded', String(!collapsed));
  });

  /* ================= Main loop ================= */
  let lastTime = performance.now();

  function loop(now) {
    const dtMs = Math.min(now - lastTime, 100);
    lastTime = now;
    const dt = dtMs / 1000;

    frameTimes.push(dtMs);
    if (frameTimes.length > 24) frameTimes.shift();
    const avgDelta = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const smoothedFps = avgDelta > 0 ? 1000 / avgDelta : 0;

    updateParticles(dt);
    render(now);

    if (warmup > 0) {
      warmup--;
    } else {
      fpsStats.current = smoothedFps;
      if (smoothedFps > fpsStats.max) fpsStats.max = smoothedFps;
      if (smoothedFps < fpsStats.min) fpsStats.min = smoothedFps;
      fpsStats.sum += smoothedFps;
      fpsStats.n++;
      updateFpsUI();
    }
    updateCountUI();
    tickAuto(now);

    requestAnimationFrame(loop);
  }

  /* ================= Init ================= */
  function init() {
    resizeCanvas();
    warmSpriteCache();
    buildControls();
    resetStats();
    updateFpsUI();
    requestAnimationFrame((t) => {
      lastTime = t;
      requestAnimationFrame(loop);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
