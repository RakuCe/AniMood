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
    current.src = resolveImageUrl(work.img);
    current.alt = work.title;
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

      /* 表示中の画像をそのまま残し、レイヤーだけを入れ替える。
         表示中のimgのsrcを書き換えないため、切替直後の再描画ちらつきを防ぐ。 */
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
      /* decode()まで完了させてからopacityだけを変更する */
      const ready = typeof preload.decode === 'function'
        ? preload.decode().catch(() => {})
        : Promise.resolve();

      ready.then(() => {
        next.src = preload.src;
        next.alt = work.title;
        next.removeAttribute('aria-hidden');

        /* 次画像を完全に準備してから、2枚を同時にクロスフェード */
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
    preload.src = resolveImageUrl(work.img);
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
