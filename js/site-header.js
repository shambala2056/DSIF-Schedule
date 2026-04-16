/**
 * Loads header.html into #site-header-placeholder synchronously.
 * Usage: <script src="js/site-header.js" data-base=""></script>
 *   data-base: relative prefix from current page to site root (e.g. "../../../")
 *
 * Runs synchronously (sync XHR) so the injected header is in the DOM before
 * designesia.js binds its mega-menu / sticky-header handlers.
 */
(function () {
  var script = document.currentScript;
  var base = (script && script.getAttribute('data-base')) || '';
  var placeholder = document.getElementById('site-header-placeholder');
  if (!placeholder) return;

  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', base + 'header.html', false);
    xhr.send();
    if (xhr.status !== 200 && xhr.status !== 0) {
      console.error('[site-header] fetch failed, status', xhr.status);
      return;
    }

    var html = xhr.responseText;

    // Prepend base to relative src/href so images and links resolve correctly
    // from subdirectory pages. Absolute, hash, mailto:, tel:, data: are left alone.
    if (base) {
      html = html.replace(
        /(\s(?:src|href)=)"(?!https?:\/\/|\/\/|\/|#|mailto:|tel:|data:)([^"]+)"/g,
        '$1"' + base + '$2"'
      );
    }

    placeholder.outerHTML = html;

    // Add .active to the menu item matching the current page
    var path = window.location.pathname.toLowerCase();
    var isProjectSubpage = path.indexOf('/projects/') !== -1;
    var file = path.split('/').filter(Boolean).pop() || '';
    if (!file || path.slice(-1) === '/') file = 'index.html';

    var activeHref = null;
    if (isProjectSubpage || file === 'tusul.html') {
      activeHref = 'tusul.html';
    } else if (file === 'sudalgaa.html') {
      activeHref = 'sudalgaa.html';
    }

    if (activeHref) {
      var links = document.querySelectorAll('#mainmenu > li > a.menu-item');
      for (var i = 0; i < links.length; i++) {
        var href = (links[i].getAttribute('href') || '').toLowerCase();
        if (href.indexOf(activeHref) !== -1 && href.indexOf('?') === -1 && href.indexOf('#') === -1) {
          links[i].classList.add('active');
          break;
        }
      }
    }
  } catch (e) {
    console.error('[site-header] load error:', e);
  }
})();
