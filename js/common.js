/* =====================================================================
 * 共通スクリプト (common.js)
 *   全ページ共通の機能: ダークモード / ハンバーガーメニュー / 検索 /
 *   お気に入り(☆) / 作品カード / 作品詳細ポップアップ
 *   ※ このファイルより先に data.js を読み込んでください。
 * ===================================================================== */

/* ---------- ユーティリティ ---------- */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* 作品IDから作品データを引く */
const findWork = id => WORKS.find(w => w.id === id);

/* =====================================================================
 * ダークモード
 *
 * ・テーマは localStorage に保存
 * ・ページ読み込み時はアニメーションなし
 * ・テーマボタンを押したときだけ0.3秒アニメーション
 * ・テーマアイコンはHTML内のLucide SVGをCSSで切り替える
 * ===================================================================== */

const THEME_KEY = "anidiag-theme";

/*
 * テーマを適用する
 *
 * animate = true
 *   → ユーザーがボタンを押したとき
 *   → 0.3秒のテーマ切替アニメーションを有効にする
 *
 * animate = false
 *   → ページ読み込み時
 *   → アニメーションなしで即座に適用する
 */
function applyTheme(theme, animate = false) {
  const root = document.documentElement;

  if (animate) {
    root.classList.add("theme-transition");
  }

  root.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);

  /*
   * テーマ切替ボタンの状態も更新
   *
   * aria-pressed:
   *   dark  → true
   *   light → false
   */
  const btn = $("#theme-btn");

  if (btn) {
    const isDark = theme === "dark";

    btn.setAttribute("aria-pressed", String(isDark));

    btn.setAttribute(
      "aria-label",
      isDark
        ? "ライトモードに切り替える"
        : "ダークモードに切り替える"
    );
  }

  /*
   * 0.3秒後にアニメーション用クラスを外す。
   *
   * 重要：
   * ページ読み込み時は animate=false なので
   * この処理自体が発生しません。
   */
  if (animate) {
    window.setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 300);
  }
}


/*
 * テーマの初期化
 */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);

  /*
   * index.htmlなどの<head>で、
   * CSSが描画される前にdata-themeが設定されている。
   *
   * そのためここではテーマを変更しない。
   */
  const currentTheme =
    document.documentElement.dataset.theme ||
    saved ||
    "light";

  /*
   * 現在のテーマだけボタンに反映する。
   *
   * SVGそのものは変更しない。
   * CSSがdata-themeを見て
   * Sun / Moon-Starを切り替える。
   */
  const btn = $("#theme-btn");

  if (btn) {
    const isDark = currentTheme === "dark";

    btn.setAttribute(
      "aria-pressed",
      String(isDark)
    );

    btn.setAttribute(
      "aria-label",
      isDark
        ? "ライトモードに切り替える"
        : "ダークモードに切り替える"
    );
  }

  /*
   * ユーザーがクリックした場合だけ
   * アニメーション付きで切り替える。
   */
  btn?.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "dark"
        ? "light"
        : "dark";

    applyTheme(nextTheme, true);
  });
}

/* =====================================================================
 * ハンバーガーメニュー(PCでも常にハンバーガー表示)
 * ===================================================================== */
function initDrawer() {
  const btn = $("#menu-btn"), drawer = $("#drawer"), ov = $("#drawer-overlay"), closeBtn = $("#drawer-close");
  if (!btn || !drawer) return;
  const page = document.body.dataset.page;
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = `
    <span class="menu-icon" aria-hidden="true">
      <span></span><span></span><span></span>
    </span>`;
  $$(".drawer-link", drawer).forEach(a => {
    if (a.dataset.page === page) a.classList.add("current");
  });
  const open  = () => {
    drawer.classList.add("open");
    ov.classList.add("show");
    btn.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    document.body.classList.add("drawer-is-open");
  };
  const close = () => {
    drawer.classList.remove("open");
    ov.classList.remove("show");
    btn.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("drawer-is-open");
  };
  btn.addEventListener("click", () => drawer.classList.contains("open") ? close() : open());
  closeBtn?.addEventListener("click", close);
  ov.addEventListener("click", close);
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}

/* =====================================================================
 * マイクロインタラクション
 *   既存の文字・構成は変えず、クリック時の波紋と表示時の
 *   スクロール連動モーションだけを追加する。
 * ===================================================================== */
