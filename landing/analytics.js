(() => {
  "use strict";
  if (location.hostname !== "fatortak.rabbeh.com") return;
  if (document.visibilityState === "prerender") return;

  const payload = JSON.stringify({
    path: location.pathname || "/",
    ref: document.referrer || "",
  });

  const send = () => {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("track.php", blob)) return;
    }
    fetch("track.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  };

  if (document.readyState === "complete") send();
  else window.addEventListener("load", send, { once: true });
})();
