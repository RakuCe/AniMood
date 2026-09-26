/* ランダム作品 */
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "random") return;
  const grid = $("#random-grid");
  const select = $("#random-count");
  const refresh = $("#random-refresh");
  if (!grid || !select) return;

  function render() {
    const count = Number(select.value) || 1;
    const candidates = WORKS.filter(work => !isFav(work.id));
    const picked = [...candidates].sort(() => Math.random() - 0.5).slice(0, count);
    grid.innerHTML = "";
    picked.forEach(work => grid.appendChild(createCard(work)));
  }
  select.addEventListener("change", render);
  refresh?.addEventListener("click", render);
  render();
});
