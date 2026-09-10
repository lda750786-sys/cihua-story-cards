const state = {
  cards: [],
  view: "create",
  activeSpace: "en",
  flashMode: "story",
  reviewDeck: [],
  reviewIndex: 0,
  flipped: false,
  touchStartX: null,
  generationStartedAt: 0,
  generationPhase: "idle",
  generationWantsImage: false,
  loadingTimer: null,
  selectedExam: "cet4",
  vocabularySources: [],
  capabilities: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const API = "";

const CARD_THEMES = [
  { name: "coral", paper: "#ff6b61", ink: "#153d7a", accent: "#ffd43b", soft: "#fff1ce" },
  { name: "sky", paper: "#42c7e8", ink: "#12386f", accent: "#ff755f", soft: "#fff5d9" },
  { name: "sun", paper: "#ffd83d", ink: "#173b78", accent: "#ef4961", soft: "#fff6d7" },
  { name: "leaf", paper: "#4bc56d", ink: "#123b70", accent: "#ffbd39", soft: "#fff2d4" },
  { name: "tangerine", paper: "#ff7b32", ink: "#173b78", accent: "#63d5e7", soft: "#fff0d4" },
  { name: "violet", paper: "#8268dc", ink: "#182f63", accent: "#ffcf3f", soft: "#f8ebd3" },
];

function cardTheme(card, offset = 0) {
  const seed = String(card?.id || card?.title || "cihua");
  const hash = [...seed].reduce((total, character) => total + character.codePointAt(0), offset);
  return CARD_THEMES[Math.abs(hash) % CARD_THEMES.length];
}

function themeStyle(theme) {
  return `--card-paper:${theme.paper};--card-ink:${theme.ink};--card-accent:${theme.accent};--card-soft:${theme.soft}`;
}

const STORY_SCENES = ["harbor", "forest", "cafe", "night", "garden", "train", "market", "studio"];

function storyScene(card) {
  const haystack = [card.title, card.title_zh, card.story_text, ...(card.vocabulary || []).flatMap((entry) => [entry.input_word, entry.lemma])]
    .filter(Boolean).join(" ").toLocaleLowerCase();
  const matches = [["harbor", /harbor|lighthouse|boat|sea|sailor|shore|tide|port/], ["forest", /forest|mountain|trail|path|tree|spring|compass|hike|sendero|montaña/], ["cafe", /cafe|coffee|bakery|letter|window|table|book|cup/], ["night", /night|moon|star|dream|sky|planet|midnight|glimmer/], ["garden", /garden|flower|seed|bird|greenhouse|river|bloom/], ["train", /train|station|ticket|journey|platform|suitcase|travel/], ["market", /market|shop|street|fruit|music|festival|lantern/], ["studio", /draw|paint|camera|music|workshop|artist|create|design/]];
  const matched = matches.find(([, pattern]) => pattern.test(haystack));
  if (matched) return matched[0];
  const hash = [...String(card?.id || card?.title || "cihua")].reduce((total, character) => total * 31 + character.codePointAt(0), 7);
  return STORY_SCENES[Math.abs(hash) % STORY_SCENES.length];
}

function sceneMarkup(card, scene = storyScene(card)) {
  const pieces = {
    harbor: "<i class=\"scene-sun\"></i><i class=\"scene-wave one\"></i><i class=\"scene-wave two\"></i><i class=\"scene-lighthouse\"></i><i class=\"scene-boat\"></i>", forest: "<i class=\"scene-sun\"></i><i class=\"scene-mountain one\"></i><i class=\"scene-mountain two\"></i><i class=\"scene-path\"></i><i class=\"scene-pine one\"></i><i class=\"scene-pine two\"></i>", cafe: "<i class=\"scene-sun\"></i><i class=\"scene-window\"></i><i class=\"scene-table\"></i><i class=\"scene-cup\"></i><i class=\"scene-book\"></i>", night: "<i class=\"scene-moon\"></i><i class=\"scene-star one\">✦</i><i class=\"scene-star two\">✦</i><i class=\"scene-hill\"></i><i class=\"scene-telescope\"></i>", garden: "<i class=\"scene-sun\"></i><i class=\"scene-ground\"></i><i class=\"scene-flower one\"></i><i class=\"scene-flower two\"></i><i class=\"scene-flower three\"></i><i class=\"scene-fence\"></i>", train: "<i class=\"scene-sun\"></i><i class=\"scene-cloud\"></i><i class=\"scene-track\"></i><i class=\"scene-train\"></i><i class=\"scene-suitcase\"></i>", market: "<i class=\"scene-sun\"></i><i class=\"scene-awning\"></i><i class=\"scene-stall\"></i><i class=\"scene-fruit one\"></i><i class=\"scene-fruit two\"></i><i class=\"scene-lantern\"></i>", studio: "<i class=\"scene-sun\"></i><i class=\"scene-easel\"></i><i class=\"scene-canvas\"></i><i class=\"scene-paint\"></i><i class=\"scene-shelf\"></i>",
  };
  return `<div class=\"story-scene scene-${scene}\" aria-hidden=\"true\">${pieces[scene]}</div>`;
}

function storyArtwork(card, compact = false, scene = storyScene(card)) {
  const image = card.image_url
    ? `<img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.title)} 的故事配图" />`
    : sceneMarkup(card, scene);
  return `<div class="story-artwork ${compact ? "is-compact" : ""}">${image}<span class="art-sticker">STORY<br />No. ${String(card.id).slice(-2).padStart(2, "0")}</span></div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wordsFromInput(value) {
  const seen = new Set();
  return value
    .split(/[，,、;；\s]+/u)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => {
      const key = word.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function spaceMeta(code = state.activeSpace) {
  return code === "es"
    ? { code: "ES", title: "西班牙语故事库", short: "西班牙语空间", archive: "Archivo Español", eyebrow: "SPANISH STORY SPACE", input: "brisa, sendero, valiente, recuerdo" }
    : { code: "EN", title: "英语故事库", short: "英语空间", archive: "English archive", eyebrow: "ENGLISH STORY SPACE", input: "fragile, harbor, rescue, glimmer" };
}

function languageMenuMarkup(language, dataAttribute) {
  const meta = language === "es"
    ? { code: "ES", name: "Español", note: "西班牙语空间" }
    : { code: "EN", name: "English", note: "英语空间" };
  return `<button type="button" ${dataAttribute}="${language}"><span class="language-code">${meta.code}</span><span><strong>${meta.name}</strong><small>${meta.note}</small></span></button>`;
}

function languageLabel(code) {
  return code === "es" ? "ES · Español" : "EN · English";
}

function dateLabel(value) {
  try {
    return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return "刚刚";
  }
}

// ---------------------------------------------------------------------------
// 静态只读模式
//
// 同一个 app.js 既服务本地工作台（有 Python 后端），也服务托管在 GitHub Pages
// 上的只读镜像。静态镜像里没有后端，因此：
//   - /api/cards、/api/vocabulary/sources 改读构建时烘焙好的 JSON
//   - /api/vocabulary/random 在浏览器里直接抽词（词库已随站点发布）
//   - 生成、删除这类写操作直接拒绝，并给出可读的提示
// ---------------------------------------------------------------------------
const STATIC_MODE =
  typeof window !== "undefined" && (window.__CIHUA_STATIC__ === true || window.location.protocol === "file:");

const STATIC_DATA = `${API}data`;
const STATIC_NOTICE = "这是只读的在线故事库：可以浏览与复习，生成新卡片请在本地工作台进行。";

/** 简单的确定性哈希，用于替换原后端按词频排序的抽词逻辑。 */
function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function fetchJsonFile(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("在线故事数据加载失败，请刷新页面重试。");
  return response.json();
}

function shuffledCopy(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

async function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  if (STATIC_MODE) {
    if (method !== "GET") {
      throw new Error("在线版本是只读的，无法生成或删除故事卡。");
    }
    if (path === "/api/cards") {
      return { cards: await fetchJsonFile(`${STATIC_DATA}/cards.json`) };
    }
    if (path === "/api/vocabulary/sources") {
      return { sources: await fetchJsonFile(`${STATIC_DATA}/vocabulary-sources.json`) };
    }
    if (path === "/api/capabilities") {
      return {
        story_generation: { available: false, backend: "static-readonly", reason: STATIC_NOTICE },
        image_generation: { available: false, backend: "static-readonly", reason: STATIC_NOTICE },
      };
    }
    if (path.startsWith("/api/vocabulary/random")) {
      const query = new URLSearchParams(path.split("?")[1] || "");
      const bank = query.get("bank_code") || query.get("exam_code") || "cet4";
      const count = Number(query.get("count") || 5);
      const bank_words = await fetchJsonFile(`${STATIC_DATA}/vocabulary/${encodeURIComponent(bank)}.json`);
      return { bank_code: bank, exam_code: bank, count: Math.min(count, bank_words.length), words: shuffledCopy(bank_words).slice(0, count) };
    }
    throw new Error(STATIC_NOTICE);
  }

  const response = await fetch(`${API}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "本地工作台暂时没有响应。");
  return payload;
}

