/* חץ ומילה - מנוע יצירת תשחצים (ללא תלות בדפדפן, רץ גם ב-Node לבדיקות) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIN = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

  /* מחזיר רק אותיות עבריות, כשצורות סופיות הופכות לרגילות */
  function normLetters(s) {
    var o = '';
    s = String(s == null ? '' : s);
    for (var i = 0; i < s.length; i++) {
      var ch = FIN[s[i]] || s[i];
      if (ch >= 'א' && ch <= 'ת') o += ch;
    }
    return o;
  }

  function hashStr(s) {
    var h = 2166136261 >>> 0;
    s = String(s);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- בנק מילים ---------- */
  function splitsOf(disp) {
    var words = String(disp).split(/[\s\-]+/).filter(Boolean);
    if (words.length < 2) return null;
    var sp = [];
    for (var i = 0; i < words.length; i++) {
      var n = normLetters(words[i]).length;
      if (n) sp.push(n);
    }
    return sp.length > 1 ? sp : null;
  }

  /*
    פורמט שורה:  תשובה|הגדרה|הגדרה נוספת|@אימוג'י
    כותרות מקטעים:  [1] קל  [2] בינוני  [3] קשה  [P] אישים (תמונה אפשרית)
  */
  function parseBank(text, defaultLvl) {
    var out = [];
    var lvl = defaultLvl || 1, person = false;
    var lines = String(text || '').split(/\r?\n/);
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li].trim();
      if (!line || line.indexOf('//') === 0) continue;
      var m = line.match(/^\[(\w+)\]$/);
      if (m) {
        if (m[1] === 'P') { person = true; lvl = 2; } else { person = false; lvl = parseInt(m[1], 10) || 1; }
        continue;
      }
      var parts = line.split('|');
      for (var pi = 0; pi < parts.length; pi++) parts[pi] = parts[pi].trim();
      parts = parts.filter(Boolean);
      if (parts.length < 2) continue;
      var disp = parts[0];
      var a = normLetters(disp);
      if (a.length < 2 || a.length > 12) continue;
      var pic = null, clues = [];
      for (var i = 1; i < parts.length; i++) {
        if (parts[i][0] === '@') pic = parts[i].slice(1).trim() || null;
        else clues.push(parts[i]);
      }
      if (!clues.length) continue;
      out.push({ a: a, disp: disp, sp: splitsOf(disp), clues: clues, lvl: lvl, person: person, pic: pic });
    }
    return mergeEntries(out);
  }

  function mergeEntries(list) {
    var map = {}, order = [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var cur = map[e.a];
      if (!cur) {
        map[e.a] = { a: e.a, disp: e.disp, sp: e.sp, clues: e.clues.slice(), lvl: e.lvl, person: !!e.person, pic: e.pic || null };
        order.push(e.a);
      } else {
        for (var j = 0; j < e.clues.length; j++) if (cur.clues.indexOf(e.clues[j]) < 0) cur.clues.push(e.clues[j]);
        if (e.lvl < cur.lvl) cur.lvl = e.lvl;
        if (e.person) cur.person = true;
        if (e.pic && !cur.pic) cur.pic = e.pic;
      }
    }
    return order.map(function (k) { return map[k]; });
  }

  /* ---------- פענוח והסמכה של תשחץ ---------- */
  /*
    def = { R, C, g:[מחרוזת לכל שורה], b:[תיבות] }
    תו בלוח: אות = תשובה, '@' = תא של תיבת הגדרה/תמונה, '#' = תא שחור
    תיבה:  { r, c, h, w, p:null|{k:'e'|'i', v}, a:{t,s,sp}|null, d:{t,s,sp}|null }
    a = תשובה מתחילה מיד אחרי התיבה בכיוון הקריאה (c גדל, כלומר שמאלה על המסך)
    d = תשובה מתחילה מיד מתחת לתיבה
    s = היסט (0 או 1) לתיבות תמונה בגודל 2x2
  */
  function parseDef(def) {
    var R = def.R | 0, C = def.C | 0, N = R * C;
    if (R < 2 || C < 2 || R > 40 || C > 40) throw new Error('bad size');
    if (!Array.isArray(def.g) || def.g.length !== R) throw new Error('bad rows');
    var type = new Uint8Array(N), ch = new Array(N), boxOf = new Int16Array(N).fill(-1);
    var r, c, i;
    for (r = 0; r < R; r++) {
      var row = def.g[r];
      if (typeof row !== 'string' || row.length !== C) throw new Error('bad row ' + r);
      for (c = 0; c < C; c++) {
        var x = row[c];
        i = r * C + c;
        if (x === '#') { type[i] = 3; ch[i] = ''; }
        else if (x === '@') { type[i] = 2; ch[i] = ''; }
        else if (x >= 'א' && x <= 'ת' && !FIN[x]) { type[i] = 1; ch[i] = x; }
        else throw new Error('bad char');
      }
    }
    var boxes = def.b || [];
    for (var bi = 0; bi < boxes.length; bi++) {
      var b = boxes[bi];
      for (var rr = 0; rr < b.h; rr++) for (var cc = 0; cc < b.w; cc++) {
        var rrr = b.r + rr, ccc = b.c + cc;
        if (rrr >= R || ccc >= C) throw new Error('box out');
        i = rrr * C + ccc;
        if (type[i] !== 2 || boxOf[i] !== -1) throw new Error('box cell');
        boxOf[i] = bi;
      }
    }
    for (i = 0; i < N; i++) if (type[i] === 2 && boxOf[i] === -1) throw new Error('orphan box cell');

    var ea = new Int16Array(N).fill(-1), ed = new Int16Array(N).fill(-1);
    var entries = [];
    for (bi = 0; bi < boxes.length; bi++) {
      var bx = boxes[bi];
      ['a', 'd'].forEach(function (d) {
        var cl = bx[d];
        if (!cl) return;
        var sr = d === 'a' ? bx.r + cl.s : bx.r + bx.h;
        var sc = d === 'a' ? bx.c + bx.w : bx.c + cl.s;
        if (cl.s < 0 || cl.s >= (d === 'a' ? bx.h : bx.w)) throw new Error('bad offset');
        var cells = [];
        var rr2 = sr, cc2 = sc;
        while (rr2 < R && cc2 < C && type[rr2 * C + cc2] === 1) {
          cells.push(rr2 * C + cc2);
          if (d === 'a') cc2++; else rr2++;
        }
        if (cells.length < 2) throw new Error('short entry');
        var id = entries.length;
        var ans = '';
        for (var k = 0; k < cells.length; k++) {
          ans += ch[cells[k]];
          var arr = d === 'a' ? ea : ed;
          if (arr[cells[k]] !== -1) throw new Error('overlap');
          arr[cells[k]] = id;
        }
        entries.push({ id: id, d: d, box: bi, cells: cells, len: cells.length, clue: cl.t, sp: cl.sp || null, ans: ans, pic: bx.p || null });
      });
    }
    for (i = 0; i < N; i++) if (type[i] === 1 && ea[i] === -1 && ed[i] === -1) throw new Error('free letter');
    // כל רצף אותיות באורך 2 ומעלה חייב להיות תשובה אמיתית שמתחילה בתחילת הרצף
    for (r = 0; r < R; r++) {
      c = 0;
      while (c < C) {
        if (type[r * C + c] !== 1) { c++; continue; }
        var s0 = c;
        while (c < C && type[r * C + c] === 1) c++;
        if (c - s0 >= 2) {
          var e0 = ea[r * C + s0];
          if (e0 < 0 || entries[e0].cells[0] !== r * C + s0 || entries[e0].len !== c - s0) throw new Error('stray run row');
        }
      }
    }
    for (c = 0; c < C; c++) {
      r = 0;
      while (r < R) {
        if (type[r * C + c] !== 1) { r++; continue; }
        var s1 = r;
        while (r < R && type[r * C + c] === 1) r++;
        if (r - s1 >= 2) {
          var e1 = ed[s1 * C + c];
          if (e1 < 0 || entries[e1].cells[0] !== s1 * C + c || entries[e1].len !== r - s1) throw new Error('stray run col');
        }
      }
    }
    // סדר קריאה: מלמעלה למטה, מימין לשמאל
    var order = entries.map(function (e) { return e.id; });
    order.sort(function (x, y) {
      var ex = entries[x], ey = entries[y];
      var rx = Math.floor(ex.cells[0] / C), ry = Math.floor(ey.cells[0] / C);
      if (rx !== ry) return rx - ry;
      var cx = ex.cells[0] % C, cy = ey.cells[0] % C;
      if (cx !== cy) return cx - cy;
      return ex.d < ey.d ? -1 : 1;
    });
    var letters = 0;
    for (i = 0; i < N; i++) if (type[i] === 1) letters++;
    return { R: R, C: C, N: N, type: type, ch: ch, boxOf: boxOf, boxes: boxes, entries: entries, ea: ea, ed: ed, order: order, letters: letters };
  }

  function patternText(len, sp) {
    return sp && sp.length > 1 ? '(' + sp.join(',') + ')' : '(' + len + ')';
  }

  /* ---------- יצירה ---------- */
  function build(P, rnd) {
    var R = P.R, C = P.C, N = R * C;
    var t = new Uint8Array(N);            // 0 ריק, 1 אות, 2 תיבה
    var nl = new Uint8Array(N);           // 1 = אסור לשים אות
    var ch = new Array(N).fill('');
    var ea = new Int16Array(N).fill(-1), ed = new Int16Array(N).fill(-1), bx = new Int16Array(N).fill(-1);
    var boxes = [], ents = [], used = {};
    var pics = 0, entriesCount = 0;
    var maxLen = Math.max(R, C) - 1;
    var minLen = P.minLen || 2;
    var byLen = P.byLen;

    function perpOK(r, c, d) {
      if (d === 'a') {
        if (r > 0 && t[(r - 1) * C + c] === 1) return false;
        if (r < R - 1 && t[(r + 1) * C + c] === 1) return false;
      } else {
        if (c > 0 && t[r * C + c - 1] === 1) return false;
        if (c < C - 1 && t[r * C + c + 1] === 1) return false;
      }
      return true;
    }

    function clueLen(b) { return (b.a ? b.a.t.length : 0) + (b.d ? b.d.t.length : 0); }

    function pickClue(e, box, d) {
      var list = e.clues;
      var n = list.length;
      var off = Math.floor(rnd() * n);
      var limit = box ? P.boxClueMax - clueLen(box) : P.clueMax;
      var best = null;
      for (var k = 0; k < n; k++) {
        var c = list[(off + k) % n];
        if (c.length <= limit) { best = c; break; }
      }
      return best;
    }

    /* מחפש את המילה הטובה ביותר שמתחילה בתא (sr,sc) בכיוון d */
    function bestAt(sr, sc, d, box, picNeeded, first) {
      var dr = d === 'd' ? 1 : 0, dc = d === 'a' ? 1 : 0;
      var cells = [];
      var r = sr, c = sc;
      while (r < R && c < C) {
        var i = r * C + c;
        if (t[i] === 1) {
          if ((d === 'a' ? ea[i] : ed[i]) !== -1) break;
          cells.push(i);
        } else if (t[i] === 0 && !nl[i] && perpOK(r, c, d)) {
          cells.push(i);
        } else break;
        r += dr; c += dc;
      }
      var top = Math.min(cells.length, maxLen);
      var best = null;
      for (var L = minLen; L <= top; L++) {
        var er = sr + L * dr, ec = sc + L * dc;
        if (er < R && ec < C && t[er * C + ec] === 1) continue;
        var list = byLen[L];
        if (!list) continue;
        var n = list.length;
        if (!n) continue;
        var off = Math.floor(rnd() * n);
        var found = 0;
        for (var q = 0; q < n && found < 8; q++) {
          var e = list[(off + q) % n];
          if (used[e.a]) continue;
          if (picNeeded && !P.picFor(e)) continue;
          var x = 0, ok = true;
          for (var k = 0; k < L; k++) {
            var ci = cells[k];
            if (t[ci] === 1) {
              if (ch[ci] !== e.a[k]) { ok = false; break; }
              x++;
            }
          }
          if (!ok) continue;
          if (x === 0 && (!first || L < 3)) continue;
          var clue = picNeeded ? e.clues[0] : pickClue(e, box, d);
          if (clue == null) continue;
          found++;
          var lv = e.lvl > P.lvlMax ? -7 * (e.lvl - P.lvlMax) : (P.lvlMax > 1 && e.lvl > 1 ? 1.5 : 0);
          var endBonus = (er >= R || ec >= C) ? P.endBonus : (t[er * C + ec] === 2 ? P.endBonus : 0);
          var sc2 = 6 * x + L * 1.3 + lv + rnd() * 3.2 + (x >= 2 ? 2 : 0) + endBonus;
          if (!best || sc2 > best.score) best = { e: e, L: L, cells: cells.slice(0, L), score: sc2, clue: clue, x: x };
        }
      }
      return best;
    }

    function place(cand) {
      var e = cand.e, d = cand.d;
      var boxId;
      if (cand.kind === 'slot') {
        boxId = bx[cand.br * C + cand.bc];
      } else {
        var p = null;
        if (cand.kind === 'pic') { p = P.picFor(e); pics++; }
        boxes.push({ r: cand.br, c: cand.bc, h: cand.h, w: cand.w, p: p, a: null, d: null });
        boxId = boxes.length - 1;
        for (var rr = 0; rr < cand.h; rr++) for (var cc = 0; cc < cand.w; cc++) {
          var bi = (cand.br + rr) * C + cand.bc + cc;
          t[bi] = 2; nl[bi] = 0; bx[bi] = boxId;
        }
      }
      var id = ents.length;
      ents.push({ box: boxId, d: d, cells: cand.cells, a: e.a });
      var cl = { t: cand.kind === 'pic' ? e.clues[0] : cand.clue, s: cand.off || 0 };
      if (e.sp) cl.sp = e.sp;
      boxes[boxId][d] = cl;
      for (var k = 0; k < cand.cells.length; k++) {
        var ci = cand.cells[k];
        if (t[ci] === 0) { t[ci] = 1; ch[ci] = e.a[k]; }
        if (d === 'a') ea[ci] = id; else ed[ci] = id;
      }
      var last = cand.cells[cand.cells.length - 1];
      var lr = Math.floor(last / C), lc = last % C;
      var er = lr + (d === 'd' ? 1 : 0), ec = lc + (d === 'a' ? 1 : 0);
      if (er < R && ec < C && t[er * C + ec] === 0) nl[er * C + ec] = 1;
      used[e.a] = 1;
      entriesCount++;
    }

    /* מועמדים סביב אות קיימת x: מילה בניצב שחוצה אותה */
    function candidatesFor(xi, allowPic) {
      var xr = Math.floor(xi / C), xc = xi % C;
      var d = ea[xi] !== -1 ? 'd' : 'a';
      if (ea[xi] !== -1 && ed[xi] !== -1) return null;
      var dr = d === 'd' ? 1 : 0, dc = d === 'a' ? 1 : 0;
      var best = null;
      var J = d === 'd' ? Math.min(xr, 7) : Math.min(xc, 7);
      for (var j = 0; j <= J; j++) {
        var sr = xr - j * dr, sc = xc - j * dc;
        var br = sr - dr, bc = sc - dc;
        if (br < 0 || bc < 0) break;
        var bi = br * C + bc;
        var cand = null;
        if (t[bi] === 0) {
          var b1 = bestAt(sr, sc, d, null, false, false);
          if (b1 && b1.x >= 1) cand = { kind: 'box', br: br, bc: bc, h: 1, w: 1, d: d, off: 0, e: b1.e, cells: b1.cells, score: b1.score, clue: b1.clue };
        } else if (t[bi] === 2) {
          var bo = boxes[bx[bi]];
          if (bo.h === 1 && bo.w === 1 && !bo[d]) {
            var b2 = bestAt(sr, sc, d, bo, false, false);
            if (b2 && b2.x >= 1) cand = { kind: 'slot', br: br, bc: bc, h: 1, w: 1, d: d, off: 0, e: b2.e, cells: b2.cells, score: b2.score + 1.5, clue: b2.clue };
          }
        } else break;
        if (cand && (!best || cand.score > best.score)) best = cand;
        // תיבת תמונה בגודל 2x2
        if (allowPic && pics < P.maxPics) {
          for (var s = 0; s < 2; s++) {
            var pr, pc;
            if (d === 'a') { pr = sr - s; pc = sc - 2; } else { pr = sr - 2; pc = sc - s; }
            if (pr < 0 || pc < 0 || pr + 1 >= R || pc + 1 >= C) continue;
            var free = true;
            for (var a = 0; a < 2 && free; a++) for (var b = 0; b < 2; b++) if (t[(pr + a) * C + pc + b] !== 0) { free = false; break; }
            if (!free) continue;
            var b3 = bestAt(sr, sc, d, null, true, false);
            if (b3 && b3.x >= 1) {
              var cp = { kind: 'pic', br: pr, bc: pc, h: 2, w: 2, d: d, off: s, e: b3.e, cells: b3.cells, score: b3.score + 4 + P.picBonus, clue: '' };
              if (!best || cp.score > best.score) best = cp;
            }
          }
        }
      }
      return best;
    }

    /* מילה ראשונה: קרובה לפינה אבל לא על הקצה, כדי שמילים אחרות יוכלו לחצות אותה */
    (function seed() {
      var tries = 0;
      while (tries++ < 40) {
        var wantPic = P.maxPics > 0 && rnd() < P.firstPicChance;
        var d = rnd() < 0.5 ? 'a' : 'd';
        var cand = null;
        if (wantPic) {
          var s = rnd() < 0.5 ? 0 : 1;
          var pr, pc, sr, sc;
          if (d === 'a') { pr = 1 + Math.floor(rnd() * 2); pc = 0; sr = pr + s; sc = pc + 2; }
          else { pr = 0; pc = 1 + Math.floor(rnd() * 2); sr = pr + 2; sc = pc + s; }
          if (pr + 1 >= R || pc + 1 >= C) continue;
          var b = bestAt(sr, sc, d, null, true, true);
          if (b) cand = { kind: 'pic', br: pr, bc: pc, h: 2, w: 2, d: d, off: s, e: b.e, cells: b.cells, score: b.score, clue: '' };
        } else {
          var br, bc;
          if (d === 'a') { br = 1 + Math.floor(rnd() * 3); bc = 0; } else { br = 0; bc = 1 + Math.floor(rnd() * 3); }
          if (br >= R || bc >= C) continue;
          var b0 = bestAt(br + (d === 'd' ? 1 : 0), bc + (d === 'a' ? 1 : 0), d, null, false, true);
          if (b0) cand = { kind: 'box', br: br, bc: bc, h: 1, w: 1, d: d, off: 0, e: b0.e, cells: b0.cells, score: b0.score, clue: b0.clue };
        }
        if (cand) { place(cand); return; }
      }
    })();

    function letterList() {
      var arr = [];
      for (var i = 0; i < N; i++) if (t[i] === 1 && (ea[i] === -1 || ed[i] === -1)) arr.push(i);
      return arr;
    }

    // שלב 1: דגימה אקראית
    var fails = 0, rounds = 0;
    while (fails < P.failLimit && rounds++ < 400) {
      var letters = letterList();
      if (!letters.length) break;
      var best = null;
      var samples = Math.min(P.samples, letters.length);
      for (var s2 = 0; s2 < samples; s2++) {
        var xi = letters[Math.floor(rnd() * letters.length)];
        var cd = candidatesFor(xi, true);
        if (cd && (!best || cd.score > best.score)) best = cd;
      }
      if (best) { place(best); fails = 0; } else fails++;
    }
    // שלב 2: סריקה מלאה למילוי חורים
    for (var sweep = 0; sweep < 30; sweep++) {
      var ls = letterList();
      var bestS = null;
      for (var q2 = 0; q2 < ls.length; q2++) {
        var cd2 = candidatesFor(ls[q2], true);
        if (cd2 && (!bestS || cd2.score > bestS.score)) bestS = cd2;
      }
      if (!bestS) break;
      place(bestS);
    }

    // שלב 3: מילים צפות (ללא חציה) שממלאות חורים
    function floaterBest() {
      var best = null;
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
        var bi = r * C + c;
        var isSlotBox = t[bi] === 2 && boxes[bx[bi]].h === 1 && boxes[bx[bi]].w === 1;
        if (t[bi] !== 0 && !isSlotBox) continue;
        for (var di = 0; di < 2; di++) {
          var d = di === 0 ? 'a' : 'd';
          var sr = r + (d === 'd' ? 1 : 0), sc = c + (d === 'a' ? 1 : 0);
          if (sr >= R || sc >= C) continue;
          var bo = isSlotBox ? boxes[bx[bi]] : null;
          if (bo && bo[d]) continue;
          var b1 = bestAt(sr, sc, d, bo, false, true);
          if (b1) {
            var cd = { kind: isSlotBox ? 'slot' : 'box', br: r, bc: c, h: 1, w: 1, d: d, off: 0, e: b1.e, cells: b1.cells, score: b1.score + (isSlotBox ? 1.5 : 0), clue: b1.clue };
            if (!best || cd.score > best.score) best = cd;
          }
        }
      }
      if (P.maxPics > pics) {
        for (var pr = 0; pr + 1 < R; pr++) for (var pc = 0; pc + 1 < C; pc++) {
          if (t[pr * C + pc] || t[pr * C + pc + 1] || t[(pr + 1) * C + pc] || t[(pr + 1) * C + pc + 1]) continue;
          for (var di2 = 0; di2 < 2; di2++) {
            var d2 = di2 === 0 ? 'a' : 'd';
            for (var so = 0; so < 2; so++) {
              var sr2 = d2 === 'a' ? pr + so : pr + 2, sc2 = d2 === 'a' ? pc + 2 : pc + so;
              if (sr2 >= R || sc2 >= C) continue;
              var b2 = bestAt(sr2, sc2, d2, null, true, true);
              if (b2) {
                var cp = { kind: 'pic', br: pr, bc: pc, h: 2, w: 2, d: d2, off: so, e: b2.e, cells: b2.cells, score: b2.score + 3 + P.picBonus, clue: '' };
                if (!best || cp.score > best.score) best = cp;
              }
            }
          }
        }
      }
      return best;
    }
    for (var fl = 0; fl < 40; fl++) {
      var fb = floaterBest();
      if (!fb) break;
      place(fb);
      // אחרי שמילה צפה נוספה, ייתכנו שוב חציות חדשות
      for (var sw2 = 0; sw2 < 6; sw2++) {
        var ls2 = letterList(), bestC = null;
        for (var q3 = 0; q3 < ls2.length; q3++) {
          var cd3 = candidatesFor(ls2[q3], true);
          if (cd3 && (!bestC || cd3.score > bestC.score)) bestC = cd3;
        }
        if (!bestC) break;
        place(bestC);
      }
    }

    // ציון
    var letterCount = 0, boxCells = 0, blackCells = 0;
    for (var i2 = 0; i2 < N; i2++) {
      if (t[i2] === 1) letterCount++;
      else if (t[i2] === 2) boxCells++;
      else blackCells++;
    }
    // אשכול שחור גדול ביותר
    var seen = new Uint8Array(N), maxBlob = 0;
    for (var s3 = 0; s3 < N; s3++) {
      if (t[s3] !== 0 || seen[s3]) continue;
      var stack = [s3], size = 0;
      seen[s3] = 1;
      while (stack.length) {
        var cur = stack.pop(); size++;
        var cr = Math.floor(cur / C), cc2 = cur % C;
        var nb = [];
        if (cr > 0) nb.push(cur - C);
        if (cr < R - 1) nb.push(cur + C);
        if (cc2 > 0) nb.push(cur - 1);
        if (cc2 < C - 1) nb.push(cur + 1);
        for (var z = 0; z < nb.length; z++) if (t[nb[z]] === 0 && !seen[nb[z]]) { seen[nb[z]] = 1; stack.push(nb[z]); }
      }
      if (size > maxBlob) maxBlob = size;
    }
    var score = letterCount * 2 + boxCells * 1.2 - blackCells * 1.6 - maxBlob * 2.2 + pics * 3;
    return { t: t, ch: ch, boxes: boxes, R: R, C: C, score: score, letters: letterCount, black: blackCells, words: entriesCount, pics: 0, maxBlob: maxBlob };
  }

  /* ---------- יצירה מבוססת תבנית: לוח מלא וללא תאים מתים ---------- */
  function slotsOf(t, R, C) {
    var sl = [], r, c, s;
    function isL(rr, cc) { return rr >= 0 && rr < R && cc >= 0 && cc < C && t[rr * C + cc] === 1; }
    for (r = 0; r < R; r++) {
      c = 0;
      while (c < C) {
        if (!isL(r, c)) { c++; continue; }
        s = c; while (isL(r, c)) c++;
        if (c - s >= 2) { var ca = []; for (var k = 0; k < c - s; k++) ca.push(r * C + s + k); sl.push({ d: 'a', cells: ca, box: s > 0 ? r * C + s - 1 : -1 }); }
      }
    }
    for (c = 0; c < C; c++) {
      r = 0;
      while (r < R) {
        if (!isL(r, c)) { r++; continue; }
        s = r; while (isL(r, c)) r++;
        if (r - s >= 2) { var cd = []; for (var k2 = 0; k2 < r - s; k2++) cd.push((s + k2) * C + c); sl.push({ d: 'd', cells: cd, box: s > 0 ? (s - 1) * C + c : -1 }); }
      }
    }
    return sl;
  }

  function cspTemplate(R, C, rnd, maxRun, extra) {
    var N = R * C, t = new Uint8Array(N).fill(1), i, r, c;
    for (r = 0; r < R; r++) t[r * C] = 2;
    for (c = 0; c < C; c++) t[c] = 2;
    function runInfo(isAcross) {
      // לכל תא אות: אורך הרצף שלו בכיוון נתון
      var len = new Int16Array(N), a, b, s;
      if (isAcross) {
        for (a = 0; a < R; a++) { b = 0; while (b < C) { if (t[a * C + b] !== 1) { b++; continue; } s = b; while (b < C && t[a * C + b] === 1) b++; for (var q = s; q < b; q++) len[a * C + q] = b - s; } }
      } else {
        for (b = 0; b < C; b++) { a = 0; while (a < R) { if (t[a * C + b] !== 1) { a++; continue; } s = a; while (a < R && t[a * C + b] === 1) a++; for (var q2 = s; q2 < a; q2++) len[q2 * C + b] = a - s; } }
      }
      return len;
    }
    for (var iter = 0; iter < 300; iter++) {
      var la = runInfo(true), ld = runInfo(false), longCells = [];
      for (i = 0; i < N; i++) if (t[i] === 1 && (la[i] > maxRun || ld[i] > maxRun)) longCells.push(i);
      if (!longCells.length) break;
      // בוחרים רצף ארוך אקראי ומחפשים בו את התא ששובר הכי הרבה רצפים ארוכים
      var seed = longCells[Math.floor(rnd() * longCells.length)];
      var sr = Math.floor(seed / C), sc = seed % C;
      var horiz = la[seed] > maxRun && (ld[seed] <= maxRun || rnd() < 0.5);
      var cells = [], rr = sr, cc = sc;
      if (horiz) { while (cc > 0 && t[rr * C + cc - 1] === 1) cc--; while (cc < C && t[rr * C + cc] === 1) { cells.push(rr * C + cc); cc++; } }
      else { while (rr > 0 && t[(rr - 1) * C + cc] === 1) rr--; while (rr < R && t[rr * C + cc] === 1) { cells.push(rr * C + cc); rr++; } }
      var best = -1, bs = -1;
      for (var k = 2; k <= cells.length - 3; k++) {
        var ci = cells[k], sc2 = rnd() * 1.5;
        if (horiz) { if (ld[ci] > maxRun) sc2 += 3; else if (ld[ci] >= 2) sc2 -= 0.5; }
        else { if (la[ci] > maxRun) sc2 += 3; else if (la[ci] >= 2) sc2 -= 0.5; }
        if (sc2 > bs) { bs = sc2; best = ci; }
      }
      if (best < 0) return null;
      t[best] = 2;
    }
    for (i = 0; i < extra; i++) {
      r = 1 + Math.floor(rnd() * (R - 1)); c = 1 + Math.floor(rnd() * (C - 1));
      t[r * C + c] = 2;
    }
    // אותיות יתומות (ללא אף רצף של 2 ומעלה) הופכות לתיבות
    for (var pass = 0; pass < 6; pass++) {
      var a2 = runInfo(true), d2 = runInfo(false), ch2 = 0;
      for (i = 0; i < N; i++) if (t[i] === 1 && a2[i] < 2 && d2[i] < 2) { t[i] = 2; ch2++; }
      if (!ch2) break;
    }
    return t;
  }

  function buildCsp(P, rnd) {
    var R = P.R, C = P.C, N = R * C, i, j, k;
    var t = cspTemplate(R, C, rnd, P.maxRun, P.extraBoxes);
    if (!t) return null;
    var sl = slotsOf(t, R, C), S = sl.length;
    if (!S) return null;
    for (i = 0; i < S; i++) {
      if (sl[i].box < 0 || sl[i].cells.length > P.maxRun + 1 || !P.cspBase[sl[i].cells.length]) return null;
    }
    // מילון לכל משבצת
    var cellSlot = new Array(N);
    for (i = 0; i < S; i++) for (k = 0; k < sl[i].cells.length; k++) {
      var ci = sl[i].cells[k];
      (cellSlot[ci] = cellSlot[ci] || []).push([i, k]);
    }
    var dom = new Array(S), shuf = {};
    for (i = 0; i < S; i++) {
      var L = sl[i].cells.length;
      var arr = shuf[L];
      if (!arr) {
        arr = P.cspBase[L].slice();
        for (j = arr.length - 1; j > 0; j--) { var m = Math.floor(rnd() * (j + 1)); var tmp = arr[j]; arr[j] = arr[m]; arr[m] = tmp; }
        shuf[L] = arr;
      }
      dom[i] = arr;
    }
    var asg = new Array(S).fill(null), used = {}, nodes = 0, maxNodes = P.cspNodes;
    function rec() {
      if (++nodes > maxNodes) return false;
      var bi = -1, bn = 1e9, x;
      for (x = 0; x < S; x++) if (!asg[x] && dom[x].length < bn) { bn = dom[x].length; bi = x; if (!bn) return false; }
      if (bi < 0) return true;
      var cand = dom[bi], cells = sl[bi].cells, tried = 0;
      for (var q = 0; q < cand.length && tried < P.cspBranch; q++) {
        var e = cand[q];
        if (used[e.a]) continue;
        tried++;
        var saved = [], ok = true;
        for (var z = 0; z < cells.length && ok; z++) {
          var cs = cellSlot[cells[z]];
          for (var y = 0; y < cs.length; y++) {
            var sj = cs[y][0], pos = cs[y][1];
            if (sj === bi || asg[sj]) continue;
            var d0 = dom[sj], nd = [];
            for (var w = 0; w < d0.length; w++) if (d0[w].a[pos] === e.a[z] && !used[d0[w].a]) nd.push(d0[w]);
            if (!nd.length) { ok = false; break; }
            saved.push(sj, d0); dom[sj] = nd;
          }
        }
        if (ok) {
          asg[bi] = e; used[e.a] = 1;
          if (rec()) return true;
          asg[bi] = null; delete used[e.a];
        }
        for (var u = saved.length - 2; u >= 0; u -= 2) dom[saved[u]] = saved[u + 1];
        if (nodes > maxNodes) return false;
      }
      return false;
    }
    // המילון הבסיסי לא מסונן ממילים משומשות: הסינון נעשה בכל צעד
    if (!rec()) return null;
    var ch = new Array(N).fill('');
    for (i = 0; i < S; i++) for (k = 0; k < sl[i].cells.length; k++) ch[sl[i].cells[k]] = asg[i].a[k];
    // תיבות
    var boxIdx = {}, boxes = [];
    for (i = 0; i < S; i++) {
      var bc = sl[i].box;
      if (boxIdx[bc] == null) { boxIdx[bc] = boxes.length; boxes.push({ r: Math.floor(bc / C), c: bc % C, h: 1, w: 1, p: null, a: null, d: null }); }
    }
    for (i = 0; i < S; i++) {
      var bo = boxes[boxIdx[sl[i].box]], e2 = asg[i], other = sl[i].d === 'a' ? 'd' : 'a';
      // האם בתיבה יש עוד הגדרה?
      var shared = false;
      for (j = 0; j < S; j++) if (j !== i && sl[j].box === sl[i].box) shared = true;
      var limit = shared ? Math.floor(P.boxClueMax / 2) : P.clueMax;
      var opts = e2.clues.filter(function (x) { return x.length <= limit; });
      if (!opts.length) return null;
      var cl = { t: opts[Math.floor(rnd() * opts.length)], s: 0 };
      if (e2.sp) cl.sp = e2.sp;
      bo[sl[i].d] = cl;
    }
    var tt = new Uint8Array(N), letterCount = 0, boxCells = 0, blackCells = 0;
    for (i = 0; i < N; i++) {
      if (t[i] === 1) { tt[i] = 1; letterCount++; }
      else if (boxIdx[i] != null) { tt[i] = 2; boxCells++; }
      else { tt[i] = 0; blackCells++; }
    }
    var score = letterCount * 2 + boxCells * 1.2 - blackCells * 1.6 + 200;
    return { t: tt, ch: ch, boxes: boxes, R: R, C: C, score: score, letters: letterCount, black: blackCells, words: S, pics: 0, maxBlob: 0 };
  }

  function toDef(res) {
    var rows = [];
    for (var r = 0; r < res.R; r++) {
      var s = '';
      for (var c = 0; c < res.C; c++) {
        var i = r * res.C + c;
        s += res.t[i] === 1 ? res.ch[i] : (res.t[i] === 2 ? '@' : '#');
      }
      rows.push(s);
    }
    var bs = res.boxes.map(function (b) {
      var o = { r: b.r, c: b.c, h: b.h, w: b.w, p: b.p || null };
      if (b.a) o.a = b.a; else o.a = null;
      if (b.d) o.d = b.d; else o.d = null;
      return o;
    });
    return { R: res.R, C: res.C, g: rows, b: bs };
  }

  /* בונה את הפרמטרים המשותפים ליצירה סינכרונית ואסינכרונית */
  function makeParams(opts) {
    var rnd = mulberry32(hashStr(String(opts.seed)));
    var maxLen = Math.max(opts.R, opts.C) - 1;
    var byLen = {}, i;
    for (i = 0; i < opts.bank.length; i++) {
      var e = opts.bank[i];
      if (e.a.length < 2 || e.a.length > maxLen) continue;
      (byLen[e.a.length] = byLen[e.a.length] || []).push(e);
    }
    // ערבוב דטרמיניסטי של כל רשימת אורך
    Object.keys(byLen).forEach(function (k) {
      var arr = byLen[k];
      for (var j = arr.length - 1; j > 0; j--) {
        var m = Math.floor(rnd() * (j + 1));
        var tmp = arr[j]; arr[j] = arr[m]; arr[m] = tmp;
      }
    });
    var P = {
      R: opts.R, C: opts.C, byLen: byLen,
      lvlMax: opts.lvlMax || 3,
      maxPics: opts.maxPics || 0,
      picFor: opts.picFor || function () { return null; },
      picBonus: opts.picBonus == null ? 3 : opts.picBonus,
      firstPicChance: opts.firstPicChance == null ? 0.5 : opts.firstPicChance,
      clueMax: opts.clueMax || 34,
      boxClueMax: opts.boxClueMax || 40,
      minLen: opts.minLen || 2,
      endBonus: opts.endBonus == null ? 3 : opts.endBonus,
      samples: opts.samples || 40,
      failLimit: opts.failLimit || 14
    };
    // האם יש אחד מהמושגים שיש לו תמונה? אז נשארים עם היוצר החופשי
    var hasPics = false;
    if (P.maxPics > 0) for (i = 0; i < opts.bank.length; i++) if (P.picFor(opts.bank[i])) { hasPics = true; break; }
    P.csp = opts.csp == null ? !hasPics : !!opts.csp;
    if (P.csp) {
      P.maxRun = Math.min(opts.maxRun || (opts.R * opts.C <= 90 ? 5 : 6), maxLen);
      P.extraBoxes = opts.extraBoxes == null ? 1 : opts.extraBoxes;
      P.cspNodes = opts.cspNodes || 1500;
      P.cspBranch = opts.cspBranch || 10;
      P.cspTries = opts.cspTries || 24;
      P.cspWant = opts.cspWant || 3;
      var half = Math.floor(P.boxClueMax / 2);
      P.cspBase = {};
      Object.keys(byLen).forEach(function (k) {
        var L = +k;
        if (L > P.maxRun + 1) return;
        var all = byLen[k].filter(function (e) {
          for (var q = 0; q < e.clues.length; q++) if (e.clues[q].length <= half) return true;
          return false;
        });
        var easy = all.filter(function (e) { return e.lvl <= P.lvlMax; });
        P.cspBase[L] = easy.length >= 40 ? easy : all;
      });
    }
    return { rnd: rnd, P: P, attempts: opts.attempts || 14 };
  }

  /* מנוע צעדים: קודם ניסיונות מבוססי תבנית, ואם אף אחד לא הצליח אז היוצר החופשי */
  function Gen(opts) {
    var m = makeParams(opts);
    this.rnd = m.rnd; this.P = m.P; this.attempts = m.attempts;
    this.best = null; this.cspOk = 0; this.i = 0; this.phase = this.P.csp ? 0 : 1; this.n = 0;
  }
  Gen.prototype.total = function () { return this.P.csp ? this.P.cspTries + this.attempts : this.attempts; };
  Gen.prototype.step = function () {
    this.n++;
    if (this.phase === 0) {
      var res = buildCsp(this.P, this.rnd);
      if (res) { this.cspOk++; if (!this.best || res.score > this.best.score) this.best = res; }
      this.i++;
      if (this.cspOk >= this.P.cspWant || this.i >= this.P.cspTries) {
        if (this.best) return true;
        this.phase = 1; this.i = 0;
      }
      return false;
    }
    var g = build(this.P, this.rnd);
    if (!this.best || g.score > this.best.score) this.best = g;
    this.i++;
    return this.i >= this.attempts;
  };
  Gen.prototype.def = function () {
    var def = toDef(this.best);
    def.m = { w: this.best.words, l: this.best.letters, k: this.best.black, p: this.best.pics };
    return def;
  };

  /*
    opts: { R, C, seed, bank:[...], lvlMax, maxPics, picFor(entry)->{k,v}|null,
            attempts, clueMax, boxClueMax }
    דטרמיניסטי: אותו seed ואותו בנק נותנים אותו תשחץ.
  */
  function generate(opts) {
    var g = new Gen(opts);
    while (!g.step()) { /* ממשיכים */ }
    return g.def();
  }

  /* גרסה אסינכרונית שמוותרת על הלולאה בין ניסיונות כדי לא לתקוע את המסך */
  function generateAsync(opts, yieldFn) {
    var g = new Gen(opts);
    return new Promise(function (resolve) {
      function step() {
        var done = g.step();
        if (yieldFn) yieldFn(Math.min(1, g.n / g.total()));
        if (done) resolve(g.def()); else setTimeout(step, 0);
      }
      step();
    });
  }

  return {
    normLetters: normLetters, hashStr: hashStr, mulberry32: mulberry32,
    parseBank: parseBank, mergeEntries: mergeEntries, parseDef: parseDef,
    generate: generate, generateAsync: generateAsync, patternText: patternText, splitsOf: splitsOf
  };
});
