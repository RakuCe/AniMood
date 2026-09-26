/* =====================================================================
 * 診断ページ用スクリプト (quiz.js)
 *   質問の描画 → 回答の集計 → スコアリング → 結果の表示
 *   ※ data.js / questions.js / common.js より後に読み込んでください。
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * 診断の軸(12軸)
 *   label    : 結果画面に表示する名前
 *   sentence : その軸が1位のときの「今の観たい傾向」コメント
 *   genres   : 作品の genres と照合するキーワード(強いマッチ)
 *   tags     : 作品の tags と照合するキーワード(弱いマッチ)
 * ------------------------------------------------------------------- */
const AXES = {
  action:  { label: "バトル・アクション", sentence: "ド派手なバトルやアクションでスカッとしたい気分",
            genres: ["バトル", "冒険", "メカ"], tags: ["無双", "チート", "アクション", "バトル", "復讐", "ざまぁ", "少年漫画"] },
  fantasy: { label: "ファンタジー・異世界", sentence: "剣と魔法の世界に飛び込みたい気分",
            genres: ["ファンタジー", "異世界", "ゲーム"], tags: ["転生", "魔法", "魔女", "ダークファンタジー"] },
  love:    { label: "恋愛・ラブコメ", sentence: "キュンとする恋愛ものを求めている気分",
            genres: ["恋愛"], tags: ["ラブコメ", "純愛", "百合", "BL", "甘々", "両片想い", "幼馴染", "片想い", "結婚", "婚活", "イチャコラ", "大人の恋", "人外"] },
  comedy:  { label: "コメディ・ギャグ", sentence: "とにかく笑って元気をチャージしたい気分",
            genres: ["コメディ"], tags: ["ギャグ", "ドタバタ", "パロディ", "シュール", "ポンコツ", "掛け合い", "勘違い"] },
  daily:   { label: "日常・癒し", sentence: "ゆったりほっこり、癒やしの時間がほしい気分",
            genres: ["日常", "青春", "癒し"], tags: ["癒し", "ほのぼの", "家族", "ふたり旅", "寮生活", "やさしい世界", "職場", "お仕事"] },
  mystery: { label: "ミステリー・考察", sentence: "謎解きや考察にじっくり没頭したい気分",
            genres: ["ミステリー", "スリラー"], tags: ["考察", "頭脳戦", "人狼", "デスゲーム", "騙し合い", "心理戦", "陰謀", "タイムループ"] },
  dark:    { label: "ダーク・ホラー", sentence: "少しダークで強い刺激を求めている気分",
            genres: ["ホラー", "サスペンス"], tags: ["ダーク", "怪異", "残酷", "絶望", "呪い", "怨念", "ギャグホラー", "病みかわ", "重厚"] },
  sf:      { label: "SF・近未来", sentence: "SFや近未来の世界観に浸りたい気分",
            genres: ["SF", "メカ"], tags: ["宇宙", "ロボット", "近未来", "ポストアポカリプス", "終末世界", "巨大ロボ", "社会派"] },
  sports:  { label: "スポーツ・青春", sentence: "熱い青春もので心を燃やしたい気分",
            genres: ["スポーツ"], tags: ["部活", "青春", "ダンス", "成長", "師弟"] },
  music:   { label: "音楽・舞台", sentence: "音楽や舞台の高揚感を楽しみたい気分",
            genres: ["音楽"], tags: ["歌で戦う", "舞台", "歌劇学校", "アーティスト", "ダンス", "ラジオ"] },
  drama:   { label: "人間ドラマ・感動", sentence: "じんわり心に残る人間ドラマを味わいたい気分",
            genres: ["ドラマ"], tags: ["群像劇", "家族", "情感", "成長", "伝統芸能", "喪失と再生", "切ない", "寓話"] },
  gourmet: { label: "グルメ・ご飯", sentence: "美味しそうなご飯やグルメ描写に癒やされたい気分",
            genres: ["グルメ"], tags: ["ご飯", "グルメ", "魔物グルメ", "ワイン"] }
};

