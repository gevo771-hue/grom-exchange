/* Gromi launcher — supplied marketing animation, deferred UI only. */
(function () {
  var BASE = '/assets/';
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var videos = new Map();
  var queued = false;
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var state = videos.get(entry.target);
      if (state) { state.inView = entry.isIntersecting; sync(entry.target, state); }
    });
  }) : null;

  function sync(video, state) {
    var btn = video.parentElement;
    var rect = btn && btn.getBoundingClientRect();
    var visible = video.isConnected && !document.hidden && !motion.matches && state.inView && rect &&
      rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
      rect.top < window.innerHeight && rect.left < window.innerWidth &&
      getComputedStyle(btn).visibility !== 'hidden';
    if (!visible) {
      video.pause();
      if (motion.matches && video.querySelector('source')) { video.replaceChildren(); video.load(); }
      return;
    }
    // Hidden launchers keep only the poster; reuse the browser's media cache on navigation.
    if (!video.querySelector('source')) {
      video.innerHTML = '<source src="' + BASE + 'grom-ai-gromi.webm" type="video/webm">' +
        '<source src="' + BASE + 'grom-ai-gromi.mp4" type="video/mp4">';
      video.load();
    }
    if (video.paused) {
      var play = video.play();
      if (play && play.catch) play.catch(function () { /* Poster remains if autoplay is unavailable. */ });
    }
  }
  function syncAll() {
    if (motion.matches) document.querySelectorAll('#i-grom-ai animateTransform').forEach(function (a) { a.remove(); });
    videos.forEach(function (state, video) { sync(video, state); });
  }
  function add(btn) {
    if (btn.querySelector('.gai-vid')) return;
    var video = document.createElement('video');
    video.className = 'gai-vid';
    video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
    video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
    video.poster = BASE + 'grom-ai-gromi-poster.webp'; video.preload = 'none';
    videos.set(video, { inView: !io });
    btn.insertBefore(video, btn.firstChild); btn.classList.add('gai-has-vid');
    if (io) io.observe(video);
  }
  function scan() {
    videos.forEach(function (_, video) {
      if (!video.isConnected) { video.pause(); if (io) io.unobserve(video); videos.delete(video); }
    });
    document.querySelectorAll('.grom-ai-launcher').forEach(add);
    syncAll();
  }
  function queueScan() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; scan(); }, 250);
  }
  function hasLauncher(node) {
    return node.nodeType === 1 && (node.classList.contains('grom-ai-launcher') ||
      (node.firstElementChild && node.querySelector('.grom-ai-launcher')));
  }
  function start() {
    scan();
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        // Localization may replace the contents of an existing launcher.
        if (m.target.nodeType === 1 && m.target.classList.contains('grom-ai-launcher')) { queueScan(); return; }
        if (Array.from(m.addedNodes).some(hasLauncher) || Array.from(m.removedNodes).some(hasLauncher)) { queueScan(); return; }
      }
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('grom:route-change', function () { requestAnimationFrame(syncAll); });
    document.addEventListener('visibilitychange', syncAll);
    if (motion.addEventListener) motion.addEventListener('change', syncAll);
    else if (motion.addListener) motion.addListener(syncAll);
    if (!io) { window.addEventListener('scroll', syncAll, true); window.addEventListener('resize', syncAll); }
  }
  function idleStart() { if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 1500 }); else setTimeout(start, 0); }
  if (document.readyState === 'complete') idleStart();
  else window.addEventListener('load', idleStart, { once: true });
})();