async function refreshData() {
  const cardsPayload = await request("/api/cards");
  state.cards = cardsPayload.cards;
  renderSpace();
  renderLibrary();
  buildReviewDeck();
}

function spaceCards() {
  return state.cards.filter((card) => card.language_code === state.activeSpace);
}

function renderSpace() {
  const meta = spaceMeta();
  const alternativeLanguage = state.activeSpace === "en" ? "es" : "en";
  $("#primary-language").innerHTML = `<span class="language-code">${meta.code}</span><span><strong>${meta.short}</strong><small>${meta.archive}</small></span>`;
  $("#primary-language").setAttribute("aria-label", `当前学习空间为${meta.short}`);
  $("#word-input").placeholder = meta.input;
  $("#library-space-primary").innerHTML = `<span class="language-code">${meta.code}</span><span><strong>${meta.short}</strong><small>${meta.archive}</small></span>`;
  $("#library-space-primary").setAttribute("aria-label", `当前学习空间为${meta.short}`);
  $("#library-eyebrow").textContent = meta.eyebrow;
  $("#library-title").textContent = meta.title;
  $("#review-space-note").textContent = meta.short;
  $("#more-language-button").innerHTML = `${state.activeSpace === "en" ? "更多语言" : "英语"} <span>＋</span>`;
  $("#library-more-language-button").innerHTML = `${state.activeSpace === "en" ? "更多语言" : "英语"} <span>＋</span>`;
  $("#language-menu").innerHTML = languageMenuMarkup(alternativeLanguage, "data-language");
  $("#library-language-menu").innerHTML = languageMenuMarkup(alternativeLanguage, "data-space-language");

  const cards = spaceCards();
  const entries = cards.flatMap((card) => card.vocabulary);
  $("#stat-cards").textContent = cards.length;
  $("#stat-words").textContent = entries.length;
  $("#stat-unique").textContent = new Set(entries.map((entry) => entry.lemma.toLocaleLowerCase())).size;
  $("#stats-copy").innerHTML = state.activeSpace === "es"
    ? "让每一个西语词，<br />先成为一个有画面的片段。"
    : "让词先住进故事里，<br />再住进记忆里。";
  const isEnglish = state.activeSpace === "en";
  state.selectedExam = isEnglish
    ? (state.selectedExam === "spanish-basic" ? "cet4" : state.selectedExam)
    : "spanish-basic";
  $$('[data-bank-language]').forEach((button) => {
    button.hidden = button.dataset.bankLanguage !== state.activeSpace;
  });
  $("#vocabulary-settings-wrap").hidden = false;
  $("#randomize-button").hidden = false;
  selectExam(state.selectedExam);
  if ($("#library-manager").open) renderLibraryManager();
}

