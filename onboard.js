/* חצים ואותיות - קבלת פנים, מדריך ומתנת פתיחה */
(function () {
  'use strict';
  var H = window.H, h = H.h;
  var GIFT = 500;

  H.applyName = function () {
    var el = H.$('#tbName');
    if (el) el.textContent = H.S.name || 'אורח';
    H.$$('[data-coins]').forEach(function (x) { x.textContent = H.S.coins; });
  };

  /* ---------- איורים קטנים ---------- */
  function mini(cols, rows, kids) {
    var g = h('div', { class: 'grid mini' });
    g.style.setProperty('--cs', '46');
    g.style.gridTemplateColumns = 'repeat(' + cols + ', 46px)';
    g.style.gridTemplateRows = 'repeat(' + rows + ', 46px)';
    kids.forEach(function (k) { g.appendChild(k); });
    return g;
  }
  function L(ch, cls) { return h('div', { class: 'cell lt ' + (cls || '') }, h('span', { class: 'l', text: ch })); }
  function K() { return h('div', { class: 'cell blk' }); }
  function ar(d, pos) { var a = h('i', { class: 'ar ' + d }); a.style.setProperty(d === 'a' ? '--ay' : '--ax', pos || '50%'); return a; }
  function B(text, d) {
    return h('div', { class: 'cell bx' }, h('div', { class: 'bt ' + d }, h('span', { class: 't', text: text })), ar(d));
  }
  function B2(ta, td) {
    var e = h('div', { class: 'cell bx two' },
      h('div', { class: 'bt a' }, h('span', { class: 't', text: ta })),
      h('div', { class: 'bt d' }, h('span', { class: 't', text: td })));
    e.appendChild(ar('a', '25%')); e.appendChild(ar('d', '50%'));
    return e;
  }
  function tile(n, pct, t) {
    var done = pct >= 100;
    return h('div', { class: 'pt' + (done ? ' done' : (pct ? ' part' : '')) },
      pct ? h('i', { class: 'pt-f', style: { height: pct + '%' } }) : null,
      h('span', { class: 'pt-p', text: pct ? pct + '%' : '' }), h('b', { text: String(n) }), h('small', { text: t || '' }));
  }
  function hrow(ic, t, price) {
    return h('div', { class: 'hint-row mock' }, H.icon(ic), h('div', { class: 'hr-t' }, h('b', { text: t })),
      h('span', { class: 'price' }, H.icon('coin'), String(price)));
  }
  function srow(ic, t) { return h('div', { class: 'hint-row mock' }, H.icon(ic), h('div', { class: 'hr-t' }, h('b', { text: t }))); }

  var GUIDE = [
    { t: 'איך פותרים?', x: 'בכל משבצת אפורה כתובה הגדרה, והחץ מראה לאן המילה נכתבת. לוחצים על הגדרה או על משבצת בלוח, והמילה מסומנת בכחול. המשבצת הלבנה עם המסגרת היא המשבצת הבאה לכתיבה.',
      i: function () { return mini(4, 1, [B('פרי אדום', 'a'), L('ת', 'hl cur'), L('ו', 'hl'), L('ת', 'hl')]); } },
    { t: 'כתיבה ומקלדת', x: 'מקלידים במקלדת העברית, והסימון מתקדם לבד. לחיצה חוזרת על אותה משבצת מחליפה בין שורה לעמודה, בלי הגבלה. משבצת אחת יכולה להחזיק שתי הגדרות: למעלה השורה ולמטה העמודה.',
      i: function () { return mini(3, 3, [B2('כלי כתיבה', 'צומח ביער'), L('ע', 'hl'), L('ט', 'hl cur'), L('ע', ''), K(), K(), L('ץ', ''), K(), K()]); } },
    { t: 'מילה פתורה', x: 'מילה שנכתבה נכון נצבעת באפור. אות שגויה מסומנת באדום כשהבדיקה האוטומטית פועלת, ואפשר לבדוק הכול גם בלחיצה על העיגול בראש הלוח.',
      i: function () { return mini(4, 2, [B('פרי אדום', 'a'), L('ת', 'sol'), L('ו', 'sol'), L('ת', 'sol'), B('חיה בים', 'a'), L('ד', 'sol'), L('ק', 'bad'), K()]); } },
    { t: 'רמזים ומטבעות', x: 'תקועים? כפתור הנורה בסרגל מתחת ללוח חושף אות בודדת (10 מטבעות) או את כל המילה (30 מטבעות). אפשר גם לבדוק מילה או את כל הלוח בחינם.',
      i: function () { return h('div', { class: 'stack' }, hrow('eye', 'חשוף אות', 10), hrow('bolt', 'חשוף מילה', 30)); } },
    { t: 'איך מרוויחים מטבעות?', x: 'כל תשחץ שפתרתם בעצמכם מזכה ב-25 מטבעות (בתשחצי ילדים 15), ועוד 10 אם לא השתמשתם ברמזים. במסך משימות יש פרסים של 20 עד 800 מטבעות. "פתור הכול" לא מזכה במטבעות.',
      i: function () { return h('div', { class: 'stack' }, hrow('check', 'פתרון תשחץ', '\u200E+25'), hrow('star', 'בלי רמזים', '\u200E+10'), hrow('trophy', 'משימות', 'עד 800')); } },
    { t: 'חבילות ומשימות', x: 'התשחצים מחולקים לחבילות של 30. ירוק: נפתר. תכלת: בתהליך, וגובה הצבע הוא אחוז ההתקדמות. במסך משימות אוספים כוכבים ומטבעות.',
      i: function () { var t = h('div', { class: 'tiles mini-t' }, tile(1, 100, '07:44'), tile(2, 68, '08:30'), tile(3, 0, '')); return t; } },
    { t: 'תמונות ומילים משלך', x: 'במסך "אישים ומילים" מוסיפים תמונות של אישים ומילים משלכם. בתשחצי ילדים התמונות הן ציורים. משבצת תמונה כתובה בה כמה אותיות במילה.',
      i: function () {
        var pic = h('div', { class: 'cell bx pic' }, h('div', { class: 'pv' }, h('span', { class: 'emo', text: '🐟' })), h('span', { class: 'plen a', text: '(2)' }), ar('a', '25%'));
        pic.style.gridRow = '1 / span 2'; pic.style.gridColumn = '1 / span 2';
        var d = L('ד', 'hl cur'); d.style.gridRow = '1'; d.style.gridColumn = '3';
        var g = L('ג', 'hl'); g.style.gridRow = '1'; g.style.gridColumn = '4';
        return mini(4, 2, [pic, d, g]);
      } },
    { t: 'גיבוי ועדכון', x: 'בהגדרות אפשר לגבות ולסנכרן את ההתקדמות לגוגל דרייב, ולעדכן את האפליקציה כשיש גרסה חדשה. אפשר לחזור למדריך הזה בכל רגע מההגדרות.',
      i: function () { return h('div', { class: 'stack' }, srow('cloud-up', 'גיבוי וסנכרון בגוגל'), srow('refresh', 'בדיקת עדכון')); } }
  ];

  function run(o) {
    var S = H.S, pages = [], idx = 0, dirn = 1, nameIn = null;
    if (o.welcome) { pages.push({ ask: true }); pages.push({ welcome: true }); }
    (o.pages || GUIDE).forEach(function (g) { pages.push(g); });
    var firstGuide = o.welcome ? 2 : 0; // העמוד הראשון אחרי השם (ברוכים הבאים) הוא תחילת המדריך
    var sh = H.sheet({ center: true, dismiss: false, cls: 'ob', body: [] });

    function finish() {
      sh.close();
      if (o.gift) giftDialog();
    }
    function go(step) { dirn = step; idx = Math.max(0, Math.min(pages.length - 1, idx + step)); render(); }
    function render() {
      var p = pages[idx];
      H.clear(sh.body);
      var page = h('div', { class: 'ob-page ' + (dirn > 0 ? 'from-l' : 'from-r') });
      var foot = h('div', { class: 'ob-foot' });
      var next;
      if (p.ask) {
        page.appendChild(h('i', { class: 'logo big' }));
        page.appendChild(h('div', { class: 'ob-h', text: 'היי, מה שמך?' }));
        page.appendChild(h('div', { class: 'ob-t', text: 'נשמח להכיר. כתוב כאן את השם שלך.' }));
        nameIn = h('input', { type: 'text', class: 'ob-name', placeholder: 'הכנס את שמך', maxlength: 24, autocomplete: 'off', value: S.name || '' });
        page.appendChild(nameIn);
        next = h('button', { class: 'btn primary', text: 'הבא', onclick: function () {
          var v = nameIn.value.trim();
          if (!v) return;
          S.name = v.slice(0, 24); H.touch(); H.applyName(); go(1);
        } });
        function sync() { next.disabled = !nameIn.value.trim(); }
        nameIn.addEventListener('input', sync);
        nameIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') next.click(); });
        sync();
        setTimeout(function () { try { nameIn.focus(); } catch (e) {} }, 350);
      } else if (p.welcome) {
        page.appendChild(h('i', { class: 'logo big' }));
        page.appendChild(h('div', { class: 'ob-h' }, S.name + ', ברוכים הבאים אל', h('b', { class: 'ob-app', text: 'חצים ואותיות' })));
        page.appendChild(h('div', { class: 'ob-t', text: 'תשחצי חצים בעברית, למבוגרים ולילדים. נעשה סיור קצר של כמה עמודים, ואחריו תקבל מתנת פתיחה.' }));
        next = h('button', { class: 'btn primary', text: 'הבא', onclick: function () { go(1); } });
      } else {
        page.appendChild(h('div', { class: 'ob-h', text: p.t }));
        page.appendChild(h('div', { class: 'ob-ill' }, p.i()));
        page.appendChild(h('div', { class: 'ob-t', text: p.x }));
        var last = idx === pages.length - 1;
        next = h('button', { class: 'btn primary', text: last ? 'סיום' : 'הבא', onclick: function () { if (last) finish(); else go(1); } });
        if (idx > firstGuide) foot.appendChild(h('button', { class: 'btn ghost', text: 'הקודם', onclick: function () { go(-1); } }));
        else foot.appendChild(h('span'));
      }
      if (p.ask || p.welcome) foot.appendChild(h('span'));
      foot.appendChild(next);
      // בעברית: "הקודם" מימין, "הבא" משמאל
      var dots = h('div', { class: 'ob-dots' });
      if (!p.welcome && !p.ask) for (var i = firstGuide; i < pages.length; i++) dots.appendChild(h('i', { class: i === idx ? 'on' : '' }));
      sh.body.appendChild(page);
      if (!p.welcome && !p.ask) sh.body.appendChild(dots);
      sh.body.appendChild(foot);
      var x = sh.el.querySelector('.ob-x');
      if (x) x.parentNode.removeChild(x);
      if (!p.welcome && !p.ask) sh.el.appendChild(h('button', { class: 'ob-x', 'aria-label': 'סגירה', onclick: finish }, H.icon('close')));
    }
    render();
  }


  var LIBGUIDE = [
    { t: 'ברוכים הבאים לאישים ומילים', x: 'כאן מנהלים את מה שנכנס לתשחצים: תמונות של אישים ומילים משלכם. יש שתי לשוניות: "אישים ותמונות" ו"המילים שלי".',
      i: function () { return h('div', { class: 'stack' }, srow('user', 'אישים ותמונות'), srow('star', 'המילים שלי')); } },
    { t: 'אישים ותמונות', x: 'אדם שיש לו תמונה מופיע בתשחץ כמשבצת תמונה ("מי בתמונה?"). אדם בלי תמונה מופיע עם הגדרה רגילה. לוחצים על שם, ובוחרים תמונה מהמכשיר או מכתובת אינטרנט. התמונות נשמרות רק אצלך.',
      i: function () {
        var pic = h('div', { class: 'cell bx pic' }, h('div', { class: 'pv' }, h('span', { class: 'emo', text: '🙂' })), h('span', { class: 'plen a', text: '(4)' }), ar('a', '25%'));
        pic.style.gridRow = '1 / span 2'; pic.style.gridColumn = '1 / span 2';
        var d = L('ד', 'hl cur'); d.style.gridRow = '1'; d.style.gridColumn = '3';
        return mini(4, 2, [pic, d, L('ו', 'hl')].map(function (n, i) { if (i === 2) { n.style.gridRow = '1'; n.style.gridColumn = '4'; } return n; }));
      } },
    { t: 'המילים שלי', x: 'מוסיפים מילה והגדרה (אפשר כמה הגדרות), ובוחרים למי היא מיועדת: מבוגרים, ילדים או שניהם. המילים ייכנסו לתשחצים חדשים. תשחצים שכבר נפתחו לא משתנים.',
      i: function () { return h('div', { class: 'stack' }, srow('check', 'ירושלים | בירת ישראל'), srow('check', 'שמש | כוכב החמה שלנו')); } },
    { t: 'ייבוא וייצוא', x: 'אפשר להדביק רשימה שלמה, שורה לכל מילה, בצורה: תשובה|הגדרה|הגדרה נוספת. הרשימה נכללת בגיבוי לגוגל דרייב, ואפשר לחזור למדריך הזה מההגדרות.',
      i: function () { return h('div', { class: 'stack' }, srow('cloud-up', 'תשובה|הגדרה|הגדרה נוספת')); } }
  ];

  function giftDialog() {
    var S = H.S;
    if (!S.gift) { S.gift = 1; H.addCoins(GIFT); }
    S.set.welcomed = true; H.touch(); H.save();
    H.snd('win');
    H.sheet({
      center: true, dismiss: false, title: 'מתנת פתיחה', sub: 'קיבלת ' + GIFT + ' מטבעות להתחלה. תוכל להשתמש בהם לרמזים.',
      body: h('div', { class: 'gift' }, H.icon('coin'), h('b', { text: '\u200E+' + GIFT })),
      actions: [{ t: 'תודה', cls: 'primary', fn: function () { H.refresh(); } }]
    });
  }

  H.showGuide = function () { run({ welcome: false, gift: false }); };
  H.showLibGuide = function () { run({ welcome: false, gift: false, pages: LIBGUIDE }); };
  H.startWelcome = function () { run({ welcome: true, gift: true }); };
})();
