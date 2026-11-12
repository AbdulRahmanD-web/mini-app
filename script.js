const tg = window.Telegram?.WebApp;
if (tg) { 
  tg.ready(); 
  tg.expand(); 
  tg.disableVerticalSwipes(); 
  tg.setHeaderColor('#0A0A0A'); 
}

// Глобальные переменные
let readProgress = [];
let chainData = { dates: [] };
let logsData = [];
let capsuleData = null;
let currentChapterId = 1;
let selectedMark = 'up';
let initDone = false;

function saveToCloud(key, value) {
  const strValue = JSON.stringify(value);
  try { localStorage.setItem(key, strValue); } catch (e) {}
  if (tg && tg.CloudStorage) {
    tg.CloudStorage.setItem(key, strValue, (err) => {
      if (err) console.error('CloudStorage save error [' + key + ']:', err);
    });
  }
}

function removeFromCloud(key) {
  try { localStorage.removeItem(key); } catch (e) {}
  if (tg && tg.CloudStorage) {
    tg.CloudStorage.removeItem(key, (err) => {
      if (err) console.error('CloudStorage remove error [' + key + ']:', err);
    });
  }
}

function loadAllData(callback) {
  // 1. localStorage (мгновенно)
  try {
    readProgress = JSON.parse(localStorage.getItem('readProgress')) || [];
    chainData = JSON.parse(localStorage.getItem('dk_chain')) || { dates: [] };
    logsData = JSON.parse(localStorage.getItem('dk_logs')) || [];
    capsuleData = JSON.parse(localStorage.getItem('dk_capsule')) || null;
  } catch (e) {
    console.error('LocalStorage load error:', e);
  }

  // 2. Если нет облака — сразу callback (browser fallback)
  if (!tg || !tg.CloudStorage) {
    callback();
    return;
  }

  // 3. Облако переопределяет данные
  const keys = ['readProgress', 'dk_chain', 'dk_logs', 'dk_capsule'];
  tg.CloudStorage.getItems(keys, (err, res) => {
    // ФИКС 1: Обработка ошибки облака (Task 1)
    if (err) {
      showToast('Ошибка синхронизации. Прогресс сохранен локально.');
      console.error('CloudStorage getItems error:', err);
    } else if (res) {
      // Защита от null при парсинге
      try {
        if (res.readProgress) {
          const parsed = JSON.parse(res.readProgress);
          if (parsed) readProgress = parsed;
        }
        if (res.dk_chain) {
          const parsed = JSON.parse(res.dk_chain);
          if (parsed && parsed.dates) chainData = parsed;
        }
        if (res.dk_logs) {
          const parsed = JSON.parse(res.dk_logs);
          if (parsed) logsData = parsed;
        }
        if (res.dk_capsule) {
          const parsed = JSON.parse(res.dk_capsule);
          if (parsed) capsuleData = parsed;
        }
      } catch (e) {
        console.error('CloudStorage parse error:', e);
      }
    }
    
    // ФИКС 2: принудительная перерисовка, если UI уже отрисовался по таймауту
    if (initDone) {
      renderProfileUI();
      renderChapterList();
      updateHomeScreen();
    }
    
    callback();
  });
}

