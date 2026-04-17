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

    // ── Цэсний нуух тохиргоо (Firestore → fallback menu.json) ──
    function hideMenuItems(menuItems) {
      var hidden = [];
      menuItems.forEach(function(m) {
        if (!m.visible && m.type !== 'section') hidden.push(m.label);
      });
      if (hidden.length) {
        document.querySelectorAll('#mainmenu > li').forEach(function(li) {
          var a = li.querySelector('a');
          if (a && hidden.indexOf(a.textContent.trim()) !== -1) {
            li.style.display = 'none';
          }
        });
      }
    }

    // menu.json-аас эхлээд sync ачаалах (хурдан)
    try {
      var menuXhr = new XMLHttpRequest();
      menuXhr.open('GET', base + 'data/menu.json', false);
      menuXhr.send();
      if (menuXhr.status === 200) {
        hideMenuItems(JSON.parse(menuXhr.responseText));
      }
    } catch(e) {}

    // Firestore-аас async давхар шалгах (админ тохиргоог бодит цагт авах)
    var fsScript = document.createElement('script');
    fsScript.type = 'module';
    fsScript.textContent = '\
      import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";\
      import{getFirestore,doc,getDoc}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";\
      try{\
        var a=initializeApp({apiKey:"AIzaSyAXYu7yseh6J6d21m-Jhiwt-EjVIeU5gQ8",authDomain:"dsif-shedule.firebaseapp.com",projectId:"dsif-shedule",storageBucket:"dsif-shedule.firebasestorage.app",messagingSenderId:"973476131387",appId:"1:973476131387:web:8c2e1234567890abcdef"},"hdr-menu");\
        var d=getFirestore(a);\
        var s=await getDoc(doc(d,"settings","menu"));\
        if(s.exists()&&s.data().list){\
          var hidden=[];\
          s.data().list.forEach(function(m){if(!m.visible&&m.type!=="section")hidden.push(m.label);});\
          document.querySelectorAll("#mainmenu > li").forEach(function(li){\
            var a=li.querySelector("a");\
            if(a){var t=a.textContent.trim();li.style.display=hidden.indexOf(t)!==-1?"none":"";}\
          });\
        }\
      }catch(e){}\
    ';
    document.head.appendChild(fsScript);

    // ── Categories loader (categories.json) ──
    try {
      var catContainer = document.getElementById('mega-categories');
      if (catContainer) {
        var catXhr = new XMLHttpRequest();
        catXhr.open('GET', base + 'data/categories.json', false);
        catXhr.send();
        if (catXhr.status === 200) {
          var cats = JSON.parse(catXhr.responseText);
          catContainer.innerHTML = '';
          cats.forEach(function(cat) {
            var col = document.createElement('div');
            col.className = 'col-lg-2 col-md-4 col-sm-6 text-center';
            col.innerHTML =
              '<a class="mega-cat-card" href="' + base + 'tusul.html?cat=' + cat.key + '">' +
                '<div class="relative hover text-center overflow-hidden soft-shadow rounded-1">' +
                  '<img src="' + (cat.image.indexOf('http') === 0 ? cat.image : base + cat.image) + '" class="w-100 relative hover-scale-1-1" alt="' + cat.name + '">' +
                '</div>' +
                '<h6 class="mt-3">' + cat.name.toUpperCase() + '</h6>' +
              '</a>';
            catContainer.appendChild(col);
          });
        }
      }
    } catch(e) {}

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