function initMotionEnhancements() {
  /*
   * 今回の仕様では「ボタンを押したときの波紋」を廃止。
   * ただし、既存のスクロール表示アニメーションはそのまま残します。
   */
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -24px" });

  const observe = root => {
    $$(".step-card, .q-card, .result-head, .empty-box", root).forEach(el => observer.observe(el));
  };
  observe(document);

  const questionList = $("#question-list");
  if (questionList) {
    new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches(".q-card")) observer.observe(node);
      }));
    }).observe(questionList, { childList: true });
  }
}

/* =====================================================================
 * お気に入り(localStorage に作品IDの配列として保存)
 * ===================================================================== */
const FAV_KEY = "anidiag-favs";
const FAV_STATUS_KEY = "anidiag-fav-status";

const getFavs = () => JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
const isFav   = id => getFavs().includes(id);

function getFavStatuses() {
  try { return JSON.parse(localStorage.getItem(FAV_STATUS_KEY) || "{}"); }
  catch { return {}; }
}

function getFavStatus(id) {
  const status = getFavStatuses()[id];
  return ["watched", "watching", "want"].includes(status) ? status : "watched";
}

function setFavStatus(id, status) {
  if (!["watched", "watching", "want"].includes(status)) return;
  const statuses = getFavStatuses();
  statuses[id] = status;
  localStorage.setItem(FAV_STATUS_KEY, JSON.stringify(statuses));
  // お気に入り一覧以外のカードも、状態変更直後にマークを更新
  syncFavButtons();
  document.dispatchEvent(new CustomEvent("fav-status-changed"));
}

function toggleFav(id) {
  let favs = getFavs();
  favs = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  syncFavButtons();
  document.dispatchEvent(new CustomEvent("fav-changed"));
  return favs.includes(id);
}

/* 画面上の状態マークを最新にする */
function syncFavButtons() {
  $$(".card").forEach(card => {
    if (card.dataset.workId) syncCardStatusMark(card, card.dataset.workId);
  });
}

