/* Beam On: First Light — shared runtime for every chapter page.
   Exposes window.FL. Load after the page markup, before the chapter's own script. */
(function () {
  const FL = window.FL = {};
  FL.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  FL.$ = id => document.getElementById(id);
  FL.css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  FL.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  FL.lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Progress store (per-viewer, survives reloads; safe when storage is blocked) ---------- */
  FL.store = {
    get(k, fallback = null) { try { const v = JSON.parse(localStorage.getItem('firstlight:' + k)); return v == null ? fallback : v; } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem('firstlight:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  /* Stars per chapter: { [levelId]: 0..3 }. Chapter 1 (Shield It) keeps its own key. */
  FL.getStars = ch => {
    if (ch === 1) { try { return JSON.parse(localStorage.getItem('shieldit:stars')) || {}; } catch (e) { return {}; } }
    return FL.store.get('stars:' + ch, {});
  };
  FL.setStars = (ch, lvl, n) => {
    const s = FL.getStars(ch);
    if (n > (s[lvl] || 0)) { s[lvl] = n; FL.store.set('stars:' + ch, s); }
    return s;
  };
  FL.unlockCard = (ch, role) => { const c = FL.store.get('cards', {}); c[role] = ch; FL.store.set('cards', c); };

  /* ---------- Audio: lo-fi soundtrack (one theme per chapter) and sound effects, synthesised live ---------- */
  const THEMES = [
    { bpm: 80, chords: [[50, 53, 57, 60], [50, 53, 55, 59], [48, 52, 55, 59], [48, 52, 55, 57]], roots: [38, 43, 36, 45], mel: [[[1, 74], [3, 72], [6, 69]], [[0, 71], [2, 74], [5, 67]], [[1, 72], [4, 76], [6, 74]], [[0, 72], [3, 69], [5, 67], [7, 64]]] },
    { bpm: 76, chords: [[48, 52, 55, 59], [45, 48, 52, 55], [50, 53, 57, 60], [43, 47, 50, 53]], roots: [36, 45, 38, 43], mel: [[[0, 71], [3, 67], [5, 72]], [[1, 69], [4, 72], [6, 76]], [[0, 74], [2, 72], [5, 69]], [[1, 71], [3, 74], [6, 67]]] },
    { bpm: 88, chords: [[45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 53], [40, 43, 47, 50]], roots: [33, 41, 43, 40], mel: [[[0, 76], [2, 72], [5, 69], [7, 72]], [[1, 69], [3, 72], [6, 77]], [[0, 74], [3, 71], [5, 67]], [[1, 71], [4, 68], [6, 64]]] },
    { bpm: 72, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [52, 55, 59, 64]], roots: [41, 40, 38, 40], mel: [[[0, 77], [3, 76], [6, 72]], [[1, 74], [4, 71], [6, 67]], [[0, 72], [2, 74], [5, 69]], [[1, 71], [3, 67], [6, 64]]] },
    { bpm: 84, chords: [[50, 53, 57, 62], [46, 50, 53, 57], [48, 52, 55, 60], [45, 49, 52, 57]], roots: [38, 34, 36, 33], mel: [[[0, 74], [2, 77], [5, 74]], [[1, 72], [3, 70], [6, 69]], [[0, 72], [3, 76], [5, 72]], [[1, 73], [4, 69], [6, 64]]] },
    { bpm: 78, chords: [[52, 55, 59, 62], [48, 52, 55, 59], [43, 47, 50, 55], [50, 54, 57, 60]], roots: [40, 36, 43, 38], mel: [[[0, 76], [3, 79], [6, 74]], [[1, 72], [3, 76], [5, 71]], [[0, 74], [2, 71], [5, 67]], [[1, 69], [4, 72], [6, 74]]] }
  ];
  FL.audio = (() => {
    let ctx = null, master, music, sfx, noise, timer = null, step = 0, next = 0, theme = THEMES[0];
    const st = { music: false, sfx: FL.store.get('sfx', true) };
    function ensure() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
      master = ctx.createGain(); master.gain.value = 0.85; master.connect(comp);
      music = ctx.createGain(); music.gain.value = 0; music.connect(master);
      sfx = ctx.createGain(); sfx.gain.value = 0.6; sfx.connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    function tone(dest, type, f, t, dur, vol, attack = 0.005, lp = 0, detune = 0) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = o;
      if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
      node.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
      return o;
    }
    function hiss(dest, t, dur, vol, type, freq, q = 1) {
      const s = ctx.createBufferSource(); s.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    }
    function kick(t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g); g.connect(music); o.start(t); o.stop(t + 0.35);
    }
    function playStep(s, t) {
      const E = 60 / theme.bpm / 2;
      const bar = Math.floor(s / 8) % 4, e = s % 8, phrase = Math.floor(s / 32);
      const tt = t + (e % 2 ? E * 0.2 : 0);
      if (e === 0) for (const m of theme.chords[bar]) { tone(music, 'triangle', hz(m), t, E * 8.4, 0.03, 0.45, 1000, -5); tone(music, 'triangle', hz(m), t, E * 8.4, 0.03, 0.45, 1000, 5); }
      if (e === 0 || e === 5) tone(music, 'sine', hz(theme.roots[bar]), tt, E * 2.8, 0.22, 0.01, 380);
      if (phrase > 0 || e === 0) {
        if (e === 0 || e === 5) kick(tt);
        if (e === 2 || e === 6) hiss(music, tt, 0.16, 0.11, 'bandpass', 1700, 0.7);
        if (e % 2 === 1 || e === 4) hiss(music, tt, 0.045, 0.035, 'highpass', 7500);
      }
      const n = theme.mel[bar].find(m => m[0] === e);
      if (n && phrase % 2 === 1) { tone(music, 'sine', hz(n[1]), tt, 1.2, 0.055); tone(music, 'sine', hz(n[1] + 12), tt, 0.35, 0.012); }
      if (Math.random() < 0.12) hiss(music, t + Math.random() * E, 0.02, 0.025, 'highpass', 3000);
    }
    function schedule() { while (next < ctx.currentTime + 0.2) { playStep(step, next); next += 60 / theme.bpm / 2; step++; } }
    function setMusic(on) {
      st.music = on;
      if (on) {
        if (!ensure()) return false;
        music.gain.cancelScheduledValues(ctx.currentTime);
        music.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
        if (!timer) { step = 0; next = ctx.currentTime + 0.08; timer = setInterval(schedule, 40); }
      } else if (ctx) {
        music.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
        clearInterval(timer); timer = null;
      }
      return true;
    }
    const ok = () => st.sfx && ensure();
    const now = () => ctx.currentTime;
    return {
      st, setMusic,
      setTheme(i) { theme = THEMES[i % THEMES.length]; },
      setSfx(on) { st.sfx = on; FL.store.set('sfx', on); },
      /* Sound effects: every chapter can use these. */
      click() { if (ok()) tone(sfx, 'sine', 660, now(), 0.06, 0.05); },
      place() { if (!ok()) return; const t = now(); hiss(sfx, t, 0.09, 0.3, 'lowpass', 520); tone(sfx, 'sine', 95, t, 0.1, 0.22); },
      clink() { if (!ok()) return; const t = now(); tone(sfx, 'triangle', hz(57), t, 0.3, 0.14); tone(sfx, 'sine', hz(76), t, 0.18, 0.04); hiss(sfx, t, 0.05, 0.12, 'highpass', 3500); },
      remove() { if (!ok()) return; const t = now(); hiss(sfx, t, 0.07, 0.16, 'bandpass', 1400, 1.2); tone(sfx, 'sine', 260, t, 0.08, 0.08); },
      blip(p = 0) { if (ok()) tone(sfx, 'sine', hz(76 + p), now(), 0.09, 0.05); },
      tick() { if (ok()) hiss(sfx, now(), 0.025, 0.12, 'highpass', 5000); },
      paper() { if (!ok()) return; const t = now(); hiss(sfx, t, 0.18, 0.08, 'bandpass', 2600, 0.6); },
      beam() { if (!ok()) return; const t = now();
        tone(sfx, 'square', 880, t, 0.16, 0.05, 0.005, 2500); tone(sfx, 'square', 880, t + 0.22, 0.16, 0.05, 0.005, 2500);
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t + 0.4); o.frequency.linearRampToValueAtTime(70, t + 1.6);
        f.type = 'lowpass'; f.frequency.setValueAtTime(200, t + 0.4); f.frequency.linearRampToValueAtTime(900, t + 1.4);
        g.gain.setValueAtTime(0.0001, t + 0.4); g.gain.linearRampToValueAtTime(0.16, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
        o.connect(f); f.connect(g); g.connect(sfx); o.start(t + 0.4); o.stop(t + 2); },
      hum(dur = 1.5) { if (!ok()) return; const t = now();
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(48, t); f.type = 'lowpass'; f.frequency.value = 300;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(sfx); o.start(t); o.stop(t + dur + 0.1); },
      knock() { if (!ok()) return; const t = now(); for (let i = 0; i < 6; i++) { hiss(sfx, t + i * 0.09, 0.05, 0.22, 'bandpass', 900, 3); tone(sfx, 'square', 130, t + i * 0.09, 0.04, 0.05, 0.002, 600); } },
      alarm() { if (!ok()) return; const t = now(); for (let i = 0; i < 3; i++) { tone(sfx, 'square', 740, t + i * 0.3, 0.14, 0.05, 0.005, 2000); tone(sfx, 'square', 587, t + i * 0.3 + 0.15, 0.14, 0.05, 0.005, 2000); } },
      whoosh() { if (!ok()) return; const t = now(); const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.35); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); s.connect(f); f.connect(g); g.connect(sfx); s.start(t); s.stop(t + 0.5); },
      clang() { if (!ok()) return; const t = now(); [220, 331, 467, 612].forEach((f, i) => tone(sfx, 'triangle', f, t, 0.9 - i * 0.15, 0.08)); hiss(sfx, t, 0.12, 0.3, 'highpass', 1500); },
      win() { if (!ok()) return; const t = now(); [72, 76, 79, 84].forEach((m, i) => { tone(sfx, 'triangle', hz(m), t + i * 0.11, 0.6, 0.12); tone(sfx, 'sine', hz(m + 12), t + i * 0.11, 0.3, 0.03); }); },
      fail() { if (!ok()) return; const t = now(); tone(sfx, 'square', 220, t, 0.22, 0.06, 0.005, 900); tone(sfx, 'square', 175, t + 0.2, 0.35, 0.06, 0.005, 900); }
    };
  })();

  /* Wire the Music and Sound buttons in the header. Theme = data-music on <body> (0–5). */
  FL.initAudio = () => {
    FL.audio.setTheme(+(document.body.dataset.music || 0));
    const mb = FL.$('musicBtn'), sb = FL.$('sfxBtn');
    if (sb) sb.setAttribute('aria-pressed', FL.audio.st.sfx ? 'true' : 'false');
    if (mb) mb.onclick = () => { const on = !FL.audio.st.music; if (FL.audio.setMusic(on) !== false) mb.setAttribute('aria-pressed', on); };
    if (sb) sb.onclick = () => { const on = !FL.audio.st.sfx; FL.audio.setSfx(on); sb.setAttribute('aria-pressed', on); if (on) FL.audio.click(); };
  };

  /* ---------- Level navigation ---------- */
  FL.renderLevels = (nav, levels, current, stars, onPick) => {
    nav.innerHTML = '';
    levels.forEach((lv, i) => {
      const b = document.createElement('button');
      const st = stars[lv.id] || 0;
      const locked = i > 0 && !stars[levels[i - 1].id];
      b.disabled = locked;
      b.setAttribute('aria-pressed', i === current ? 'true' : 'false');
      b.innerHTML = `${lv.id}. ${lv.name}<span class="stars" aria-label="${st} of 3 stars">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>`;
      if (locked) b.title = 'Finish the previous level to unlock';
      b.onclick = () => { FL.audio.click(); onPick(i); };
      nav.appendChild(b);
    });
  };

  /* ---------- Teacher password lock for "Show solution" (default password: medphys) ---------- */
  const PW_HASH = '111faca47cfc35';
  function pwHash(str, seed = 7) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  FL.unlocked = false;
  /* Markup needed: #solve button, form#lock with #pw input and #pwerr. onSolve runs once unlocked. */
  FL.setupLock = onSolve => {
    const btn = FL.$('solve'), form = FL.$('lock'), pw = FL.$('pw'), err = FL.$('pwerr');
    btn.onclick = () => {
      if (FL.unlocked) return onSolve();
      form.hidden = !form.hidden;
      if (!form.hidden) { err.hidden = true; pw.value = ''; pw.focus(); }
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (pwHash(pw.value.trim().toLowerCase()) !== PW_HASH) { err.hidden = false; FL.audio.fail(); pw.select(); return; }
      FL.unlocked = true; form.hidden = true; pw.value = '';
      btn.textContent = 'Show solution (unlocked)';
      onSolve();
    });
    pw.addEventListener('input', () => { err.hidden = true; });
  };

  /* ---------- Result cards ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  FL.esc = esc;
  /* opts: { chapter, stars, title, summary, physics:[], card:{role,text}, nextLabel, onNext } */
  FL.showWin = (box, o) => {
    FL.audio.win();
    if (o.card) FL.unlockCard(o.chapter, o.card.role);
    box.hidden = false;
    box.className = 'card result win';
    box.innerHTML = `<div class="bigstars" aria-label="${o.stars} of 3 stars">${'★'.repeat(o.stars)}${'☆'.repeat(3 - o.stars)}</div>
      <h3>${esc(o.title)}</h3><p>${o.summary}</p>
      ${o.physics && o.physics.length ? `<h2 style="margin-top:12px">Physics you used today</h2><ul>${o.physics.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
      ${o.card ? `<div class="career"><span class="eyebrow">Career card unlocked for {name}</span><b>${esc(o.card.role)}</b><p>${esc(o.card.text)}</p></div>` : ''}
      <button class="primary" id="nextBtn">${esc(o.nextLabel || 'Back to all chapters')}</button>`;
    FL.$('nextBtn').onclick = () => { FL.audio.click(); if (o.onNext) o.onNext(); else location.href = 'index.html'; };
  };
  /* opts: { title, issues:[] } */
  FL.showFail = (box, o) => {
    FL.audio.fail();
    box.hidden = false;
    box.className = 'card result lose';
    box.innerHTML = `<h3>${esc(o.title || 'Not quite yet')}</h3><ul>${o.issues.map(i => `<li>${i}</li>`).join('')}</ul>`;
  };
  /* Final level of a chapter: a closing card with a link back to the menu. */
  FL.chapterComplete = (box, o) => {
    box.className = 'card result win';
    box.innerHTML = `<h3>${esc(o.title)}</h3><p>${o.text}</p>
      ${o.pathway ? `<div class="career"><span class="eyebrow">Next in the story</span><p>${o.pathway}</p></div>` : ''}
      <button class="primary" id="homeBtn">Back to all chapters</button>`;
    FL.$('homeBtn').onclick = () => { location.href = 'index.html'; };
  };

  /* Re-run cb when the viewer's theme changes (system or explicit). */
  FL.onTheme = cb => {
    const run = () => requestAnimationFrame(cb);
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', run);
    new MutationObserver(run).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.fonts?.ready.then(run);
  };

  /* Size a canvas to its CSS width at device pixel ratio, keeping an aspect ratio. Returns {w,h,ctx}. */
  FL.fitCanvas = (cv, aspect) => {
    const p = cv.parentElement, ps = getComputedStyle(p);
    const w = Math.floor(p.clientWidth - parseFloat(ps.paddingLeft || 0) - parseFloat(ps.paddingRight || 0));
    const h = Math.round(w / aspect);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, ctx };
  };

  /* ---------- Player profile, sign-up and the organiser's Google Form ---------- */
  /* Paste the form's link here (the "Send" link ending in /viewform). To pre-fill answers,
     add each question's entry id from Google Forms' "Get pre-filled link". */
  FL.FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd-ByTVstSKoDbNMw3InKo5WtDV-tcq3yZ9VN1jhTT_0y8VGA/viewform';
  FL.FORM_ENTRIES = {
    name: 'entry.2112143680', email: 'entry.2043421316', school: 'entry.1756856791', state: 'entry.2029939603',
    year: 'entry.1791770449', stage: 'entry.200189267', interest: 'entry.519842191', consent: 'entry.1405417863',
    favourite: 'entry.39961460', study: 'entry.1200602730', stars: 'entry.1861690002',
    age: 'entry.1475119608', guardian: 'entry.1139715430'
  };
  FL.YEARS = ['Form 1–3 / Year 7–9', 'Form 4 / Year 10 (SPM, O level, IGCSE)', 'Form 5 / Year 11 (SPM, O level, IGCSE)', 'Form 6 / STPM', 'A level or IB', 'Matriculation or foundation', 'University', 'Teacher', 'Other'];
  FL.STATES = ['Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Putrajaya', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Outside Malaysia'];
  FL.profile = () => FL.store.get('profile', null);
  /* A profile counts as complete when every required field is filled in. */
  FL.profileComplete = () => { const p = FL.profile(); return !!(p && p.name && p.school && p.state && p.year && p.interest && p.age && (p.age !== 'Under 18' || p.guardian) && (!p.consent || p.email)); };
  FL.playerName = () => { const p = FL.profile(); return (p && p.name) || 'friend'; };
  FL.totalStars = () => FL.CHAPTERS.reduce((s, c) => s + Object.values(FL.getStars(c.id)).reduce((a, b) => a + (b || 0), 0), 0);

  /* Link to the organiser's form, pre-filled where entry ids are set. stage: 'Before playing' | 'After playing'. */
  FL.formLink = (stage, extra = {}) => {
    if (!FL.FORM_URL) return '';
    const p = FL.profile() || {};
    const vals = { name: p.name, email: p.consent ? p.email : '', age: p.age, guardian: p.age === 'Under 18' && p.guardian ? 'Yes, my parent or guardian agrees' : '', school: p.school, state: p.state, year: p.year, stage,
      interest: stage === 'After playing' ? extra.interest : p.interest,
      consent: p.consent ? 'Yes, you may email me about medical physics outreach events' : '',
      favourite: extra.favourite, study: extra.study, stars: String(FL.totalStars()) };
    const q = [];
    for (const [k, id] of Object.entries(FL.FORM_ENTRIES)) if (id && vals[k] != null && vals[k] !== '') q.push(encodeURIComponent(id) + '=' + encodeURIComponent(vals[k]));
    return FL.FORM_URL + (q.length ? (FL.FORM_URL.includes('?') ? '&' : '?') + 'usp=pp_url&' + q.join('&') : '');
  };

  /* Replace the {name} token in any text on the page, now and as the page changes. */
  const TOKEN = '{name}';
  function fillText(node) {
    if (node.nodeType === 3) { if (node.nodeValue.includes(TOKEN)) node.nodeValue = node.nodeValue.split(TOKEN).join(FL.playerName()); return; }
    if (node.nodeType !== 1 || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const hits = []; while (w.nextNode()) if (w.currentNode.nodeValue.includes(TOKEN)) hits.push(w.currentNode);
    hits.forEach(fillText);
  }
  FL.personalize = () => {
    fillText(document.body);
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') fillText(m.target); else m.addedNodes.forEach(fillText); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  };

  const SIGNUP_CSS = `
.fl-scrim { position: fixed; inset: 0; z-index: 50; background: color-mix(in srgb, var(--ink) 55%, transparent); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); display: grid; place-items: center; overflow-y: auto;
  padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); }
