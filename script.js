let state = {
  topic: 'general',
  mode: 'easy',
  idx: 0,
  items: [],
  learned: new Set(JSON.parse(localStorage.getItem('lexi_learned') || '[]')),
  favorites: new Set(JSON.parse(localStorage.getItem('lexi_favorites') || '[]')),
  ttsStyle: 'natural'
};
let currentItem = null;

function initTopics() {
  const sel = document.getElementById('topicSel');
  const topics = {
    general: "Общая категория",
    finance: "Финансы и Налоги",
    legal: "Юриспруденция",
    phrases: "Фразы для собраний",
    numbers: "Числа и суммы (억/만/천)",
    favorites: "⚖️ Избранное (Трудные карточки)"
  };
  for (const key in topics) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.innerText = topics[key];
    sel.appendChild(opt);
  }
}

// Универсальная функция озвучки (определяет язык автоматически)
function speakText(text, lang) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang || 'ko-KR'; // По умолчанию корейский
  if (state.ttsStyle === 'soft') { u.rate = 0.85; u.pitch = 0.8; }
  else if (state.ttsStyle === 'energetic') { u.rate = 1.15; u.pitch = 1.3; }
  else { u.rate = 1.0; u.pitch = 1.0; }
  speechSynthesis.speak(u);
}

// Оставляем для диалогов и аудио, где всегда корейский
function speakKorean(text) {
  speakText(text, 'ko-KR');
}

