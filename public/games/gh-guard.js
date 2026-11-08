/* Game Hub client guard. Loaded first in every game page.
   It only reports to the parent player; the server decides what a report means,
   because anything running in the browser can be bypassed by a determined cheater. */
(function () {
  if (window.__ghGuard) return;
  window.__ghGuard = true;
  if (window.parent === window || !/[?&]hub=1(&|$)/.test(location.search)) return;

  var sent = {};
  function report(kind) {
    if (sent[kind]) return;
    sent[kind] = true;
    try {
      window.parent.postMessage({ source: "gamehub", type: "gh-integrity", kind: kind }, location.origin);
    } catch (e) {}
  }

  if (navigator.webdriver === true) report("automation");

  var inputTypes = [
    "pointerdown", "pointermove", "pointerup",
    "mousedown", "mousemove", "mouseup",
    "touchstart", "touchmove", "touchend",
    "keydown", "keyup"
  ];
  var blocked = 0;
  inputTypes.forEach(function (type) {
    window.addEventListener(
      type,
      function (event) {
        if (event.isTrusted) return;
        event.stopImmediatePropagation();
        event.preventDefault();
        blocked += 1;
        if (blocked >= 5) report("synthetic_input");
      },
      true
    );
  });

  var lastPerf = performance.now();
  var lastDate = Date.now();
  var strikes = 0;
  setInterval(function () {
    var perf = performance.now();
    var date = Date.now();
    var perfDelta = perf - lastPerf;
    var dateDelta = date - lastDate;
    lastPerf = perf;
    lastDate = date;
    if (dateDelta < 500 || dateDelta > 5000) {
      strikes = 0;
      return;
    }
    var ratio = perfDelta / dateDelta;
    strikes = ratio > 1.4 || ratio < 0.6 ? strikes + 1 : 0;
    if (strikes >= 4) report("speed_hack");
  }, 1000);
})();
