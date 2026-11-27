(function () {
  'use strict';

  function getDocHeight() {
    var bodyRect = document.body ? Math.ceil(document.body.getBoundingClientRect().height) : 0;
    return Math.max(bodyRect, window.innerHeight);
  }

  function isStickyOrFixed(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var pos = window.getComputedStyle(node).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
      node = node.parentElement;
    }
    return false;
  }

  // When embedded inside the dashboard heatmap iframe: don't track, just report exact content height & support screenshot export.
  if (window.top !== window.self) {
    var reportHeight = function () {
      var h = document.body ? Math.ceil(document.body.getBoundingClientRect().height) : document.documentElement.scrollHeight;
      window.parent.postMessage({ type: 'ua_page_size', height: h }, '*');
    };
    window.addEventListener('load', reportHeight);
    window.addEventListener('resize', reportHeight);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reportHeight);
    setTimeout(reportHeight, 150);
    setTimeout(reportHeight, 600);

    var loadHtml2Canvas = function (cb) {
      if (window.html2canvas) return cb(window.html2canvas);
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = function () { cb(window.html2canvas); };
      s.onerror = function () { cb(null); };
      document.head.appendChild(s);
    };

    window.addEventListener('message', function (e) {
      if (!e.data || e.data.type !== 'ua_capture') return;
      loadHtml2Canvas(function (h2c) {
        if (!h2c) {
          window.parent.postMessage({ type: 'ua_capture_result', dataUrl: null }, '*');
          return;
        }
        h2c(document.body, {
          useCORS: true,
          scale: 1,
          windowWidth: document.documentElement.clientWidth,
          windowHeight: Math.ceil(document.body.getBoundingClientRect().height),
        })
          .then(function (canvas) {
            window.parent.postMessage({ type: 'ua_capture_result', dataUrl: canvas.toDataURL('image/png') }, '*');
          })
          .catch(function () {
            window.parent.postMessage({ type: 'ua_capture_result', dataUrl: null }, '*');
          });
      });
    });
    return;
  }

  // Don't track automated headless screenshot captures
  if (navigator.webdriver) return;

  var script = document.currentScript;
  var isLocalSeparate =
    window.location.protocol === 'file:' ||
    (window.location.hostname === 'localhost' && window.location.port && window.location.port !== '5001');
  var defaultEndpoint = isLocalSeparate
    ? 'http://localhost:5001/api/events'
    : window.location.origin + '/api/events';
  var ENDPOINT =
    window.ANALYTICS_ENDPOINT ||
    (script && script.getAttribute('data-endpoint')) ||
    defaultEndpoint;
  var STORAGE_KEY = 'ua_session_id';

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function getSessionId() {
    try {
      var id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = uuid();
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch (e) {
      return uuid();
    }
  }

  var sessionId = getSessionId();

  function send(payload) {
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {
      /* never break the host page */
    }
  }

  function getDeviceType() {
    var w = document.documentElement.clientWidth || window.innerWidth;
    return w <= 768 ? 'mobile' : 'desktop';
  }

  function track(type, extra) {
    var payload = {
      session_id: sessionId,
      event_type: type,
      page_url: window.location.href,
      device_type: getDeviceType(),
      timestamp: new Date().toISOString(),
    };
    for (var k in extra) payload[k] = extra[k];
    send(payload);
  }

  track('page_view', {
    viewport_width: document.documentElement.clientWidth || window.innerWidth,
    viewport_height: getDocHeight(),
  });

  document.addEventListener(
    'click',
    function (e) {
      var pinned = isStickyOrFixed(e.target);
      var x = pinned ? e.clientX : e.clientX + window.scrollX;
      var y = pinned ? e.clientY : e.clientY + window.scrollY;
      track('click', {
        x: Math.round(x),
        y: Math.round(y),
        viewport_width: document.documentElement.clientWidth || window.innerWidth,
        viewport_height: getDocHeight(),
      });
    },
    true
  );
})();