const CHAPTERS = [
  { 
    id: 1, title: "Диагноз", 
    text: "Ты чувствуешь фоновую тревогу. Пустоту внутри, которую не получается ничем заглушить. Кажется, что тебя обманули, но ты не можешь понять, где и когда.<br><br>С тобой всё в порядке. Это не твоя вина. Это диагноз.<br><br>Представь, что твоя жизнь — это озеро. В детстве оно было чистым. Но чем старше ты становился, тем больше в него сливали отходы. Соцсети. Игры. Бесконечные новости. Чужие мнения. Красивые картинки чужого успеха.<br><br>Каждый день по капле. Ты этого не замечал. Но теперь твоё озеро — это болото. Ты пытаешься пить из него, но вода горчит.<br><br>Ты покупаешь «бутылки с счастьем» в интернете. Новый телефон, донат стримеру, курс за 5000 рублей. На пару часов становится легче. Но на утро озеро становится ещё грязнее.<br><br>Пора это признать. И начать очистку.", 
    action: "Напиши три вещи, которые ты потребляешь каждый день, и знаешь, что это яд.", 
    nextStep: "Прочитай её и выпиши три источника мусора." 
  },
  { 
    id: 2, title: "Отсечение", 
    text: "Ты признал, что твоё озеро отравлено. Теперь ты стоишь перед выбором: продолжать пить яд, зная, что это яд, или начать очистку.<br><br>Большинство останавливается. Им хватает смелости признаться себе, но не хватает сил отказаться. Потому что яд сладкий. Он даёт быстрое удовольствие. А очистка — это больно и скучно.<br><br>Но есть две ловушки. Первая: «будь как все, пей эту грязь». Вторая: «стань роботом, запрети себе всё».<br><br>Истина посередине. Ты не робот. Ты не должен запрещать себе быть мужчиной. Ты должен научиться управлять этим.<br><br>Твоя задача — не спрятаться в бункере. А перестать быть собакой Павлова, у которой выделяется слюна на каждый звонок. Ты видишь крючок, знаешь, что на нём яд, и сам решаешь, глотать или нет.", 
    action: "Удали сегодня один источник мусора. Без прощаний. Просто удали.", 
    nextStep: "Следующий шаг: убери один источник мусора сегодня." 
  },
  { 
    id: 3, title: "Точка опоры", 
    text: "Ты отрезал первый слой грязи. Стало легче дышать. Но сейчас ты стоишь перед главной пустотой. Той самой, которую ты годами пытался заполнить чем угодно. Играми. Лайками. Девушками.<br><br>Ты думал: «Найдётся кто-то, и я наконец успокоюсь». Но этого не происходило.<br><br>Большинство мужчин живут как город без электростанции. Они подключаются к чужим розеткам. Сначала это мать. Потом друзья. Потом женщина. Пока у соседа всё хорошо — свет горит. Но как только у соседа авария — город погружается во тьму.<br><br>Женщина не может быть твоим якорем. Она не может забирать твою тревогу. Она — зеркало. Если внутри тебя хаос, она отразит хаос. Если внутри пустота — она отразит пустоту. Если сила — она успокоится рядом с тобой.<br><br>Ты не можешь прийти к зеркалу и требовать, чтобы оно сделало тебя красивым. Сначала ты должен привести себя в порядок.", 
    action: "Сделай сегодня одно дело, которое давно откладывал. Сам, без чьей-либо помощи.", 
    nextStep: "Следующий шаг: сделай одно отложенное дело в одиночку." 
  },
  { 
    id: 4, title: "Система", 
    text: "Ты понял, что опора внутри. У тебя появилось свободное время. Но как не слить его и не вернуться обратно в болото? Ответ — тебе нужна Система. Железный каркас, который будет держать тебя каждый день.<br><br>Самый простой инструмент — бумажный дневник. Пока ты пишешь от руки, мозг работает иначе. Твой дневник — это центр управления полётами. Сюда ты будешь записывать цели и выгружать мысли.<br><br>Первое правило: первый час после пробуждения — твой. Не хватайся за телефон. Возьми дневник. Выгрузи мусор из головы на бумагу. Напиши одну главную задачу на сегодня. Всего одну. Ту, которая продвинет тебя к цели. Не десять.<br><br>И разбей свою большую цель на «бусины». Не «стать разработчиком», а «прочитать главу про Flexbox», «сверстать карточку». Ты не думаешь о том, чтобы выучить всё. Ты рвёшь одну бусину сегодня.", 
    action: "Заведи тетрадь (или заметки). Напиши одну задачу на сегодня и сделай её.", 
    nextStep: "Следующий шаг: начни вести дневник и напиши задачу на завтра." 
  },
  { 
    id: 5, title: "Цель", 
    text: "Ты признал диагноз, отсек яд, построил опору и начал строить систему. Но главный вопрос: «Ради чего всё это?»<br><br>Цель — это не приговор. Это не клятва на крови. Цель — это направление, которое ты выбираешь на данном этапе. Тебе не нужно решать всю жизнь прямо сейчас. Тебе нужно решить, в какую сторону сделать первый шаг.<br><br>Всю жизнь тебе говорили, чего ты должен хотеть. Машину, статус, «нормальную» работу. Это чужие цели. Как найти свою? Пробовать.<br><br>Задай себе вопрос: «Что мне интересно?» Не что выгодно. Не что престижно. Что вызывает любопытство?<br><br>Многие боятся начать, потому что боятся ошибиться. «А вдруг это не моё?» Послушай: терять тебе нечего. Любой опыт — это актив. Потратил месяц на дизайн и понял, что не твоё? Это не провал. Это покупка бесценного опыта.", 
    action: "Напиши свою главную цель. Сделай к ней первый маленький шаг прямо сейчас.", 
    nextStep: "Следующий шаг: сформулируй свою цель и сделай первый шаг." 
  },
  { 
    id: 6, title: "Дневник Junior", isDiary: true,
    text: "<p><strong>Введение:</strong><br>Привет. Я — обычный парень, который учится на frontend-разработчика с нуля.<br>Этот дневник — не учебник. Это честный архив моего пути: ошибки, которые я совершал, и система, которая помогла мне не сломаться.<br>Здесь нет «успешного успеха». Только 5 ключевых уроков, которые я вынес за первые 90 дней учёбы.<br>Каждый урок — это одна неделя, один инсайт и одно конкретное действие.</p><p><strong>Урок 1. Моя главная ошибка была не в коде:</strong><br>Когда я начал верстать свои первые макеты, знания HTML и CSS у меня уже были. Но как только я сел за работу, наступил ступор. Я не понимал, как применить теорию на практике. Часами бился над одним блоком. Тревога, раздражение и мысли «я не стану разработчиком».<br>Настоящая проблема оказалась не в сложности кода, а в моём подходе. Я решил всё делать сам. Не спрашивал однокурсников, учителя, ментора — тех, кто уже прошёл этот путь. Я изобретал велосипед в одиночку и платил за это временем и нервами.<br>Всё изменилось, когда я начал задавать вопросы. Один конкретный вопрос тому, у кого есть опыт, экономил мне часы мучений.<br>Твой урок: Не пытайся пройти путь в одиночку. Найди наставника, учителя, единомышленников. Ищи ответы на YouTube, в статьях, в тематических чатах. Один вопрос может сэкономить тебе недели.</p><p><strong>Урок 2. Я перестал копировать шаблоны и нашёл свою систему:</strong><br>В начале пути я попал под влияние «культа саморазвития». YouTube, блогеры, красивые видео с идеальным утром. Я пытался копировать их привычки, думая, что это принесёт мне успех. Результат — выгорание и чувство, что я делаю то, что мне не подходит.<br>Я понял: не нужно копировать. Нужно искать своё. Я перестал пичкать себя чужими ритуалами и начал выстраивать свою систему. Например, я ненавижу тренироваться утром. Зато мне отлично заходит тренировка после работы, в 11 утра. Я перенёс её — и она перестала быть пыткой.<br>Твой урок: Привычки — это внешние модификаторы. Если нет твоей собственной основы, они не работают. Не копируй слепо. Пробуй, ошибайся и ищи свой ритм.</p><p><strong>Урок 3. Правило 20 минут, когда нет желания:</strong><br>Бывают дни, когда энергии нет совсем. Голова не варит, руки не поднимаются. Раньше я давил себя: «Надо, соберись». Это заканчивалось либо срывом, либо имитацией работы и чувством вины.<br>Теперь я использую Правило 20 минут.<br>1. Сажусь за главное дело без телефона и вкладок.<br>2. Засекаю ровно 20 минут.<br>3. Делаю. Если через 20 минут сил нет — закрываю с чистой совестью. День прожит не зря.<br>Чаще всего ты втягиваешься, и эти 20 минут превращаются в час продуктивной работы. Мозг боится не работы, а её бесконечности. Когда ты даёшь ему короткий, безопасный лимит — он соглашается начать.<br>Твой эксперимент: В день, когда нет желания, попробуй поработать 20 минут через силу. А в другой такой же день — не работай. Сравни ощущения.</p><p><strong>Урок 4. О чём я думаю, когда просыпаюсь:</strong><br>Честно — ни о чём особенном. Никаких аффирмаций, ритуалов и попыток «настроиться». Я просто знаю: сегодня новый день. Я встаю, завтракаю и сажусь за работу. Мой день — это блоки: утро, работа, вечер.<br>Раньше я расписывал день поминутно и жил ради галочек. Теперь у меня есть одна главная задача на день, обычно связанная с фронтендом. Если я сделал её — день выигран, даже если всё остальное пошло не по плану.<br>Книги, спорт, тренировка голоса — это бонусы. Они подпитывают мою главную цель, но не заменяют её.<br>Твой урок: Перестань пытаться сделать идеальный поминутный план. Раздели день на крупные блоки. Выдели одну главную задачу. И начни утро с неё.</p><p><strong>Урок 5. React — первые шаги. Без страха, но с нюансами:</strong><br>Когда я перешёл к изучению React, ужаса, который был с первыми макетами, уже не было. База, которую я построил, дала мне опору. React — это всё тот же JavaScript, только с другим синтаксисом. Как пересесть с велосипеда на мотоцикл.<br>Я начал с простого: установил окружение, создал первый компонент. Компонент — это просто кусок интерфейса, как кирпичик. Из них собирается всё приложение. Да, код теперь живёт в одном файле, и ошибки чаще всего от невнимательности. Нужна аккуратность и порядок в голове прежде, чем в коде.<br>Сложности есть, но нет чувства «это слишком трудно, надо бросить». Есть понимание: надо просто продолжать. Разбивать большое на маленькое, закрывать тему за темой, делать мини-проекты. React — это не страшно. Это просто новый инструмент, который становится понятнее с каждым часом практики.</p><p><strong>Заключение:</strong><br>Этот дневник — не волшебная таблетка. Это мой реальный путь. Я спотыкался, ошибался, менял подходы и продолжал идти. У тебя будет так же.<br>Главное, что я понял: дисциплина — это не про насилие над собой. Это про систему, которая работает лично для тебя.<br>Подпишись на канал «Фокус и Чилл», чтобы следить за продолжением: @chilldushi</p>", 
    action: "Прочитай и сохрани этот опыт.", 
    nextStep: "Следующий шаг: перейди в полную версию." 
  }
];

