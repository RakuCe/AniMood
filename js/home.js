/* トップカード */
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "home") return;

  const cards = $$('[data-visual-card]');
  const candidates = WORKS.filter(work => work && work.img && work.title);
  if (!cards.length || !candidates.length) return;

  let previousIds = [];
  const DISPLAY_TIME = 5000;
  const FADE_TIME = 1000;

  /* 作品選択 */
  function pickWorks(count) {
    const pool = candidates.filter(work => !previousIds.includes(work.id));
    const source = pool.length >= count ? pool : candidates;
    const picked = [...source].sort(() => Math.random() - 0.5).slice(0, count);
    previousIds = picked.map(work => work.id);
    return picked;
  }

  /* 画像レイヤー */
  function ensureLayers(card) {
    let current = card.querySelector('.visual-img-current');
    let next = card.querySelector('.visual-img-next');

    if (!current) {
      current = card.querySelector('img');
      if (!current) {
        current = document.createElement('img');
        card.appendChild(current);
      }
      current.className = 'visual-img-current';
    }

    if (!next) {
      next = document.createElement('img');
      next.className = 'visual-img-next';
      next.alt = '';
      next.setAttribute('aria-hidden', 'true');
      card.appendChild(next);
    }

    current.style.opacity = '1';
    next.style.opacity = '0';
    return { current, next };
  }

  /* 初期表示 */
  function setInitial(card, work) {
    const { current, next } = ensureLayers(card);
    current.src = resolveImageUrl(thumbImagePath(work.img));
    current.alt = work.title;
    attachImageFallback(current, work);
    attachImageFallback(current, work);
    current.removeAttribute('aria-hidden');
    next.removeAttribute('src');
    next.alt = '';
    next.setAttribute('aria-hidden', 'true');
    card.dataset.workId = work.id;
    card.setAttribute('aria-label', work.title);
  }

  /* クロスフェード */
  function fadeTo(card, work) {
    if (card.dataset.fading === 'true') return;
    card.dataset.fading = 'true';

    const { current, next } = ensureLayers(card);
    const preload = new Image();
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;

        current.classList.remove('visual-img-current');
      current.classList.add('visual-img-next');
      current.style.opacity = '0';
      current.setAttribute('aria-hidden', 'true');
      current.alt = '';

      next.classList.remove('visual-img-next');
      next.classList.add('visual-img-current');
      next.style.opacity = '1';
      next.removeAttribute('aria-hidden');
      next.alt = work.title;

      card.dataset.workId = work.id;
      card.setAttribute('aria-label', work.title);
      card.dataset.fading = 'false';
    };

    preload.onload = () => {
        const ready = typeof preload.decode === 'function'
        ? preload.decode().catch(() => {})
        : Promise.resolve();

      ready.then(() => {
        next.src = preload.src;
        next.alt = work.title;
        next.removeAttribute('aria-hidden');

            requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            current.style.opacity = '0';
            next.style.opacity = '1';
          });
        });

        window.setTimeout(finish, FADE_TIME);
      });
    };

    preload.onerror = () => {
      card.dataset.fading = 'false';
    };
    preload.src = resolveImageUrl(thumbImagePath(work.img));
    attachImageFallback(preload, work);
  }

  /* 5秒表示 → 1秒クロスフェード → 5秒表示 */
  function rotateCards() {
    const nextWorks = pickWorks(cards.length);
    cards.forEach((card, index) => {
      if (nextWorks[index]) fadeTo(card, nextWorks[index]);
    });
  }

  pickWorks(cards.length).forEach((work, index) => setInitial(cards[index], work));
  window.setInterval(rotateCards, DISPLAY_TIME + FADE_TIME);
});

function initRankCarousel(root, ids) {
  const track = root.querySelector(".rank-track");
  const prev = root.querySelector(".rank-prev");
  const next = root.querySelector(".rank-next");
  if (!track) return;
  track.innerHTML = "";
  ids.slice(0, 20).forEach((id, i) => {
    const work = findWork(id);
    if (!work) return;
    const item = document.createElement("div");
    item.className = "rank-item";
    const num = document.createElement("span");
    num.className = "rank-num";
    num.textContent = String(i + 1);
    item.appendChild(num);
    item.appendChild(createCard(work));
    track.appendChild(item);
  });
  root.hidden = !track.children.length;
  if (!track.children.length) return;

  const updateArrows = () => {
    const max = track.scrollWidth - track.clientWidth;
    if (prev) prev.hidden = track.scrollLeft <= 2;
    if (next) next.hidden = track.scrollLeft >= max - 2;
  };
  const items = () => [...track.querySelectorAll(".rank-item")];
  prev?.addEventListener("click", () => {
    const sl = track.scrollLeft;
    let edge = null;
    for (const el of items()) {
      if (el.offsetLeft + el.offsetWidth > sl + 8) { edge = el; break; }
    }
    if (!edge) return;
    track.scrollTo({ left: Math.max(0, edge.offsetLeft + edge.offsetWidth - track.clientWidth), behavior: "smooth" });
  });
  next?.addEventListener("click", () => {
    const visRight = track.scrollLeft + track.clientWidth;
    let edge = null;
    for (const el of items()) {
      if (el.offsetLeft < visRight - 8) edge = el;
    }
    if (!edge) return;
    track.scrollTo({ left: edge.offsetLeft, behavior: "smooth" });
  });
  track.addEventListener("scroll", updateArrows, { passive: true });
  track.addEventListener("wheel", e => { e.preventDefault(); }, { passive: false });
  let drag = false, startX = 0, startSl = 0;
  track.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag = true; startX = e.clientX; startSl = track.scrollLeft;
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener("pointermove", e => {
    if (!drag) return;
    track.scrollLeft = startSl - (e.clientX - startX);
  });
  const endDrag = () => { drag = false; };
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  requestAnimationFrame(updateArrows);
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "home") return;
  const rows = [
    ["rank-watched", "watched"],
    ["rank-watching", "watching"],
    ["rank-want", "want"]
  ];
  if (!POPULAR_API) {
    rows.forEach(([id]) => { const el = document.getElementById(id); if (el) el.hidden = true; });
    return;
  }
  const base = POPULAR_API.replace(/\/$/, "");
  rows.forEach(([elId, status]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    fetch(base + "/popular?status=" + status + "&limit=20")
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const ids = (Array.isArray(data) ? data : []).map(x => x.id || x).filter(Boolean);
        initRankCarousel(el, ids);
      })
      .catch(() => { el.hidden = true; });
  });
});