/* 軸が作品にマッチする度合い: ジャンル一致=1.0 / タグ一致=0.65 / 不一致=0 */
function axisMatch(axis, work) {
  const a = AXES[axis];
  if (work.genres.some(g => a.genres.includes(g))) return 1.0;
  if (work.tags.some(t => a.tags.includes(t))) return 0.65;
  return 0;
}

/* =====================================================================
 * 質問の描画(1ページに全問を並べ、スクロールで答える形式)
 * ===================================================================== */
const answers = {}; // { 質問id: 選択肢index or 1〜5 }
let includeCheckedWorks = true;

function renderQuestions() {
  const box = $("#question-list");
  QUESTIONS.forEach((q, qi) => {
    const sec = document.createElement("section");
    sec.className = "q-card";
    sec.dataset.qid = q.id;

    if (q.type === "choice") {
      sec.innerHTML = `
        <h2 class="q-title"><span class="q-num">Q${qi + 1}</span>${esc(q.text)}</h2>
        <div class="q-options">
          ${q.options.map((o, oi) =>
            `<button class="q-opt" data-v="${oi}">${esc(o.label)}</button>`).join("")}
        </div>`;
      $$(".q-opt", sec).forEach(b => b.addEventListener("click", () => {
        $$(".q-opt", sec).forEach(x => x.classList.remove("selected"));
        b.classList.add("selected");
        answers[q.id] = Number(b.dataset.v);
        updateProgress();
      }));
    } else {
      sec.innerHTML = `
        <h2 class="q-title"><span class="q-num">Q${qi + 1}</span>${esc(q.text)}</h2>
        <div class="q-scale">
          <span class="scale-label">${esc(q.low)}</span>
          <div class="scale-btns">
            ${[1, 2, 3, 4, 5].map(v => `<button class="scale-btn" data-v="${v}">${v}</button>`).join("")}
          </div>
          <span class="scale-label">${esc(q.high)}</span>
        </div>`;
      $$(".scale-btn", sec).forEach(b => b.addEventListener("click", () => {
        $$(".scale-btn", sec).forEach(x => x.classList.remove("selected"));
        b.classList.add("selected");
        answers[q.id] = Number(b.dataset.v);
        updateProgress();
      }));
    }
    box.appendChild(sec);
  });
}

/* 進捗バーと診断ボタンの状態更新 */
function updateProgress() {
  const done = Object.keys(answers).length, total = QUESTIONS.length;
  $("#progress-fill").style.width = `${(done / total) * 100}%`;
  $("#progress-text").textContent = `${done} / ${total} 問`;
  $("#diagnose-btn").disabled = false;
}

/* =====================================================================
 * スコアリング
 *   軸スコア(好みの方向性) + パラメータ近さ(シリアス度などの好み)
 * ===================================================================== */
function computeScores() {
  const axisPts = {}; Object.keys(AXES).forEach(a => axisPts[a] = 0);
  const prefs = {}; // 5段階評価のパラメータ好み

  QUESTIONS.forEach(q => {
    const v = answers[q.id];
    if (q.type === "choice") {
      const w = q.options[v].w;
      for (const [axis, pt] of Object.entries(w)) axisPts[axis] += pt;
    } else {
      if (q.param) prefs[q.param] = v;
      (q.plus  || []).forEach(([axis, m]) => axisPts[axis] += (v - 3) * m);
      (q.minus || []).forEach(([axis, m]) => axisPts[axis] -= (v - 3) * m);
    }
  });
  Object.keys(axisPts).forEach(a => axisPts[a] = Math.max(0, axisPts[a]));

  const candidates = includeCheckedWorks ? WORKS : WORKS.filter(work => !isFav(work.id));

  return candidates.map(work => {
    let score = 0;
    for (const [axis, pt] of Object.entries(axisPts)) {
      if (pt > 0) score += pt * axisMatch(axis, work);
    }
    for (const [key, pref] of Object.entries(prefs)) {
      score += (5 - Math.abs(pref - work.params[key])) * 1.5;
    }
    return { work, score };
  }).sort((a, b) => b.score - a.score);
}