function setTTSStyle(style, btn) {
  state.ttsStyle = style;
  document.querySelectorAll('.tts-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function toggleFavorite() {
  if (!currentItem) return;
  const key = currentItem.origKo; // Используем оригинальное корейское слово как ключ
  if (state.favorites.has(key)) {
    state.favorites.delete(key);
  } else {
    state.favorites.add(key);
  }
  localStorage.setItem('lexi_favorites', JSON.stringify([...state.favorites]));
  updateFavBtnUI();
  
  if (state.topic === 'favorites') {
    prepareItems();
    if (state.idx >= state.items.length) state.idx = 0;
    renderCard();
  }
}

function updateFavBtnUI() {
  const btns = document.querySelectorAll('.fav-btn');
  if (!currentItem) return;
  const isFav = state.favorites.has(currentItem.origKo);
  btns.forEach(btn => {
    if (isFav) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function prepareItems() {
  let raw = [];
  if (state.topic === 'favorites') {
    for (let key in VOCAB_DATA) {
      VOCAB_DATA[key].forEach(item => {
        if (state.favorites.has(item.ko)) raw.push(item);
      });
    }
  } else {
    raw = VOCAB_DATA[state.topic] || [];
  }
  
  // Формируем объекты с четким разделением сторон и языков
  state.items = raw.map(item => {
    if (state.mode === 'medium') {
      // RU -> KO
      return {
        origKo: item.ko, // нужен для избранного
        front: item.ru,
        back: item.ko,
        frontLang: 'ru-RU',
        backLang: 'ko-KR',
        ai: item.ai_ko || item.ai_ru || "Контекст отсутствует.",
        aiLang: 'KO'
      };
    } else {
      // KO -> RU
      return {
        origKo: item.ko,
        front: item.ko,
        back: item.ru,
        frontLang: 'ko-KR',
        backLang: 'ru-RU',
        ai: item.ai_ru || "Контекст отсутствует.",
        aiLang: 'RU'
      };
    }
  });
}

function renderCard() {
  const card = document.getElementById('cardEl');
  card.classList.remove('flipped');
  
  if (state.items.length === 0) {
    currentItem = null;
    document.getElementById('cardFront').innerText = "Список пуст";
    document.getElementById('cardBack').innerText = "Добавьте карточки в избранное";
    document.getElementById('aiText').innerText = "Нажмите на иконку пера в правом верхнем углу карточки, чтобы добавить её сюда.";
    document.getElementById('aiBadge').innerText = "AI CONTEXT";
    document.getElementById('progressText').innerText = "0 / 0";
    document.querySelectorAll('.fav-btn').forEach(btn => btn.classList.remove('active'));
    return;
  }

  currentItem = state.items[state.idx];
  
  document.getElementById('cardFront').innerText = currentItem.front;
  document.getElementById('cardBack').innerText = currentItem.back;
  document.getElementById('aiText').innerText = currentItem.ai;
  
  // Меняем текст бейджа в зависимости от языка контекста
  document.getElementById('aiBadge').innerText = currentItem.aiLang === 'KO' ? "AI CONTEXT (KO)" : "AI CONTEXT (RU)";
  
  document.getElementById('progressText').innerText = `${state.idx + 1} / ${state.items.length}`;
  
  updateFavBtnUI();

  if (!state.learned.has(currentItem.origKo)) {
    state.learned.add(currentItem.origKo);
    localStorage.setItem('lexio_learned', JSON.stringify([...state.learned]));
    updateStats();
  }
}

function nextCard() { 
  if (state.items.length === 0) return;
  state.idx = (state.idx + 1) % state.items.length; 
  renderCard(); 
}
function prevCard() { 
  if (state.items.length === 0) return;
  state.idx = (state.idx - 1 + state.items.length) % state.items.length; 
  renderCard(); 
}

function updateStats() {
  document.getElementById('statLearned').innerText = state.learned.size;
  let total = 0;
  for (let key in VOCAB_DATA) total += VOCAB_DATA[key].length;
  document.getElementById('statTotal').innerText = total;
}

function renderDialogues() {
  const list = document.getElementById('dialogueList');
  list.innerHTML = '';
  DIALOGUE_DATA.forEach(block => {
    const div = document.createElement('div');
    div.className = 'dlg-block';
    div.innerHTML = `<h3>${block.title}</h3>`;
    const carousel = document.createElement('div');
    carousel.className = 'carousel-wrapper';
    
    block.items.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'dlg-card';
      itemDiv.innerHTML = `
        <button class="speak-fab" onclick="speakKorean('${item.ko.replace(/'/g, "\\'")}')">🔊</button>
        <div class="dlg-ko">${item.ko}</div>
        <div class="dlg-ru">${item.ru}</div>
      `;
      carousel.appendChild(itemDiv);
    });
    div.appendChild(carousel);
    list.appendChild(div);
  });
}

function renderListening() {
  const list = document.getElementById('listenList');
  list.innerHTML = '';
  for (const topic in VOCAB_DATA) {
    VOCAB_DATA[topic].forEach(item => {
      const div = document.createElement('div');
      div.className = 'listen-item';
      div.innerHTML = `
        <button class="speak-fab" style="position:relative; width:40px; height:40px;" onclick="speakKorean('${item.ko.replace(/'/g, "\\'")}')">🔊</button>
        <div>
          <div class="listen-ko">${item.ko}</div>
          <div class="listen-ru">${item.ru}</div>
        </div>
      `;
      list.appendChild(div);
    });
  }
}

function switchView(view, btn) {
  ['cards', 'dialogues', 'listen'].forEach(v => {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== view);
  });
  document.querySelectorAll('.dock-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// Events
document.getElementById('cardEl').addEventListener('click', (e) => {
  if (!e.target.closest('button')) {
    document.getElementById('cardEl').classList.toggle('flipped');
  }
});
document.getElementById('topicSel').addEventListener('change', e => { state.topic = e.target.value; state.idx = 0; prepareItems(); renderCard(); });
document.getElementById('modeSel').addEventListener('change', e => { state.mode = e.target.value; state.idx = 0; prepareItems(); renderCard(); });
document.getElementById('themeBtn').addEventListener('click', () => {
  const cur = document.body.dataset.theme;
  document.body.dataset.theme = cur === 'dark' ? 'light' : 'dark';
});
document.addEventListener('keydown', e => {
  if (document.getElementById('view-cards').classList.contains('hidden')) return;
  if (e.key === 'ArrowRight') nextCard();
  if (e.key === 'ArrowLeft') prevCard();
  if (e.key === ' ') { e.preventDefault(); document.getElementById('cardEl').click(); }
});

// Init
initTopics();
prepareItems();
renderCard();
renderDialogues();
renderListening();
updateStats();