// gallerypage.js — standalone gallery.html renderer: fetch the editorial
// file, validate it with the same logic the test suite runs, and render one
// card per entry. Extracted from an inline <script> so the page can run
// under a strict Content-Security-Policy (no 'unsafe-inline').
'use strict';
const GALLERY_LANG = (navigator.language || 'en').slice(0, 2);
fetch('./gallery.json')
  .then((r) => r.json())
  .then((raw) => {
    const list = document.getElementById('galleryList');
    list.textContent = '';
    for (const e of validateGallery(raw)) {
      const card = document.createElement('a');
      card.className = 'gallerycard';
      card.href = './index.html#' + galleryEntryHash(e);
      const h = document.createElement('h2');
      h.textContent = galleryText(e.title, GALLERY_LANG);
      const p = document.createElement('p');
      p.textContent = galleryText(e.desc, GALLERY_LANG);
      const meta = document.createElement('p');
      meta.className = 'mono gallerymeta';
      meta.textContent = `seed ${e.seed} · ${e.x}, ${e.z}`;
      card.append(h, p, meta);
      list.appendChild(card);
    }
  })
  .catch(() => {
    document.getElementById('galleryList').textContent = 'gallery.json could not be loaded.';
  });