/* 上位から9作品を選ぶ(同じメインジャンルが3作品以上連続しないように調整) */
function pickRecommendations(scored) {
  const picked = [], genreCount = {};
  for (const s of scored) {
    const g = s.work.genres[0] || "その他";
    if ((genreCount[g] || 0) >= 2) continue;
    genreCount[g] = (genreCount[g] || 0) + 1;
    picked.push(s);
    if (picked.length === 9) break;
  }
  /* 優劣はつけず、ランダムな順で並べる */
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

/* 「おすすめする理由」として表示するタグを集める */
function reasonTagsFor(work, axisPts) {
  const topAxes = Object.entries(axisPts).filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1]).map(([a]) => a);
  const tags = [];
  for (const axis of topAxes) {
    const a = AXES[axis];
    work.genres.forEach(g => { if (a.genres.includes(g) && !tags.includes(g)) tags.push(g); });
    work.tags.forEach(t => { if (a.tags.includes(t) && !tags.includes(t)) tags.push(t); });
    if (tags.length >= 4) break;
  }
  return tags.slice(0, 4);
}

/* =====================================================================
 * 結果の表示
 * ===================================================================== */
function showResult() {
  /* 未回答があれば最初の質問へ移動 */
  const unanswered = QUESTIONS.find(q => answers[q.id] === undefined);
  if (unanswered) {
    const target = document.querySelector(`[data-qid="${unanswered.id}"]`);
    if (target) {
      $$(".q-card.needs-answer").forEach(card => card.classList.remove("needs-answer"));
      target.classList.add("needs-answer");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => target.classList.remove("needs-answer"), 1800);
    }
    return;
  }

  const axisPts = {}; Object.keys(AXES).forEach(a => axisPts[a] = 0);
  const prefs = {};
  QUESTIONS.forEach(q => {
    const v = answers[q.id];
    if (q.type === "choice") {
      for (const [axis, pt] of Object.entries(q.options[v].w)) axisPts[axis] += pt;
    } else {
      if (q.param) prefs[q.param] = v;
      (q.plus  || []).forEach(([axis, m]) => axisPts[axis] += (v - 3) * m);
      (q.minus || []).forEach(([axis, m]) => axisPts[axis] -= (v - 3) * m);
    }
  });
  Object.keys(axisPts).forEach(a => axisPts[a] = Math.max(0, axisPts[a]));

  /* --- 今の観たい傾向 --- */
  const ranked = Object.entries(axisPts).sort((a, b) => b[1] - a[1]);
  const top = ranked.filter(([, p]) => p > 0).slice(0, 3);
  if (top.length) {
    $("#trend-text").textContent = AXES[top[0][0]].sentence + "のようです。";
    $("#trend-chips").innerHTML = top.map(([a]) =>
      `<span class="chip trend-chip">${esc(AXES[a].label)}</span>`).join("");
  } else {
    $("#trend-text").textContent = "バランスよくいろいろ観たい気分のようです。";
    $("#trend-chips").innerHTML = `<span class="chip trend-chip">バランス型</span>`;
  }

  /* --- おすすめ9作品(順位なし) --- */
  const grid = $("#result-grid");
  grid.innerHTML = "";
  pickRecommendations(computeScores()).forEach(({ work }) =>
    grid.appendChild(createCard(work, reasonTagsFor(work, axisPts))));

  const result = $("#result");
  result.hidden = false;
  result.scrollIntoView({ behavior: "smooth" });
}

/* =====================================================================
 * 初期化
 * ===================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  if (!$("#question-list")) return;
  renderQuestions();
  updateProgress();
  $("#diagnose-btn").addEventListener("click", showResult);
  const includeToggle = $("#include-checked-toggle");
  includeToggle?.addEventListener("click", () => {
    includeCheckedWorks = !includeCheckedWorks;
    includeToggle.classList.toggle("is-on", includeCheckedWorks);
    includeToggle.setAttribute("aria-pressed", String(includeCheckedWorks));
  });
  $("#retry-btn").addEventListener("click", () => {
    Object.keys(answers).forEach(k => delete answers[k]);
    $$(".q-opt.selected, .scale-btn.selected").forEach(b => b.classList.remove("selected"));
    $("#result").hidden = true;
    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
