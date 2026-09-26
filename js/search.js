/* 検索結果一覧 */
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "search") return;
  const params = new URLSearchParams(window.location.search);
  const query = (params.get("q") || "").trim();
  const grid = $("#search-grid");
  const summary = $("#search-summary");
  const count = $("#search-count");
  if (!grid) return;

  const q = query.toLowerCase();
  const hits = q ? WORKS.filter(w =>
    w.title.toLowerCase().includes(q) ||
    w.season.toLowerCase().includes(q) ||
    w.genres.some(g => g.toLowerCase().includes(q)) ||
    w.tags.some(t => t.toLowerCase().includes(q))
  ) : [];

  summary.textContent = query ? `「${query}」の検索結果` : "検索キーワードが入力されていません。";
  count.textContent = `${hits.length} 作品`;
  if (!hits.length) {
    grid.innerHTML = `<div class="empty-box"><p>該当する作品が見つかりませんでした。</p><p><a href="list.html">作品一覧を見る</a></p></div>`;
    return;
  }
  hits.forEach(work => grid.appendChild(createCard(work)));
});
