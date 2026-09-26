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
    const genreSel = $("#genre-filter");
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
        yearSel.value = "すべて";
        setActive(tabs, button);
        render();
      }, s === "すべて");
      if (s === "すべて") allSeasonButton = b;
    });

    /* 年絞り込みはジャンルと同じselect式に変更 */
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
    genreSel.innerHTML = `<option value="すべて">すべてのジャンル</option>` +
      genres.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
    genreSel.addEventListener("change", () => { genre = genreSel.value; render(); });

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
    let statusFilter = "all";

    const seasonValue = season => {
      const m = String(season || "").match(/(\d{4})年(冬|春|夏|秋)/);
      if (!m) return 0;
      const order = { "冬": 1, "春": 2, "夏": 3, "秋": 4 };
      return Number(m[1]) * 10 + (order[m[2]] || 0);
    };

    function render() {
      const favIds = getFavs();
      let favs = favIds.map(findWork).filter(Boolean);

      if (statusFilter !== "all") {
        favs = favs.filter(work => getFavStatus(work.id) === statusFilter);
      }

      const sort = sortSel?.value || "registered";
      if (sort === "season") {
        favs.sort((a, b) => seasonValue(a.season) - seasonValue(b.season) || favIds.indexOf(a.id) - favIds.indexOf(b.id));
      } else if (sort === "genre") {
        favs.sort((a, b) => (a.genres[0] || "").localeCompare(b.genres[0] || "", "ja") || a.title.localeCompare(b.title, "ja"));
      } else {
        favs.sort((a, b) => favIds.indexOf(a.id) - favIds.indexOf(b.id));
      }

      grid.innerHTML = "";
      favs.forEach(w => grid.appendChild(createCard(w)));
      empty.hidden = favs.length > 0;
      $("#fav-count").textContent = `${favs.length} 作品`;
    }

    statusTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        statusFilter = tab.dataset.statusFilter || "all";
        statusTabs.forEach(button => {
          const active = button === tab;
          button.classList.toggle("active", active);
          button.setAttribute("aria-selected", String(active));
        });
        render();
      });
    });

    sortSel?.addEventListener("change", render);
    render();
    document.addEventListener("fav-changed", render);
    document.addEventListener("fav-status-changed", render);
  }
});
