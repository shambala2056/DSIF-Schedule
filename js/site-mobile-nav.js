/**
 * Гар утасны доод цэсийг бүх хуудсанд оруулах нэгдсэн скрипт.
 * Usage: <script src="js/site-mobile-nav.js" data-active="ТӨСӨЛ"></script>
 *   data-active — тухайн хуудсанд идэвхтэй байх цэсийн label (заавал биш).
 */
(function () {
  if (document.getElementById('mobile-bottom-nav')) return; // давхар оруулахгүй

  var script = document.currentScript;
  var activeLabel = (script && script.getAttribute('data-active')) || '';

  var CSS = (
    '#mobile-bottom-nav {' +
      'display: none;' +
      'position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;' +
      'height: calc(52px + env(safe-area-inset-bottom, 0px));' +
      'padding-bottom: env(safe-area-inset-bottom, 0px);' +
      'background: rgba(14,14,14,0.96);' +
      'backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);' +
      'border-top: 1px solid rgba(255,255,255,0.08);' +
      'box-shadow: 0 -4px 24px rgba(0,0,0,0.4);' +
      'flex-direction: row; align-items: center; justify-content: space-around;' +
    '}' +
    'body:not(.dark-scheme) #mobile-bottom-nav {' +
      'background: rgba(248,249,250,0.97);' +
      'border-top: 1px solid rgba(0,0,0,0.08);' +
      'box-shadow: 0 -4px 20px rgba(0,0,0,0.1);' +
    '}' +
    '.mob-nav-item {' +
      'position: relative; z-index: 1;' +
      'display: flex; flex-direction: column; align-items: center; justify-content: center;' +
      'flex: 1; gap: 1px; text-decoration: none !important;' +
      'color: #000 !important; opacity: 0.75;' +
      'transition: opacity 0.25s, transform 0.25s;' +
      'padding: 2px; border-radius: 10px;' +
    '}' +
    'body:not(.dark-scheme) .mob-nav-item { color: #000 !important; }' +
    'body.dark-scheme .mob-nav-item { color: #ffffff !important; }' +
    '.mnav-icon-wrap {' +
      'width: 26px; height: 26px;' +
      'display: flex; align-items: center; justify-content: center; border-radius: 50%;' +
      'transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s;' +
    '}' +
    '.mob-nav-item i { font-size: 14px; line-height: 1; transition: color 0.25s; }' +
    '.mob-nav-item span { font-size: 8px; letter-spacing: 0.2px; line-height: 1; color: inherit !important; opacity: 0.85; transition: color 0.25s, opacity 0.25s; }' +
    '.mob-nav-item.active, body:not(.dark-scheme) .mob-nav-item.active, body.dark-scheme .mob-nav-item.active {' +
      'color: #4bac48 !important; opacity: 1;' +
      'background: transparent; border: 0; box-shadow: none;' +
    '}' +
    '.mob-nav-item.active span { opacity: 1; font-weight: 700; }' +
    '.mob-nav-item[data-menu-label="ТӨСӨЛ"] {' +
      'flex: 0 0 auto; transform: translateY(-10px); padding: 4px 6px;' +
    '}' +
    '.mob-nav-item[data-menu-label="ТӨСӨЛ"] .mnav-icon-wrap {' +
      'width: 44px; height: 44px;' +
      'background: #4bac48;' +
      'border: 2.5px solid #fff;' +
    '}' +
    'body.dark-scheme .mob-nav-item[data-menu-label="ТӨСӨЛ"] .mnav-icon-wrap {' +
      'border-color: rgba(14,14,14,0.96);' +
    '}' +
    '.mob-nav-item[data-menu-label="ТӨСӨЛ"] i { font-size: 18px; color: #fff !important; }' +
    '.mob-nav-item[data-menu-label="ТӨСӨЛ"] span { font-weight: 700; margin-top: 2px; }' +
    '@media (max-width: 991px) {' +
      '#mobile-bottom-nav { display: flex; }' +
      'body { padding-bottom: 56px; }' +
    '}'
  );

  var ITEMS = [
    { label: 'НҮҮР',     href: 'index.html',                     icon: 'fa-home',           text: 'Нүүр' },
    { label: 'ЗОРИЛГО',  href: 'index.html#section-about',       icon: 'fa-bullseye',       text: 'Зорилго' },
    { label: 'ТӨСӨЛ',    href: 'tusul.html',                     icon: 'fa-folder-open',    text: 'Төсөл' },
    { label: 'ХӨТӨЛБӨР', href: 'index.html#section-schedule',    icon: 'fa-calendar-alt',   text: 'Хөтөлбөр' },
    { label: 'БАЙРШИЛ',  href: 'index.html#section-venue',       icon: 'fa-location-dot',   text: 'Байршил' },
    { label: 'СУДАЛГАА', href: 'sudalgaa.html',                  icon: 'fa-clipboard-list', text: 'Судалгаа' }
  ];

  // CSS оруулах
  var style = document.createElement('style');
  style.id = 'site-mobile-nav-style';
  style.textContent = CSS;
  document.head.appendChild(style);

  // <nav> оруулах
  var nav = document.createElement('nav');
  nav.id = 'mobile-bottom-nav';
  nav.innerHTML = ITEMS.map(function (it) {
    var isActive = activeLabel && it.label === activeLabel ? ' active' : '';
    return (
      '<a class="mob-nav-item' + isActive + '" href="' + it.href + '" data-menu-label="' + it.label + '">' +
        '<div class="mnav-icon-wrap"><i class="fa ' + it.icon + '"></i></div>' +
        '<span>' + it.text + '</span>' +
      '</a>'
    );
  }).join('');

  function insertNav() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', insertNav);
      return;
    }
    document.body.appendChild(nav);
  }
  insertNav();

  // Нуугдсан цэсийг menu.json-оос таних (админ тохиргоо)
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'data/menu.json', true);
    xhr.onload = function () {
      if (xhr.status !== 200) return;
      try {
        var list = JSON.parse(xhr.responseText);
        var hidden = [];
        list.forEach(function (m) { if (!m.visible && m.type !== 'section') hidden.push(m.label); });
        if (!hidden.length) return;
        nav.querySelectorAll('.mob-nav-item[data-menu-label]').forEach(function (el) {
          if (hidden.indexOf(el.dataset.menuLabel) !== -1) el.style.display = 'none';
        });
      } catch (_) {}
    };
    xhr.send();
  } catch (e) {}
})();
