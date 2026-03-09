/* Campus System — main.js */
(function () {
  'use strict';

  // ── Dark mode ────────────────────────────────────────────────────────────
  (function initDarkMode() {
    var saved  = localStorage.getItem('campusDarkMode') === '1';
    var btn    = document.getElementById('darkToggle');
    var icon   = document.getElementById('darkIcon');

    function applyDark(on) {
      document.body.classList.toggle('dark-mode', on);
      if (icon) {
        icon.className = on ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
      }
      // remove the no-flash guard now that body has the right class
      document.documentElement.classList.remove('dm-pending');
      document.documentElement.style.visibility = '';
    }

    // Apply saved preference immediately
    applyDark(saved);

    if (btn) {
      btn.addEventListener('click', function () {
        var isDark = document.body.classList.contains('dark-mode');
        applyDark(!isDark);
        localStorage.setItem('campusDarkMode', isDark ? '0' : '1');
      });
    }
  })();
  const sidebar   = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  if (sidebar && toggleBtn) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
    function openSidebar()  { sidebar.classList.add('open');    backdrop.classList.add('show'); }
    function closeSidebar() { sidebar.classList.remove('open'); backdrop.classList.remove('show'); }
    toggleBtn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
    backdrop.addEventListener('click', closeSidebar);
  }
  // ── Bootstrap toast for server flash messages ──────────────────────────
  (function initFlashToast() {
    if (typeof window.__flashToast === 'undefined') return;
    if (typeof bootstrap === 'undefined' || !bootstrap.Toast) return;

    var flash     = window.__flashToast;
    var isSuccess = flash.type === 'success';
    var icon      = isSuccess ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
    var bgClass   = isSuccess ? 'text-bg-success' : 'text-bg-danger';

    var toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center border-0 ' + bgClass;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.innerHTML =
      '<div class="d-flex">' +
        '<div class="toast-body">' +
          '<i class="bi ' + icon + ' me-2"></i>' + flash.msg +
        '</div>' +
        '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
      '</div>';

    var container = document.getElementById('toastContainer');
    if (!container) return;
    container.appendChild(toastEl);

    var toast = new bootstrap.Toast(toastEl, { delay: 4000, autohide: true });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', function () { toastEl.remove(); });
  })();
  if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el, { trigger: 'hover' }));
  }

  // ── Notification system ──────────────────────────────────────────────────
  (function initNotifications() {
    var bell       = document.getElementById('notifBell');
    var badge      = document.getElementById('notifBadge');
    var dropdown   = document.getElementById('notifDropdown');
    var list       = document.getElementById('notifList');
    var markAllBtn = document.getElementById('markAllRead');
    var clearBtn   = document.getElementById('clearRead');
    if (!bell) return;

    var ICONS = { order:'bi-bag-check-fill', booking:'bi-calendar-check-fill', chat:'bi-chat-dots-fill', admin:'bi-shield-fill', system:'bi-info-circle-fill' };
    var isOpen = false;

    function setBadge(count) {
      if (!badge) return;
      if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.classList.remove('d-none'); }
      else            { badge.classList.add('d-none'); }
    }

    function relTime(iso) {
      var diff = Math.floor((Date.now() - new Date(iso)) / 1000);
      if (diff <  60)   return 'just now';
      if (diff < 3600)  return Math.floor(diff / 60)   + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    }

    function renderItem(n) {
      var li  = document.createElement('li');
      var tag = n.link ? 'a' : 'div';
      li.innerHTML =
        '<' + tag + ' class="notif-item' + (n.read ? '' : ' unread') + '"' +
          (n.link ? ' href="' + n.link + '"' : '') +
          ' data-id="' + n._id + '">' +
          '<div class="notif-icon ' + (n.type || 'system') + '">' +
            '<i class="bi ' + (ICONS[n.type] || ICONS.system) + '"></i>' +
          '</div>' +
          '<div class="notif-content">' +
            '<div class="notif-title">' + n.title + '</div>' +
            '<div class="notif-body">'  + n.body  + '</div>' +
            '<div class="notif-time">'  + relTime(n.createdAt) + '</div>' +
          '</div>' +
          (!n.read ? '<div class="notif-unread-dot"></div>' : '') +
        '</' + tag + '>';
      li.firstElementChild.addEventListener('click', function () { markOneRead(n._id, li); });
      return li;
    }

    function renderList(notifications) {
      list.innerHTML = '';
      if (!notifications || notifications.length === 0) {
        list.innerHTML = '<li class="notif-empty text-muted small text-center py-4"><i class="bi bi-bell-slash fs-4 d-block mb-1"></i>No notifications yet</li>';
        return;
      }
      notifications.forEach(function (n) { list.appendChild(renderItem(n)); });
    }

    function fetchNotifications() {
      fetch('/notifications', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (data) { setBadge(data.unreadCount); renderList(data.notifications); })
        .catch(function (e) { console.warn('[notif] fetch error', e); });
    }

    function markOneRead(id, li) {
      fetch('/notifications/mark-read', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          setBadge(data.unreadCount);
          var item = li ? li.querySelector('.notif-item') : null;
          if (item) {
            item.classList.remove('unread');
            var dot = item.querySelector('.notif-unread-dot');
            if (dot) dot.remove();
          }
        });
    }

    function openDropdown()  { dropdown.classList.remove('d-none'); isOpen = true;  fetchNotifications(); }
    function closeDropdown() { dropdown.classList.add('d-none');    isOpen = false; }

    bell.addEventListener('click', function (e) { e.stopPropagation(); isOpen ? closeDropdown() : openDropdown(); });
    document.addEventListener('click', function (e) {
      if (isOpen && !document.getElementById('notifWrapper').contains(e.target)) closeDropdown();
    });

    if (markAllBtn) {
      markAllBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        fetch('/notifications/mark-read', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            setBadge(data.unreadCount);
            list.querySelectorAll('.notif-item').forEach(function (el) {
              el.classList.remove('unread');
              var dot = el.querySelector('.notif-unread-dot');
              if (dot) dot.remove();
            });
          });
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        fetch('/notifications/clear', { method: 'DELETE', credentials: 'same-origin' })
          .then(function () { fetchNotifications(); });
      });
    }

    function connectSocket() {
      if (typeof io === 'undefined') return;
      var socket = io({ transports: ['websocket', 'polling'] });
      socket.on('notification:new', function (data) {
        setBadge(data.unreadCount);
        bell.style.transition = 'transform .15s';
        bell.style.transform  = 'scale(1.25)';
        setTimeout(function () { bell.style.transform = ''; }, 200);
        if (isOpen) {
          var empty = list.querySelector('.notif-empty');
          if (empty) list.innerHTML = '';
          list.insertBefore(renderItem(Object.assign({ read: false }, data)), list.firstChild);
        }
      });
    }

    setTimeout(connectSocket, 300);
    fetchNotifications();
  })();
})();