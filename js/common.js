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
 * AniList API
 * ・作品ごとのAniListエントリーを検索
 * ・PREQUEL / SEQUELを辿って同一シリーズの話数を合計
 * ・評価は代表エントリーのaverageScoreを10点満点へ変換
 * ・1時間キャッシュ。期限後に再取得するため、続編追加も自動反映
 * ===================================================================== */
const ANILIST_API_URL = "https://graphql.anilist.co";
const ANILIST_CACHE_KEY = "animood-anilist-v3";
const ANILIST_CACHE_TTL = 6 * 60 * 60 * 1000;

function getAniListCache() {
  try { return JSON.parse(localStorage.getItem(ANILIST_CACHE_KEY) || "{}"); }
  catch { return {}; }
}
function setAniListCache(cache) {
  try { localStorage.setItem(ANILIST_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

/* AniListは一時的な通信失敗があるため、タイムアウト＋再試行を行う。 */
async function aniListRequest(query, variables = {}) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(ANILIST_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
        cache: "no-store"
      });
      if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message || "AniList GraphQL error");
      return json.data;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("AniList request failed");
}

const ANILIST_SEARCH_QUERY = `
  query ($search: String!) {
    Page(page: 1, perPage: 25) {
      media(search: $search, type: ANIME, isAdult: false) {
        id
        title { native romaji english userPreferred }
        synonyms
        coverImage { large }
        format
        episodes
        averageScore
        startDate { year month day }
        season
        seasonYear
      }
    }
  }
`;

const ANILIST_MEDIA_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        title { native romaji english userPreferred }
        synonyms
        coverImage { large }
        format
        episodes
        averageScore
        startDate { year month day }
        season
        seasonYear
        relations {
          edges {
            relationType
            node {
              id
              format
              episodes
              averageScore
              title { native romaji english userPreferred }
            }
          }
        }
      }
    }
  }
