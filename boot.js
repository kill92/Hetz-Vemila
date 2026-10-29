/* חץ ומילה - הפעלה */
(function () {
  'use strict';
  var H = window.H;
  try { H.load(); } catch (e) { H.S = H.defaults(); }
  H.applyTheme();
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: light)');
    var onChange = function () { if (H.S.set.theme === 'auto') H.applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    H.applyName();
    H.go('home');
    if (!H.S.set.welcomed) setTimeout(function () { H.startWelcome(); }, 450);
    var b = document.getElementById('boot');
    if (b) { b.classList.add('out'); setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 400); }
    H.registerSW();
    setTimeout(function () { H.checkUpdate(false); }, 2500);
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  }
  var p;
  try { p = H.imgInit(); } catch (e) { p = Promise.resolve(); }
  Promise.race([p, new Promise(function (r) { setTimeout(r, 2500); })]).then(start, start);

  window.addEventListener('error', function (ev) {
    if (!started) start();
  });
})();