function renderVocabularySources() {
  for (const source of state.vocabularySources) {
    const target = $(`#${source.exam_code}-source-count`);
    if (target) target.textContent = `${Number(source.total).toLocaleString("zh-CN")} 词 · ${source.source}`;
  }
}

async function loadVocabularySources() {
  const payload = await request("/api/vocabulary/sources");
  state.vocabularySources = payload.sources || [];
  renderVocabularySources();
  selectExam(state.selectedExam);
}

function renderImageCapability() {
  const capability = state.capabilities?.image_generation;
  const available = Boolean(capability?.available);
  const option = $(".image-option");
  const input = $("#image-requested");
  input.disabled = !available;
  if (!available) input.checked = false;
  option.classList.toggle("is-disabled", !available);
  option.title = available ? "" : (capability?.reason || "当前 Agent 不支持生图");
  $("#image-option-title").textContent = available ? "生成一张故事配图" : "故事配图暂不可用";
  $("#image-option-note").textContent = available
    ? `${capability.backend === "codex" ? "Codex 内置生图" : capability.backend} · 默认关闭；失败不影响故事卡`
    : (capability?.reason || "当前 Agent 不支持生图，已自动关闭");
}

async function loadCapabilities() {
  state.capabilities = await request("/api/capabilities");
  renderImageCapability();
}

function selectExam(examCode) {
  state.selectedExam = examCode;
  $$("[data-exam]").forEach((button) => button.classList.toggle("is-active", button.dataset.exam === examCode));
  const labels = { cet4: "CET-4", ielts: "IELTS", "spanish-basic": "ES BASIC" };
  $("#vocabulary-settings-button").innerHTML = `词库 ${labels[examCode] || examCode.toUpperCase()} <span>⌄</span>`;
  const source = state.vocabularySources.find((item) => item.exam_code === examCode);
  if (source) $("#vocabulary-source-note").textContent = `数据来源 ${source.source} · ${source.license}`;
  updateRandomButtonLabel("随机");
}

