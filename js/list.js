/* =====================================================================
 * 作品一覧 / お気に入り一覧ページ用スクリプト (list.js)
 *   body の data-page が "list" または "favorites" のときに動きます。
 * ===================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  /* ================= 作品一覧 ================= */
  if (page === "list") {
    const grid = $("#work-grid");
    const tabs = $("#season-tabs");
    const yearSel = $("#year-filter");
    const sel = $("#genre-filter");
    let season = "すべて", year = "すべて", genre = "すべて";

    const setActive = (container, active) => {
      $$(".tab-btn", container).forEach(button => {
        button.classList.toggle("active", button === active);
      });
    };

    const addFilterButton = (container, label, onClick, active = false) => {
      const button = document.createElement("button");
      button.className = "tab-btn" + (active ? " active" : "");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => onClick(button));
      container.appendChild(button);
      return button;
    };

    /* シーズン絞り込みタブ */
    let allSeasonButton;
    ["すべて", ...SEASONS].forEach(s => {
      const b = addFilterButton(tabs, s, button => {
        season = s;
        year = "すべて";
        setActive(tabs, button);
        yearSel.value = "すべて";
        render();
      });
      if (s === "すべて") allSeasonButton = b;
    });

    /* 2011年以降を年単位で絞り込む */
    const yearFilters = Array.from({ length: 16 }, (_, i) => `${2011 + i}年`);
    const matchesYear = (workSeason, targetYear) =>
      targetYear === "2025年"
        ? ["2025年冬", "2025年春", "2025年夏"].includes(workSeason)
        : workSeason.startsWith(targetYear);
    yearSel.innerHTML = `<option value="すべて">すべての年</option>` +
      yearFilters.map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join("");
    yearSel.addEventListener("change", () => {
      year = yearSel.value;
      season = "すべて";
      setActive(tabs, allSeasonButton);
      render();
    });

    /* ジャンル絞り込み(登録作品から自動収集) */
    const genres = [...new Set(WORKS.flatMap(w => w.genres))].sort();
    sel.innerHTML = `<option value="すべて">すべてのジャンル</option>` +
      genres.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
    sel.addEventListener("change", () => { genre = sel.value; render(); });

    function render() {
      const hits = WORKS.filter(w =>
        (season === "すべて" || w.season === season) &&
        (year === "すべて" || matchesYear(w.season, year)) &&
        (genre === "すべて" || w.genres.includes(genre)));
      grid.innerHTML = "";
      hits.forEach(w => grid.appendChild(createCard(w)));
      $("#work-count").textContent = `${hits.length} 作品`;
    }
    render();
  }

  /* ================= お気に入り一覧 ================= */
  if (page === "favorites") {
    const grid = $("#fav-grid"), empty = $("#fav-empty");
    const sortSel = $("#fav-sort");
    const statusTabs = $$(".fav-status-tab");
    let sortMode = sortSel?.value || "registered";
    let sortDirection = "asc";
    let statusFilter = "all";

    const seasonKey = season => {
      const m = String(season || "").match(/^(\d{4})年(冬|春|夏|秋)?$/);
      if (!m) return -Infinity;
      const order = { "冬": 1, "春": 2, "夏": 3, "秋": 4 };
      return Number(m[1]) * 10 + (order[m[2]] || 0);
    };

    function sortWorks(items) {
      const result = [...items];
      const registeredIndex = new Map(getFavs().map((id, i) => [id, i]));
      if (sortMode === "season") {
        result.sort((a, b) => seasonKey(a.season) - seasonKey(b.season) || a.title.localeCompare(b.title, "ja"));
      } else if (sortMode === "genre") {
        result.sort((a, b) => {
          const ag = (a.genres?.[0] || "").localeCompare(b.genres?.[0] || "", "ja");
          return ag || a.title.localeCompare(b.title, "ja");
        });
      } else {
        result.sort((a, b) => (registeredIndex.get(a.id) ?? 0) - (registeredIndex.get(b.id) ?? 0));
      }
      if (sortDirection === "desc") result.reverse();
      return result;
    }

    function render() {
      const favs = getFavs().map(findWork).filter(Boolean);
      const filtered = statusFilter === "all"
        ? favs
        : favs.filter(w => getFavStatus(w.id) === statusFilter);
      const sorted = sortWorks(filtered);

      grid.innerHTML = "";
      sorted.forEach(w => grid.appendChild(createCard(w)));
      empty.hidden = sorted.length > 0;
      $("#fav-count").textContent = `${sorted.length} 作品`;
    }

    sortSel?.addEventListener("change", () => {
      sortMode = sortSel.value;
      render();
    });

    const sortAsc = $("#fav-sort-asc");
    const sortDesc = $("#fav-sort-desc");
    const syncSortDirection = () => {
      sortAsc?.classList.toggle("active", sortDirection === "asc");
      sortDesc?.classList.toggle("active", sortDirection === "desc");
      sortAsc?.setAttribute("aria-pressed", String(sortDirection === "asc"));
      sortDesc?.setAttribute("aria-pressed", String(sortDirection === "desc"));
    };
    sortAsc?.addEventListener("click", () => { sortDirection = "asc"; syncSortDirection(); render(); });
    sortDesc?.addEventListener("click", () => { sortDirection = "desc"; syncSortDirection(); render(); });
    syncSortDirection();

    statusTabs.forEach(tab => tab.addEventListener("click", () => {
      statusFilter = tab.dataset.statusFilter || "all";
      statusTabs.forEach(x => {
        const active = x === tab;
        x.classList.toggle("active", active);
        x.setAttribute("aria-selected", String(active));
      });
      render();
    }));

    render();
    /* チェックの追加・削除・状態変更をすべて即時反映 */
    document.addEventListener("fav-changed", render);
    document.addEventListener("fav-status-changed", render);
  }
});
