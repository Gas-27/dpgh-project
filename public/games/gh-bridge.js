/* Shared Game Hub bridge for the reward games (Brain Memory, Sliding Tiles, Stop the Timer, Endless Runner).
   The parent page owns the wallet, lives and verification; this file only relays events and draws small overlays. */
(function () {
  var HUB = /[?&]hub=1/.test(location.search);
  var listeners = { state: [], cont: [], market: [], result: [] };
  var GH = (window.GH = {
    hub: HUB,
    ready: false,
    guest: false,
    level: 1,
    target: 1,
    lives: 1,
    status: "active",
    rewardGb: 5,
    tier1Level: null,
    tier1RewardGb: null,
    lifePrice: 4,
    cfg: {},
    pending: null,
  });

  GH.send = function (m) {
    if (!HUB) return;
    try {
      window.parent.postMessage(Object.assign({ source: "gamehub" }, m), location.origin);
    } catch (e) {}
  };
  GH.on = function (kind, fn) {
    listeners[kind].push(fn);
  };
  function emit(kind, d) {
    listeners[kind].forEach(function (fn) {
      try {
        fn(d);
      } catch (e) {
        console.error(e);
      }
    });
  }

  GH.complete = function (level) {
    if (!HUB) return Promise.resolve({ ok: true, level: level + 1, lives: GH.lives, status: level >= GH.target ? "cleared" : "active" });
    return new Promise(function (resolve) {
      GH.pending = resolve;
      GH.send({ type: "gh-level-complete", level: level });
    });
  };
  GH.lifeLost = function () {
    GH.send({ type: "gh-life-lost" });
  };
  GH.resetStreak = function () {
    if (!HUB) return Promise.resolve({ ok: true, level: 1 });
    return new Promise(function (resolve) {
      GH.pending = resolve;
      GH.send({ type: "gh-reset-streak" });
    });
  };
  GH.cashOut = function () {
    GH.send({ type: "gh-cash-out" });
  };
  GH.loadMarket = function () {
    GH.send({ type: "gh-market-load" });
  };
  GH.buyItem = function (type, key) {
    GH.send({ type: "gh-market-buy", itemType: type, itemKey: key });
  };
  GH.consume = function (key) {
    GH.send({ type: "gh-consume", itemKey: key });
  };

  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin) return;
    var d = e.data;
    if (!d || d.source !== "gamehub-parent") return;
    if (d.type === "gh-state") {
      GH.ready = true;
      GH.level = d.level || 1;
      GH.target = d.target || GH.target;
      GH.lives = d.lives;
      GH.status = d.status;
      GH.rewardGb = d.rewardGb || GH.rewardGb;
      GH.tier1Level = d.tier1Level;
      GH.tier1RewardGb = d.tier1RewardGb;
      GH.lifePrice = d.lifePrice || GH.lifePrice;
      GH.cfg = d.config || {};
      GH.guest = !!d.guest;
      emit("state", d);
    } else if (d.type === "gh-continue") {
      GH.lives = d.lives;
      GH.status = "active";
      hideOverlay();
      emit("cont", d);
    } else if (d.type === "gh-level-result") {
      if (d.level) GH.level = d.level;
      if (typeof d.lives === "number") GH.lives = d.lives;
      if (d.status) GH.status = d.status;
      var p = GH.pending;
      GH.pending = null;
      if (p) p(d);
      emit("result", d);
    } else if (d.type === "gh-market") {
      emit("market", d);
    }
  });

  /* Overlays ------------------------------------------------------------------ */
  var overlay;
  function ensureOverlay() {
    if (overlay) return overlay;
    var s = document.createElement("style");
    s.textContent =
      "#ghOv{position:fixed;inset:0;z-index:99998;display:none;align-items:center;justify-content:center;background:rgba(5,8,20,.82);font-family:system-ui,Segoe UI,Arial,sans-serif;padding:16px}" +
      "#ghOv .ghBox{width:min(340px,100%);background:#111a2f;border:1px solid #2c3b66;border-radius:18px;padding:22px 18px;text-align:center;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.6)}" +
      "#ghOv h2{font-size:21px;margin:0 0 8px}#ghOv p{font-size:14px;line-height:1.45;margin:0 0 16px;color:#c9d3ee}" +
      "#ghOv button{display:block;width:100%;border:0;border-radius:12px;padding:13px;font-size:15px;font-weight:800;margin-top:8px;cursor:pointer;background:#ffd23f;color:#1a1a1a}" +
      "#ghOv button.alt{background:#24325a;color:#fff}" +
      "#ghCover{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:#000;color:#fff;font:700 16px system-ui,Arial;text-align:center;padding:24px}" +
      "@media print{html,body{display:none!important}}";
    document.head.appendChild(s);
    overlay = document.createElement("div");
    overlay.id = "ghOv";
    document.body.appendChild(overlay);
    return overlay;
  }
  function hideOverlay() {
    if (overlay) overlay.style.display = "none";
  }
  GH.hideOverlay = hideOverlay;
  GH.overlay = function (title, text, buttons) {
    var o = ensureOverlay();
    o.innerHTML = "";
    var box = document.createElement("div");
    box.className = "ghBox";
    var h = document.createElement("h2");
    h.textContent = title;
    var p = document.createElement("p");
    p.textContent = text;
    box.appendChild(h);
    box.appendChild(p);
    (buttons || []).forEach(function (b) {
      var btn = document.createElement("button");
      btn.textContent = b.label;
      if (b.alt) btn.className = "alt";
      btn.onclick = b.onClick;
      box.appendChild(btn);
    });
    o.appendChild(box);
    o.style.display = "flex";
  };
  GH.showOutOfLives = function (what) {
    GH.overlay("Out of lives", (what || "You lost your last life.") + " Buy a life for GH\u20B5" + GH.lifePrice + " to continue right where you stopped, or end the game.", [
      { label: "Buy a life", onClick: function () { GH.send({ type: "gh-open-buy" }); } },
    ]);
    GH.send({ type: "gh-open-buy" });
  };
  GH.showWin = function (gb) {
    GH.overlay("You won!", "You earned free MTN " + (gb || GH.rewardGb) + "GB data. Claim it now.", [
      { label: "Claim my data", onClick: function () { GH.send({ type: "gh-open-claim" }); } },
    ]);
    GH.send({ type: "gh-open-claim" });
  };

  /* Screen-capture protection (best effort in a browser) ------------------------ */
  function protect() {
    try {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getDisplayMedia = function () {
          return Promise.reject(new DOMException("Screen capture is disabled in this game", "NotAllowedError"));
        };
      }
    } catch (e) {}
    var cover;
    function mkCover() {
      if (cover) return cover;
      cover = document.createElement("div");
      cover.id = "ghCover";
      cover.textContent = "Game hidden to protect fair play. Tap to continue.";
      cover.onclick = function () { cover.style.display = "none"; };
      document.body.appendChild(cover);
      return cover;
    }
    ensureOverlay();
    function hide() { mkCover().style.display = "flex"; }
    function show() { if (cover) cover.style.display = "none"; }
    document.addEventListener("visibilitychange", function () { document.hidden ? hide() : show(); });
    window.addEventListener("keyup", function (e) {
      if (e.key === "PrintScreen") {
        try { navigator.clipboard.writeText(""); } catch (x) {}
        hide();
        setTimeout(show, 1500);
      }
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "PrintScreen" || ((e.ctrlKey || e.metaKey) && e.shiftKey && /^(s|3|4|5)$/i.test(e.key))) {
        e.preventDefault();
        hide();
        setTimeout(show, 1500);
      }
    });
    document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    document.addEventListener("dragstart", function (e) { e.preventDefault(); });
  }
  if (HUB) {
    if (document.body) protect();
    else document.addEventListener("DOMContentLoaded", protect);
    document.addEventListener("DOMContentLoaded", function () { GH.send({ type: "gh-ready" }); });
    if (document.readyState !== "loading") GH.send({ type: "gh-ready" });
  }
})();