function updateRandomButtonLabel(action = "随机") {
  const count = Number($("#random-count").value);
  $("#randomize-button").innerHTML = `<span aria-hidden="true">↻</span><span>${action} ${count} 词</span>`;
}

async function randomizeVocabulary() {
  const button = $("#randomize-button");
  const count = Number($("#random-count").value);
  let succeeded = false;
  button.disabled = true;
  button.innerHTML = "<span aria-hidden=\"true\">↻</span><span>正在抽词</span>";
  try {
    const payload = await request(`/api/vocabulary/random?bank_code=${encodeURIComponent(state.selectedExam)}&count=${count}`);
    const words = payload.words.map((entry) => entry.word);
    $("#word-input").value = words.join(", ");
    renderWordChips();
    succeeded = true;
    $("#word-input").focus();
  } catch (error) {
    setStatus(error.message || "随机抽词失败，请再试一次。", "error");
  } finally {
    button.disabled = false;
    updateRandomButtonLabel(succeeded ? "再随机" : "随机");
  }
}

function chooseSpace(language, clearDraft = false) {
  const changed = state.activeSpace !== language;
  state.activeSpace = language;
  state.flipped = false;
  if (changed && clearDraft) {
    $("#word-input").value = "";
    renderWordChips();
    updateRandomButtonLabel("随机");
  }
  renderSpace();
  renderLibrary();
  if (state.view === "review") buildReviewDeck();
}

function renderWordChips() {
  const words = wordsFromInput($("#word-input").value);
  $("#word-count").textContent = `${words.length} / 10`;
  $("#word-chips").innerHTML = words
    .slice(0, 10)
    .map((word, index) => `<span class="word-chip">${escapeHtml(word)}<button type="button" data-remove-word="${index}" aria-label="移除 ${escapeHtml(word)}">×</button></span>`)
    .join("");
}