.fl-dialog { width: min(560px, 100%); background: var(--board); color: var(--ink); border: 1px solid var(--line); border-radius: 18px; padding: 22px; display: grid; gap: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.25); font-family: var(--body); }
.fl-dialog h2 { font: 800 26px/1.1 var(--display); margin: 0; letter-spacing: -.01em; }
.fl-dialog .fl-kicker { font: 500 12px/1.3 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.fl-dialog p { margin: 0; font-size: 15px; }
.fl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 520px) { .fl-grid { grid-template-columns: 1fr; } }
.fl-f { display: grid; gap: 5px; min-width: 0; font-size: 14px; }
.fl-f.wide { grid-column: 1 / -1; }
.fl-f label, .fl-f legend { font-weight: 700; }
.fl-f label small, .fl-f legend small { font-weight: 400; color: var(--muted); }
.fl-f input, .fl-f select { width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: var(--paper); color: var(--ink); font: 15px var(--body); }
.fl-f fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; }
.fl-scale { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.fl-scale label { display: grid; justify-items: center; gap: 2px; border: 1px solid var(--line); border-radius: 10px; padding: 8px 4px; cursor: pointer; background: var(--paper); font: 700 16px/1 var(--body); }
.fl-scale input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.fl-scale label:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.fl-scale label:has(input:focus-visible) { outline: 3px solid var(--accent); outline-offset: 2px; }
.fl-ends { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); }
.fl-check { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; font-size: 14px; }
.fl-check input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--accent); }
.fl-two { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.fl-two label { display: flex; gap: 8px; align-items: center; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: var(--paper); cursor: pointer; font-weight: 400; }
.fl-two label:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); }
.fl-two input { accent-color: var(--accent); width: auto; margin: 0; flex: 0 0 auto; }
.fl-privacy a { color: var(--accent); }
.fl-privacy.fl-f { display: block; }
.fl-privacy { font-size: 13px !important; color: var(--muted); background: var(--paper); border-radius: 10px; padding: 10px 12px; }
.fl-err { color: var(--bad); font-size: 13px !important; }
.fl-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.fl-btn { border: 0; border-radius: 10px; padding: 12px 18px; background: var(--accent); color: var(--board); font: 700 15px/1 var(--body); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.fl-btn.alt { background: transparent; color: var(--ink); border: 1px solid var(--line); }
.fl-btn[aria-disabled="true"] { opacity: .5; pointer-events: none; }
.fl-chip { font: 600 14px/1 var(--body); padding: 9px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--board); color: var(--ink); cursor: pointer; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fl-chip b { color: var(--accent); }
.fl-dialog :focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }`;
  function injectCss() {
    if (document.getElementById('fl-signup-css')) return;
    const s = document.createElement('style'); s.id = 'fl-signup-css'; s.textContent = SIGNUP_CSS; document.head.appendChild(s);
  }
  const opt = (list, cur, ph) => `<option value="">${ph}</option>` + list.map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const scale = (name, cur) => `<div class="fl-scale">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="${name}" value="${n}"${String(cur) === String(n) ? ' checked' : ''}>${n}</label>`).join('')}</div>`;

  function openDialog(html, wire) {
    injectCss();
    const prev = document.activeElement;
    const scrim = document.createElement('div');
    scrim.className = 'fl-scrim';
    scrim.innerHTML = `<div class="fl-dialog" role="dialog" aria-modal="true" aria-labelledby="fl-dlg-title">${html}</div>`;
    document.body.appendChild(scrim);
    const close = () => { scrim.remove(); if (prev && prev.focus) prev.focus(); };
    scrim.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const f = [...scrim.querySelectorAll('input, select, button, a[href]')].filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    wire(scrim, close);
    const first = scrim.querySelector('input, select, button, a[href]'); if (first) first.focus();
    return close;
  }

  /* Step 2 of sign-up and the "Send my details" button: open the organiser's form. */
  FL.showSend = (stage = 'Before playing', extra = {}, required = false) => {
    const href = FL.formLink(stage, extra);
    const must = required && !!href;
    openDialog(`<span class="fl-kicker">${stage === 'After playing' ? 'Thank you' : 'One more step'}</span>
      <h2 id="fl-dlg-title">${stage === 'After playing' ? 'Send your feedback' : 'Send your details'}</h2>
      ${href ? `<p>Your answers are ready on the organiser's form. Open it, check them and press <b>Submit</b>.${must ? ' You need to send your details before you start playing.' : ' Nothing is sent until you do.'}</p>`
             : `<p>The organiser has not added their form yet. Your details are saved on this device, and you can send them later from the menu.</p>`}
      <div class="fl-actions">
        ${must ? '' : `<button class="fl-btn alt" type="button" data-skip>${href ? 'Not now' : 'OK'}</button>`}
        ${href ? `<a class="fl-btn" href="${esc(href)}" target="_blank" rel="noopener" data-open>${must ? 'Open the form and start playing' : 'Open the form'}</a>` : ''}
      </div>`, (root, close) => {
      const skip = root.querySelector('[data-skip]'); if (skip) skip.onclick = close;
      const a = root.querySelector('[data-open]');
      if (a) a.addEventListener('click', () => { FL.store.set('sent:' + (stage === 'After playing' ? 'after' : 'before'), Date.now()); setTimeout(close, 300); });
    });
  };

  /* After-game feedback: interest again, favourite chapter, and study plans. Then the form. */
  FL.showFeedback = () => {
    const prev = FL.store.get('feedback', {});
    openDialog(`<span class="fl-kicker">Feedback</span>
      <h2 id="fl-dlg-title">How did it go, ${esc(FL.playerName())}?</h2>
      <form class="fl-grid" novalidate>
        <div class="fl-f wide"><fieldset><legend>Now, how interested are you in a career in medical physics?</legend>${scale('fl-int2', prev.interest)}<div class="fl-ends"><span>1 · Not at all</span><span>5 · Very</span></div></fieldset></div>
        <div class="fl-f wide"><label for="fl-fav">Favourite chapter</label><select id="fl-fav">${opt(FL.CHAPTERS.map(c => c.id + '. ' + c.title), prev.favourite, 'Choose…')}</select></div>
        <div class="fl-f wide"><label for="fl-study">Would you consider studying physics after SPM, O level or IGCSE?</label><select id="fl-study">${opt(['Yes', 'Maybe', 'No', 'I already am'], prev.study, 'Choose…')}</select></div>
        <p class="fl-err fl-f wide" id="fl-err" hidden>Choose a number from 1 to 5 first.</p>
        <div class="fl-actions fl-f wide"><button class="fl-btn alt" type="button" data-cancel>Cancel</button><button class="fl-btn" type="submit">Next</button></div>
      </form>`, (root, close) => {
      root.querySelector('[data-cancel]').onclick = close;
      root.querySelectorAll('input').forEach(el => el.addEventListener('change', () => { root.querySelector('#fl-err').hidden = true; }));
      root.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const r = root.querySelector('input[name="fl-int2"]:checked');
        if (!r) { root.querySelector('#fl-err').hidden = false; return; }
        const fb = { interest: +r.value, favourite: root.querySelector('#fl-fav').value, study: root.querySelector('#fl-study').value };
        FL.store.set('feedback', fb);
        close();
        FL.showSend('After playing', fb);
      });
    });
  };

  /* Sign-up / edit details. onDone runs after saving.
     PDPA design: only what the outreach needs is compulsory. Email is asked only when the player opts in to contact,
     and players under 18 need a parent or guardian's agreement before sending anything. */
  FL.PRIVACY_URL = 'privacy.html';
  FL.showSignup = (onDone, editing = false) => {
    const p = FL.profile() || {};
    openDialog(`<span class="fl-kicker">${editing ? 'Your details' : 'Beam On: First Light · New staff'}</span>
      <h2 id="fl-dlg-title">${editing ? 'Edit your details' : 'Welcome to the department'}</h2>
      <p>${editing ? 'Changes are saved on this device.' : 'The team needs a few details before your first day. Your name appears in the game, and a nickname is fine.'}</p>
      <form class="fl-grid" novalidate>
        <div class="fl-f wide"><label for="fl-name">First name or nickname</label><input id="fl-name" maxlength="30" autocomplete="nickname" value="${esc(p.name || '')}" required></div>
        <div class="fl-f"><label for="fl-school">School</label><input id="fl-school" maxlength="80" autocomplete="organization" value="${esc(p.school || '')}" required></div>
        <div class="fl-f"><label for="fl-state">State</label><select id="fl-state" required>${opt(FL.STATES, p.state, 'Choose…')}</select></div>
        <div class="fl-f wide"><label for="fl-year">Form or year</label><select id="fl-year" required>${opt(FL.YEARS, p.year, 'Choose…')}</select></div>
        <div class="fl-f wide"><fieldset><legend>How interested are you in a career in medical physics?</legend>${scale('fl-int', p.interest)}<div class="fl-ends"><span>1 · Not at all</span><span>5 · Very</span></div></fieldset></div>
        <div class="fl-f wide"><fieldset><legend>How old are you?</legend><div class="fl-two">
          <label><input type="radio" name="fl-age" value="Under 18"${p.age === 'Under 18' ? ' checked' : ''}>Under 18</label>
          <label><input type="radio" name="fl-age" value="18 or over"${p.age === '18 or over' ? ' checked' : ''}>18 or over</label></div></fieldset></div>
        <label class="fl-check fl-f wide" id="fl-guardian-row"${p.age === 'Under 18' ? '' : ' hidden'}><input type="checkbox" id="fl-guardian"${p.guardian ? ' checked' : ''}><span>My parent or guardian agrees to me sharing these details with the organiser.</span></label>
        <label class="fl-check fl-f wide"><input type="checkbox" id="fl-consent"${p.consent ? ' checked' : ''}><span>Optional: the organiser may email me about medical physics outreach events.</span></label>
        <div class="fl-f wide" id="fl-email-row"${p.consent ? '' : ' hidden'}><label for="fl-email">Email <small>(needed only for event news)</small></label><input id="fl-email" type="email" maxlength="120" autocomplete="email" value="${esc(p.email || '')}"></div>
        <p class="fl-privacy fl-f wide">Your details are sent to the organiser on a Google Form and used only for this outreach programme. <a href="${FL.PRIVACY_URL}" target="_blank" rel="noopener">Read the privacy notice</a> · <a href="${FL.PRIVACY_URL}#bm" target="_blank" rel="noopener">Notis privasi (Bahasa Malaysia)</a></p>
        <p class="fl-err fl-f wide" id="fl-err" hidden></p>
        <div class="fl-actions fl-f wide">${editing ? '<button class="fl-btn alt" type="button" data-cancel>Cancel</button>' : ''}<button class="fl-btn" type="submit">${editing ? 'Save' : 'Start my first day'}</button></div>
      </form>`, (root, close) => {
      const $$ = s => root.querySelector(s), err = $$('#fl-err');
      if ($$('[data-cancel]')) $$('[data-cancel]').onclick = close;
      root.querySelectorAll('input, select').forEach(el => el.addEventListener('input', () => { err.hidden = true; }));
      const sync = () => {
        const age = root.querySelector('input[name="fl-age"]:checked');
        $$('#fl-guardian-row').hidden = !(age && age.value === 'Under 18');
        $$('#fl-email-row').hidden = !$$('#fl-consent').checked;
      };
      root.querySelectorAll('input[name="fl-age"], #fl-consent').forEach(el => el.addEventListener('change', sync));
      $$('form').addEventListener('submit', e => {
        e.preventDefault();
        const name = $$('#fl-name').value.trim().replace(/\s+/g, ' ');
        const consent = $$('#fl-consent').checked;
        const email = consent ? $$('#fl-email').value.trim() : '';
        const picked = root.querySelector('input[name="fl-int"]:checked');
        const ageEl = root.querySelector('input[name="fl-age"]:checked');
        const age = ageEl ? ageEl.value : '';
        const guardian = age === 'Under 18' && $$('#fl-guardian').checked;
        let msg = '';
        if (!name) msg = 'Enter a first name or nickname.';
        else if (!$$('#fl-school').value.trim()) msg = 'Enter the name of your school.';
        else if (!$$('#fl-state').value) msg = 'Choose your state.';
        else if (!$$('#fl-year').value) msg = 'Choose your form or year.';
        else if (!picked) msg = 'Choose how interested you are, from 1 to 5.';
        else if (!age) msg = 'Choose whether you are under 18.';
        else if (age === 'Under 18' && !guardian) msg = 'Ask a parent or guardian first, then tick the box to show they agree.';
        else if (consent && !email) msg = 'Enter your email for event news, or untick the box.';
        else if (consent && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) msg = 'That email does not look complete. Check it and try again.';
        if (msg) { err.textContent = msg; err.hidden = false; return; }
        const prof = { name, email, school: $$('#fl-school').value.trim(), state: $$('#fl-state').value, year: $$('#fl-year').value,
          interest: +picked.value, age, guardian, consent, joined: p.joined || new Date().toISOString().slice(0, 10) };
        FL.store.set('profile', prof);
        close();
        document.querySelectorAll('.fl-chip b').forEach(b => { b.textContent = name; });
        if (onDone) onDone(prof);
        if (!editing) FL.showSend('Before playing', {}, true);
      });
    });
  };

  /* Name chip in the header + the sign-up gate. Runs on every page that loads common.js. */
  FL.initPlayer = () => {
    const group = document.querySelector('.audio');
    if (group && !group.querySelector('.fl-chip')) {
      injectCss();
      const b = document.createElement('button');
      b.className = 'fl-chip'; b.type = 'button'; b.title = 'Edit your details';
      b.innerHTML = 'Physicist <b></b>';
      b.querySelector('b').textContent = (FL.profile() || {}).name || 'Sign up';
      b.onclick = () => FL.showSignup(() => location.reload(), FL.profileComplete());
      group.insertBefore(b, group.firstChild);
    }
    /* Personalise only once a name exists, so {name} tokens wait for the sign-up. */
    if (FL.profileComplete()) FL.personalize();
    else FL.showSignup(() => { FL.personalize(); if (FL.onSignedUp) FL.onSignedUp(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', FL.initPlayer); else setTimeout(FL.initPlayer, 0);

  /* Chapter catalogue, shared by the hub and the chapter pages. */
  FL.CHAPTERS = [
    { id: 1, file: 'ch1.html', title: 'Shield It', sub: 'Build the Bunker', concept: 'Radioactivity, absorption, inverse square law', role: 'Radiation protection', levels: 3 },
    { id: 2, file: 'ch2.html', title: 'Hit the Target', sub: 'First Patient', concept: 'X-rays, attenuation, the EM spectrum', role: 'Treatment planning', levels: 3 },
    { id: 3, file: 'ch3.html', title: 'Morning Check', sub: 'Quality Assurance', concept: 'Measurement, error, gas laws', role: 'Quality assurance', levels: 3 },
    { id: 4, file: 'ch4.html', title: 'Safe Zone', sub: 'Seeing Inside', concept: 'Magnetism, electromagnetism, waves', role: 'MRI physics and safety', levels: 3 },
    { id: 5, file: 'ch5.html', title: 'Tracer Time', sub: 'Nuclear Medicine', concept: 'Half-life, radioactive decay', role: 'Nuclear medicine physics', levels: 3 },
    { id: 6, file: 'ch6.html', title: 'Stop on the Spot', sub: 'The Proton Question', concept: 'Energy, charged particles, the Bragg peak', role: 'Research physicist', levels: 3 }
  ];
})();