const getTodayKey = () => new Date().toISOString().slice(0, 10);
const user = tg?.initDataUnsafe?.user;
const firstName = user?.first_name || 'Гость';
const avatarLetter = firstName.charAt(0).toUpperCase();

function init() {
  document.getElementById('ui-name').innerText = firstName;
  document.getElementById('ui-avatar').innerText = avatarLetter;
  renderChapterList();
  updateHomeScreen();
  renderProfileUI();
}

function openTelegramLink(url) { if (tg) tg.openTelegramLink(url); else window.open(url, '_blank'); }
function hapticFeedback() { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium'); }
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.innerText = message; toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function updateHomeScreen() {
  const guestBlock = document.getElementById('home-guest');
  const userBlock = document.getElementById('home-user');
  const chaptersRead = readProgress.filter(id => id <= 5).length;

  if (chaptersRead === 0) { guestBlock.classList.remove('hidden'); userBlock.classList.add('hidden'); }
  else if (chaptersRead > 0 && chaptersRead < 5) {
    guestBlock.classList.add('hidden'); userBlock.classList.remove('hidden');
    let nextChapter = CHAPTERS.find(ch => ch.id <= 5 && !readProgress.includes(ch.id));
    document.getElementById('home-chapter-title').innerText = `Ты на Главе ${nextChapter.id}`;
    document.getElementById('home-next-step').innerText = nextChapter.nextStep;
  } else { guestBlock.classList.remove('hidden'); userBlock.classList.add('hidden'); }
}

function renderChapterList() {
  const container = document.getElementById('chapter-list-container');
  container.innerHTML = '';
  if (readProgress.length === 0) {
    document.getElementById('state-empty').classList.remove('hidden');
    document.getElementById('state-list').classList.add('hidden');
    document.getElementById('materials-final-block').classList.add('hidden');
    return;
  } else {
    document.getElementById('state-empty').classList.add('hidden');
    document.getElementById('state-list').classList.remove('hidden');
  }
  if (readProgress.length === 6) document.getElementById('materials-final-block').classList.remove('hidden');
  else document.getElementById('materials-final-block').classList.add('hidden');

  CHAPTERS.forEach(ch => {
    const isRead = readProgress.includes(ch.id);
    const div = document.createElement('div');
    div.className = 'chapter-item';
    div.onclick = () => openReader(ch.id);
    div.innerHTML = `
      <div class="chapter-icon ${isRead ? 'read' : ''}">${isRead ? '✓' : (ch.isDiary ? '📘' : '0' + ch.id)}</div>
      <div class="chapter-info">
        <div class="chapter-title">${ch.isDiary ? ch.title : 'Глава ' + ch.id + '. ' + ch.title}</div>
        <div class="chapter-desc">${isRead ? 'Прочитано' : 'Доступно для чтения'}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

function calculateRank() {
  const chaptersRead = readProgress.filter(id => id <= 5).length;
  const chainCount = chainData.dates.length;
  const failCount = logsData.filter(l => l.fail && l.fail.trim() !== '').length;
  const score = (chaptersRead * 10) + chainCount + failCount;

  let title = 'Новичок', motto = 'Ты здесь. Начало положено. Не сливайся.';
  if (score >= 100) { title = 'Рыцарь'; motto = 'Ты построил систему. Теперь строй империю.'; }
  else if (score >= 50) { title = 'Воин'; motto = 'Дисциплина — твоё оружие. Ты в бою.'; }
  else if (score >= 25) { title = 'Страж'; motto = 'Ты держишь оборону. Не сдавай.'; }
  else if (score >= 10) { title = 'Оруженосец'; motto = 'Первый шаг сделан. Путь начался.'; }

  return { title, motto, score };
}

function getStreak(dates) {
  let streak = 0; let d = new Date();
  if (!dates.includes(getTodayKey())) d.setDate(d.getDate() - 1);
  while (true) {
    const k = d.toISOString().slice(0, 10);
    if (dates.includes(k)) { streak++; d.setDate(d.getDate() - 1); } else break;
  }
  return streak;
}

function renderChain() {
  const streak = getStreak(chainData.dates);
  const today = getTodayKey();
  document.getElementById('streakNum').textContent = streak + ' дн.';
  const box = document.getElementById('chainDots');
  box.innerHTML = '';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    const el = document.createElement('div');
    let className = 'dot';
    if (chainData.dates.includes(k)) className += ' done';
    else if (k === today) className += ' today';
    else className += ' missed';
    el.className = className;
    el.textContent = d.getDate();
    box.appendChild(el);
  }
  const msg = document.getElementById('chainMsg');
  if (chainData.dates.includes(today)) {
    msg.textContent = streak >= 7 ? 'Цепь держится. 7 дней. Это не случайность.' : 'Цепь жива. Ты сегодня уже воин.';
  } else {
    msg.textContent = streak === 0 ? 'Цепь пуста. Сделай разбор — и она начнётся.' : 'Цепь разорвана. Один день — ошибка. Два — привычка. Начни заново.';
  }
}

function setMark(mark) {
  hapticFeedback(); selectedMark = mark;
  document.querySelectorAll('.mark-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.mark-btn[data-mark="${mark}"]`).classList.add('active');
}

function saveReview() {
  hapticFeedback();
  const didInput = document.getElementById('review-did');
  const failInput = document.getElementById('review-fail');
  
  let did = didInput.value.trim().substring(0, 200);
  let fail = failInput.value.trim().substring(0, 200);
  
  if (!did && !fail) { showToast('Заполни хотя бы одно поле.'); return; }

  const today = getTodayKey();
  if (!chainData.dates.includes(today)) {
    chainData.dates.push(today); 
    chainData.dates.sort();
    saveToCloud('dk_chain', chainData);
  }
  
  logsData.unshift({ id: Date.now(), date: today, did: did || '—', fail: fail, mark: selectedMark });
  if (logsData.length > 15) logsData = logsData.slice(0, 15);
  
  saveToCloud('dk_logs', logsData);
  didInput.value = ''; 
  failInput.value = '';

  if (selectedMark === 'up') showToast('День выигран. Зафиксировано.');
  else if (selectedMark === 'down') showToast('Слив записан. Сделай выводы и вставай.');
  else showToast('Шаг сделан. Идём дальше.');

  renderProfileUI();
}

function renderProfileUI() {
  const chaptersRead = readProgress.filter(id => id <= 5).length;
  document.getElementById('stat-read').innerText = chaptersRead;
  document.getElementById('progress-bar').style.width = `${(Math.min(chaptersRead, 5) / 5) * 100}%`;

  const rank = calculateRank();
  document.getElementById('ui-rank').innerText = `${rank.title} • ${chainData.dates.length} дней в пути`;
  document.getElementById('ui-motto').innerText = rank.motto;

  renderChain(); renderCapsule(); renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (logsData.length === 0) { list.innerHTML = '<p class="history-empty">Пока нет записей.</p>'; return; }
  logsData.forEach(log => {
    const markIcon = log.mark === 'up' ? '▲' : log.mark === 'down' ? '▼' : '—';
    const markColor = log.mark === 'up' ? 'var(--success)' : log.mark === 'down' ? 'var(--danger)' : 'var(--text-muted)';
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-content">
        <div class="history-date">${log.date} <span style="color:${markColor}; margin-left:6px;">${markIcon}</span></div>
        <div class="history-text">Сделал: ${log.did}</div>
        ${log.fail ? `<div class="history-text">Слился: <span>${log.fail}</span></div>` : ''}
      </div>
      <button class="history-delete" onclick="deleteLog(${log.id})">×</button>
    `;
    list.appendChild(div);
  });
}

function deleteLog(id) {
  hapticFeedback();
  logsData = logsData.filter(l => l.id !== id);
  saveToCloud('dk_logs', logsData);
  renderProfileUI();
}

function renderCapsule() {
  const container = document.getElementById('capsule-container');
  if (!capsuleData) {
    container.innerHTML = `
      <h3>Капсула Рыцаря</h3>
      <p class="capsule-text">Напиши обещание себе. Оно откроется через 30 дней.</p>
      <input type="text" id="capsule-input" class="input-field" placeholder="Кем ты станешь через 30 дней? Одно обещание." maxlength="200">
      <button class="btn btn--primary" onclick="sealCapsule()">Запечатать капсулу</button>
    `;
  } else {
    const now = Date.now();
    if (now >= capsuleData.unlockAt) {
      container.innerHTML = `
        <h3>Капсула вскрыта</h3>
        <p class="capsule-text" style="color:var(--accent); font-style:italic;">«${capsuleData.text}»</p>
        <p class="capsule-text" style="font-size:12px;">Запечатано: ${new Date(capsuleData.created).toLocaleDateString('ru-RU')}</p>
        <button class="btn btn--danger" onclick="burnCapsule()">Сжечь капсулу</button>
      `;
    } else {
      container.innerHTML = `
        <h3>Капсула запечатана</h3>
        <p class="capsule-text">${new Date(capsuleData.created).toLocaleDateString('ru-RU')}. Ты обещал себе. Не подглядывать.</p>
        <button class="btn btn--danger" onclick="burnCapsule()">Сжечь капсулу</button>
      `;
    }
  }
}

function sealCapsule() {
  hapticFeedback();
  const input = document.getElementById('capsule-input');
  const text = input.value.trim().substring(0, 200);
  if (!text) return showToast('Напиши обещание.');
  const created = Date.now(); 
  const unlockAt = created + (30 * 24 * 60 * 60 * 1000);
  capsuleData = { text, created, unlockAt };
  saveToCloud('dk_capsule', capsuleData);
  showToast('Капсула запечатана. Увидимся через 30 дней.');
  renderCapsule();
}

function burnCapsule() {
  hapticFeedback(); 
  capsuleData = null;
  removeFromCloud('dk_capsule');
  showToast('Капсула сожжена.');
  renderCapsule();
}

function openReader(id) {
  currentChapterId = id;
  const chapter = CHAPTERS.find(c => c.id === id);
  document.getElementById('reader-title').innerText = chapter.isDiary ? chapter.title : `Глава ${id}. ${chapter.title}`;
  document.getElementById('reader-counter').innerText = chapter.isDiary ? 'Бонусный материал' : `Глава ${id} из 5`;
  document.getElementById('reader-content').innerHTML = chapter.isDiary ? chapter.text : `<p>${chapter.text}</p>`;
  
  if (tg) { tg.BackButton.show(); document.getElementById('btn-custom-back').style.display = 'none'; }
  
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-reader').classList.add('active');
  document.getElementById('bottom-nav').classList.add('hidden');
  document.getElementById('main-scroll').scrollTop = 0;
  
  if (readProgress.includes(id)) {
    document.getElementById('btn-mark-read').classList.add('hidden');
    document.getElementById('reader-action-block').classList.remove('active');
    showNavigationButtons(id);
  } else { resetButtons(); }
}

function closeReader() {
  document.getElementById('view-reader').classList.remove('active');
  document.getElementById('view-materials').classList.add('active');
  document.getElementById('bottom-nav').classList.remove('hidden');
  if (tg) { tg.BackButton.hide(); document.getElementById('btn-custom-back').style.display = 'flex'; }
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-target="view-materials"]').classList.add('active');
  renderChapterList(); 
}

function markAsRead() {
  hapticFeedback();
  if (!readProgress.includes(currentChapterId)) {
    readProgress.push(currentChapterId);
    saveToCloud('readProgress', readProgress);
    renderChapterList(); updateHomeScreen(); renderProfileUI();
  }
  document.getElementById('btn-mark-read').classList.add('hidden');
  const chapter = CHAPTERS.find(c => c.id === currentChapterId);
  if (chapter.isDiary) { showNavigationButtons(currentChapterId); } 
  else {
    document.getElementById('action-text').innerText = chapter.action;
    document.getElementById('reader-action-block').classList.add('active');
  }
}

function completeAction() {
  hapticFeedback();
  const btn = document.querySelector('#reader-action-block button');
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Выполнено ✓'; btn.style.background = 'var(--success)'; btn.style.color = '#FFF'; btn.style.borderColor = 'var(--success)';
  setTimeout(() => {
    document.getElementById('reader-action-block').classList.remove('active');
    showNavigationButtons(currentChapterId);
    setTimeout(() => {
      btn.innerHTML = originalText; btn.style.background = 'transparent'; btn.style.color = 'var(--text-main)'; btn.style.borderColor = 'var(--border)';
    }, 300);
  }, 600);
}

function showNavigationButtons(id) {
  if (id === 6) {
    document.getElementById('btn-full-version').classList.remove('hidden');
    document.getElementById('btn-back-list').classList.remove('hidden');
  } else {
    document.getElementById('btn-next-chapter').classList.remove('hidden');
    document.getElementById('btn-back-list').classList.remove('hidden');
  }
}

function nextChapter() { if (currentChapterId < 6) openReader(currentChapterId + 1); }

function resetButtons() {
  document.getElementById('btn-mark-read').classList.remove('hidden');
  document.getElementById('btn-next-chapter').classList.add('hidden');
  document.getElementById('btn-back-list').classList.add('hidden');
  document.getElementById('btn-full-version').classList.add('hidden');
  document.getElementById('reader-action-block').classList.remove('active');
}

function continueReading() {
  const chaptersRead = readProgress.filter(id => id <= 5).length;
  if (chaptersRead >= 5) { closeReader(); return; }
  let nextChapterId = 1;
  for (let i = 1; i <= 5; i++) { if (!readProgress.includes(i)) { nextChapterId = i; break; } }
  openReader(nextChapterId);
}

function switchTab(targetId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(targetId).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const targetBtn = document.querySelector(`.nav-item[data-target="${targetId}"]`);
  if (targetBtn) targetBtn.classList.add('active');
  document.getElementById('main-scroll').scrollTop = 0;
  if (targetId === 'view-profile') renderProfileUI();
}

if (tg) { tg.BackButton.onClick(() => { closeReader(); }); }

// Запуск с загрузкой данных
const safeInit = () => {
  if (initDone) return;
  initDone = true;
  try { init(); } catch (e) { console.error('Init error:', e); }
  document.getElementById('loader').classList.add('hidden');
};

loadAllData(safeInit);
setTimeout(safeInit, 3000);