/* חצים ואותיות - ליבה: כלים, מצב, אחסון, צלילים, תמונות ובנקי מילים */
(function () {
  'use strict';
  var H = window.H = {};
  var E = window.Engine;

  H.VERSION = '1.0.0';
  H.KEY = 'hetz.v1';
  H.BANK_VER = window.BANK_VERSION || 1;

  /* ---------- כלי DOM ---------- */
  var $ = H.$ = function (s, r) { return (r || document).querySelector(s); };
  H.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* בונה אלמנט בצורה בטוחה: טקסט תמיד נכנס כ-textContent, אף פעם לא כ-HTML */
  var h = H.h = function (tag, props) {
    var e = document.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'style' && typeof v === 'object') { for (var sk in v) e.style[sk] = v[sk]; }
        else if (k === 'data') { for (var dk in v) e.dataset[dk] = v[dk]; }
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
        else e.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (var i = 2; i < arguments.length; i++) appendKids(e, arguments[i]);
    return e;
  };
  function appendKids(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) appendKids(e, c[i]); return; }
    e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  H.icon = function (n, cls) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(ns, 'use');
    u.setAttribute('href', '#i-' + n);
    s.appendChild(u);
    return s;
  };
  H.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  H.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  H.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s || 0));
    var hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return (hh ? H.pad2(hh) + ':' : '') + H.pad2(mm) + ':' + H.pad2(ss);
  };
  H.today = function () {
    var d = new Date();
    return d.getFullYear() + '-' + H.pad2(d.getMonth() + 1) + '-' + H.pad2(d.getDate());
  };
  H.dayNum = function (iso) {
    var p = String(iso).split('-');
    return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  };
  H.rid = function (n) {
    var s = '', a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    try {
      var arr = new Uint8Array(n || 8); crypto.getRandomValues(arr);
      for (var i = 0; i < arr.length; i++) s += a[arr[i] % a.length];
    } catch (e) { for (var j = 0; j < (n || 8); j++) s += a[Math.floor(Math.random() * a.length)]; }
    return s;
  };
  H.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------- הודעות קצרות ---------- */
  var toastT = 0;
  H.toast = function (msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, ms || 2300);
  };

  /* ---------- חלונות תחתונים ---------- */
  var sheetStack = [];
  H.sheet = function (o) {
    var layer = $('#layer');
    var back = h('div', { class: 'back' });
    var box = h('div', { class: 'sheet' + (o.center ? ' center' : '') + (o.cls ? ' ' + o.cls : ''), role: 'dialog', 'aria-modal': 'true' });
    if (o.title) box.appendChild(h('div', { class: 'sh-title', text: o.title }));
    if (o.sub) box.appendChild(h('div', { class: 'sh-sub', text: o.sub }));
    var body = h('div', { class: 'sh-body' });
    appendKids(body, o.body);
    box.appendChild(body);
    var api = {
      el: box, body: body,
      close: function () {
        if (!back.parentNode) return;
        box.classList.add('out'); back.classList.add('out');
        setTimeout(function () { if (back.parentNode) back.parentNode.removeChild(back); }, 180);
        var i = sheetStack.indexOf(api); if (i >= 0) sheetStack.splice(i, 1);
        if (o.onClose) o.onClose();
      }
    };
    if (o.actions && o.actions.length) {
      var row = h('div', { class: 'sh-actions' });
      o.actions.forEach(function (a) {
        row.appendChild(h('button', {
          class: 'btn ' + (a.cls || ''), text: a.t,
          onclick: function () { var r = a.fn ? a.fn(api) : undefined; if (!a.keep && r !== false) api.close(); }
        }));
      });
      box.appendChild(row);
    }
    back.appendChild(box);
    if (o.dismiss !== false) back.addEventListener('pointerdown', function (ev) { if (ev.target === back) api.close(); });
    layer.appendChild(back);
    sheetStack.push(api);
    return api;
  };
  H.closeSheets = function () { while (sheetStack.length) sheetStack[sheetStack.length - 1].close(); };
  H.topSheet = function () { return sheetStack[sheetStack.length - 1] || null; };
  H.confirm = function (title, text, okText, fn, danger) {
    return H.sheet({
      title: title, sub: text, center: true,
      actions: [
        { t: 'ביטול', cls: 'ghost' },
        { t: okText || 'אישור', cls: danger ? 'danger' : 'primary', fn: function () { fn(); } }
      ]
    });
  };

  /* ---------- צלילים ורטט ---------- */
  var AC = null;
  function ac() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
    if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
    return AC;
  }
  function tone(f, d, type, v, t0) {
    var a = ac(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.value = f;
    var t = a.currentTime + (t0 || 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v || 0.1, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + d + 0.03);
  }
  H.snd = function (k) {
    if (!H.S || !H.S.set.sound) return;
    try {
      if (k === 'key') tone(620, 0.04, 'triangle', 0.05);
      else if (k === 'ok') { tone(660, 0.12, 'sine', 0.09); tone(880, 0.16, 'sine', 0.09, 0.09); }
      else if (k === 'bad') { tone(180, 0.2, 'sawtooth', 0.05); }
      else if (k === 'coin') { tone(988, 0.08, 'square', 0.04); tone(1319, 0.14, 'square', 0.04, 0.07); }
      else if (k === 'win') { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.28, 'triangle', 0.1, i * 0.11); }); }
    } catch (e) {}
  };
  H.vib = function (ms) {
    if (H.S && H.S.set.vib && navigator.vibrate) { try { navigator.vibrate(ms || 12); } catch (e) {} }
  };

  /* ---------- מצב ואחסון ---------- */
  H.defaults = function () {
    return {
      v: 1, id: H.rid(12), created: Date.now(), updatedAt: 0,
      set: {
        theme: 'dark', sound: true, vib: true, autoCheck: false, autoJump: true,
        mode: 'a', zoom: 1, clientId: '', lockOn: false, pinHash: '', pinSalt: '', lockSec: 60,
        updateBase: '', unlockAll: false, autoSync: true, welcomed: false, libSeen: false
      },
      name: '', gift: 0, coins: 0, coinsAt: 0, mc: { words: 0, faces: 0, nohint: 0, fast10: 0, fast5: 0, secs: 0, big: 0, earn: 0, hints: 0, dayN: 0, dayD: '' }, m: {},
      st: { a: 0, k: 0, secA: 0, secK: 0, streak: { cur: 0, best: 0, last: '' } },
      p: {}, lib: [], libDel: [], photos: {}, last: '', cloud: { at: 0 }
    };
  };

  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function num(v, d, lo, hi) { v = +v; if (!isFinite(v)) return d; return Math.max(lo, Math.min(hi, v)); }
  var ID_RE = /^[A-Za-z0-9\-_:]{1,48}$/;

  function cleanDef(d) {
    if (!d || typeof d !== 'object') return null;
    var R = d.R | 0, C = d.C | 0;
    if (R < 2 || C < 2 || R > 40 || C > 40) return null;
    if (!Array.isArray(d.g) || d.g.length !== R) return null;
    for (var i = 0; i < R; i++) if (typeof d.g[i] !== 'string' || d.g[i].length !== C) return null;
    if (!Array.isArray(d.b) || d.b.length > 400) return null;
    try { E.parseDef(d); } catch (e) { return null; }
    return d;
  }

  H.sanitize = function (o) {
    var S = H.defaults();
    if (!o || typeof o !== 'object') return S;
    S.id = str(o.id, 40) || S.id;
    S.created = num(o.created, S.created, 0, 4e12);
    S.updatedAt = num(o.updatedAt, 0, 0, 4e12);
    var s = o.set || {}, D = S.set;
    if (['auto', 'dark', 'light'].indexOf(s.theme) >= 0) D.theme = s.theme;
    ['sound', 'vib', 'autoCheck', 'autoJump', 'lockOn', 'unlockAll', 'autoSync', 'welcomed', 'libSeen'].forEach(function (k) { if (typeof s[k] === 'boolean') D[k] = s[k]; });
    if (s.mode === 'a' || s.mode === 'k') D.mode = s.mode;
    D.zoom = [1, 1.5, 2].indexOf(+s.zoom) >= 0 ? +s.zoom : 1;
    D.clientId = str(s.clientId, 200).trim();
    D.pinHash = str(s.pinHash, 100); D.pinSalt = str(s.pinSalt, 40);
    D.lockSec = num(s.lockSec, 60, 0, 86400);
    D.updateBase = str(s.updateBase, 300).trim();
    if (!D.pinHash) D.lockOn = false;
    S.name = str(o.name, 24).trim(); S.gift = o.gift ? 1 : 0;
    S.coins = Math.floor(num(o.coins, 0, 0, 1e9));
    S.coinsAt = num(o.coinsAt, 0, 0, 4e12);
    ['words', 'faces', 'nohint', 'fast10', 'fast5', 'secs', 'big', 'earn', 'hints', 'dayN'].forEach(function (k) {
      S.mc[k] = Math.floor(num((o.mc || {})[k], 0, 0, 1e9));
    });
    S.mc.dayD = /^\d{4}-\d{2}-\d{2}$/.test((o.mc || {}).dayD || '') ? o.mc.dayD : '';
    for (var mk in (o.m || {})) { if (/^[a-z0-9]{2,16}$/.test(mk)) S.m[mk] = Math.floor(num(o.m[mk], 0, 0, 3)); }
    var st = o.st || {};
    S.st.a = Math.floor(num(st.a, 0, 0, 1e7)); S.st.k = Math.floor(num(st.k, 0, 0, 1e7));
    S.st.secA = Math.floor(num(st.secA, 0, 0, 1e10)); S.st.secK = Math.floor(num(st.secK, 0, 0, 1e10));
    var sk = st.streak || {};
    S.st.streak = { cur: Math.floor(num(sk.cur, 0, 0, 1e5)), best: Math.floor(num(sk.best, 0, 0, 1e5)), last: /^\d{4}-\d{2}-\d{2}$/.test(sk.last || '') ? sk.last : '' };
    var p = o.p || {};
    var n = 0;
    for (var id in p) {
      if (!ID_RE.test(id) || !p[id] || typeof p[id] !== 'object') continue;
      if (++n > 3000) break;
      var q = p[id];
      var def = cleanDef(q.def);
      if (!def) continue;
      S.p[id] = {
        c: str(q.c, 2000), r: str(q.r, 2000), t: Math.floor(num(q.t, 0, 0, 1e7)),
        d: q.d ? 1 : 0, h: Math.floor(num(q.h, 0, 0, 1e5)), u: num(q.u, 0, 0, 4e12),
        n: Math.floor(num(q.n, 0, 0, 5000)), as: q.as ? 1 : 0, cred: q.cred ? 1 : 0, def: def, bv: Math.floor(num(q.bv, 1, 0, 1e6))
      };
    }
    S.last = ID_RE.test(o.last || '') ? o.last : '';
    var lib = Array.isArray(o.lib) ? o.lib.slice(0, 3000) : [];
    lib.forEach(function (x) {
      if (!x || typeof x !== 'object') return;
      var disp = str(x.a, 40).trim();
      if (E.normLetters(disp).length < 2) return;
      var clues = (Array.isArray(x.clues) ? x.clues : []).map(function (c) { return str(c, 80).trim(); }).filter(Boolean).slice(0, 4);
      if (!clues.length) return;
      S.lib.push({
        id: str(x.id, 24) || H.rid(8), a: disp, clues: clues,
        lvl: [1, 2, 3].indexOf(+x.lvl) >= 0 ? +x.lvl : 2,
        aud: ['a', 'k', 'b'].indexOf(x.aud) >= 0 ? x.aud : 'b',
        emoji: str(x.emoji, 8), u: num(x.u, 0, 0, 4e12)
      });
    });
    S.libDel = (Array.isArray(o.libDel) ? o.libDel : []).slice(0, 3000).map(function (x) { return str(x, 24); }).filter(Boolean);
    var ph = o.photos || {};
    for (var a in ph) {
      if (/^[א-ת]{2,12}$/.test(a) && typeof ph[a] === 'string' && /^[A-Za-z0-9]{3,30}$/.test(ph[a])) S.photos[a] = ph[a];
    }
    S.cloud = { at: num((o.cloud || {}).at, 0, 0, 4e12) };
    return S;
  };

  var mem = null;
  H.load = function () {
    var raw = null;
    try { raw = localStorage.getItem(H.KEY); } catch (e) { raw = mem; }
    var S = null;
    if (raw) {
      try { S = H.sanitize(JSON.parse(raw)); }
      catch (e) {
        try { localStorage.setItem(H.KEY + '.bad', raw); } catch (e2) {}
        S = null;
      }
    }
    H.S = S || H.defaults();
  };
  var saveT = 0;
  H.save = function () {
    clearTimeout(saveT);
    var s = JSON.stringify(H.S);
    try { localStorage.setItem(H.KEY, s); } catch (e) { mem = s; }
  };
  H.saveSoon = function () { clearTimeout(saveT); saveT = setTimeout(H.save, 350); };
  H.touch = function () { H.S.updatedAt = Date.now(); H.saveSoon(); };
  H.addCoins = function (n) {
    H.S.coins = Math.max(0, H.S.coins + n);
    H.S.coinsAt = Date.now();
    H.touch();
    var el = H.$$('[data-coins]'); el.forEach(function (x) { x.textContent = H.S.coins; });
  };

  /* ---------- תמונות (IndexedDB) ---------- */
  var idb = null;
  var imgs = H.imgs = {};
  function idbOpen() {
    return new Promise(function (res) {
      try {
        var rq = indexedDB.open('hetz-img', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('i'); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { res(null); };
        rq.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  H.imgInit = function () {
    return idbOpen().then(function (db) {
      idb = db;
      if (!db) return;
      return new Promise(function (res) {
        try {
          var tx = db.transaction('i', 'readonly'), st = tx.objectStore('i'), rq = st.openCursor();
          rq.onsuccess = function () {
            var c = rq.result;
            if (c) { if (typeof c.value === 'string' && c.value.indexOf('data:image/') === 0) imgs[c.key] = c.value; c.continue(); }
            else res();
          };
          rq.onerror = function () { res(); };
        } catch (e) { res(); }
      });
    });
  };
  H.imgPut = function (key, data) {
    imgs[key] = data;
    return new Promise(function (res) {
      if (!idb) return res();
      try {
        var tx = idb.transaction('i', 'readwrite');
        tx.objectStore('i').put(data, key);
        tx.oncomplete = function () { res(); }; tx.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  };
  H.imgDel = function (key) {
    delete imgs[key];
    return new Promise(function (res) {
      if (!idb) return res();
      try {
        var tx = idb.transaction('i', 'readwrite');
        tx.objectStore('i').delete(key);
        tx.oncomplete = function () { res(); }; tx.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  };

  /* חותך ריבוע (מוטה כלפי מעלה לפנים), מקטין ל-360 ושומר כ-JPEG */
  H.processImage = function (src) {
    return new Promise(function (res, rej) {
      var img = new Image(), objUrl = null;
      if (typeof src === 'string') img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var w = img.naturalWidth, hh = img.naturalHeight;
          if (!w || !hh) return rej(new Error('size'));
          var s = Math.min(w, hh), sx = (w - s) / 2, sy = (hh - s) * 0.22;
          var out = 360, cv = document.createElement('canvas');
          cv.width = cv.height = out;
          var cx = cv.getContext('2d');
          cx.fillStyle = '#fff'; cx.fillRect(0, 0, out, out);
          cx.drawImage(img, sx, sy, s, s, 0, 0, out, out);
          var d = cv.toDataURL('image/jpeg', 0.8);
          if (objUrl) URL.revokeObjectURL(objUrl);
          res(d);
        } catch (e) { rej(new Error('cors')); }
      };
      img.onerror = function () { if (objUrl) URL.revokeObjectURL(objUrl); rej(new Error('load')); };
      if (typeof src === 'string') img.src = src;
      else { objUrl = URL.createObjectURL(src); img.src = objUrl; }
    });
  };
  H.setPhoto = function (ans, data) {
    var old = H.S.photos[ans];
    var key = 'p' + Date.now().toString(36) + H.rid(4);
    return H.imgPut(key, data).then(function () {
      H.S.photos[ans] = key;
      if (old) H.imgDel(old);
      H.bankDirty = true;
      H.touch();
    });
  };
  H.removePhoto = function (ans) {
    var old = H.S.photos[ans];
    if (old) { delete H.S.photos[ans]; H.imgDel(old); H.bankDirty = true; H.touch(); }
  };

  /* ---------- בנקי מילים ---------- */
  var cache = null;
  H.bankDirty = true;
  H.buildBanks = function () {
    if (cache && !H.bankDirty) return cache;
    var A = E.parseBank(window.BANK_ADULT, 1);
    var P = E.parseBank(window.BANK_PEOPLE, 2);
    var K = E.parseBank(window.BANK_KIDS, 1);
    var ca = [], ck = [];
    H.S.lib.forEach(function (x) {
      var a = E.normLetters(x.a);
      if (a.length < 2 || a.length > 12) return;
      var ent = { a: a, disp: x.a, sp: E.splitsOf(x.a), clues: x.clues.slice(), lvl: x.lvl, person: false, pic: x.emoji || null };
      if (x.aud === 'a' || x.aud === 'b') ca.push(ent);
      if (x.aud === 'k' || x.aud === 'b') ck.push(ent);
    });
    cache = {
      a: E.mergeEntries(A.concat(P, ca)),
      k: E.mergeEntries(K.concat(ck)),
      people: P,
      custom: H.S.lib
    };
    H.bankDirty = false;
    return cache;
  };
  H.picFor = function (mode) {
    var S = H.S;
    return function (e) {
      var k = S.photos[e.a];
      if (k && H.imgs[k]) return { k: 'i', v: k };
      if (mode === 'k' && e.pic) return { k: 'e', v: e.pic };
      return null;
    };
  };

  /* ---------- ערכת נושא ---------- */
  H.applyTheme = function () {
    var S = H.S, root = document.documentElement;
    var t = S.set.theme;
    if (t === 'auto') t = (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    root.setAttribute('data-theme', t);
    root.setAttribute('data-mode', S.set.mode);
    var m = document.querySelector('meta[name=theme-color]');
    if (m) {
      var bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
      if (bg) m.setAttribute('content', bg);
    }
  };

  H.sha256 = function (s) {
    var enc = new TextEncoder().encode(s);
    return crypto.subtle.digest('SHA-256', enc).then(function (buf) {
      var a = new Uint8Array(buf), o = '';
      for (var i = 0; i < a.length; i++) o += (a[i] < 16 ? '0' : '') + a[i].toString(16);
      return o;
    });
  };
})();
