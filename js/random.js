document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "random") return;
  const grid = $("#random-grid");
  const select = $("#random-count");
  const refresh = $("#random-refresh");
  if (!grid || !select) return;
  const COUNT = 5;

  function pool() {
    const mode = select.value;
    return WORKS.filter(work => {
      const fav = isFav(work.id);
      const st = fav ? getFavStatus(work.id) : "";
      if (mode === "unchecked") return !fav;
      if (mode === "want") return fav && st === "want";
      if (mode === "watching") return fav && st === "watching";
      if (mode === "want-watching") return fav && (st === "want" || st === "watching");
      return !fav;
    });
  }

  function render() {
    const picked = [...pool()].sort(() => Math.random() - 0.5).slice(0, COUNT);
    grid.innerHTML = "";
    picked.forEach(work => grid.appendChild(createCard(work)));
  }
  select.addEventListener("change", render);
  refresh?.addEventListener("click", render);
  render();
});
