/* חצים ואותיות - משימות */
(function () {
  'use strict';
  var H = window.H, h = H.h;

  var MISSIONS = [
    { id: 'master', t: 'רב אמן תשחצים', d: 'פתור {n} תשחצים', k: 'solved', tiers: [10, 50, 150], rw: [40, 150, 400] },
    { id: 'adults', t: 'מומחה מבוגרים', d: 'פתור {n} תשחצי מבוגרים', k: 'solvedA', tiers: [5, 25, 100], rw: [30, 100, 300] },
    { id: 'kids', t: 'חבר של הילדים', d: 'פתור {n} תשחצי ילדים', k: 'solvedK', tiers: [5, 25, 100], rw: [20, 80, 200] },
    { id: 'clean', t: 'בלי רמזים', d: 'פתור {n} תשחצים בלי רמזים', k: 'nohint', tiers: [3, 15, 50], rw: [40, 120, 300] },
    { id: 'fast10', t: 'מהיר ועצבני', d: 'פתור {n} תשחצים בפחות מ-10 דקות כל אחד', k: 'fast10', tiers: [1, 5, 20], rw: [30, 100, 300] },
    { id: 'fast5', t: 'ברק', d: 'פתור {n} תשחצים בפחות מ-5 דקות כל אחד', k: 'fast5', tiers: [1, 3, 10], rw: [60, 150, 400] },
    { id: 'words', t: 'ידע כללי', d: 'פתור {n} הגדרות', k: 'words', tiers: [100, 1000, 5000], rw: [30, 200, 500] },
    { id: 'faces', t: 'זיהוי', d: 'זהה {n} אישים לפי תמונה', k: 'faces', tiers: [5, 50, 200], rw: [50, 200, 500] },
    { id: 'streak', t: 'רצף לוהט', d: 'שמור על רצף של {n} ימים', k: 'streak', tiers: [3, 7, 30], rw: [40, 120, 500] },
    { id: 'packs', t: 'כובש חבילות', d: 'השלם {n} חבילות של 30 תשחצים', k: 'packs', tiers: [1, 3, 10], rw: [100, 300, 800] },
    { id: 'big', t: 'אלוף הענקים', d: 'פתור {n} תשחצים גדולים (14×10 ומעלה)', k: 'big', tiers: [1, 5, 20], rw: [80, 250, 600] },
    { id: 'marathon', t: 'מרתוניסט', d: 'פתור תשחצים במשך {n} דקות', k: 'mins', tiers: [60, 300, 1200], rw: [30, 100, 300] },
    { id: 'hinter', t: 'לא מתביישים', d: 'השתמש ב-{n} רמזים', k: 'hints', tiers: [10, 50, 150], rw: [20, 60, 150] },
    { id: 'photos', t: 'אספן אישים', d: 'הוסף {n} תמונות לאישים', k: 'photos', tiers: [1, 10, 40], rw: [30, 100, 300] },
    { id: 'custom', t: 'בונה מילים', d: 'הוסף {n} מילים משלך', k: 'custom', tiers: [1, 10, 50], rw: [30, 100, 300] },
    { id: 'treasure', t: 'אוצר', d: 'הרוויח {n} מטבעות מתשחצים', k: 'earn', tiers: [500, 3000, 10000], rw: [50, 150, 400] },
    { id: 'secret', t: 'יום של שיא', d: 'פתור 5 תשחצים ביום אחד', k: 'dayN', tiers: [5], rw: [500], secret: true }
  ];

  function packsDone() {
    var n = 0;
    ['a', 'k'].forEach(function (m) { for (var p = 1; p <= H.PACKS; p++) if (H.solvedInPack(m, p) >= H.PACK_SIZE) n++; });
    return n;
  }
  function cur(k) {
    var S = H.S, mc = S.mc;
    switch (k) {
      case 'solved': return S.st.a + S.st.k;
      case 'solvedA': return S.st.a;
      case 'solvedK': return S.st.k;
      case 'streak': return S.st.streak.best;
      case 'packs': return packsDone();
      case 'photos': return Object.keys(S.photos).length;
      case 'custom': return S.lib.length;
      case 'mins': return Math.floor(mc.secs / 60);
      case 'dayN': return mc.dayD === H.today() ? mc.dayN : 0;
      default: return mc[k] || 0;
    }
  }
  function reached(m) {
    var c = cur(m.k), r = 0;
    m.tiers.forEach(function (t) { if (c >= t) r++; });
    return r;
  }
  H.claimable = function () {
    var n = 0;
    MISSIONS.forEach(function (m) { if (reached(m) > (H.S.m[m.id] || 0)) n++; });
    return n;
  };
  H.updateBadge = function () {
    var b = H.$('#nav [data-go=missions]');
    if (b) b.classList.toggle('dot', H.claimable() > 0);
  };

  function claim(m) {
    var S = H.S, got = S.m[m.id] || 0, r = reached(m), sum = 0;
    if (r <= got) return;
    for (var i = got; i < r; i++) sum += m.rw[i];
    S.m[m.id] = r;
    H.addCoins(sum);
    H.snd('coin'); H.vib(25);
    H.toast('קיבלת ' + sum + ' מטבעות');
    H.save();
    if (H.cloudAuto) H.cloudAuto();
    H.go('missions');
  }

  function row(m) {
    var S = H.S, c = cur(m.k), got = S.m[m.id] || 0, r = reached(m), total = m.tiers.length;
    var allDone = got >= total;
    var nextIdx = Math.min(got, total - 1);
    var target = m.tiers[Math.min(r, total - 1)];
    var canClaim = r > got;
    var hidden = m.secret && got < total && !canClaim;
    var stars = h('div', { class: 'ms-stars' });
    if (total > 1) for (var i = 0; i < 3; i++) stars.appendChild(H.icon('star', i < got ? 'on' : ''));
    else stars.appendChild(H.icon('star', got ? 'on' : ''));
    var act;
    if (allDone) act = h('div', { class: 'ms-done' }, H.icon('check'));
    else if (canClaim) {
      var sum = 0; for (var j = got; j < r; j++) sum += m.rw[j];
      act = h('button', { class: 'ms-claim', onclick: function () { claim(m); } }, 'קבל', h('span', { class: 'rw' }, H.icon('coin'), '+' + sum));
    } else if (hidden) act = h('div', { class: 'ms-q', text: '?' });
    else {
      var pct = Math.min(100, Math.round(c * 100 / target));
      act = h('div', { class: 'ms-prog' }, h('i', { style: { width: pct + '%' } }), h('span', { text: c + '/' + target }));
    }
    var rewardShown = allDone ? null : (canClaim ? null : h('div', { class: 'ms-rw' }, h('small', { text: 'פרס:' }), h('span', { class: 'rw' }, H.icon('coin'), String(m.rw[nextIdx]))));
    return h('div', { class: 'ms' + (canClaim ? ' ready' : '') + (allDone ? ' fin' : '') },
      h('div', { class: 'ms-main' },
        h('b', { text: hidden ? 'משימה סודית' : m.t }),
        h('small', { text: hidden ? 'שששש... לא מגלים!' : m.d.replace('{n}', String(target)) }),
        stars),
      rewardShown, act);
  }

  H.addScreen('missions', function () {
    var root = h('section', { class: 'scr' });
    var n = H.claimable();
    root.appendChild(h('header', { class: 'top' }, h('h2', { text: 'משימות' }),
      h('div', { class: 'coin-chip' }, H.icon('coin'), h('span', { 'data-coins': 1, text: H.S.coins }))));
    root.appendChild(h('div', { class: 'note' }, h('b', { text: n ? 'יש ' + n + ' פרסים שמחכים לך' : 'עמדו במשימות וצברו מטבעות' }),
      h('p', { text: 'מטבעות משמשים לרמזים: חשיפת אות עולה 10, חשיפת מילה שלמה עולה 30. כל משימה כוללת שלושה כוכבים.' })));
    var ms = MISSIONS.slice().sort(function (a, b) {
      var ra = reached(a) > (H.S.m[a.id] || 0) ? 0 : ((H.S.m[a.id] || 0) >= a.tiers.length ? 2 : 1);
      var rb = reached(b) > (H.S.m[b.id] || 0) ? 0 : ((H.S.m[b.id] || 0) >= b.tiers.length ? 2 : 1);
      return ra - rb || MISSIONS.indexOf(a) - MISSIONS.indexOf(b);
    });
    var list = h('div', { class: 'rows' });
    ms.forEach(function (m) { list.appendChild(row(m)); });
    root.appendChild(list);
    return root;
  });
  H.MISSIONS = MISSIONS;
})();
