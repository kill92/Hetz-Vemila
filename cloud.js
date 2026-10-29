/* חצים ואותיות - גיבוי וסנכרון Google Drive, עדכון, נעילה והתקנה */
(function () {
  'use strict';
  var H = window.H, h = H.h, $ = H.$;

  /* ---------- יצוא ויבוא ---------- */
  function packState(S) {
    var o = JSON.parse(JSON.stringify(S));
    delete o.set;
    return o;
  }
  function imagesFor(S) {
    var out = {};
    for (var a in S.photos) { var k = S.photos[a]; if (H.imgs[k]) out[k] = H.imgs[k]; }
    return out;
  }
  H.exportObj = function () {
    return { app: 'hetz', fmt: 1, ver: H.VERSION, at: Date.now(), state: packState(H.S), images: imagesFor(H.S) };
  };
  H.exportJSON = function () { return JSON.stringify(H.exportObj()); };

  function parseBackup(text) {
    if (typeof text !== 'string' || text.length > 60e6) return null;
    var o;
    try { o = JSON.parse(text); } catch (e) { return null; }
    if (!o || o.app !== 'hetz' || !o.state || typeof o.state !== 'object') return null;
    return o;
  }
  var IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;
  /* בונה מצב נקי מגיבוי: מקבל את ההגדרות המקומיות, מאמת תמונות */
  function stateFrom(o) {
    var raw = Object.assign({}, o.state, { set: H.S.set });
    var S = H.sanitize(raw);
    S.id = H.S.id;
    var imgs = {};
    var src = o.images && typeof o.images === 'object' ? o.images : {};
    for (var a in S.photos) {
      var k = S.photos[a], d = src[k] || H.imgs[k];
      if (typeof d === 'string' && d.length < 900000 && IMG_RE.test(d)) imgs[k] = d; else delete S.photos[a];
    }
    return { S: S, imgs: imgs };
  }
  function adopt(res) {
    var keys = Object.keys(res.imgs), p = [];
    keys.forEach(function (k) { if (!H.imgs[k]) p.push(H.imgPut(k, res.imgs[k])); });
    var old = H.S;
    H.S = res.S;
    // תמונות שאינן בשימוש יותר
    for (var a in old.photos) {
      var k2 = old.photos[a], used = false;
      for (var b in H.S.photos) if (H.S.photos[b] === k2) used = true;
      if (!used) H.imgDel(k2);
    }
    H.bankDirty = true;
    return Promise.all(p).then(function () { H.S.updatedAt = Date.now(); H.save(); H.applyTheme(); });
  }
  H.importJSON = function (text) {
    var o = parseBackup(text);
    if (!o) return false;
    try { adopt(stateFrom(o)); } catch (e) { return false; }
    return true;
  };

  /* ---------- מיזוג ---------- */
  function merge(L, R) {
    var M = H.defaults();
    M.id = L.id; M.created = Math.min(L.created, R.created) || L.created;
    M.set = L.set;
    M.name = L.name || R.name; M.gift = (L.gift || R.gift) ? 1 : 0;
    var id;
    // תשחצים
    var ids = {};
    Object.keys(L.p).forEach(function (k) { ids[k] = 1; });
    Object.keys(R.p).forEach(function (k) { ids[k] = 1; });
    for (id in ids) {
      var a = L.p[id], b = R.p[id];
      if (!a) M.p[id] = b; else if (!b) M.p[id] = a;
      else if (a.d !== b.d) M.p[id] = a.d ? a : b;
      else M.p[id] = a.u >= b.u ? a : b;
      if ((a && a.cred) || (b && b.cred)) M.p[id].cred = 1;
    }
    // ספרייה אישית
    var del = {};
    L.libDel.concat(R.libDel).forEach(function (x) { del[x] = 1; });
    M.libDel = Object.keys(del).slice(-3000);
    var lib = {};
    L.lib.concat(R.lib).forEach(function (w) { if (del[w.id]) return; if (!lib[w.id] || lib[w.id].u < w.u) lib[w.id] = w; });
    M.lib = Object.keys(lib).map(function (k) { return lib[k]; });
    // תמונות
    M.photos = Object.assign({}, R.photos, L.photos);
    // מטבעות
    if (R.coinsAt > L.coinsAt) { M.coins = R.coins; M.coinsAt = R.coinsAt; } else { M.coins = L.coins; M.coinsAt = L.coinsAt; }
    // סטטיסטיקה
    M.st.a = Math.max(L.st.a, R.st.a); M.st.k = Math.max(L.st.k, R.st.k);
    M.st.secA = Math.max(L.st.secA, R.st.secA); M.st.secK = Math.max(L.st.secK, R.st.secK);
    var ls = L.st.streak, rs = R.st.streak;
    var top = ls.last > rs.last ? ls : (rs.last > ls.last ? rs : (ls.cur >= rs.cur ? ls : rs));
    M.st.streak = { cur: top.cur, best: Math.max(ls.best, rs.best, top.cur), last: top.last };
    Object.keys(L.mc).forEach(function (k) { if (k !== 'dayD') M.mc[k] = Math.max(L.mc[k], R.mc[k] || 0); });
    if (R.mc.dayD > L.mc.dayD) { M.mc.dayD = R.mc.dayD; M.mc.dayN = R.mc.dayN; } else { M.mc.dayD = L.mc.dayD; M.mc.dayN = L.mc.dayN; }
    var mk = {};
    Object.keys(L.m).concat(Object.keys(R.m)).forEach(function (k) { mk[k] = Math.max(L.m[k] || 0, R.m[k] || 0); });
    M.m = mk;
    M.last = L.updatedAt >= R.updatedAt ? (L.last || R.last) : (R.last || L.last);
    M.cloud = L.cloud;
    M.updatedAt = Date.now();
    return M;
  }

  H._merge = merge; H._stateFrom = stateFrom;

  /* ---------- Google Identity ---------- */
  var SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  var FILE = 'hetz-backup.json';
  var tok = '', tokExp = 0, tclient = null, tclientId = '', pend = null, gsiP = null, busy = false;

  function loadGsi() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gsiP) return gsiP;
    gsiP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { gsiP = null; rej(new Error('gsi')); };
      document.head.appendChild(s);
    });
    return gsiP;
  }
  function validTok() { return tok && Date.now() < tokExp - 60000; }
  function getToken() {
    if (validTok()) return Promise.resolve(tok);
    var cid = H.S.set.clientId;
    if (!cid) return Promise.reject(new Error('noclient'));
    return loadGsi().then(function () {
      return new Promise(function (res, rej) {
        if (!tclient || tclientId !== cid) {
          tclientId = cid;
          tclient = google.accounts.oauth2.initTokenClient({
            client_id: cid, scope: SCOPE,
            callback: function (r) { if (pend) { var p = pend; pend = null; if (r && r.access_token) p.ok(r); else p.no(new Error((r && r.error) || 'auth')); } },
            error_callback: function (e) { if (pend) { var p = pend; pend = null; p.no(new Error((e && e.type) || 'popup')); } }
          });
        }
        pend = { ok: res, no: rej };
        tclient.requestAccessToken({ prompt: H.S.cloud.at ? '' : 'consent' });
      });
    }).then(function (r) {
      tok = r.access_token; tokExp = Date.now() + (+r.expires_in || 3000) * 1000;
      return tok;
    });
  }
  function api(url, opt) {
    opt = opt || {};
    opt.headers = Object.assign({ Authorization: 'Bearer ' + tok }, opt.headers || {});
    return fetch(url, opt).then(function (r) {
      if (r.status === 401) { tok = ''; throw new Error('401'); }
      if (!r.ok) throw new Error('http' + r.status);
      return r;
    });
  }
  function findFile() {
    var q = encodeURIComponent("name='" + FILE + "'");
    return api('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=5&fields=files(id,modifiedTime)&q=' + q)
      .then(function (r) { return r.json(); }).then(function (j) { return (j.files && j.files[0]) || null; });
  }
  function download(id) {
    return api('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?alt=media').then(function (r) { return r.text(); });
  }
  function upload(id, text) {
    if (id) {
      return api('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(id) + '?uploadType=media', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text
      });
    }
    var bd = 'hetz' + H.rid(12);
    var body = '--' + bd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name: FILE, parents: ['appDataFolder'] }) +
      '\r\n--' + bd + '\r\nContent-Type: application/json\r\n\r\n' + text + '\r\n--' + bd + '--';
    return api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + bd }, body: body
    });
  }
  function errMsg(e) {
    var m = e && e.message || '';
    if (m === 'noclient') return 'חסר Client ID. הוסף אותו בהגדרות, בחלק של הגיבוי.';
    if (m === 'gsi') return 'אין חיבור לשירותי Google. בדוק אינטרנט.';
    if (m === 'popup_closed' || m === 'popup_failed_to_open' || m === 'access_denied') return 'ההתחברות בוטלה';
    if (m === 'popup') return 'ההתחברות בוטלה';
    if (m === '401') return 'ההרשאה פגה. נסה שוב.';
    if (m === 'http403') return 'אין הרשאה. ודא ש-Google Drive API מופעל בפרויקט.';
    if (m.indexOf('http') === 0) return 'שגיאת שרת (' + m.slice(4) + ')';
    if (m === 'nofile') return 'לא נמצא גיבוי בענן';
    if (m === 'bad') return 'הקובץ בענן אינו תקין';
    return 'הפעולה נכשלה. בדוק אינטרנט ונסה שוב.';
  }
  function wrapOp(label, fn, silent) {
    if (busy) { if (!silent) H.toast('פעולה אחרת בעיצומה'); return Promise.resolve(false); }
    busy = true;
    if (!silent) H.toast(label, 8000);
    return getToken().then(fn).then(function (msg) {
      busy = false;
      if (!silent && msg) H.toast(msg, 3200);
      if (H.view === 'settings') H.refresh();
      return true;
    }).catch(function (e) {
      busy = false;
      if (!silent) H.toast(errMsg(e), 4200);
      return false;
    });
  }

  H.cloud = {
    connected: function () { return !!validTok(); },
    sync: function (manual) {
      return wrapOp('מסנכרן…', function () {
        return findFile().then(function (f) {
          if (!f) {
            return upload(null, H.exportJSON()).then(function () { H.S.cloud.at = Date.now(); H.save(); return 'הגיבוי הראשון נשמר בענן'; });
          }
          return download(f.id).then(function (text) {
            var o = parseBackup(text);
            if (!o) throw new Error('bad');
            var remote = stateFrom(o);
            var merged = merge(H.S, remote.S);
            var imgs = Object.assign({}, remote.imgs);
            for (var a in merged.photos) { var k = merged.photos[a]; if (!imgs[k] && H.imgs[k]) imgs[k] = H.imgs[k]; }
            return adopt({ S: merged, imgs: imgs }).then(function () {
              return upload(f.id, H.exportJSON());
            }).then(function () {
              H.S.cloud.at = Date.now(); H.save();
              return 'הסנכרון הושלם';
            });
          });
        });
      }, !manual);
    },
    backup: function () {
      H.confirm('לגבות לענן?', 'הגיבוי הקיים בענן יוחלף בנתונים שבמכשיר הזה.', 'גבה', function () {
        wrapOp('מגבה…', function () {
          return findFile().then(function (f) { return upload(f && f.id, H.exportJSON()); }).then(function () {
            H.S.cloud.at = Date.now(); H.save(); return 'הגיבוי נשמר בענן';
          });
        });
      });
    },
    restore: function () {
      H.confirm('לשחזר מהענן?', 'ההתקדמות והמילים במכשיר יוחלפו בגיבוי שבענן.', 'שחזר', function () {
        wrapOp('משחזר…', function () {
          return findFile().then(function (f) {
            if (!f) throw new Error('nofile');
            return download(f.id);
          }).then(function (text) {
            var o = parseBackup(text);
            if (!o) throw new Error('bad');
            return adopt(stateFrom(o));
          }).then(function () { H.S.cloud.at = Date.now(); H.save(); return 'השחזור הושלם'; });
        }).then(function () { /* המסך יתרענן */ });
      }, true);
    }
  };
  var autoT = 0;
  H.cloudAuto = function () {
    if (!H.S.set.autoSync || !H.S.set.clientId || !validTok()) return;
    clearTimeout(autoT);
    autoT = setTimeout(function () {
      var g = H.G && H.G();
      if (g && !g.done) { H.cloudAuto(); return; }
      H.cloud.sync(false);
    }, 2500);
  };

  /* ---------- עדכון ---------- */
  function cmpVer(a, b) {
    var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (var i = 0; i < 3; i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  }
  H.applyUpdate = function () {
    if (H.persistGame) { try { H.persistGame(); } catch (e) {} }
    H.save();
    var p = [];
    if (window.caches) p.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
    if (navigator.serviceWorker) p.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }));
    Promise.all(p).then(reload, reload);
    function reload() { location.reload(); }
  };
  H.checkUpdate = function (manual) {
    if (manual) H.toast('בודק עדכון…', 5000);
    return fetch('version.json?ts=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('http');
      return r.json();
    }).then(function (j) {
      if (!j || typeof j.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(j.version)) throw new Error('bad');
      if (cmpVer(j.version, H.VERSION) > 0) {
        var notes = (typeof j.notes === 'string' ? j.notes : '').slice(0, 300);
        H.sheet({
          title: 'יש גרסה חדשה', center: true, sub: 'גרסה ' + j.version + (notes ? '\n' + notes : ''),
          actions: [{ t: 'אחר כך', cls: 'ghost' }, { t: 'עדכן עכשיו', cls: 'primary', fn: function () { H.applyUpdate(); return false; }, keep: true }]
        });
      } else if (manual) H.toast('האפליקציה מעודכנת (גרסה ' + H.VERSION + ')');
    }).catch(function () {
      if (manual) H.toast('לא הצלחתי לבדוק עדכון. בדוק אינטרנט.');
    });
  };

  /* ---------- התקנה ---------- */
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; if (H.view === 'settings') H.refresh(); });
  window.addEventListener('appinstalled', function () { deferred = null; H.toast('האפליקציה הותקנה'); });
  H.canInstall = function () { return !!deferred; };
  H.doInstall = function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; H.refresh(); });
  };
  H.isIOS = function () {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };
  H.isStandalone = function () {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  };
  H.registerSW = function () {
    if (!('serviceWorker' in navigator)) return;
    if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
    navigator.serviceWorker.register('sw.js').catch(function () {});
  };
})();
