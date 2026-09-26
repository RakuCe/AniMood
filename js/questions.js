/* =====================================================================
 * 質問データ (questions.js)
 * ---------------------------------------------------------------------
 * ■ 質問の種類
 *   - "choice" : 選択式。options の w:{軸: 点数} がそのまま加算される。
 *   - "scale"  : 5段階評価。答え v は 1〜5 の整数。
 *       param : "sakuga"|"story"|"serious"|"tempo"|"music" を指定すると、
 *               作品の params との近さでスコアリングに使われる。
 *       plus  : [["軸", 倍率]] → (v-3)×倍率 が軸に加算される
 *       minus : [["軸", 倍率]] → (v-3)×倍率 が軸から減算される
 *       low/high : 両端のラベル(1と5が何を意味するか)
 *
 * ■ 使える軸(キー)は quiz.js の AXES を参照。
 *   action / fantasy / love / comedy / daily / mystery /
 *   dark / sf / sports / music / drama / gourmet
 * ===================================================================== */

const QUESTIONS = [
  /* ---------- 選択式 ---------- */
  {
    id: "q1", type: "choice",
    text: "今の気分に一番近いのはどれ?",
    options: [
      { label: "ドカンと熱くなりたい", w: { action: 3 } },
      { label: "キュンとときめきたい", w: { love: 3 } },
      { label: "ふふっと笑いたい",     w: { comedy: 3 } },
      { label: "じっくり考え込みたい", w: { mystery: 3 } }
    ]
  },
  {
    id: "q2", type: "choice",
    text: "もし異世界に行けるなら?",
    options: [
      { label: "最強の力で無双したい",           w: { fantasy: 2, action: 2 } },
      { label: "まったり暮らしたい",             w: { fantasy: 2, daily: 2 } },
      { label: "美味しいものを食べ歩きたい",     w: { fantasy: 1, gourmet: 3 } },
      { label: "行かない。現実の物語がいい",     w: { daily: 2, drama: 1 } }
    ]
  },
  {
    id: "q9", type: "choice",
    text: "いちばん観たい舞台(世界観)は?",
    options: [
      { label: "剣と魔法の世界",   w: { fantasy: 3 } },
      { label: "現代の日常",       w: { daily: 3 } },
      { label: "近未来・宇宙",     w: { sf: 3 } },
      { label: "どこでもいい", w: {} }
    ]
  },
  {
    id: "q10", type: "choice",
    text: "好きな主人公のタイプは?",
    options: [
      { label: "圧倒的な強さの無双系", w: { action: 2, fantasy: 1 } },
      { label: "頭脳で勝負する策士",   w: { mystery: 3 } },
      { label: "平凡だけど優しい人",   w: { daily: 2, love: 1 } },
      { label: "闇を抱えたアウトロー", w: { dark: 3 } }
    ]
  },
  {
    id: "q16", type: "choice",
    text: "理想の休日の過ごし方に近いのは?",
    options: [
      { label: "体を動かす・何かに打ち込む", w: { sports: 3 } },
      { label: "音楽やライブを楽しむ",       w: { music: 3 } },
      { label: "のんびり家で過ごす",         w: { daily: 2 } },
      { label: "友達とわいわい騒ぐ",         w: { comedy: 2 } }
    ]
  },
  {
    id: "q17", type: "choice",
    text: "バトルものを観るなら、どれがいい?",
    options: [
      { label: "少年漫画的な熱い戦い",     w: { action: 3 } },
      { label: "デスゲーム・心理戦",       w: { mystery: 2, dark: 1 } },
      { label: "ロボット・SFの大規模戦闘", w: { sf: 2, action: 1 } },
      { label: "バトルはなくてもいい",     w: { daily: 1, drama: 1 } }
    ]
  },
  {
    id: "q18", type: "choice",
    text: "観終わった後に残ってほしいのは?",
    options: [
      { label: "爽快感・スカッと感",       w: { action: 2, comedy: 1 } },
      { label: "余韻・考えさせられる感じ", w: { mystery: 1, drama: 2 } },
      { label: "胸キュン・ときめき",       w: { love: 2 } },
      { label: "癒やし・ほっこり",         w: { daily: 2 } }
    ]
  },

  /* ---------- 5段階評価 ---------- */
  {
    id: "q3", type: "scale",
    text: "今はとにかく笑いたい。",
    low: "思わない", high: "とてもそう思う",
    param: null,
    plus: [["comedy", 1]], minus: []
  },
  {
    id: "q4", type: "scale",
    text: "重厚でシリアスな物語に浸りたい。",
    low: "軽い話がいい", high: "重い話がいい",
    param: "serious",
    plus: [["drama", 0.5], ["dark", 0.5]], minus: [["comedy", 1]]
  },
  {
    id: "q5", type: "scale",
    text: "テンポの速い展開が好きだ。",
    low: "ゆっくりがいい", high: "速い方がいい",
    param: "tempo",
    plus: [["action", 0.5]], minus: [["daily", 0.5]]
  },
  {
    id: "q6", type: "scale",
    text: "複雑な伏線や謎解きがある話が好きだ。",
    low: "単純な話がいい", high: "複雑な話がいい",
    param: "story",
    plus: [["mystery", 0.7]], minus: []
  },
  {
    id: "q7", type: "scale",
    text: "作画や映像の美しさは重視する。",
    low: "気にしない", high: "かなり重視",
    param: "sakuga",
    plus: [], minus: []
  },
  {
    id: "q8", type: "scale",
    text: "音楽や主題歌も作品選びで重視する。",
    low: "気にしない", high: "かなり重視",
    param: "music",
    plus: [["music", 0.8]], minus: []
  },
  {
    id: "q11", type: "scale",
    text: "美味しそうなご飯シーンがあると嬉しい。",
    low: "どうでもいい", high: "とても嬉しい",
    param: null,
    plus: [["gourmet", 1], ["daily", 0.3]], minus: []
  },
  {
    id: "q12", type: "scale",
    text: "ドキドキ・ハラハラする展開が欲しい。",
    low: "穏やかがいい", high: "スリルが欲しい",
    param: null,
    plus: [["mystery", 0.5], ["dark", 0.5]], minus: [["daily", 0.5]]
  },
  {
    id: "q13", type: "scale",
    text: "恋愛要素は多い方がいい。",
    low: "なくていい", high: "たっぷり欲しい",
    param: null,
    plus: [["love", 1]], minus: []
  },
  {
    id: "q14", type: "scale",
    text: "感動して泣きたい気分だ。",
    low: "そうでもない", high: "泣きたい",
    param: null,
    plus: [["drama", 1]], minus: []
  },
  {
    id: "q15", type: "scale",
    text: "ダークで残酷な描写も平気だ。",
    low: "苦手", high: "むしろ好き",
    param: null,
    plus: [["dark", 1]], minus: []
  },
  {
    id: "q19", type: "scale",
    text: "キャラ同士の掛け合いやギャグのノリが好きだ。",
    low: "苦手", high: "大好き",
    param: null,
    plus: [["comedy", 1]], minus: []
  },
  {
    id: "q20", type: "scale",
    text: "ゆるくてかわいい雰囲気に癒やされたい。",
    low: "そうでもない", high: "癒やされたい",
    param: null,
    plus: [["daily", 1], ["comedy", 0.3]], minus: []
  }
];