function highlightStory(story, vocabulary) {
  const forms = vocabulary.map((entry) => entry.used_form || entry.lemma || entry.input_word).filter(Boolean);
  if (!forms.length) return escapeHtml(story);
  const matcher = new RegExp(`(${forms.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  return story
    .split(matcher)
    .map((part, index) => (index % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join("");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightTranslation(translation, vocabulary) {
  const terms = [...new Set(vocabulary.flatMap((entry) => {
    const translatedPhrase = String(entry.translation_phrase_zh || "").trim();
    if (translatedPhrase) return [translatedPhrase];
    return String(entry.meaning_zh || "")
      .split(/[；;,，、/]/u)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2);
  }))].sort((a, b) => b.length - a.length);
  if (!terms.length) return escapeHtml(translation);
  const matcher = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gu");
  return translation
    .split(matcher)
    .map((part, index) => (index % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join("");
}

function renderLibrary() {
  const visible = spaceCards();
  const grid = $("#library-grid");
  const empty = $("#library-empty");
  const usedScenes = new Set();
  grid.innerHTML = visible
    .map((card, index) => {
      const theme = cardTheme(card, index);
      let scene = storyScene(card);
      const preferredIndex = STORY_SCENES.indexOf(scene);
      for (let step = 0; usedScenes.has(scene) && step < STORY_SCENES.length; step += 1) scene = STORY_SCENES[(preferredIndex + step + 1) % STORY_SCENES.length];
      usedScenes.add(scene);
      const words = card.vocabulary.map((entry) => `<span>${escapeHtml(entry.input_word)}</span>`).join("");
      return `<button class="library-card theme-${theme.name}" style="${themeStyle(theme)};--card-tilt:${(index % 3 - 1) * 0.7}deg" data-open-card="${card.id}">
        ${storyArtwork(card, true, scene)}
        <div class="library-card-copy">
          <div class="library-card-top"><span>${escapeHtml(dateLabel(card.created_at))}</span><span>${languageLabel(card.language_code)}</span></div>
          <h2>${escapeHtml(card.title)}</h2>
          <p>${escapeHtml(card.story_text)}</p>
          <div class="library-card-words">${words}</div>
        </div>
      </button>`;
    })
    .join("");
  grid.hidden = visible.length === 0;
  empty.hidden = visible.length !== 0;
  empty.querySelector("h2").textContent = state.activeSpace === "es" ? "西班牙语故事库还是空的" : "英语故事库还是空的";
}

function renderLibraryManager() {
  const cards = spaceCards();
  const list = $("#manager-list");
  const empty = $("#manager-empty");
  $("#manager-space-note").textContent = `只显示当前${spaceMeta().short}的故事。删除后无法恢复。`;
  list.innerHTML = cards.map((card) => `<div class="manager-row">
    <div><strong>${escapeHtml(card.title)}</strong><span>${escapeHtml(dateLabel(card.created_at))} · ${card.vocabulary.length} 个词</span></div>
    <button type="button" data-delete-card="${escapeHtml(card.id)}">删除</button>
  </div>`).join("");
  list.hidden = cards.length === 0;
  empty.hidden = cards.length !== 0;
}

function openLibraryManager() {
  // 静态镜像没有后端，删除必然失败，所以这里直接给出提示而不是让按钮报错。
  if (STATIC_MODE) {
    window.alert(STATIC_NOTICE);
    return;
  }
  renderLibraryManager();
  $("#library-manager").showModal();
}

async function deleteManagedCard(cardId, button) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card || !window.confirm(`确定删除《${card.title}》吗？这张故事卡和其中的单词都会被删除。`)) return;
  button.disabled = true;
  button.textContent = "删除中";
  try {
    await request(`/api/cards/${encodeURIComponent(cardId)}`, { method: "DELETE" });
    await refreshData();
    renderLibraryManager();
  } catch (error) {
    window.alert(error.message || "删除失败，请稍后再试。");
    button.disabled = false;
    button.textContent = "删除";
  }
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function buildReviewDeck(preserveSelectedId = null) {
  const cards = spaceCards();
  state.reviewDeck = state.flashMode === "story"
    ? cards.map((card) => ({ type: "story", card }))
    : cards.flatMap((card) => card.vocabulary.map((entry) => ({ type: "word", card, entry })));
  const selectedIndex = preserveSelectedId ? state.reviewDeck.findIndex((item) => item.card.id === preserveSelectedId) : 0;
  state.reviewIndex = Math.max(0, selectedIndex);
  state.flipped = false;
  renderReview();
}

function currentReview() {
  return state.reviewDeck[state.reviewIndex];
}

function storyFront(card) {
  return `<div class="story-front-layout">
    <div class="story-visual">${storyArtwork(card)}<div class="story-title-wrap"><span>CIHUA STORY CARD</span><h2 class="story-card-title">${escapeHtml(card.title)}</h2></div></div>
    <div class="story-copy"><div class="card-face-label"><span>${languageLabel(card.language_code)}</span><span>READ · IMAGINE · REMEMBER</span></div>
      <p class="story-reading">${highlightStory(card.story_text, card.vocabulary)}</p>
      <p class="card-prompt">读到高亮词，先在心里说出它的意思。点击卡片翻面。</p></div>
  </div>`;
}

function storyBack(card) {
  const entries = card.vocabulary
    .map((entry) => `<div class="vocab-entry"><div><strong>${escapeHtml(entry.input_word)}</strong><small>${escapeHtml(entry.pronunciation || "")}</small></div><div class="vocab-definition"><div class="vocab-label-row"><span class="part-of-speech">${escapeHtml(entry.part_of_speech)}</span>${entry.grammar_note ? `<small>${escapeHtml(entry.grammar_note)}</small>` : ""}</div><div class="vocab-meaning">${escapeHtml(entry.meaning_zh)}</div></div><div>${escapeHtml(entry.story_sentence)}</div></div>`)
    .join("");
  return `<div class="back-ribbon"><span>中文译文</span><span>${card.language_code.toUpperCase()} / ZH</span></div>
    <div class="translation-layout"><div class="translation-head"><span class="translation-number">翻<br />译</span><h2 class="translation-title">${escapeHtml(card.title_zh || card.title)}</h2></div>
    <p class="translation">${highlightTranslation(card.translation_zh, card.vocabulary)}</p><div class="vocab-list">${entries}</div></div>`;
}

function wordFront(entry, card) {
  return `<div class="word-poster" aria-hidden="true"><span class="poster-letter">${escapeHtml(entry.input_word.slice(0, 1).toUpperCase())}</span><i></i><i></i><b>✦</b></div>
    <div class="card-face-label"><span>${languageLabel(card.language_code)}</span><span>WORD CARD</span></div>
    <div class="word-main">${escapeHtml(entry.input_word)}</div><p class="word-sub">它来自哪一个场景？它是什么意思？</p><p class="card-prompt">点击卡片翻面。</p>`;
}

function wordBack(entry, card) {
  return `<div class="word-answer"><div class="card-face-label"><span>REVEAL</span><span>${card.language_code.toUpperCase()}</span></div>
    <h2>${escapeHtml(entry.input_word)}</h2><p class="word-pronunciation">${escapeHtml(entry.pronunciation || "")}</p><div class="word-label-row"><span class="part-of-speech">${escapeHtml(entry.part_of_speech)}</span>${entry.grammar_note ? `<small>${escapeHtml(entry.grammar_note)}</small>` : ""}</div>
    <p class="meaning">${escapeHtml(entry.meaning_zh)}</p><div class="sentence-box">${escapeHtml(entry.story_sentence)}</div><button type="button" class="story-jump" data-open-story-card="${escapeHtml(card.id)}">去看《${escapeHtml(card.title)}》的故事卡 <span aria-hidden="true">→</span></button></div>`;
}

function syncFlipButton() {
  const button = $("#flip-card");
  const returnLabel = currentReview()?.type === "word" ? "翻回单词" : "翻回故事";
  button.innerHTML = state.flipped ? `${returnLabel} <kbd>Space</kbd>` : "翻面看答案 <kbd>Space</kbd>";
}

function renderReview() {
  const card = $("#flash-card");
  const item = currentReview();
  const total = state.reviewDeck.length;
  $("#flash-progress").innerHTML = `<span>${total ? String(state.reviewIndex + 1).padStart(2, "0") : "00"}</span><i></i><span>${String(total).padStart(2, "0")}</span>`;
  $("#prev-card").disabled = total < 2;
  $("#next-card").disabled = total < 2;
  $("#flip-card").disabled = total === 0;
  $("#shuffle-cards").disabled = total < 2;
  syncFlipButton();
  if (!item) {
    card.className = "flash-card no-cards";
    card.removeAttribute("style");
    card.innerHTML = `<div><span class="eyebrow">NO CARDS YET</span><h2>${state.activeSpace === "es" ? "还没有西班牙语故事卡" : "先写一个英语故事"}</h2><p>去创作页放进几个词，故事会在这里等你翻开。</p></div>`;
    return;
  }
  const front = item.type === "story" ? storyFront(item.card) : wordFront(item.entry, item.card);
  const back = item.type === "story" ? storyBack(item.card) : wordBack(item.entry, item.card);
  const theme = cardTheme(item.card, item.type === "word" ? state.reviewIndex : 0);
  card.className = `flash-card theme-${theme.name} ${item.type === "word" ? "word-card" : "story-card"}`;
  card.setAttribute("style", themeStyle(theme));
  card.classList.toggle("is-flipped", state.flipped);
  card.innerHTML = `<div class="flash-card-inner"><article class="flash-card-face flash-card-front" aria-hidden="${state.flipped}">${front}</article><article class="flash-card-face flash-card-back" aria-hidden="${!state.flipped}">${back}</article></div>`;
}

function setView(view) {
  closeMenus();
  state.view = view;
  $$(".view").forEach((element) => element.classList.toggle("is-active", element.id === `view-${view}`));
  $$("[data-view-link]").forEach((button) => button.classList.toggle("is-active", button.dataset.viewLink === view));
  if (view === "review") buildReviewDeck();
  if (view === "library") { renderSpace(); renderLibrary(); }
  if (view === "create") window.setTimeout(() => $("#word-input").focus(), 120);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setStatus(message, type = "info") {
  const status = $("#generation-status");
  status.hidden = !message;
  status.textContent = message || "";
  status.dataset.type = type;
}

function renderLoadingProgress() {
  const elapsed = Math.floor((Date.now() - state.generationStartedAt) / 1000);
  const stages = state.generationPhase === "image"
    ? ["故事写好了，正在生成配图", "Codex 正在把故事里最有辨识度的一幕画出来。"]
    : elapsed < 4
    ? ["词话正在搭建故事", "先为这些词找到同一个场景。"]
    : elapsed < 12
      ? ["它们已经在同一个故事里相遇", "正在让人物、行动和一点转折自然发生。"]
      : ["正在做最后一次故事检查", "确认每个词都被用到，且故事有完整结尾。"];
  $("#loading-title").textContent = stages[0];
  $("#loading-detail").textContent = stages[1];
  $("#loading-elapsed").textContent = `已用时 ${elapsed} 秒 · ${state.generationWantsImage ? "含配图通常需要 40–120 秒" : "通常需要 20–60 秒"}`;
}

function setLoading(visible, words = [], wantsImage = false) {
  const overlay = $("#generation-overlay");
  if (state.loadingTimer) window.clearInterval(state.loadingTimer);
  state.loadingTimer = null;
  overlay.hidden = !visible;
  $("#create-form").setAttribute("aria-busy", String(visible));
  if (!visible) {
    state.generationPhase = "idle";
    state.generationWantsImage = false;
    return;
  }
  state.generationPhase = "queued";
  state.generationWantsImage = wantsImage;
  state.generationStartedAt = Date.now();
  $("#loading-words").innerHTML = words.map((word) => `<span>${escapeHtml(word)}</span>`).join("");
  renderLoadingProgress();
  state.loadingTimer = window.setInterval(renderLoadingProgress, 900);
}

async function pollGeneration(jobId) {
  const status = await request(`/api/generations/${jobId}`);
  state.generationPhase = status.phase || status.status;
  renderLoadingProgress();
  if (status.status === "complete") return status;
  if (status.status === "failed") throw new Error(status.error || "故事生成失败。");
  const waitLimit = state.generationWantsImage ? 330_000 : 105_000;
  if (Date.now() - state.generationStartedAt > waitLimit) {
    throw new Error("本次生成耗时过长，已停止等待。请重新生成一次。");
  }
  if (status.status === "queued") $("#loading-detail").textContent = "正在唤起 Codex，马上开始把词连成一个故事。";
  await new Promise((resolve) => window.setTimeout(resolve, 1600));
  return pollGeneration(jobId);
}

async function submitGeneration(event) {
  event.preventDefault();
  if (STATIC_MODE) {
    setStatus(STATIC_NOTICE, "info");
    return;
  }
  const words = wordsFromInput($("#word-input").value);
  if (words.length < 2 || words.length > 10) {
    setStatus("请先输入 2–10 个不重复的单词。", "error");
    return;
  }
  const button = $("#generate-button");
  const wantsImage = !$("#image-requested").disabled && $("#image-requested").checked;
  button.disabled = true;
  setStatus("");
  setLoading(true, words, wantsImage);
  try {
    const job = await request("/api/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words, language_code: state.activeSpace, image_requested: wantsImage }),
    });
    const completed = await pollGeneration(job.id);
    await refreshData();
    $("#word-input").value = "";
    $("#image-requested").checked = false;
    renderWordChips();
    state.flashMode = "story";
    $$("[data-flash-mode]").forEach((item) => item.classList.toggle("is-active", item.dataset.flashMode === "story"));
    setView("review");
    buildReviewDeck(completed.card.id);
    if (completed.image_status === "failed") {
      window.alert(`故事卡已生成，但配图失败，已使用默认插画。\n${completed.image_error || "请稍后重试。"}`);
    }
  } catch (error) {
    setStatus(error.message || "生成失败，请稍后再试。", "error");
  } finally {
    setLoading(false);
    button.disabled = false;
  }
}

function flipCard() {
  if (!currentReview()) return;
  state.flipped = !state.flipped;
  const card = $("#flash-card");
  card.classList.toggle("is-flipped", state.flipped);
  card.querySelector(".flash-card-front").setAttribute("aria-hidden", String(state.flipped));
  card.querySelector(".flash-card-back").setAttribute("aria-hidden", String(!state.flipped));
  syncFlipButton();
}

function moveCard(direction) {
  const total = state.reviewDeck.length;
  if (total < 2) return;
  state.reviewIndex = (state.reviewIndex + direction + total) % total;
  state.flipped = false;
  renderReview();
}

function openStoryCard(cardId) {
  state.flashMode = "story";
  $$("[data-flash-mode]").forEach((item) => item.classList.toggle("is-active", item.dataset.flashMode === "story"));
  buildReviewDeck(cardId);
}

function closeMenus() {
  $$(".language-menu, .vocabulary-settings-menu").forEach((menu) => { menu.hidden = true; });
  ["#more-language-button", "#vocabulary-settings-button", "#library-more-language-button"].forEach((selector) => {
    const button = $(selector);
    if (button) button.setAttribute("aria-expanded", "false");
  });
}

function toggleMenu(buttonSelector, menuSelector) {
  const menu = $(menuSelector);
  const willOpen = menu.hidden;
  closeMenus();
  if (willOpen) {
    menu.hidden = false;
    $(buttonSelector).setAttribute("aria-expanded", "true");
  }
}

function bindEvents() {
  $$("[data-view-link]").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    setView(button.dataset.viewLink);
  }));
  $("#word-input").addEventListener("input", renderWordChips);
  $("#word-chips").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-word]");
    if (!button) return;
    const words = wordsFromInput($("#word-input").value);
    words.splice(Number(button.dataset.removeWord), 1);
    $("#word-input").value = words.join(", ");
    renderWordChips();
  });
  $("#more-language-button").addEventListener("click", () => toggleMenu("#more-language-button", "#language-menu"));
  $("#vocabulary-settings-button").addEventListener("click", () => toggleMenu("#vocabulary-settings-button", "#vocabulary-settings-menu"));
  $("#library-more-language-button").addEventListener("click", () => toggleMenu("#library-more-language-button", "#library-language-menu"));
  $("#language-menu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-language]");
    if (!button) return;
    chooseSpace(button.dataset.language, true);
    closeMenus();
  });
  $("#library-language-menu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-space-language]");
    if (!button) return;
    chooseSpace(button.dataset.spaceLanguage);
    closeMenus();
  });
  $("#manage-library-button").addEventListener("click", openLibraryManager);
  $("#close-library-manager").addEventListener("click", () => $("#library-manager").close());
  $("#library-manager").addEventListener("click", (event) => {
    if (event.target === $("#library-manager")) {
      $("#library-manager").close();
      return;
    }
    const button = event.target.closest("[data-delete-card]");
    if (button) deleteManagedCard(button.dataset.deleteCard, button);
  });
  $("#create-form").addEventListener("submit", submitGeneration);
  $$("[data-exam]").forEach((button) => button.addEventListener("click", () => selectExam(button.dataset.exam)));
  $("#random-count").addEventListener("change", () => updateRandomButtonLabel("随机"));
  $("#randomize-button").addEventListener("click", randomizeVocabulary);
  $("#library-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-card]");
    if (!button) return;
    setView("review");
    openStoryCard(button.dataset.openCard);
  });
  $$("[data-flash-mode]").forEach((button) => button.addEventListener("click", () => {
    state.flashMode = button.dataset.flashMode;
    $$("[data-flash-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
    buildReviewDeck();
  }));
  $("#flash-card").addEventListener("click", (event) => {
    const storyButton = event.target.closest("[data-open-story-card]");
    if (storyButton) {
      event.stopPropagation();
      openStoryCard(storyButton.dataset.openStoryCard);
      return;
    }
    flipCard();
  });
  $("#flip-card").addEventListener("click", flipCard);
  $("#prev-card").addEventListener("click", () => moveCard(-1));
  $("#next-card").addEventListener("click", () => moveCard(1));
  $("#shuffle-cards").addEventListener("click", () => {
    state.reviewDeck = shuffled(state.reviewDeck);
    state.reviewIndex = 0;
    state.flipped = false;
    renderReview();
  });
  $("#flash-card").addEventListener("touchstart", (event) => { state.touchStartX = event.changedTouches[0].screenX; }, { passive: true });
  $("#flash-card").addEventListener("touchend", (event) => {
    if (state.touchStartX === null) return;
    const delta = event.changedTouches[0].screenX - state.touchStartX;
    state.touchStartX = null;
    if (Math.abs(delta) > 52) moveCard(delta > 0 ? -1 : 1);
  }, { passive: true });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".more-language-wrap")) closeMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenus();
      return;
    }
    if (state.view !== "review" || event.target.matches("textarea, input")) return;
    if (event.code === "Space") { event.preventDefault(); flipCard(); }
    if (event.key === "ArrowLeft") moveCard(-1);
    if (event.key === "ArrowRight") moveCard(1);
  });
}

/** 静态镜像里把写操作相关的入口标注为只读。 */
function applyStaticMode() {
  document.body.classList.add("is-static-mode");
  const button = $("#generate-button");
  if (button) {
    button.innerHTML = "<span>在线版本为只读</span>";
    button.title = STATIC_NOTICE;
  }
  const status = $("#generation-status");
  if (status) {
    status.hidden = false;
    status.textContent = STATIC_NOTICE;
  }
  const manage = $("#manage-library-button");
  if (manage) {
    manage.textContent = "只读预览";
    manage.title = STATIC_NOTICE;
  }
}

async function init() {
  bindEvents();
  renderWordChips();
  updateRandomButtonLabel("随机");
  if (STATIC_MODE) applyStaticMode();
  try {
    await Promise.all([refreshData(), loadVocabularySources(), loadCapabilities()]);
    window.setTimeout(() => $("#word-input").focus(), 140);
  } catch (error) {
    setStatus("工作台还没有连上本地服务。请重新运行 server.py。", "error");
  }
}

document.addEventListener("DOMContentLoaded", init);
