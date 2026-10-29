/* חצים ואותיות - חבילות, יצירת תשחצים ומסך המשחק */
(function () {
  'use strict';
  var H = window.H, E = window.Engine, h = H.h, $ = H.$;

  /* ---------- חבילות ומזהים ---------- */
  H.PACK_SIZE = 30;
  H.PACKS = 40;

  H.packCfg = function (mode, n, kind) {
    n = n || 1;
    if (kind === 'daily' || kind === 'rand') n = 4;
    if (mode === 'a') {
      var R, C;
      if (n <= 2) { R = 10; C = 8; } else if (n <= 6) { R = 12; C = 9; } else if (n <= 12) { R = 14; C = 10; } else { R = 16; C = 11; }
      return { R: R, C: C, lvlMax: n <= 2 ? 1 : (n <= 5 ? 2 : 3), maxPics: 2, clueMax: 34, boxClueMax: 40, attempts: 12 };
    }
    var R2, C2;
    if (n <= 3) { R2 = 6; C2 = 6; } else if (n <= 8) { R2 = 7; C2 = 7; } else { R2 = 8; C2 = 8; }
    return { R: R2, C: C2, lvlMax: n <= 4 ? 1 : 2, maxPics: n <= 3 ? 2 : 3, clueMax: 26, boxClueMax: 30, attempts: 12 };
  };
  H.puzId = function (mode, pack, idx) { return mode + pack + '-' + idx; };
  H.dailyId = function (mode) { return 'd-' + mode + '-' + H.today(); };
  H.randId = function (mode) { return 'x-' + mode + '-' + Date.now().toString(36) + H.rid(3); };
  H.parseId = function (id) {
    var m = /^([ak])(\d+)-(\d+)$/.exec(id);
    if (m) return { type: 'pack', mode: m[1], pack: +m[2], idx: +m[3] };
    m = /^d-([ak])-(\d{4}-\d{2}-\d{2})$/.exec(id);
    if (m) return { type: 'daily', mode: m[1], date: m[2] };
    m = /^x-([ak])-([a-z0-9]+)$/.exec(id);
    if (m) return { type: 'rand', mode: m[1], tag: m[2] };
    return null;
  };
  H.puzTitle = function (id) {
    var p = H.parseId(id);
    if (!p) return 'תשחץ';
    if (p.type === 'pack') return 'חבילה ' + p.pack + ' · תשחץ ' + p.idx;
    if (p.type === 'daily') return 'התשחץ היומי';
    return 'תשחץ אקראי';
  };

  H.progressOf = function (id) {
    var r = H.S.p[id];
    if (!r) return { pct: 0, done: false, t: 0 };
    if (r.d) return { pct: 100, done: true, t: r.t };
    var c = r.c || '', f = 0, n = r.n || c.length || 1;
    for (var i = 0; i < c.length; i++) if (c[i] !== ' ') f++;
    return { pct: Math.min(99, Math.round(f * 100 / n)), done: false, t: r.t };
  };
  H.solvedInPack = function (mode, pack) {
    var n = 0;
    for (var i = 1; i <= H.PACK_SIZE; i++) { var r = H.S.p[H.puzId(mode, pack, i)]; if (r && r.d) n++; }
    return n;
  };
  H.totalSolved = function (mode) {
    var n = 0, p = H.S.p;
    for (var id in p) { var pi = H.parseId(id); if (pi && pi.type === 'pack' && pi.mode === mode && p[id].d) n++; }
    return n;
  };
  H.packNeed = function (pack) { return 12 * (pack - 1); };
  H.packLocked = function (mode, pack) {
    if (H.S.set.unlockAll || pack <= 1) return 0;
    var need = H.packNeed(pack) - H.totalSolved(mode);
    return need > 0 ? need : 0;
  };

  /* ---------- יצירה ופתיחה ---------- */
  var loadingEl = null;
  function showLoading(text) {
    if (loadingEl) return;
    loadingEl = h('div', { class: 'loading' },
      h('div', { class: 'spin' }),
      h('div', { class: 'loading-t', text: text || 'מכין תשחץ חדש…' }));
    document.body.appendChild(loadingEl);
  }
  function hideLoading() { if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl); loadingEl = null; }

  H.makePuzzle = function (id) {
    var pi = H.parseId(id);
    if (!pi) return Promise.reject(new Error('id'));
    var cfg = H.packCfg(pi.mode, pi.pack, pi.type);
    var B = H.buildBanks();
    return E.generateAsync({
      seed: 'hz' + H.BANK_VER + '|' + id, R: cfg.R, C: cfg.C,
      bank: pi.mode === 'a' ? B.a : B.k, lvlMax: cfg.lvlMax, maxPics: cfg.maxPics,
      picFor: H.picFor(pi.mode), clueMax: cfg.clueMax, boxClueMax: cfg.boxClueMax, attempts: cfg.attempts
    });
  };

  H.openPuzzle = function (id) {
    var rec = H.S.p[id];
    if (rec && rec.def) {
      try { E.parseDef(rec.def); H.startGame(id, rec.def); return; } catch (e) { delete H.S.p[id]; }
    }
    showLoading();
    H.makePuzzle(id).then(function (def) {
      hideLoading();
      H.startGame(id, def);
    }).catch(function () {
      hideLoading();
      H.toast('לא הצלחתי ליצור תשחץ. נסה שוב.');
    });
  };

  /* ---------- מצב משחק ---------- */
  var G = null;
  H.G = function () { return G; };
  var timerI = 0, saveI = 0;
  var KB_ROWS = [
    ['ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ', '⌫'],
    ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'],
    ['ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ']
  ];
  var LAT = { e: 'ק', r: 'ר', t: 'א', y: 'ט', u: 'ו', i: 'ן', o: 'ם', p: 'פ', a: 'ש', s: 'ד', d: 'ג', f: 'כ', g: 'ע', h: 'י', j: 'ח', k: 'ל', l: 'ך', ';': 'ף', z: 'ז', x: 'ס', c: 'ב', v: 'ה', b: 'נ', n: 'מ', m: 'צ', ',': 'ת', '.': 'ץ' };
  var COST = { cell: 10, word: 30 };

  H.startGame = function (id, def) {
    var P = E.parseDef(def);
    var S = H.S, pi = H.parseId(id);
    var rec = S.p[id];
    if (!rec) {
      rec = S.p[id] = { c: '', r: '', t: 0, d: 0, h: 0, u: Date.now(), n: P.letters, as: 0, def: def, bv: H.BANK_VER };
    }
    var li = [];
    for (var i = 0; i < P.N; i++) if (P.type[i] === 1) li.push(i);
    G = {
      id: id, pi: pi, def: def, P: P, rec: rec, li: li,
      val: new Array(P.N).fill(''), rev: new Uint8Array(P.N), bad: new Uint8Array(P.N),
      sel: -1, dir: 'a', pin: false, cur: null, els: [], undo: [], t: rec.t || 0, done: !!rec.d,
      hints: rec.h || 0, assisted: !!rec.as, hintShown: {}, sinceSave: 0, entBox: {}, sol: new Uint8Array(P.entries.length)
    };
    P.entries.forEach(function (e) { (G.entBox[e.box] = G.entBox[e.box] || {})[e.d] = e.id; });
    for (var k = 0; k < li.length; k++) {
      var ch = rec.c ? rec.c[k] : '';
      if (ch && ch !== ' ' && ch >= 'א' && ch <= 'ת') G.val[li[k]] = ch;
      if (rec.r && rec.r[k] === '1') G.rev[li[k]] = 1;
    }
    if (G.done) for (var q = 0; q < li.length; q++) G.val[li[q]] = P.ch[li[q]];
    S.last = id;
    H.touch();
    document.documentElement.setAttribute('data-mode', pi ? pi.mode : 'a');
    buildGameView();
    try { history.pushState({ g: id }, ''); } catch (e) {}
    if (!G.done) {
      var first = firstOpenEntry();
      if (first) selectEntry(first, true); else selectCellRaw(li[0], 'a');
    } else { G.sel = -1; refreshSel(); }
    startTimer();
  };

  function firstOpenEntry() {
    var P = G.P;
    for (var k = 0; k < P.order.length; k++) {
      var e = P.entries[P.order[k]];
      if (entryHasEmpty(e)) return e;
    }
    return null;
  }
  function entryHasEmpty(e) {
    for (var i = 0; i < e.cells.length; i++) if (!G.val[e.cells[i]]) return true;
    return false;
  }
  function entryOf(i, dir) {
    var id = dir === 'a' ? G.P.ea[i] : G.P.ed[i];
    return id >= 0 ? G.P.entries[id] : null;
  }

  /* ---------- בניית המסך ---------- */
  var V = {};  // רפרנסים ל-DOM של המשחק
  function buildGameView() {
    var P = G.P;
    V = {};
    var root = h('section', { class: 'game', data: { mode: G.pi ? G.pi.mode : 'a' } });
    V.root = root;

    V.timer = h('span', { class: 'g-time', text: H.fmtTime(G.t) });
    var top = h('header', { class: 'g-top' },
      h('button', { class: 'ib', 'aria-label': 'חזרה', onclick: function () { H.exitGame(); } }, H.icon('chev-r')),
      h('div', { class: 'g-title' },
        h('div', { class: 'g-name', text: H.puzTitle(G.id) }),
        V.timer),
      h('button', { class: 'ib', 'aria-label': 'עוד', onclick: openMenu }, H.icon('more')));
    root.appendChild(top);

    /* פס הגדרה */
    V.ringFg = null;
    V.ringTxt = h('span', { class: 'ring-t' });
    var ns = 'http://www.w3.org/2000/svg';
    var ring = document.createElementNS(ns, 'svg');
    ring.setAttribute('viewBox', '0 0 40 40'); ring.setAttribute('class', 'ring');
    var bg = document.createElementNS(ns, 'circle'); bg.setAttribute('cx', 20); bg.setAttribute('cy', 20); bg.setAttribute('r', 16); bg.setAttribute('class', 'ring-bg');
    var fg = document.createElementNS(ns, 'circle'); fg.setAttribute('cx', 20); fg.setAttribute('cy', 20); fg.setAttribute('r', 16); fg.setAttribute('class', 'ring-fg');
    fg.setAttribute('transform', 'rotate(-90 20 20)');
    ring.appendChild(bg); ring.appendChild(fg);
    V.ringFg = fg;
    var ringWrap = h('div', { class: 'ring-w', onclick: function () { checkAll(); } }, ring, V.ringTxt);

    V.clue = h('div', { class: 'clue-t' });
    V.pat = h('div', { class: 'clue-p' });
    V.hintBtn = h('button', { class: 'lnk', text: 'הצג רמז', onclick: function () { if (G.cur) { G.hintShown[G.cur.id] = 1; updateBar(); } } });
    var clueBox = h('div', { class: 'clue-box', onclick: function (ev) { if (ev.target.closest('button')) return; gotoRelative(1); } }, V.clue, V.pat);
    V.bar = h('div', { class: 'g-bar' },
      h('button', { class: 'ib sm', 'aria-label': 'הגדרה קודמת', onclick: function () { gotoRelative(-1); } }, H.icon('chev-r')),
      clueBox,
      h('button', { class: 'ib sm', 'aria-label': 'הגדרה הבאה', onclick: function () { gotoRelative(1); } }, H.icon('chev-l')),
      ringWrap);
    root.appendChild(V.bar);

    /* לוח */
    V.wrap = h('div', { class: 'gwrap' });
    V.grid = h('div', { class: 'grid' });
    V.wrap.appendChild(V.grid);
    root.appendChild(V.wrap);
    buildGrid();

    /* סרגל כלים */
    V.coins = h('span', { 'data-coins': 1, text: H.S.coins });
    var micOK = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    V.tools = h('div', { class: 'g-tools' },
      h('div', { class: 'coin-chip' }, H.icon('coin'), V.coins),
      tool('bulb', 'רמז', openHints),
      (V.pinBtn = tool('lock', 'מנעול', function () {
        if (G.done) return;
        if (G.sel < 0) { H.toast('בחר משבצת קודם', 1200); return; }
        setPin(!G.pin);
        H.toast(G.pin ? 'נעול על המשבצת' : 'המנעול כבוי', 1100);
      })),
      tool('undo', 'בטל', undo),
      tool('trash', 'נקה מילה', clearWord),
      micOK ? tool('mic', 'הקלטה', listen) : null,
      tool('zoom', 'זום', cycleZoom));
    root.appendChild(V.tools);

    /* מקלדת */
    var kb = h('div', { class: 'kb', dir: 'ltr' });
    KB_ROWS.forEach(function (row) {
      var r = h('div', { class: 'kb-r' });
      row.forEach(function (k) {
        var b = h('button', { class: 'key' + (k === '⌫' ? ' del' : ''), 'data-k': k, 'aria-label': k === '⌫' ? 'מחק' : k });
        if (k === '⌫') b.appendChild(H.icon('backspace')); else b.textContent = k;
        r.appendChild(b);
      });
      kb.appendChild(r);
    });
    kb.addEventListener('pointerdown', function (ev) {
      var b = ev.target.closest('.key');
      if (!b) return;
      ev.preventDefault();
      b.classList.add('dn');
      var k = b.getAttribute('data-k');
      if (k === '⌫') backspace(); else typeLetter(k);
    });
    function up(ev) { var b = ev.target.closest && ev.target.closest('.key'); H.$$('.key.dn', kb).forEach(function (x) { x.classList.remove('dn'); }); }
    kb.addEventListener('pointerup', up); kb.addEventListener('pointercancel', up); kb.addEventListener('pointerleave', up);
    V.kb = kb;
    root.appendChild(kb);

    V.grid.addEventListener('click', function (ev) {
      var c = ev.target.closest('.cell');
      if (!c) return;
      if (c.classList.contains('lt')) { selectCell(+c.getAttribute('data-i'), true); }
      else if (c.classList.contains('bx')) { selectBox(+c.getAttribute('data-b')); }
    });

    H.showView(root, 'game');
    layoutGrid();
    updateBar();
    updateRing();
    if (window.ResizeObserver) {
      V.ro = new ResizeObserver(function () { layoutGrid(); });
      V.ro.observe(V.wrap);
    }
  }

  function tool(icon, label, fn) {
    return h('button', { class: 'tool', onclick: fn, 'aria-label': label }, H.icon(icon), h('span', { text: label }));
  }

  function buildGrid() {
    var P = G.P, grid = V.grid;
    H.clear(grid);
    G.els = new Array(P.N);
    P.boxes.forEach(function (b, bi) {
      var two = !!(b.a && b.d) && !b.p;
      var el = h('div', {
        class: 'cell bx' + (b.p ? ' pic' : '') + (two ? ' two' : ''), 'data-b': bi,
        style: { gridRow: (b.r + 1) + ' / span ' + b.h, gridColumn: (b.c + 1) + ' / span ' + b.w }
      });
      if (b.p) {
        var pv = h('div', { class: 'pv' });
        if (b.p.k === 'e') pv.appendChild(h('span', { class: 'emo', text: b.p.v }));
        else if (H.imgs[b.p.v]) pv.appendChild(h('img', { src: H.imgs[b.p.v], alt: '', draggable: 'false' }));
        else pv.appendChild(h('span', { class: 'emo', text: '❓' }));
        el.appendChild(pv);
        ['a', 'd'].forEach(function (d) {
          if (!b[d]) return;
          var e = P.entries[G.entBox[bi][d]];
          el.appendChild(h('span', { class: 'plen ' + d, text: E.patternText(e.len, e.sp) }));
          var ar = h('i', { class: 'ar ' + d });
          var s = b[d].s || 0;
          if (d === 'a') ar.style.setProperty('--ay', (s === 0 ? 25 : 75) + '%');
          else ar.style.setProperty('--ax', (s === 0 ? 75 : 25) + '%');
          el.appendChild(ar);
        });
      } else {
        ['a', 'd'].forEach(function (d) {
          if (!b[d]) return;
          var e = P.entries[G.entBox[bi][d]];
          var t = b[d].t;
          if (e.sp) t += ' ' + E.patternText(e.len, e.sp);
          el.appendChild(h('div', { class: 'bt ' + d }, h('span', { class: 't', text: t })));
          var ar = h('i', { class: 'ar ' + d });
          if (d === 'a') ar.style.setProperty('--ay', two ? '25%' : '50%');
          else ar.style.setProperty('--ax', '50%');
          el.appendChild(ar);
        });
      }
      grid.appendChild(el);
      for (var rr = 0; rr < b.h; rr++) for (var cc = 0; cc < b.w; cc++) G.els[(b.r + rr) * P.C + b.c + cc] = el;
    });
    for (var i = 0; i < P.N; i++) {
      var r = Math.floor(i / P.C), c = i % P.C;
      if (P.type[i] === 1) {
        var el2 = h('div', { class: 'cell lt', 'data-i': i, style: { gridRow: String(r + 1), gridColumn: String(c + 1) } }, h('span', { class: 'l' }));
        G.els[i] = el2;
        grid.appendChild(el2);
        paintCell(i);
      } else if (P.type[i] === 3) {
        grid.appendChild(h('div', { class: 'cell blk', style: { gridRow: String(r + 1), gridColumn: String(c + 1) } }));
      }
    }
    for (var q = 0; q < P.N; q++) if (P.type[q] === 1) paintSolClass(q);
  }

  function paintCell(i) {
    var el = G.els[i]; if (!el) return;
    el.firstChild.textContent = G.val[i];
    el.classList.toggle('bad', !!G.bad[i]);
    el.classList.toggle('rev', !!G.rev[i]);
    el.classList.toggle('has', !!G.val[i]);
    syncSol(i); paintSolClass(i);
  }
  function entSolved(e) {
    for (var k = 0; k < e.cells.length; k++) if (G.val[e.cells[k]] !== G.P.ch[e.cells[k]]) return false;
    return true;
  }
  function paintSolClass(c) {
    var el = G.els[c]; if (!el || !el.classList) return;
    var a = G.P.ea[c], d = G.P.ed[c];
    el.classList.toggle('sol', (a >= 0 && G.sol[a] === 1) || (d >= 0 && G.sol[d] === 1));
  }
  /* משבצת של מילה שנפתרה נכון (אפורה) ננעלת ואי אפשר לשנות בה אות */
  function isLocked(i) {
    var a = G.P.ea[i], d = G.P.ed[i];
    return (a >= 0 && G.sol[a] === 1) || (d >= 0 && G.sol[d] === 1);
  }
  function isFixed(i) { return !!G.rev[i] || isLocked(i); }
  function syncSol(i) {
    [G.P.ea[i], G.P.ed[i]].forEach(function (id) {
      if (id < 0) return;
      var s = entSolved(G.P.entries[id]) ? 1 : 0;
      if (G.sol[id] !== s) { G.sol[id] = s; G.P.entries[id].cells.forEach(paintSolClass); }
    });
  }

  /* גודל משבצות וגופן ההגדרות */
  function layoutGrid() {
    if (!G || !V.wrap) return;
    var P = G.P, w = V.wrap.clientWidth;
    if (!w) return;
    var pad = 8, z = H.S.set.zoom || 1;
    var cs = Math.floor(((w - pad * 2) * z) / P.C * 10) / 10;
    var avail = V.wrap.clientHeight - pad * 2;
    if (z === 1 && cs * P.R > avail && avail > 0) {
      // אם כל הלוח נכנס כמעט, מקטינים מעט כדי שיוצג בשלמותו
      var fit = Math.floor(avail / P.R * 10) / 10;
      if (fit >= cs * 0.88) cs = fit;
    }
    V.root.style.setProperty('--cs', cs);
    V.grid.style.width = (cs * P.C) + 'px';
    V.grid.style.height = (cs * P.R) + 'px';
    V.grid.style.gridTemplateColumns = 'repeat(' + P.C + ', ' + cs + 'px)';
    V.grid.style.gridTemplateRows = 'repeat(' + P.R + ', ' + cs + 'px)';
    fitClues(cs);
  }

  function fitClues(cs) {
    var P = G.P;
    H.$$('.bx', V.grid).forEach(function (el) {
      var bi = +el.getAttribute('data-b'), b = P.boxes[bi];
      if (b.p) return;
      H.$$('.bt', el).forEach(function (bt) {
        var span = bt.firstChild;
        var max = Math.min(cs * 0.36, 18), min = Math.max(5.5, cs * 0.15), size = max;
        for (; size > min; size -= 0.4) {
          span.style.fontSize = size.toFixed(1) + 'px';
          if (span.offsetHeight <= bt.clientHeight && span.scrollWidth <= span.clientWidth + 1) break;
        }
        span.style.fontSize = Math.max(size, min).toFixed(1) + 'px';
      });
    });
  }

  /* ---------- בחירה וניווט ---------- */
  function selectCellRaw(i, dir) {
    G.sel = i; G.dir = dir;
    var e = entryOf(i, dir);
    if (!e) { dir = dir === 'a' ? 'd' : 'a'; G.dir = dir; }
    refreshSel();
  }
  function selectCell(i, toggle) {
    if (G.P.type[i] !== 1) return;
    var dir = G.dir, ea = G.P.ea[i], ed = G.P.ed[i];
    if (toggle && G.sel === i && ea >= 0 && ed >= 0) dir = dir === 'a' ? 'd' : 'a';
    else if (G.sel !== i) dir = ea >= 0 ? 'a' : 'd';
    else if (dir === 'a' && ea < 0) dir = 'd';
    else if (dir === 'd' && ed < 0) dir = 'a';
    G.sel = i; G.dir = dir;
    refreshSel();
  }
  function selectEntry(e, firstEmpty) {
    var cell = e.cells[0];
    if (firstEmpty) for (var i = 0; i < e.cells.length; i++) if (!G.val[e.cells[i]]) { cell = e.cells[i]; break; }
    G.sel = cell; G.dir = e.d;
    refreshSel();
  }
  function selectBox(bi) {
    var m = G.entBox[bi] || {}, list = [];
    if (m.a != null) list.push(G.P.entries[m.a]);
    if (m.d != null) list.push(G.P.entries[m.d]);
    if (!list.length) return;
    var pick = list[0];
    if (G.cur && G.cur.box === bi && list.length > 1) pick = list[0] === G.cur ? list[1] : list[0];
    selectEntry(pick, true);
    H.vib(8);
  }
  function gotoRelative(step) {
    var P = G.P, ord = P.order, n = ord.length;
    if (!n || !G.cur) return;
    var idx = ord.indexOf(G.cur.id);
    for (var k = 1; k <= n; k++) {
      var e = P.entries[ord[(idx + step * k + n * 4) % n]];
      if (!G.done && !entryHasEmpty(e) && k < n) continue;
      selectEntry(e, true);
      return;
    }
  }

  var hlSet = [];
  function refreshSel() {
    hlSet.forEach(function (i) { var el = G.els[i]; if (el) el.classList.remove('hl', 'cur'); });
    hlSet = [];
    G.cur = G.sel >= 0 ? entryOf(G.sel, G.dir) : null;
    if (G.cur) {
      G.cur.cells.forEach(function (i) { G.els[i].classList.add('hl'); hlSet.push(i); });
      var el = G.els[G.sel]; el.classList.add('cur');
      scrollTo(G.els[G.sel]);
    }
    updateBar();
  }

  function scrollTo(el) {
    if (!el || !V.wrap) return;
    var w = V.wrap, r = el.getBoundingClientRect(), wr = w.getBoundingClientRect(), m = 14;
    if (r.top < wr.top + m) w.scrollTop -= (wr.top + m - r.top);
    else if (r.bottom > wr.bottom - m) w.scrollTop += (r.bottom - wr.bottom + m);
    if (r.left < wr.left + m) w.scrollLeft -= (wr.left + m - r.left);
    else if (r.right > wr.right - m) w.scrollLeft += (r.right - wr.right + m);
  }

  function updateBar() {
    if (!V.clue) return;
    var e = G.cur;
    H.clear(V.pat);
    if (!e) {
      V.clue.textContent = G.done ? 'כל הכבוד, התשחץ פתור' : 'בחר משבצת';
      return;
    }
    var txt;
    if (e.pic && e.pic.k === 'i') {
      txt = 'מי בתמונה?';
      if (G.hintShown[e.id] && e.clue) txt += ' ' + e.clue;
    } else txt = e.clue || 'תמונה';
    V.clue.textContent = txt;
    var patNode = h('span', { class: 'pl', text: E.patternText(e.len, e.sp) });
    var chips = h('span', { class: 'chips' });
    var splitAt = {}, acc = 0;
    if (e.sp) e.sp.forEach(function (n) { acc += n; splitAt[acc] = 1; });
    e.cells.forEach(function (ci, k) {
      var c = h('span', { class: 'chip' + (ci === G.sel ? ' on' : '') + (G.val[ci] ? ' f' : '') + (G.bad[ci] ? ' x' : ''), text: G.val[ci] || '' });
      chips.appendChild(c);
      if (splitAt[k + 1] && k + 1 < e.len) chips.appendChild(h('span', { class: 'sp' }));
    });
    V.pat.appendChild(patNode); V.pat.appendChild(chips);
    if (e.pic && e.pic.k === 'i' && e.clue && !G.hintShown[e.id]) V.pat.appendChild(V.hintBtn);
  }

  function updateRing() {
    var total = G.li.length, f = 0;
    for (var i = 0; i < total; i++) if (G.val[G.li[i]]) f++;
    G.filled = f;
    var C = 2 * Math.PI * 16;
    V.ringFg.setAttribute('stroke-dasharray', (C * f / total).toFixed(2) + ' ' + C.toFixed(2));
    V.ringTxt.textContent = f + '/' + total;
  }

  /* ---------- הקלדה ---------- */
  function setVal(i, v, pushUndo) {
    if (pushUndo) {
      G.undo.push({ i: i, old: G.val[i], sel: G.sel, dir: G.dir });
      if (G.undo.length > 300) G.undo.shift();
    }
    G.val[i] = v;
    G.bad[i] = 0;
    paintCell(i);
  }

  function typeLetter(ch) {
    if (G.done || G.sel < 0) return;
    ch = E.normLetters(ch);
    if (!ch) return;
    var i = G.sel;
    if (isFixed(i)) {
      /* אות נעולה: ממשיכים רק אם הוקלדה אותה האות, אחרת נשארים במקום */
      if (ch === G.val[i]) advance(); else H.toast('האות הזו נעולה', 900);
      return;
    }
    var e = G.cur;
    var ids = [G.P.ea[i], G.P.ed[i]].filter(function (x) { return x >= 0; });
    var before = ids.map(function (x) { return G.sol[x] === 1; });
    setVal(i, ch, true);
    H.snd('key'); H.vib(6);
    if (H.S.set.autoCheck && ch !== G.P.ch[i]) { G.bad[i] = 1; paintCell(i); H.snd('bad'); }
    updateRing();
    markDirty();
    /* כל מונח שנפתר עכשיו (גם אם לא זה שעומדים עליו) מקבל הבהוב וצליל */
    var fresh = ids.filter(function (x, k) { return !before[k] && G.sol[x] === 1; });
    if (checkWin()) return;
    if (fresh.length) {
      fresh.forEach(function (x) { flash(G.P.entries[x]); });
      H.snd('ok'); H.vib(18);
    }
    if (G.pin) {
      /* מנעול משבצת: נשארים במקום עד שהמילה נפתרה נכון */
      if (e && entryCorrect(e)) setPin(false);
      return;
    }
    advance();
  }
  function setPin(on) {
    G.pin = !!on;
    if (V.pinBtn) V.pinBtn.classList.toggle('on', G.pin);
  }

  function entryCorrect(e) {
    for (var k = 0; k < e.cells.length; k++) if (G.val[e.cells[k]] !== G.P.ch[e.cells[k]]) return false;
    return true;
  }
  function flash(e) {
    e.cells.forEach(function (i) { var el = G.els[i]; el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 700); });
  }

  function advance() {
    var e = G.cur;
    if (!e) { updateBar(); return; }
    var idx = e.cells.indexOf(G.sel), k;
    /* עוברים למשבצת הבאה במילה, גם אם היא כבר מלאה (אות של מילה אחרת שנפתרה) */
    if (idx >= 0 && idx + 1 < e.cells.length) { moveTo(e.cells[idx + 1]); return; }
    for (k = 0; k <= idx; k++) if (!G.val[e.cells[k]]) { moveTo(e.cells[k]); return; }
    if (H.S.set.autoJump) {
      var P = G.P, ord = P.order, n = ord.length, pos = ord.indexOf(e.id);
      for (var j = 1; j < n; j++) {
        var cand = P.entries[ord[(pos + j) % n]];
        if (entryHasEmpty(cand)) { selectEntry(cand, true); return; }
      }
    }
    updateBar();
  }
  function moveTo(i) { G.sel = i; refreshSel(); }

  function backspace() {
    if (G.done || G.sel < 0) return;
    var i = G.sel;
    if (G.val[i] && !isFixed(i)) {
      setVal(i, '', true); H.snd('key'); updateRing(); markDirty(); updateBar();
      return;
    }
    var e = G.cur; if (!e) return;
    var idx = e.cells.indexOf(i);
    for (var k = idx - 1; k >= 0; k--) {
      var ci = e.cells[k];
      G.sel = ci; refreshSel();
      if (!isFixed(ci)) { if (G.val[ci]) { setVal(ci, '', true); updateRing(); markDirty(); updateBar(); } return; }
    }
  }

  function undo() {
    if (G.done) return;
    var u = G.undo.pop();
    while (u && isLocked(u.i)) u = G.undo.pop();
    if (!u) { H.toast('אין מה לבטל'); return; }
    G.val[u.i] = u.old; G.bad[u.i] = 0; paintCell(u.i);
    G.sel = u.i; G.dir = u.dir; refreshSel();
    updateRing(); markDirty();
  }

  function clearWord() {
    if (G.done || !G.cur) return;
    var any = false;
    G.cur.cells.forEach(function (i) {
      if (G.val[i] && !isFixed(i)) { setVal(i, '', true); any = true; }
    });
    if (any) { updateRing(); markDirty(); updateBar(); H.snd('key'); }
  }

  function cycleZoom() {
    var z = H.S.set.zoom || 1;
    H.S.set.zoom = z === 1 ? 1.5 : (z === 1.5 ? 2 : 1);
    H.touch();
    layoutGrid();
    setTimeout(function () { scrollTo(G.els[G.sel]); }, 30);
    H.toast(H.S.set.zoom === 1 ? 'תצוגה רגילה' : 'הגדלה ×' + H.S.set.zoom, 1200);
  }

  /* ---------- שמירה ---------- */
  function persist() {
    if (!G) return;
    var c = '', r = '';
    for (var k = 0; k < G.li.length; k++) { c += G.val[G.li[k]] || ' '; r += G.rev[G.li[k]] ? '1' : '0'; }
    var rec = G.rec;
    rec.c = c; rec.r = r; rec.t = Math.floor(G.t); rec.h = G.hints; rec.u = Date.now(); rec.as = G.assisted ? 1 : 0;
    rec.d = G.done ? 1 : 0; rec.n = G.li.length;
    H.touch();
  }
  H.persistGame = persist;
  var dirtyT = 0;
  function markDirty() { clearTimeout(dirtyT); dirtyT = setTimeout(persist, 500); }

  function startTimer() {
    stopTimer();
    timerI = setInterval(function () {
      if (!G || G.done || document.hidden || H.topSheet() || H.view !== 'game') return;
      G.t++;
      if (V.timer) V.timer.textContent = H.fmtTime(G.t);
      if (++G.sinceSave >= 6) { G.sinceSave = 0; persist(); }
    }, 1000);
  }
  function stopTimer() { clearInterval(timerI); timerI = 0; }

  document.addEventListener('visibilitychange', function () { if (document.hidden && G) persist(); });
  window.addEventListener('pagehide', function () { if (G) persist(); H.save(); });

  /* ---------- בדיקות ורמזים ---------- */
  function checkEntry(e) {
    var wrong = 0;
    e.cells.forEach(function (i) { if (G.val[i] && G.val[i] !== G.P.ch[i]) { G.bad[i] = 1; wrong++; paintCell(i); } });
    updateBar();
    return wrong;
  }
  function checkAll() {
    if (G.done) return;
    var wrong = 0;
    for (var k = 0; k < G.li.length; k++) {
      var i = G.li[k];
      if (G.val[i] && G.val[i] !== G.P.ch[i]) { G.bad[i] = 1; wrong++; paintCell(i); }
    }
    updateBar();
    if (wrong) { H.snd('bad'); H.toast(wrong === 1 ? 'יש אות אחת שגויה' : 'יש ' + wrong + ' אותיות שגויות'); }
    else { H.snd('ok'); H.toast(G.filled === G.li.length ? 'הכול נכון' : 'עד עכשיו הכול נכון'); }
  }

  function spend(n) {
    if (H.S.coins < n) { H.toast('אין מספיק מטבעות. פותרים תשחצים כדי להרוויח עוד.'); return false; }
    H.addCoins(-n); return true;
  }
  function revealCell(i) {
    G.val[i] = G.P.ch[i]; G.rev[i] = 1; G.bad[i] = 0; paintCell(i);
  }
  function openHints() {
    if (G.done) { H.toast('התשחץ כבר פתור'); return; }
    var e = G.cur;
    var s = H.sheet({
      title: 'רמזים', sub: 'המטבעות שלך: ' + H.S.coins,
      body: [
        hintRow('eye', 'חשוף אות', 'המשבצת שנבחרה', COST.cell, function () {
          if (G.sel < 0 || G.rev[G.sel]) { H.toast('בחר משבצת'); return false; }
          if (!spend(COST.cell)) return false;
          G.hints++; H.S.mc.hints++; revealCell(G.sel); H.snd('coin'); updateRing(); persist(); updateBar();
          if (!checkWin()) advance();
        }),
        hintRow('bolt', 'חשוף מילה', 'כל ההגדרה הנוכחית', COST.word, function () {
          if (!e) return false;
          if (!spend(COST.word)) return false;
          G.hints++; H.S.mc.hints++;
          e.cells.forEach(revealCell);
          H.snd('coin'); updateRing(); persist(); updateBar();
          if (!checkWin()) advance();
        }),
        hintRow('check', 'בדוק מילה', 'מסמן אותיות שגויות', 0, function () {
          if (!e) return false;
          var w = checkEntry(e);
          H.toast(w ? 'יש טעות במילה' : 'הכול נכון עד עכשיו');
        }),
        hintRow('shield', 'בדוק הכול', 'כל הלוח', 0, function () { checkAll(); }),
        hintRow('refresh', 'פתור הכול', 'בלי מטבעות ובלי פרס', 0, function () {
          H.confirm('לפתור את כל התשחץ?', 'התשחץ יסומן כפתור, אבל לא תקבל מטבעות.', 'פתור', function () {
            for (var k = 0; k < G.li.length; k++) revealCell(G.li[k]);
            G.assisted = true; updateRing(); checkWin();
          }, true);
        })
      ]
    });
    function hintRow(ic, t, sub, cost, fn) {
      return h('button', {
        class: 'hint-row', onclick: function () { var r = fn(); if (r !== false) s.close(); }
      }, H.icon(ic), h('div', { class: 'hr-t' }, h('b', { text: t }), h('small', { text: sub })),
        cost ? h('span', { class: 'price' }, H.icon('coin'), String(cost)) : h('span', { class: 'free', text: 'חינם' }));
    }
  }

  function openMenu() {
    var s = H.sheet({
      title: H.puzTitle(G.id),
      body: [
        menuRow('refresh', 'התחל מחדש', function () {
          H.confirm('להתחיל מחדש?', 'כל ההתקדמות בתשחץ הזה תימחק.', 'התחל מחדש', function () { restart(); }, true);
        }),
        menuRow('shield', 'בדיקה אוטומטית: ' + (H.S.set.autoCheck ? 'פועלת' : 'כבויה'), function () {
          H.S.set.autoCheck = !H.S.set.autoCheck; H.touch();
          H.toast(H.S.set.autoCheck ? 'טעויות יסומנו מיד' : 'בדיקה אוטומטית כבויה');
        }),
        menuRow('sliders', 'הגדרות', function () { exitToScreen('settings'); })
      ]
    });
    function menuRow(ic, t, fn) {
      return h('button', { class: 'hint-row', onclick: function () { s.close(); fn(); } }, H.icon(ic), h('div', { class: 'hr-t' }, h('b', { text: t })));
    }
  }

  function restart() {
    for (var i = 0; i < G.P.N; i++) { G.val[i] = ''; G.rev[i] = 0; G.bad[i] = 0; }
    G.done = false; G.assisted = false; G.hints = 0; G.t = 0; G.undo = [];
    G.rec.d = 0; G.rec.as = 0;
    for (var k = 0; k < G.li.length; k++) paintCell(G.li[k]);
    persist(); updateRing();
    var f = firstOpenEntry(); if (f) selectEntry(f, true);
  }

  /* ---------- הקלטה (זיהוי דיבור) ---------- */
  function listen() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !G.cur || G.done) return;
    var e = G.cur;
    var rec = new SR();
    rec.lang = 'he-IL'; rec.maxAlternatives = 5; rec.interimResults = false;
    H.toast('אומר את התשובה…', 3000);
    rec.onresult = function (ev) {
      var alts = ev.results[0], found = null;
      for (var i = 0; i < alts.length; i++) {
        var w = E.normLetters(alts[i].transcript);
        if (w.length === e.len) { found = w; break; }
      }
      if (!found) { H.toast('לא הבנתי תשובה באורך ' + e.len + ' אותיות'); return; }
      e.cells.forEach(function (ci, k) { if (!isFixed(ci)) setVal(ci, found[k], true); });
      updateRing(); markDirty(); updateBar();
      if (!checkWin()) { H.snd('key'); advance(); }
    };
    rec.onerror = function () { H.toast('ההקלטה לא הצליחה'); };
    try { rec.start(); } catch (err) { H.toast('ההקלטה לא זמינה'); }
  }

  /* ---------- ניצחון ---------- */
  function checkWin() {
    if (G.done) return true;
    for (var k = 0; k < G.li.length; k++) { var i = G.li[k]; if (G.val[i] !== G.P.ch[i]) return false; }
    win();
    return true;
  }

  function win() {
    var S = H.S, mode = G.pi ? G.pi.mode : 'a';
    var mBefore = H.claimable ? H.claimable() : 0;
    G.done = true; setPin(false);
    stopTimer();
    persist();
    var earned = 0, bonus = [];
    if (!G.assisted && !G.rec.cred) {
      earned = mode === 'a' ? 25 : 15;
      if (G.hints === 0) { earned += 10; bonus.push('בלי רמזים'); }
      G.rec.cred = 1;
      var mc = S.mc, td0 = H.today();
      mc.words += G.P.entries.length;
      G.P.entries.forEach(function (e) { if (e.pic && e.pic.k === 'i') mc.faces++; });
      if (G.hints === 0) mc.nohint++;
      if (G.t <= 600) mc.fast10++;
      if (G.t <= 300) mc.fast5++;
      mc.secs += G.t;
      if (mode === 'a' && G.P.R * G.P.C >= 140) mc.big++;
      if (mc.dayD !== td0) { mc.dayD = td0; mc.dayN = 0; }
      mc.dayN++;
      mc.earn += earned;
      H.addCoins(earned);
      if (mode === 'a') { S.st.a++; S.st.secA += G.t; } else { S.st.k++; S.st.secK += G.t; }
      var td = H.today(), sk = S.st.streak;
      if (sk.last !== td) {
        sk.cur = (sk.last && H.dayNum(td) - H.dayNum(sk.last) === 1) ? sk.cur + 1 : 1;
        sk.last = td;
        if (sk.cur > sk.best) sk.best = sk.cur;
      }
    }
    G.rec.d = 1;
    if (H.claimable && H.claimable() > mBefore) setTimeout(function () { H.toast('הושלמה משימה! הפרס מחכה במסך המשימות', 3400); }, 3200);
    H.touch(); H.save();
    H.snd('win'); H.vib(40);
    confetti();
    refreshSel();
    updateBar();
    setTimeout(function () { showWin(earned, bonus); }, 650);
    if (H.cloudAuto) H.cloudAuto();
  }

  function showWin(earned, bonus) {
    var hasNext = !!nextPuzzleId();
    var chips = h('div', { class: 'win-chips' },
      h('div', { class: 'wchip' }, H.icon('flame'), h('b', { text: H.fmtTime(G.t) }), h('small', { text: 'זמן' })),
      h('div', { class: 'wchip' }, H.icon('bulb'), h('b', { text: String(G.hints) }), h('small', { text: 'רמזים' })),
      h('div', { class: 'wchip' }, H.icon('coin'), h('b', { text: '\u200E+' + earned }), h('small', { text: 'מטבעות' })));
    H.sheet({
      title: G.assisted ? 'התשחץ נפתר' : 'כל הכבוד!', center: true, dismiss: false,
      sub: G.assisted ? 'נפתר בעזרת "פתור הכול", בלי פרס.' : (bonus.length ? bonus.join(' · ') : 'פתרת את התשחץ'),
      body: chips,
      actions: [
        { t: 'חזרה', cls: 'ghost', fn: function () { H.exitGame(); } },
        { t: hasNext ? 'לתשחץ הבא' : 'סיום', cls: 'primary', fn: function () { var n = nextPuzzleId(); if (n) { leaveQuiet(); H.openPuzzle(n); } else H.exitGame(); } }
      ]
    });
  }

  function nextPuzzleId() {
    var pi = G.pi;
    if (!pi) return null;
    if (pi.type === 'pack') {
      for (var d = 1; d <= H.PACK_SIZE; d++) {
        var idx = ((pi.idx - 1 + d) % H.PACK_SIZE) + 1;
        var id = H.puzId(pi.mode, pi.pack, idx);
        if (!(H.S.p[id] && H.S.p[id].d)) return id;
      }
      return null;
    }
    if (pi.type === 'rand') return H.randId(pi.mode);
    return null;
  }

  function confetti() {
    var layer = h('div', { class: 'confetti' });
    var cols = ['#ffb547', '#3ddbc0', '#ff6b8b', '#7b8cff', '#ffe066'];
    for (var i = 0; i < 46; i++) {
      var p = h('i', { style: { left: Math.random() * 100 + '%', background: cols[i % cols.length], animationDelay: (Math.random() * 0.35) + 's', animationDuration: (1.5 + Math.random() * 1.2) + 's', transform: 'rotate(' + Math.random() * 360 + 'deg)' } });
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 3200);
  }

  /* ---------- יציאה ---------- */
  function leaveQuiet() {
    if (!G) return;
    persist(); stopTimer();
    if (V.ro) { try { V.ro.disconnect(); } catch (e) {} }
    G = null; V = {};
    H.applyTheme();
    try { if (history.state && history.state.g) history.replaceState({}, ''); } catch (e) {}
  }
  H.exitGame = function () {
    H.closeSheets();
    if (history.state && history.state.g) { history.back(); }
    else { leaveQuiet(); H.go(H.prevScreen || 'home', H.prevArg); }
  };
  function exitToScreen(name) { H.closeSheets(); leaveQuiet(); H.go(name); }
  window.addEventListener('popstate', function () {
    if (G) { H.closeSheets(); leaveQuiet(); H.go(H.prevScreen || 'home', H.prevArg); }
  });

  /* ---------- מקלדת פיזית ---------- */
  document.addEventListener('keydown', function (ev) {
    if (!G || H.view !== 'game' || H.topSheet() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var t = ev.target && ev.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') return;
    var k = ev.key;
    if (k === 'Backspace') { ev.preventDefault(); backspace(); return; }
    if (k === 'Tab') { ev.preventDefault(); gotoRelative(ev.shiftKey ? -1 : 1); return; }
    if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'ArrowUp' || k === 'ArrowDown') {
      ev.preventDefault();
      var P = G.P, i = G.sel; if (i < 0) return;
      var r = Math.floor(i / P.C), c = i % P.C;
      if (k === 'ArrowLeft') c++; else if (k === 'ArrowRight') c--; else if (k === 'ArrowUp') r--; else r++;
      var guard = 0;
      while (r >= 0 && r < P.R && c >= 0 && c < P.C && guard++ < 40) {
        var ni = r * P.C + c;
        if (P.type[ni] === 1) { var dir = (k === 'ArrowUp' || k === 'ArrowDown') ? 'd' : 'a'; G.sel = ni; G.dir = entryOf(ni, dir) ? dir : (dir === 'a' ? 'd' : 'a'); refreshSel(); return; }
        if (k === 'ArrowLeft') c++; else if (k === 'ArrowRight') c--; else if (k === 'ArrowUp') r--; else r++;
      }
      return;
    }
    if (k.length === 1) {
      var ch = (k >= 'א' && k <= 'ת') ? k : LAT[k.toLowerCase()];
      if (ch) { ev.preventDefault(); typeLetter(ch); }
    }
  });

  H.gameSolvedFill = function () {};
})();
