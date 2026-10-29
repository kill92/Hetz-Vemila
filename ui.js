/* חצים ואותיות - מסכים: בית, חבילות, אישים ומילים, הגדרות */
(function () {
  'use strict';
  var H = window.H, E = window.Engine, h = H.h, $ = H.$;
  var view = $('#view');
  H.view = 'home'; H.curArg = null; H.prevScreen = 'home'; H.prevArg = null;

  /* ---------- ניווט ---------- */
  H.showView = function (node, name) {
    H.clear(view);
    view.appendChild(node);
    H.view = name;
    document.body.classList.toggle('ingame', name === 'game');
    view.scrollTop = 0;
    var nav = name === 'pack' ? 'packs' : name;
    H.$$('#nav button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-go') === nav); });
    if (H.updateBadge) H.updateBadge();
  };
  var screens = {};
  H.addScreen = function (n, f) { screens[n] = f; };
  H.go = function (name, arg) {
    if (!screens[name]) name = 'home';
    H.curArg = arg == null ? null : arg;
    H.showView(screens[name](arg), name);
  };
  H.refresh = function () { if (H.view !== 'game') H.go(H.view, H.curArg); };
  H.play = function (id) {
    H.prevScreen = H.view === 'game' ? 'home' : H.view; H.prevArg = H.curArg;
    H.openPuzzle(id);
  };
  window.addEventListener('popstate', function () {
    if (!H.G() && H.view === 'pack') H.go('packs', { mode: H.packsMode || H.S.set.mode });
  });

  /* ---------- רכיבים קטנים ---------- */
  function seg(opts, val, fn) {
    var el = h('div', { class: 'seg', role: 'group' });
    opts.forEach(function (o) {
      el.appendChild(h('button', { class: o[0] === val ? 'on' : '', text: o[1], onclick: function () { fn(o[0]); } }));
    });
    return el;
  }
  function sw(on, fn) {
    var b = h('button', { class: 'sw' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', onclick: function () {
      on = !on; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); fn(on);
    } }, h('i'));
    return b;
  }
  function row(title, sub, control, onclick) {
    return h('div', { class: 'srow' + (onclick ? ' tap' : ''), onclick: onclick },
      h('div', { class: 'sr-t' }, h('b', { text: title }), sub ? h('small', { text: sub }) : null),
      control || null);
  }
  function card(title, kids) {
    return h('section', { class: 'card' }, title ? h('h3', { text: title }) : null, kids);
  }
  function field(label, input, hint) {
    return h('label', { class: 'fld' }, h('span', { text: label }), input, hint ? h('small', { text: hint }) : null);
  }
  function input(val, ph, extra) {
    var a = { type: 'text', value: val || '', placeholder: ph || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' };
    for (var k in (extra || {})) a[k] = extra[k];
    return h('input', a);
  }
  function btn(text, cls, fn, icon) {
    return h('button', { class: 'btn ' + (cls || ''), onclick: fn }, icon ? H.icon(icon) : null, text);
  }
  function coinChip() { return h('div', { class: 'coin-chip' }, H.icon('coin'), h('span', { 'data-coins': 1, text: H.S.coins })); }
  function bar(pct) { return h('div', { class: 'pbar' }, h('i', { style: { width: Math.max(0, Math.min(100, pct)) + '%' } })); }
  H.copyText = function (t) {
    function fallback() {
      var ta = h('textarea', { style: { position: 'fixed', top: '0', left: '0', opacity: '0' } });
      ta.value = t; document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); return ok;
    }
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return fallback(); });
    return Promise.resolve(fallback());
  };
  H.download = function (name, text) {
    try {
      var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      var a = h('a', { href: url, download: name });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return true;
    } catch (e) { return false; }
  };
  function ago(ts) {
    if (!ts) return 'עדיין לא';
    var m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'ממש עכשיו';
    if (m < 60) return 'לפני ' + m + ' דקות';
    var hr = Math.floor(m / 60);
    if (hr < 24) return 'לפני ' + hr + ' שעות';
    return 'לפני ' + Math.floor(hr / 24) + ' ימים';
  }
  function setMode(m) {
    if (H.S.set.mode === m) return;
    H.S.set.mode = m; H.touch(); H.applyTheme(); H.refresh();
  }

  /* ---------- בית ---------- */
  function lastOpen(mode) {
    var best = null, p = H.S.p;
    for (var id in p) {
      if (p[id].d) continue;
      var pi = H.parseId(id);
      if (!pi || pi.mode !== mode) continue;
      if (!best || p[id].u > best.u) best = { id: id, u: p[id].u };
    }
    return best;
  }
  function nextInPacks(mode) {
    for (var pk = 1; pk <= H.PACKS; pk++) {
      if (H.packLocked(mode, pk)) break;
      for (var i = 1; i <= H.PACK_SIZE; i++) {
        var id = H.puzId(mode, pk, i);
        if (!(H.S.p[id] && H.S.p[id].d)) return { id: id, pack: pk, idx: i };
      }
    }
    return null;
  }

  screens.home = function () {
    var S = H.S, mode = S.set.mode, kid = mode === 'k';
    var root = h('section', { class: 'scr home' });
    root.appendChild(h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('i', { class: 'logo' }), h('div', {}, h('h1', { text: 'חצים ואותיות' }), h('small', { text: kid ? 'תשחצים לילדים' : 'תשחצי חצים בעברית' }))),
      coinChip()));
    root.appendChild(seg([['a', 'מבוגרים'], ['k', 'ילדים']], mode, setMode));

    var cont = lastOpen(mode);
    if (cont) {
      var pr = H.progressOf(cont.id);
      root.appendChild(h('button', { class: 'hero', onclick: function () { H.play(cont.id); } },
        h('div', { class: 'hero-k', text: 'להמשיך מאיפה שעצרת' }),
        h('div', { class: 'hero-t', text: H.puzTitle(cont.id) }),
        bar(pr.pct),
        h('div', { class: 'hero-f' }, h('span', { text: pr.pct + '% הושלמו' }), h('span', { class: 'go' }, 'המשך', H.icon('chev-l')))));
    }

    root.appendChild(h('button', { class: 'wide', onclick: function () { H.play(H.randId(mode)); } },
      h('div', {}, h('b', { text: 'תשחץ אקראי' }), h('small', { text: 'תשחץ חדש בכל לחיצה' })),
      h('div', { class: 'wide-r' }, H.icon('dice'))));

    var nx = nextInPacks(mode);
    if (nx) {
      var done = H.solvedInPack(mode, nx.pack);
      root.appendChild(h('button', { class: 'wide', onclick: function () { H.play(nx.id); } },
        h('div', {}, h('b', { text: 'הבא בתור' }), h('small', { text: 'חבילה ' + nx.pack + ' · תשחץ ' + nx.idx })),
        h('div', { class: 'wide-r' }, h('small', { text: done + '/' + H.PACK_SIZE }), H.icon('chev-l'))));
    }

    var cnt = kid ? S.st.k : S.st.a, secs = kid ? S.st.secK : S.st.secA;
    root.appendChild(h('div', { class: 'stats' },
      stat('check', String(cnt), 'נפתרו'),
      stat('flame', String(S.st.streak.cur), 'ימי רצף'),
      stat('star', cnt ? H.fmtTime(secs / cnt) : '--', 'זמן ממוצע')));

    if (!kid) {
      var B = H.buildBanks(), have = 0;
      B.people.forEach(function (p) { if (S.photos[p.a] && H.imgs[S.photos[p.a]]) have++; });
      root.appendChild(h('button', { class: 'wide soft', onclick: function () { H.go('lib', 'people'); } },
        h('div', {}, h('b', { text: 'תמונות של אישים' }), h('small', { text: have ? 'יש לך ' + have + ' תמונות, אפשר להוסיף עוד' : 'הוסף תמונות כדי שתשחצים יכללו משבצות תמונה' })),
        h('div', { class: 'wide-r' }, H.icon('image'))));
    }
    return root;
  };
  function stat(ic, v, l) { return h('div', { class: 'stat' }, H.icon(ic), h('b', { text: v }), h('small', { text: l })); }

  /* ---------- חבילות ---------- */
  function packLabel(mode, n) {
    if (mode === 'a') return n <= 2 ? 'קלות' : (n <= 6 ? 'בינוניות' : (n <= 12 ? 'מאתגרות' : 'למומחים'));
    return n <= 3 ? 'קטנות' : (n <= 8 ? 'בינוניות' : 'גדולות');
  }
  function modeSolved(mode) { return mode === 'a' ? H.S.st.a : H.S.st.k; }
  screens.packs = function (a) {
    var S = H.S;
    if (a && a.mode) return packList(a.mode);
    var root = h('section', { class: 'scr' });
    root.appendChild(h('header', { class: 'top' }, h('h2', { text: 'חבילות' }), coinChip()));
    [['a', 'תשחצי מבוגרים', 'חצים והגדרות בתוך הלוח, מילים ואישים', 'book'], ['k', 'תשחצי ילדים', 'לוחות קטנים וצבעוניים עם תמונות', 'star']].forEach(function (m) {
      var mode = m[0], n = modeSolved(mode);
      root.appendChild(h('button', { class: 'mode-card ' + (mode === 'k' ? 'kids' : 'adult'), onclick: function () {
        S.set.mode = mode; H.touch(); H.applyTheme(); H.packsMode = mode; H.go('packs', { mode: mode });
      } },
        h('div', { class: 'mc-i' }, H.icon(m[3])),
        h('div', { class: 'mc-t' }, h('b', { text: m[1] }), h('small', { text: m[2] }), h('small', { class: 'mc-n', text: n + ' תשחצים נפתרו' })),
        H.icon('chev-l')));
    });
    return root;
  };
  function packList(mode) {
    H.packsMode = mode;
    var root = h('section', { class: 'scr' });
    root.appendChild(h('header', { class: 'top' },
      h('button', { class: 'ib', 'aria-label': 'חזרה', onclick: function () { H.go('packs'); } }, H.icon('chev-r')),
      h('h2', { text: mode === 'a' ? 'תשחצי מבוגרים' : 'תשחצי ילדים' }), coinChip()));
    var list = h('div', { class: 'plist' });
    for (var n = 1; n <= H.PACKS; n++) list.appendChild(packCard(mode, n));
    root.appendChild(list);
    return root;
  }
  function packCard(mode, n) {
    var lock = H.packLocked(mode, n), done = H.solvedInPack(mode, n), cfg = H.packCfg(mode, n);
    var el = h('button', {
      class: 'pack' + (lock ? ' locked' : '') + (done === H.PACK_SIZE ? ' full' : ''),
      onclick: function () {
        if (lock) { H.toast('פותרים עוד ' + lock + ' תשחצים כדי לפתוח חבילה זו'); return; }
        try { history.pushState({ s: 'pack' }, ''); } catch (e) {}
        H.go('pack', { mode: mode, n: n });
      }
    },
      h('div', { class: 'pk-n' }, lock ? H.icon('lock') : h('span', { text: String(n) })),
      h('div', { class: 'pk-i' },
        h('b', { text: 'חבילה ' + n }),
        h('small', { text: cfg.C + '×' + cfg.R + ' · ' + packLabel(mode, n) }),
        lock ? h('small', { class: 'need', text: 'נפתחת אחרי עוד ' + lock + ' תשחצים' }) : bar(done * 100 / H.PACK_SIZE)),
      h('div', { class: 'pk-c', text: lock ? '' : done + '/' + H.PACK_SIZE }));
    return el;
  }
  screens.pack = function (a) {
    a = a || { mode: H.S.set.mode, n: 1 };
    var mode = a.mode, n = a.n, done = H.solvedInPack(mode, n);
    var root = h('section', { class: 'scr' });
    root.appendChild(h('header', { class: 'top' },
      h('button', { class: 'ib', 'aria-label': 'חזרה', onclick: function () { if (history.state && history.state.s) history.back(); else H.go('packs', { mode: mode }); } }, H.icon('chev-r')),
      h('h2', { text: 'חבילה ' + n }), coinChip()));
    root.appendChild(h('div', { class: 'psum' }, h('span', { text: done + ' מתוך ' + H.PACK_SIZE + ' נפתרו' }), bar(done * 100 / H.PACK_SIZE)));
    var g = h('div', { class: 'tiles' });
    for (var i = 1; i <= H.PACK_SIZE; i++) {
      (function (i) {
        var id = H.puzId(mode, n, i), pr = H.progressOf(id);
        g.appendChild(h('button', {
          class: 'pt' + (pr.done ? ' done' : (pr.pct ? ' part' : '')), onclick: function () { H.play(id); }, 'aria-label': 'תשחץ ' + i
        }, pr.pct ? h('i', { class: 'pt-f', style: { height: pr.pct + '%' } }) : null,
          h('span', { class: 'pt-p', text: pr.pct ? pr.pct + '%' : '' }),
          h('b', { text: String(i) }),
          h('small', { text: pr.t ? H.fmtTime(pr.t) : '' })));
      })(i);
    }
    root.appendChild(g);
    return root;
  };

  /* ---------- מילים ותמונות ---------- */
  var libState = { tab: 'people', filter: 'all', q: '' };
  screens.lib = function (tab) {
    if (tab === 'people' || tab === 'mine') libState.tab = tab;
    var root = h('section', { class: 'scr' });
    root.appendChild(h('header', { class: 'top' }, h('h2', { text: 'אישים ומילים' }), h('button', { class: 'icon-btn', 'aria-label': 'מדריך', text: '?', onclick: function () { H.showLibGuide(); } })));
    root.appendChild(seg([['people', 'אישים ותמונות'], ['mine', 'המילים שלי']], libState.tab, function (t) { libState.tab = t; H.go('lib'); }));
    root.appendChild(libState.tab === 'people' ? peopleTab() : mineTab());
    if (!H.S.set.libSeen && H.showLibGuide) {
      H.S.set.libSeen = true; H.touch(); H.save();
      setTimeout(function () { if (H.view === 'lib') H.showLibGuide(); }, 250);
    }
    return root;
  };

  function thumb(ans, disp) {
    var k = H.S.photos[ans];
    if (k && H.imgs[k]) return h('div', { class: 'th', style: { backgroundImage: 'url(' + H.imgs[k] + ')' } });
    return h('div', { class: 'th empty' }, h('span', { text: (disp || ans).charAt(0) }));
  }

  function peopleTab() {
    var B = H.buildBanks(), S = H.S;
    var wrap = h('div', { class: 'libwrap' });
    var have = 0;
    B.people.forEach(function (p) { if (S.photos[p.a] && H.imgs[S.photos[p.a]]) have++; });
    wrap.appendChild(h('div', { class: 'note' },
      h('b', { text: have + ' מתוך ' + B.people.length + ' אישים עם תמונה' }),
      h('p', { text: 'בתשחץ, אדם שיש לו תמונה מופיע כמשבצת תמונה ("מי בתמונה?"). אדם בלי תמונה מופיע עם הגדרה רגילה. התמונות נשמרות רק אצלך, במכשיר.' })));
    var q = input(libState.q, 'חיפוש שם…', { 'aria-label': 'חיפוש' });
    var chips = seg([['all', 'הכול'], ['miss', 'חסרות'], ['have', 'יש']], libState.filter, function (f) { libState.filter = f; draw(); });
    wrap.appendChild(q); wrap.appendChild(chips);
    var list = h('div', { class: 'rows' });
    wrap.appendChild(list);
    function draw() {
      H.$$('button', chips).forEach(function (b, i) { b.classList.toggle('on', ['all', 'miss', 'have'][i] === libState.filter); });
      H.clear(list);
      var qq = q.value.trim(), n = 0;
      B.people.forEach(function (p) {
        var has = !!(S.photos[p.a] && H.imgs[S.photos[p.a]]);
        if (libState.filter === 'miss' && has) return;
        if (libState.filter === 'have' && !has) return;
        if (qq && p.disp.indexOf(qq) < 0) return;
        n++;
        list.appendChild(h('button', { class: 'prow', onclick: function () { photoSheet(p.a, p.disp, p.clues, function () { draw(); }); } },
          thumb(p.a, p.disp),
          h('div', { class: 'pr-i' }, h('b', { text: p.disp }), h('small', { text: p.clues[0] || '' })),
          h('span', { class: 'tag' + (has ? ' ok' : '') }, has ? H.icon('check') : H.icon('plus'))));
      });
      if (!n) list.appendChild(h('div', { class: 'empty', text: 'לא נמצא כלום' }));
    }
    q.addEventListener('input', function () { libState.q = q.value; draw(); });
    draw();
    return wrap;
  }

  function photoSheet(ans, disp, clues, done) {
    var S = H.S;
    var prev = h('div', { class: 'ph-prev' });
    function paintPrev() {
      H.clear(prev);
      var k = S.photos[ans];
      if (k && H.imgs[k]) prev.appendChild(h('img', { src: H.imgs[k], alt: '' }));
      else prev.appendChild(h('div', { class: 'th empty big' }, h('span', { text: disp.charAt(0) })));
    }
    paintPrev();
    var file = h('input', { type: 'file', accept: 'image/*', class: 'hid' });
    var url = input('', 'https://…', { type: 'url', dir: 'ltr', inputmode: 'url' });
    var busy = false;
    function apply(src) {
      if (busy) return; busy = true; H.toast('מעבד תמונה…', 6000);
      H.processImage(src).then(function (d) { return H.setPhoto(ans, d); }).then(function () {
        busy = false; H.toast('התמונה נשמרה'); paintPrev(); if (done) done(); sh.close();
      }).catch(function (e) {
        busy = false;
        H.toast(e && e.message === 'cors' ? 'האתר לא מאפשר שימוש בתמונה. שמור אותה בגלריה ובחר משם.' : 'לא הצלחתי לטעון את התמונה', 3600);
      });
    }
    file.addEventListener('change', function () { if (file.files && file.files[0]) apply(file.files[0]); });
    var sh = H.sheet({
      title: disp, sub: (clues && clues[0]) || '',
      body: [prev,
        btn('בחירה מהגלריה', 'primary block', function () { file.click(); }, 'image'),
        file,
        h('div', { class: 'or', text: 'או מכתובת של תמונה' }),
        h('div', { class: 'urlrow' }, url, btn('טען', 'ghost', function () {
          var u = url.value.trim();
          if (!/^https:\/\//i.test(u)) { H.toast('הכתובת צריכה להתחיל ב-https://'); return; }
          apply(u);
        })),
        h('p', { class: 'tiny', text: 'טיפ: בוויקיפדיה לוחצים על תמונה, ואז "פתח בגודל מלא", ומעתיקים את כתובת התמונה. תמונות מוויקימדיה עובדות הכי טוב.' }),
        S.photos[ans] ? btn('הסר תמונה', 'danger-ghost block', function () { H.removePhoto(ans); if (done) done(); sh.close(); H.toast('התמונה הוסרה'); }, 'trash') : null]
    });
  }

  function mineTab() {
    var S = H.S;
    var wrap = h('div', { class: 'libwrap' });
    wrap.appendChild(h('div', { class: 'note' },
      h('b', { text: 'המילים שלך' }),
      h('p', { text: 'מילים שתוסיף כאן ייכנסו לתשחצים החדשים, למבוגרים, לילדים או לשניהם. תשחצים שכבר נפתחו לא משתנים.' })));
    wrap.appendChild(h('div', { class: 'btnrow' },
      btn('מילה חדשה', 'primary', function () { wordSheet(null); }, 'plus'),
      btn('יבוא', 'ghost', importSheet, 'copy'),
      btn('יצוא', 'ghost', exportWords, 'ext')));
    var list = h('div', { class: 'rows' });
    if (!S.lib.length) list.appendChild(h('div', { class: 'empty', text: 'עדיין לא הוספת מילים' }));
    S.lib.slice().sort(function (a, b) { return b.u - a.u; }).forEach(function (w) {
      var hasP = S.photos[E.normLetters(w.a)];
      list.appendChild(h('button', { class: 'prow', onclick: function () { wordSheet(w); } },
        w.emoji ? h('div', { class: 'th emo', text: w.emoji }) : thumb(E.normLetters(w.a), w.a),
        h('div', { class: 'pr-i' }, h('b', { text: w.a }), h('small', { text: w.clues[0] })),
        h('span', { class: 'tag', text: w.aud === 'a' ? 'מבוגרים' : (w.aud === 'k' ? 'ילדים' : 'שניהם') })));
    });
    wrap.appendChild(list);
    return wrap;
  }

  function wordSheet(w) {
    var S = H.S;
    var a = input(w ? w.a : '', 'למשל: ירושלים');
    var cl = [0, 1, 2].map(function (i) { return input(w && w.clues[i] ? w.clues[i] : '', i === 0 ? 'הגדרה' : 'הגדרה נוספת (לא חובה)', { maxlength: 80 }); });
    var emo = input(w ? w.emoji : '', 'אימוג׳י לתשחצי ילדים (לא חובה)', { maxlength: 6 });
    var lvl = w ? w.lvl : 2, aud = w ? w.aud : 'b';
    var lvlSeg = h('div'), audSeg = h('div');
    function drawSegs() {
      H.clear(lvlSeg); H.clear(audSeg);
      lvlSeg.appendChild(seg([[1, 'קל'], [2, 'בינוני'], [3, 'קשה']], lvl, function (v) { lvl = v; drawSegs(); }));
      audSeg.appendChild(seg([['a', 'מבוגרים'], ['k', 'ילדים'], ['b', 'שניהם']], aud, function (v) { aud = v; drawSegs(); }));
    }
    drawSegs();
    var sh = H.sheet({
      title: w ? 'עריכת מילה' : 'מילה חדשה', cls: 'tall',
      body: [field('התשובה', a, 'אותיות בעברית, עד 12 אותיות. רווח בין מילים נתמך.'),
        field('הגדרות', h('div', { class: 'stack' }, cl)),
        field('רמת קושי', lvlSeg), field('מתאים ל', audSeg), field('אימוג׳י', emo),
        w ? btn('תמונה למילה', 'ghost block', function () { photoSheet(E.normLetters(w.a), w.a, w.clues, null); }, 'image') : null,
        w ? btn('מחק מילה', 'danger-ghost block', function () {
          H.confirm('למחוק את "' + w.a + '"?', '', 'מחק', function () {
            S.lib = S.lib.filter(function (x) { return x.id !== w.id; });
            S.libDel.push(w.id); if (S.libDel.length > 3000) S.libDel.shift();
            H.bankDirty = true; H.touch(); sh.close(); H.go('lib');
          }, true);
        }, 'trash') : null],
      actions: [{ t: 'ביטול', cls: 'ghost' }, { t: 'שמירה', cls: 'primary', fn: function () {
        var disp = a.value.trim().replace(/\s+/g, ' ');
        var norm = E.normLetters(disp);
        if (!/^[א-ת ]+$/.test(disp)) { H.toast('התשובה צריכה להכיל אותיות בעברית בלבד'); return false; }
        if (norm.length < 2 || norm.length > 12) { H.toast('התשובה צריכה להיות בין 2 ל-12 אותיות'); return false; }
        var clues = cl.map(function (i) { return i.value.trim(); }).filter(Boolean);
        if (!clues.length) { H.toast('חסרה הגדרה'); return false; }
        var item = { id: w ? w.id : H.rid(8), a: disp, clues: clues, lvl: lvl, aud: aud, emoji: emo.value.trim().slice(0, 6), u: Date.now() };
        if (w) S.lib = S.lib.map(function (x) { return x.id === w.id ? item : x; }); else S.lib.push(item);
        H.bankDirty = true; H.touch(); H.go('lib', 'mine'); H.toast('נשמר');
      } }]
    });
  }

  function importSheet() {
    var ta = h('textarea', { rows: 8, placeholder: 'תשובה|הגדרה|הגדרה נוספת\nירושלים|בירת ישראל|עיר הקודש', dir: 'rtl', spellcheck: 'false' });
    var aud = 'b', lvl = 2, audSeg = h('div'), lvlSeg = h('div');
    function drawSegs() {
      H.clear(audSeg); H.clear(lvlSeg);
      audSeg.appendChild(seg([['a', 'מבוגרים'], ['k', 'ילדים'], ['b', 'שניהם']], aud, function (v) { aud = v; drawSegs(); }));
      lvlSeg.appendChild(seg([[1, 'קל'], [2, 'בינוני'], [3, 'קשה']], lvl, function (v) { lvl = v; drawSegs(); }));
    }
    drawSegs();
    H.sheet({
      title: 'יבוא מילים', cls: 'tall', sub: 'שורה לכל מילה: תשובה|הגדרה|הגדרה נוספת. אפשר להוסיף |@😀 לאימוג׳י.',
      body: [ta, field('מתאים ל', audSeg), field('רמת קושי', lvlSeg)],
      actions: [{ t: 'ביטול', cls: 'ghost' }, { t: 'ייבא', cls: 'primary', fn: function () {
        var S = H.S, added = 0, skipped = 0;
        ta.value.split(/\r?\n/).forEach(function (line) {
          line = line.trim();
          if (!line || line.indexOf('//') === 0) return;
          var parts = line.split('|').map(function (x) { return x.trim(); });
          var disp = (parts.shift() || '').replace(/\s+/g, ' '), emoji = '', clues = [];
          parts.forEach(function (p) { if (p.charAt(0) === '@') emoji = p.slice(1, 7); else if (p) clues.push(p.slice(0, 80)); });
          var n = E.normLetters(disp);
          if (!/^[א-ת ]+$/.test(disp) || n.length < 2 || n.length > 12 || !clues.length || S.lib.length >= 3000) { skipped++; return; }
          S.lib.push({ id: H.rid(8), a: disp, clues: clues.slice(0, 4), lvl: lvl, aud: aud, emoji: emoji, u: Date.now() });
          added++;
        });
        if (added) { H.bankDirty = true; H.touch(); }
        H.toast('נוספו ' + added + ' מילים' + (skipped ? ', דולגו ' + skipped : ''));
        H.go('lib', 'mine');
      } }]
    });
  }
  function exportWords() {
    var S = H.S;
    if (!S.lib.length) { H.toast('אין עדיין מילים ליצוא'); return; }
    var txt = S.lib.map(function (w) { return [w.a].concat(w.clues).concat(w.emoji ? ['@' + w.emoji] : []).join('|'); }).join('\n');
    H.copyText(txt).then(function (ok) { H.toast(ok ? 'הרשימה הועתקה ללוח' : 'ההעתקה נכשלה'); });
  }

  /* ---------- הגדרות ---------- */
  screens.settings = function () {
    var S = H.S, set = S.set;
    var root = h('section', { class: 'scr' });
    root.appendChild(h('header', { class: 'top' }, h('h2', { text: 'הגדרות' }), coinChip()));

    var nameIn = input(S.name || '', 'השם שלך', { maxlength: 24 });
    root.appendChild(card('חשבון', [
      field('השם שלך', nameIn),
      btn('שמור שם', 'ghost block', function () {
        var v = nameIn.value.trim().slice(0, 24);
        if (!v) { H.toast('כתוב שם'); return; }
        S.name = v; H.touch(); H.applyName(); H.toast('נשמר');
      }),
      row('מדריך שימוש', 'הסבר קצר עם איורים', null, function () { H.showGuide(); })
    ]));

    root.appendChild(card('מראה וצלילים', [
      row('ערכת נושא', null, null),
      seg([['auto', 'אוטומטי'], ['dark', 'כהה'], ['light', 'בהיר']], set.theme, function (v) { set.theme = v; H.touch(); H.applyTheme(); H.go('settings'); }),
      row('צלילים', null, sw(set.sound, function (v) { set.sound = v; H.touch(); H.snd('ok'); })),
      row('רטט', null, sw(set.vib, function (v) { set.vib = v; H.touch(); H.vib(20); }))
    ]));

    root.appendChild(card('משחק', [
      row('בדיקה אוטומטית', 'אות שגויה מסומנת מיד', sw(set.autoCheck, function (v) { set.autoCheck = v; H.touch(); })),
      row('מעבר אוטומטי', 'אחרי השלמת מילה עוברים לבאה', sw(set.autoJump, function (v) { set.autoJump = v; H.touch(); })),
      row('פתח את כל החבילות', 'בלי צורך לפתור כדי להתקדם', sw(set.unlockAll, function (v) { set.unlockAll = v; H.touch(); }))
    ]));

    root.appendChild(cloudCard());
    root.appendChild(card('גיבוי ידני', [
      row('שמור גיבוי לקובץ', 'קובץ שאפשר לשמור בכל מקום', null, function () {
        var ok = H.download('hetz-backup-' + H.today() + '.json', H.exportJSON());
        H.toast(ok ? 'הגיבוי נשמר' : 'השמירה נכשלה');
      }),
      row('העתק גיבוי ללוח', null, null, function () { H.copyText(H.exportJSON()).then(function (ok) { H.toast(ok ? 'הועתק ללוח' : 'ההעתקה נכשלה'); }); }),
      row('שחזור מגיבוי', 'מקובץ או מטקסט שהועתק', null, restoreSheet)
    ]));

    root.appendChild(updateCard());
    root.appendChild(installCard());

    root.appendChild(card('אודות', [
      row('חצים ואותיות', 'גרסה ' + H.VERSION + ' · ערכים: ' + (function () { var b = H.buildBanks(); return b.a.length + b.k.length; })(), null),
      row('הדרכה', 'סיור קצר בשימוש באפליקציה', null, function () { H.showGuide(false); }),
      row('איפוס כל הנתונים', 'מוחק התקדמות, מילים ותמונות מהמכשיר', null, function () {
        H.confirm('לאפס הכול?', 'כל ההתקדמות, המילים והתמונות במכשיר יימחקו. גיבוי בענן (אם יש) לא יימחק.', 'אפס הכול', function () { H.resetAll(); }, true);
      })
    ]));
    return root;
  };

  function cloudCard() {
    var S = H.S, set = S.set, c = H.cloud;
    var connected = c.connected();
    var cid = input(set.clientId, 'Client ID של Google', { dir: 'ltr', 'aria-label': 'Client ID' });
    var kids = [
      row('חשבון Google', connected ? 'מחובר · סנכרון אחרון: ' + ago(S.cloud.at) : 'לא מחובר', null),
      field('Client ID', cid, 'נוצר פעם אחת ב-Google Cloud. ההסבר המלא במדריך.'),
      btn('שמור Client ID', 'ghost block', function () {
        set.clientId = cid.value.trim(); H.touch(); H.toast(set.clientId ? 'נשמר' : 'נמחק');
      }),
      btn(connected ? 'סנכרן עכשיו' : 'התחבר וסנכרן', 'primary block', function () { c.sync(true); }, 'refresh')
    ];
    if (connected) {
      kids.push(h('div', { class: 'btnrow' },
        btn('גבה', 'ghost', function () { c.backup(); }, 'cloud-up'),
        btn('שחזר', 'ghost', function () { c.restore(); }, 'cloud-down')));
    }
    kids.push(row('סנכרון אוטומטי', 'אחרי כל תשחץ שנפתר', sw(set.autoSync, function (v) { set.autoSync = v; H.touch(); })));
    kids.push(h('p', { class: 'tiny', text: 'הנתונים נשמרים בתיקייה פרטית של האפליקציה בדרייב שלך, ששום אפליקציה אחרת לא רואה.' }));
    return card('גיבוי וסנכרון בגוגל', kids);
  }

  function restoreSheet() {
    var ta = h('textarea', { rows: 6, placeholder: 'הדבק כאן את הגיבוי…', dir: 'ltr', spellcheck: 'false' });
    var file = h('input', { type: 'file', accept: '.json,application/json', class: 'hid' });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      if (f.size > 40e6) { H.toast('הקובץ גדול מדי'); return; }
      var rd = new FileReader();
      rd.onload = function () { ta.value = String(rd.result || ''); };
      rd.readAsText(f);
    });
    H.sheet({
      title: 'שחזור מגיבוי', sub: 'ההתקדמות, המילים והתמונות במכשיר יוחלפו בגיבוי. ההגדרות האישיות נשארות.',
      body: [btn('בחירת קובץ', 'ghost block', function () { file.click(); }, 'ext'), file, ta],
      actions: [{ t: 'ביטול', cls: 'ghost' }, { t: 'שחזר', cls: 'danger', fn: function () {
        var ok = H.importJSON(ta.value);
        if (!ok) { H.toast('הגיבוי לא תקין'); return false; }
        H.toast('השחזור הושלם'); H.go('settings');
      } }]
    });
  }

  function updateCard() {
    return card('עדכונים', [
      row('גרסה נוכחית', H.VERSION, null),
      btn('בדוק אם יש עדכון', 'primary block', function () { H.checkUpdate(true); }, 'refresh'),
      h('p', { class: 'tiny', text: 'האפליקציה בודקת עדכון בכל פתיחה. ההתקדמות והמילים שלך לא נמחקים בעדכון.' })
    ]);
  }

  function installCard() {
    var kids = [];
    if (H.isStandalone()) kids.push(row('האפליקציה מותקנת', 'פועלת במסך מלא', null));
    else if (H.canInstall()) kids.push(btn('התקן במכשיר', 'primary block', function () { H.doInstall(); }, 'plus'));
    else if (H.isIOS()) kids.push(h('div', { class: 'note' }, h('b', { text: 'התקנה באייפון' }),
      h('p', { text: 'בספארי: לחץ על כפתור השיתוף (ריבוע עם חץ), גלול ובחר "הוסף למסך הבית", ואז "הוסף".' })));
    else kids.push(h('div', { class: 'note' }, h('b', { text: 'התקנה באנדרואיד' }),
      h('p', { text: 'בכרום: תפריט שלוש הנקודות, ואז "התקן אפליקציה" או "הוסף למסך הבית".' })));
    return card('התקנה', kids);
  }

  /* ---------- איפוס ---------- */
  H.resetAll = function () {
    try { localStorage.removeItem(H.KEY); } catch (e) {}
    try { var rq = indexedDB.deleteDatabase('hetz-img'); rq.onsuccess = rq.onerror = rq.onblocked = function () { location.reload(); }; setTimeout(function () { location.reload(); }, 1200); }
    catch (e) { location.reload(); }
  };

  /* ---------- ניווט תחתון ---------- */
  H.$$('#nav button').forEach(function (b) {
    b.addEventListener('click', function () { H.closeSheets(); H.go(b.getAttribute('data-go')); });
  });
})();