`;

function normalizeTitle(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s　・:：!！?？「」『』【】（）()［］[\]、,./\\'"’”〜~‐‑–—]/g, "")
    .replace(/(?:第[0-9一二三四五六七八九十]+期|[0-9]+期|season[0-9]+|[0-9]+(?:nd|st|rd|th)|part[0-9]+)$/i, "")
    .replace(/[0-9]+$/, "");
}

function titleCandidates(media) {
  const out = [];
  const push = value => {
    if (value && !out.includes(value)) out.push(value);
  };
  push(media.title?.native);
  push(media.title?.romaji);
  push(media.title?.english);
  push(media.title?.userPreferred);
  (media.synonyms || []).forEach(push);
  return out;
}

function titleTokens(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKC")
    .split(/[\s　・:：!！?？「」『』【】（）()［］[\]、,./\\'"’”〜~‐‑–—]+/)
    .map(v => v.trim())
    .filter(v => v.length >= 2);
}

function pickAniListSearchResult(work, media) {
  if (!media.length) return null;
  const target = normalizeTitle(work.title);
  const targetTokens = titleTokens(work.title);
  const seasonText = String(work.season || "");
  const yearMatch = seasonText.match(/(20\d{2})年/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  const scored = media.map(m => {
    const titles = titleCandidates(m);
    const normalized = titles.map(normalizeTitle).filter(Boolean);
    let score = 0;
    let exact = false;

    if (normalized.some(t => t === target)) {
      score += 300;
      exact = true;
    } else if (normalized.some(t => t.includes(target) || target.includes(t))) {
      score += 145;
    }

    const titleTokenSet = new Set(titles.flatMap(titleTokens));
    if (targetTokens.length) {
      const overlap = targetTokens.filter(t => titleTokenSet.has(t)).length / targetTokens.length;
      score += overlap * 70;
    }

    /* シリーズ名の共通部分だけで別シーズンを選ばないよう、年と形式を補正。 */
    if (m.format === "TV") score += 18;
    else if (m.format === "ONA") score += 10;
    else if (m.format === "MOVIE" || m.format === "OVA" || m.format === "SPECIAL") score -= 12;
    if (year && m.seasonYear === year) score += 28;
    if (year && m.startDate?.year === year) score += 16;
    if (m.episodes) score += 2;
    if (exact && year && m.seasonYear === year) score += 30;

    return { media: m, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.media || null;
}

function buildAniListQueries(work) {
  const title = String(work.title || "").trim();
  const variants = new Set();
  const add = value => {
    const v = String(value || "").trim();
    if (v) variants.add(v);
  };

  add(title);
  add(title.replace(/[！!？?「」『』【】（）()［］[\]・:：]/g, " ").replace(/\s+/g, " ").trim());
  add(title.replace(/\s*(?:第\s*[0-9一二三四五六七八九十]+期|[0-9]+(?:nd|st|rd|th)?\s*Season|Season\s*[0-9]+|Part\s*[0-9]+)\s*$/i, "").trim());
  add(title.replace(/\s*[（(]\s*(?:第)?[0-9一二三四五六七八九十]+(?:期|クール|nd|st|rd|th)?\s*[）)]\s*$/i, "").trim());

  return [...variants].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
}

async function searchAniList(work) {
  const cache = getAniListCache();
  const searchCacheKey = `search:${work.id}`;
  const cached = cache[searchCacheKey];
  if (cached?.value?.id && cached.expiresAt > Date.now()) return cached.value;

  const queries = buildAniListQueries(work);
  let best = null;
  for (const query of queries) {
    try {
      const data = await aniListRequest(ANILIST_SEARCH_QUERY, { search: query });
      const media = data?.Page?.media || [];
      const picked = pickAniListSearchResult(work, media);
      if (picked) {
        if (!best) best = picked;
        const target = normalizeTitle(work.title);
        const exact = titleCandidates(picked).some(t => normalizeTitle(t) === target);
        if (exact) break;
      }
    } catch (error) {
      console.warn("AniList search query failed:", query, error);
    }
  }

  if (!best) return null;
  cache[searchCacheKey] = { value: best, expiresAt: Date.now() + ANILIST_CACHE_TTL };
  setAniListCache(cache);
  return best;
}

async function resolveAniListId(work) {
  if (Number.isInteger(Number(work.anilistId))) return Number(work.anilistId);
  const ids = Array.isArray(work.anilistIds)
    ? work.anilistIds.map(Number).filter(Number.isInteger)
    : [];
  if (ids.length) return ids[0];

  const cache = getAniListCache();
  const cached = cache[work.id];
  if (cached?.id && cached.expiresAt > Date.now()) return cached.id;

  const picked = await searchAniList(work);
  if (!picked) return null;
  cache[work.id] = { id: picked.id, expiresAt: Date.now() + ANILIST_CACHE_TTL };
  setAniListCache(cache);
  return picked.id;
}

async function fetchAniListSeriesInfo(work) {
  const cache = getAniListCache();
  const cachedInfo = cache[`info:${work.id}`];
  if (cachedInfo?.expiresAt > Date.now()) return cachedInfo.value;

  /* anilistIdsを指定した作品は検索結果や関連作品に左右されず、指定IDだけを合計する。 */
  const explicitIds = Array.isArray(work.anilistIds)
    ? work.anilistIds.map(Number).filter(Number.isInteger)
    : (Number.isInteger(Number(work.anilistId)) ? [Number(work.anilistId)] : []);

  let mediaMap = new Map();
  let rootId = null;

  if (explicitIds.length) {
    rootId = explicitIds[0];
    try {
      const data = await aniListRequest(ANILIST_MEDIA_QUERY, { ids: explicitIds });
      for (const item of (data?.Page?.media || [])) mediaMap.set(item.id, item);
    } catch (error) {
      console.warn("AniList explicit IDs:", error);
    }
  } else {
    try {
      rootId = await resolveAniListId(work);
    } catch (error) {
      console.warn("AniList ID resolution:", error);
    }
    if (!rootId) return null;

    const seen = new Set([rootId]);
    let frontier = [rootId];

    /* PREQUEL / SEQUELだけを辿る。OVA・映画・スピンオフなどは自動で混ぜない。 */
    try {
      for (let depth = 0; depth < 12 && frontier.length; depth++) {
        const data = await aniListRequest(ANILIST_MEDIA_QUERY, { ids: frontier });
        const media = data?.Page?.media || [];
        const next = [];
        for (const item of media) {
          mediaMap.set(item.id, item);
          for (const edge of (item.relations?.edges || [])) {
            if (edge.relationType !== "PREQUEL" && edge.relationType !== "SEQUEL") continue;
            const id = edge.node?.id;
            if (id && !seen.has(id)) {
              seen.add(id);
              next.push(id);
            }
          }
        }
        frontier = [...new Set(next)];
      }
    } catch (error) {
      console.warn("AniList series relations:", error);
    }

    /* 関連取得だけ失敗した場合でも、代表作品の情報は残す。 */
    if (!mediaMap.size) {
      try {
        const fallback = await searchAniList(work);
        if (fallback) {
          mediaMap.set(fallback.id, fallback);
          rootId = fallback.id;
        }
      } catch (error) {
        console.warn("AniList fallback search:", error);
      }
    }
  }

  const series = [...mediaMap.values()];
  if (!series.length) return null;

  const episodeTotal = series.reduce((sum, m) => sum + (Number.isFinite(Number(m.episodes)) ? Number(m.episodes) : 0), 0);
  const root = mediaMap.get(rootId) || series[0];
  const score = Number.isFinite(Number(root.averageScore))
    ? (Number(root.averageScore) / 10).toFixed(1)
    : null;
  const value = {
    episodes: episodeTotal > 0 ? episodeTotal : null,
    score,
    entryCount: series.length,
    updatedAt: Date.now()
  };
  cache[`info:${work.id}`] = { value, expiresAt: Date.now() + ANILIST_CACHE_TTL };
  setAniListCache(cache);
  return value;
}

function aniListInfoHTML(info) {
  if (!info || (info.episodes == null && info.score == null)) return "";
  return `<div class="anilist-info" aria-label="AniList情報">
    ${info.episodes != null ? `<div class="anilist-stat"><span class="anilist-label">話数</span><strong>全${info.episodes}話</strong></div>` : ""}
    ${info.score != null ? `<div class="anilist-stat"><span class="anilist-label">評価</span><strong>${esc(info.score)}</strong></div>` : ""}
  </div>`;
}

async function loadAniListInfo(work, backdrop) {
  const box = $(".anilist-info-wrap", backdrop);
  if (!box) return;
  box.innerHTML = `<div class="anilist-loading">AniListから情報を取得中…</div>`;
  try {
    const info = await fetchAniListSeriesInfo(work);
    box.innerHTML = info ? aniListInfoHTML(info) : "";
  } catch (error) {
    console.warn("AniList API:", error);
    box.innerHTML = "";
  }
}

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
function resolveImageUrl(path) {
  const raw = String(path || "");
  if (!raw) return "";
  if (/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
  // HTMLはhtml/配下なので、data.jsのimg/...をサイトルート基準へ補正する。
  if (/^img\//i.test(raw)) return `../${raw}`;
  return raw;
}

function imageFallbackSvg(title) {
  const label = String(title || "AniMood").slice(0, 18);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6C63FF"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs><rect width="640" height="360" rx="24" fill="#171329"/><rect x="18" y="18" width="604" height="324" rx="18" fill="url(#g)" opacity=".18"/><text x="320" y="190" text-anchor="middle" fill="#fff" font-size="30" font-family="sans-serif">${esc(label)}</text><text x="320" y="230" text-anchor="middle" fill="#fff" opacity=".72" font-size="16" font-family="sans-serif">AniMood</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function attachImageFallback(img, work) {
  if (!img || !work) return;
  img.dataset.fallbackTried = "false";
  img.addEventListener("error", async () => {
    if (img.dataset.fallbackTried === "true") {
      img.src = imageFallbackSvg(work.title);
      return;
    }
    img.dataset.fallbackTried = "true";
    try {
      const media = await searchAniList(work);
      const cover = media?.coverImage?.large;
      if (cover) {
        img.src = cover;
        return;
      }
    } catch (error) {
      console.warn("AniList cover:", error);
    }
    img.src = imageFallbackSvg(work.title);
  }, { once: false });
}

function createCard(work, reasonTags = []) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.workId = work.id;
  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${esc(resolveImageUrl(work.img))}" alt="${esc(work.title)}" loading="lazy">
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
        <img src="${esc(resolveImageUrl(work.img))}" alt="${esc(work.title)}">
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
        <div class="anilist-info-wrap" aria-live="polite"></div>
        <p class="modal-desc">${formatDesc(work.desc)}</p>
        <a class="official-link" href="${esc(work.url)}" target="_blank" rel="noopener">公式サイトを見る <svg class="official-link-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg></a>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  attachImageFallback($(".modal-img-wrap img", backdrop), work);
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
  loadAniListInfo(work, backdrop);
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
            <img src="${esc(resolveImageUrl(w.img))}" alt="">
            <span>${esc(w.title)}</span>
          </button>`).join("")
      : `<p class="search-empty">見つかりませんでした</p>`;
    dd.classList.add("show");
    $$(".search-item", dd).forEach(b => {
      b.addEventListener("click", () => {
        dd.classList.remove("show"); input.value = "";
        openPopup(b.dataset.id);
      });
      const work = findWork(b.dataset.id);
      const image = $("img", b);
      if (work && image) attachImageFallback(image, work);
    });
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
