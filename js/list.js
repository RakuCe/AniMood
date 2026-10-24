document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

    if (page === "list") {
    const grid = $("#work-grid");
    const yearSel = $("#year-filter");
    const seasonSel = $("#season-filter");
    const sel = $("#genre-filter");
    let season = "すべて", year = "すべて", genre = "すべて";

    const yearFilters = Array.from({ length: 16 }, (_, i) => `${2011 + i}年`);
    const matchesYear = (workSeason, targetYear) =>
      targetYear === "2025年"
        ? ["2025年冬", "2025年春", "2025年夏"].includes(workSeason)
        : workSeason.startsWith(targetYear);
    const matchesSeason = (workSeason, targetSeason) =>
      targetSeason === "すべて" || String(workSeason || "").endsWith(targetSeason);

    yearSel.innerHTML = `<option value="すべて">すべての年</option>` +
      yearFilters.map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join("");
    yearSel.addEventListener("change", () => {
      year = yearSel.value;
      render();
    });

    seasonSel.innerHTML = `<option value="すべて">すべての季節</option>` +
      ["冬", "春", "夏", "秋"].map(s => `<option value="${s}">${s}</option>`).join("");
    seasonSel.addEventListener("change", () => {
      season = seasonSel.value;
      render();
    });

    const genres = [...new Set(WORKS.flatMap(w => w.genres))].sort();
    sel.innerHTML = `<option value="すべて">すべてのジャンル</option>` +
      genres.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
    sel.addEventListener("change", () => { genre = sel.value; render(); });

    const cardById = new Map();
    let built = 0;
    const CHUNK = 28;
    function applyFilter() {
      let n = 0;
      for (const w of WORKS) {
        const show = matchesSeason(w.season, season) &&
          (year === "すべて" || matchesYear(w.season, year)) &&
          (genre === "すべて" || w.genres.includes(genre));
        const card = cardById.get(w.id);
        if (card) card.hidden = !show;
        if (show) n += 1;
      }
      $("#work-count").textContent = `${n} 作品`;
    }
    function pump() {
      const end = Math.min(built + CHUNK, WORKS.length);
      const frag = document.createDocumentFragment();
      for (; built < end; built++) {
        const w = WORKS[built];
        const card = createCard(w);
        cardById.set(w.id, card);
        frag.appendChild(card);
      }
      grid.appendChild(frag);
      applyFilter();
      if (built < WORKS.length) requestAnimationFrame(pump);
    }
    function render() { applyFilter(); }
    requestAnimationFrame(pump);
  }

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

    const sortDirBtn = $("#fav-sort-dir");
    const syncSortDirection = () => {
      const desc = sortDirection === "desc";
      if (sortDirBtn) {
        sortDirBtn.textContent = desc ? "↓ 降順" : "↑ 昇順";
        sortDirBtn.classList.toggle("active", true);
        sortDirBtn.setAttribute("aria-pressed", String(desc));
        sortDirBtn.setAttribute("aria-label", desc ? "並びを昇順にする" : "並びを降順にする");
      }
    };
    sortDirBtn?.addEventListener("click", () => {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
      syncSortDirection();
      render();
    });
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
    document.addEventListener("fav-changed", render);
    document.addEventListener("fav-status-changed", render);
  }
});
