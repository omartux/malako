(function () {
  'use strict';

  const NOTICE_ID = 'admin-mode-notice';
  const CLOSE_ID = 'admin-mode-close';
  const DISMISS_KEY = 'malako_admin_notice_dismissed';
  const PROBE_PATH = 'admin/admin-mode.js';

  function wasDismissed() {
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function rememberDismissal() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch (error) {
      return;
    }
  }

  function init() {
    const notice = document.getElementById(NOTICE_ID);
    const close = document.getElementById(CLOSE_ID);
    if (!notice || !close || wasDismissed()) return;

    let revealed = false;

    function reveal() {
      if (revealed || window.MALAKO_ADMIN_PRESENT !== true) return;
      revealed = true;
      notice.hidden = false;
      window.requestAnimationFrame(function () {
        notice.classList.add('is-visible');
      });
    }

    close.addEventListener('click', function () {
      rememberDismissal();
      notice.classList.remove('is-visible');
      notice.hidden = true;
    });

    if (window.MALAKO_ADMIN_PRESENT === true) {
      reveal();
      return;
    }

    const probe = document.createElement('script');
    probe.src = PROBE_PATH + (window.location.protocol === 'file:' ? '' : '?v=' + Date.now());
    probe.async = true;
    probe.onload = reveal;
    probe.onerror = function () {
      notice.hidden = true;
    };
    document.head.appendChild(probe);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