const FAV_STATUS_META = {
  watched:  { label: "視聴済み", className: "status-watched", icon: `<svg class="status-check-icon" viewBox="0 0 24 24" aria-hidden="true"><path class="status-check-outline" d="M5 12.5l4.2 4.2L19 7"/><path class="status-check-fill" d="M5 12.5l4.2 4.2L19 7"/></svg>` },
  watching: { label: "視聴中",   className: "status-watching", icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5l10 6.5-10 6.5z"/></svg>` },
  want:     { label: "気になる", className: "status-want",     icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h11v15l-5.5-3.5-5.5 3.5z"/></svg>` }
};

function favStatusMarkHTML(id) {
  if (!isFav(id)) return "";
  const status = getFavStatus(id);
  const meta = FAV_STATUS_META[status] || FAV_STATUS_META.watched;
  return `<button type="button" class="fav-status-mark ${meta.className}" data-fav-status-remove="${esc(id)}" aria-label="${esc(meta.label)}を外す">${meta.icon}</button>`;
}

function favBtnHTML(id) {
  return favStatusMarkHTML(id);
}

function filterChipHTML(value, type) {
  const className = type === "genre" ? "genre-chip" : "tag-chip";
  return `<button type="button" class="chip ${className} filter-chip" data-filter-type="${type}" data-filter-value="${esc(value)}">${esc(value)}</button>`;
}

function initFilterChipEvents(root) {
  $$(".filter-chip", root).forEach(button => {
    button.addEventListener("click", e => {
      e.stopPropagation();
      const value = button.dataset.filterValue || "";
      if (!value) return;
      window.location.href = `search.html?q=${encodeURIComponent(value)}`;
    });
  });
}

function syncCardStatusMark(card, id) {
  const wrap = $(".card-img-wrap", card);
  if (!wrap) return;
  const old = $(".fav-status-mark", wrap);
  if (old) old.remove();
  if (!isFav(id)) return;
  wrap.insertAdjacentHTML("afterbegin", favStatusMarkHTML(id));
  const mark = $(".fav-status-mark", wrap);
  if (mark) {
    mark.addEventListener("click", e => {
      e.stopPropagation();
      toggleFav(id);
    });
  }
}

/* =====================================================================
 * 作品カード(一覧・検索・診断結果・お気に入りで共通の見た目)
 *   reasonTags : 診断結果で「おすすめする理由」のタグを出すときに渡す
 * ===================================================================== */
function createCard(work, reasonTags = []) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.workId = work.id;
  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${esc(work.img)}" alt="${esc(work.title)}" loading="lazy">
      ${favBtnHTML(work.id)}
      <span class="copy-badge">${esc(work.copyright)}</span>
      ${work.season ? `<span class="season-badge">${esc(work.season)}</span>` : ""}
    </div>
    <div class="card-body">
      <h3 class="card-title">${esc(work.title)}</h3>
      <div class="chip-row">${work.genres.map(g => filterChipHTML(g, "genre")).join("")}</div>
      ${reasonTags.length ? `
        <p class="reason-label">あなたの気分にマッチ:</p>
        <div class="chip-row">${reasonTags.map(t => `<span class="chip reason-chip">${esc(t)}</span>`).join("")}</div>` : ""}
    </div>`;
  card.addEventListener("click", () => openPopup(work.id));
  const statusMark = $(".fav-status-mark", card);
  if (statusMark) {
    statusMark.addEventListener("click", e => {
      e.stopPropagation();
      toggleFav(work.id);
    });
  }
  initFilterChipEvents(card);
  if (document.body.dataset.page === "favorites") initFavStatusControls(card, work.id);
  return card;
}


function createFavStatusControl(id, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "fav-status-control";
  wrap.innerHTML = `
    <span class="fav-status-label">状態</span>
    <div class="fav-status-buttons" role="group" aria-label="${esc(findWork(id)?.title || "作品")}の状態">
      <button type="button" class="fav-status-btn" data-status="watched">${FAV_STATUS_META.watched.icon}視聴済み</button>
      <button type="button" class="fav-status-btn" data-status="watching">${FAV_STATUS_META.watching.icon}視聴中</button>
      <button type="button" class="fav-status-btn" data-status="want">${FAV_STATUS_META.want.icon}気になる</button>
      <button type="button" class="fav-status-btn status-remove" data-status="remove">× 外す</button>
    </div>`;

  const update = () => {
    const current = isFav(id) ? getFavStatus(id) : null;
    $$(".fav-status-btn", wrap).forEach(button => {
      const active = button.dataset.status === current;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  $$(".fav-status-btn", wrap).forEach(button => {
    button.addEventListener("click", e => {
      e.stopPropagation();
      const status = button.dataset.status;
      if (status === "remove") {
        if (isFav(id)) toggleFav(id);
        update();
        if (typeof onChange === "function") onChange();
        return;
      }
      if (!isFav(id)) {
        let favs = getFavs();
        favs = [...favs, id];
        localStorage.setItem(FAV_KEY, JSON.stringify(favs));
        syncFavButtons();
        document.dispatchEvent(new CustomEvent("fav-changed"));
      }
      setFavStatus(id, status);
      update();
      if (typeof onChange === "function") onChange();
    });
  });
  update();
  return wrap;
}

function initFavStatusControls(card, id) {
  const body = $(".card-body", card);
  if (!body || !isFav(id)) return;
  body.appendChild(createFavStatusControl(id));
}

/* =====================================================================
 * 作品詳細ポップアップ(カード・検索・お気に入り一覧のどこからでも開く)
 * ===================================================================== */
function paramRowHTML(key, label, value) {
  const dots = [1, 2, 3, 4, 5].map(i =>
    `<span class="dot${i <= value ? " on" : ""}"></span>`).join("");
  return `<div class="param-row"><span class="param-label">${esc(label)}</span><span class="dots">${dots}</span></div>`;
}

function formatDesc(text) {
  const sentences = String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[。！？!?])\s*/).filter(Boolean);
  const lines = [];
  let line = "";
  sentences.forEach(sentence => {
    if (line && (line.length + sentence.length > 78)) {
      lines.push(line);
      line = sentence;
    } else {
      line += sentence;
    }
  });
  if (line) lines.push(line);
  return lines.map(esc).join("<br>");
}

function openPopup(id) {
  const work = findWork(id);
  if (!work) return;
  closePopup();

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(work.title)}の詳細">
      <button class="modal-close" aria-label="閉じる">×</button>
      <div class="modal-img-wrap">
        <img src="${esc(work.img)}" alt="${esc(work.title)}">
        ${favBtnHTML(work.id)}
        <span class="copy-badge">${esc(work.copyright)}</span>
      </div>
      <div class="modal-body">
        <h3 class="modal-title">${esc(work.title)}</h3>
        <div class="chip-row">${work.genres.map(g => filterChipHTML(g, "genre")).join("")}</div>
        <div class="chip-row">${work.tags.map(t => filterChipHTML(t, "tag")).join("")}</div>
        <div class="param-box">
          ${PARAM_LABELS.map(([k, label]) => paramRowHTML(k, label, work.params[k])).join("")}
        </div>
        <p class="modal-desc">${formatDesc(work.desc)}</p>
        <a class="official-link" href="${esc(work.url)}" target="_blank" rel="noopener">公式サイトを見る <svg class="official-link-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg></a>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.classList.add("no-scroll");
  requestAnimationFrame(() => backdrop.classList.add("show"));

  const modalBody = $(".modal-body", backdrop);

  const updatePopupStatus = () => {
    const existing = $(".modal-status-control", backdrop);
    if (existing) existing.remove();
    if (modalBody) {
      const control = createFavStatusControl(work.id, updatePopupStatus);
      control.classList.add("modal-status-control");
      modalBody.insertBefore(control, modalBody.querySelector(".param-box"));
    }
    const imgWrap = $(".modal-img-wrap", backdrop);
    const oldMark = $(".fav-status-mark", imgWrap);
    if (oldMark) oldMark.remove();
    if (isFav(work.id)) {
      imgWrap.insertAdjacentHTML("afterbegin", favStatusMarkHTML(work.id));
      const mark = $(".fav-status-mark", imgWrap);
      mark.addEventListener("click", e => {
        e.stopPropagation();
        toggleFav(work.id);
        updatePopupStatus();
      });
    }
  };
  updatePopupStatus();
  initFilterChipEvents(backdrop);
  $(".modal-close", backdrop).addEventListener("click", closePopup);
  backdrop.addEventListener("click", e => { if (e.target === backdrop) closePopup(); });
}

function closePopup() {
  const b = $(".modal-backdrop");
  if (b) { b.remove(); document.body.classList.remove("no-scroll"); }
}

document.addEventListener("keydown", e => { if (e.key === "Escape") closePopup(); });

/* =====================================================================
 * 検索バー(作品名・ジャンル・タグで検索 → クリックでポップアップ)
 * ===================================================================== */
function initSearch() {
  const input = $("#search-input"), dd = $("#search-dropdown"), submit = $("#search-submit");
  if (!input || !dd) return;

  const goSearch = () => {
    const q = input.value.trim();
    if (!q) return;
    window.location.href = `search.html?q=${encodeURIComponent(q)}`;
  };

  const render = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { dd.classList.remove("show"); dd.innerHTML = ""; return; }
    const hits = WORKS.filter(w =>
      w.title.toLowerCase().includes(q) ||
      w.season.toLowerCase().includes(q) ||
      w.genres.some(g => g.toLowerCase().includes(q)) ||
      w.tags.some(t => t.toLowerCase().includes(q))
    ).slice(0, 8);

    dd.innerHTML = hits.length
      ? hits.map(w => `
          <button class="search-item" data-id="${esc(w.id)}">
            <img src="${esc(w.img)}" alt="">
            <span>${esc(w.title)}</span>
          </button>`).join("")
      : `<p class="search-empty">見つかりませんでした</p>`;
    dd.classList.add("show");
    $$(".search-item", dd).forEach(b =>
      b.addEventListener("click", () => {
        dd.classList.remove("show"); input.value = "";
        openPopup(b.dataset.id);
      }));
  };

  input.addEventListener("input", render);
  input.addEventListener("focus", render);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); goSearch(); }
  });
  submit?.addEventListener("click", goSearch);
  document.addEventListener("click", e => {
    if (!e.target.closest(".search-box")) dd.classList.remove("show");
  });
}



/* ページトップボタン */
function initPageTop() {
  if ($("#page-top")) return;
  const button = document.createElement("button");
  button.id = "page-top";
  button.type = "button";
  button.className = "page-top-btn";
  button.setAttribute("aria-label", "ページの先頭へ戻る");
  button.innerHTML = `
    <svg class="page-top-icon" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="page-top-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#6C63FF"></stop>
          <stop offset="100%" stop-color="#22D3EE"></stop>
        </linearGradient>
      </defs>
      <path d="M6 4 20 12 6 20Z"></path>
    </svg>
    <span class="page-top-label">TOP</span>`;
  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.body.appendChild(button);

  const updateVisibility = () => {
    const visible = window.scrollY > 180;
    button.classList.toggle("is-visible", visible);
    // ページトップまで戻ってボタンが非表示になった時点で向きを元に戻す
    button.classList.toggle("top-returned", !visible);
  };
  window.addEventListener("scroll", updateVisibility, { passive: true });
  updateVisibility();
}

/* =====================================================================
 * 初期化(全ページ共通)
 * ===================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initDrawer();
  initSearch();
  initMotionEnhancements();
  syncFavButtons();
  initPageTop();
});
