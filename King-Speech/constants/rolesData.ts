import type { Lang } from "@/context/LangContext";

// ---------------------------------------------------------------------------
// Roles content model for the Show Time «Роли» section.
//
// A role is a life / professional scenario the player performs to train
// adaptability — entering a character, finding words and speaking confidently
// in any situation. Every role supports BOTH play modes:
//   - scripted  → a teleprompter text the player reads aloud
//   - improv    → a role + scene prompt the player improvises around
//
// Rarity is purely a DROP CHANCE for the random spin (higher dropWeight =
// lands more often). Manual grid selection ignores weight entirely.
// ---------------------------------------------------------------------------

export type RoleCategory = "sales" | "blogger" | "communication" | "public";
export type RoleRarity = "common" | "rare" | "legendary";
export type RoleMode = "scripted" | "improv";

export interface LocalizedText {
  ru: string;
  en: string;
}

export interface Role {
  id: string;
  category: RoleCategory;
  emoji: string;
  accent: string;
  rarity: RoleRarity;
  /** Higher = appears more often in the random spin. */
  dropWeight: number;
  title: LocalizedText;
  /** Short one-line description shown on the card. */
  desc: LocalizedText;
  /** Improvisation scene / condition the player reacts to. */
  scene: LocalizedText;
  /** Teleprompter text for scripted mode. */
  scriptedText: LocalizedText;
}

export interface CategoryMeta {
  id: RoleCategory;
  emoji: string;
  accent: string;
  label: LocalizedText;
}

export const ROLE_CATEGORIES: CategoryMeta[] = [
  {
    id: "sales",
    emoji: "💰",
    accent: "#F5A623",
    label: { ru: "Продажник", en: "Salesperson" },
  },
  {
    id: "blogger",
    emoji: "📱",
    accent: "#E84393",
    label: { ru: "Инста-блогер", en: "Influencer" },
  },
  {
    id: "communication",
    emoji: "☕",
    accent: "#00B894",
    label: { ru: "Сервис и общение", en: "Service & talk" },
  },
  {
    id: "public",
    emoji: "🎬",
    accent: "#6C5CE7",
    label: { ru: "Публичные профессии", en: "On stage" },
  },
];

export const RARITY_META: Record<
  RoleRarity,
  { label: LocalizedText; color: string; glow: string }
> = {
  common: {
    label: { ru: "Обычная", en: "Common" },
    color: "#9AA6B2",
    glow: "rgba(154,166,178,0.35)",
  },
  rare: {
    label: { ru: "Редкая", en: "Rare" },
    color: "#4DA3FF",
    glow: "rgba(77,163,255,0.5)",
  },
  legendary: {
    label: { ru: "Легендарная", en: "Legendary" },
    color: "#FFC01E",
    glow: "rgba(255,192,30,0.6)",
  },
};

// Weight per rarity — the random spin favours common roles heavily; legendary
// roles land rarely, which makes unlocking one feel special.
export const RARITY_WEIGHT: Record<RoleRarity, number> = {
  common: 100,
  rare: 28,
  legendary: 7,
};

export const ROLES: Role[] = [
  // ---------------------------- SALES ----------------------------
  {
    id: "ice-cream",
    category: "sales",
    emoji: "🍦",
    accent: "#F5A623",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Продавец мороженого", en: "Ice-cream seller" },
    desc: { ru: "Продай стаканчик так, чтобы его захотели прямо сейчас", en: "Sell a scoop they crave right now" },
    scene: {
      ru: "Жаркий день, к тебе подходит уставший прохожий. Продай ему мороженое так, чтобы он ушёл счастливым.",
      en: "A hot day, a tired passer-by walks up. Sell them ice-cream so they leave happy.",
    },
    scriptedText: {
      ru: "Дамы и господа! Только сегодня — самое вкусное мороженое в городе. Нежный пломбир тает на языке, а свежая ягода будит вкус. Один стаканчик — и жара отступает. Побалуйте себя: вы это заслужили!",
      en: "Ladies and gentlemen! Today only — the tastiest ice-cream in town. Silky vanilla melts on your tongue, fresh berries wake up the taste. One cup and the heat backs off. Treat yourself — you deserve it!",
    },
  },
  {
    id: "car",
    category: "sales",
    emoji: "🚗",
    accent: "#F5A623",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Автодилер", en: "Car dealer" },
    desc: { ru: "Продай машину мечты сомневающемуся клиенту", en: "Sell the dream car to a hesitant buyer" },
    scene: {
      ru: "Клиент любуется машиной, но боится цены. Убеди его, что это лучшая инвестиция в его жизнь.",
      en: "A client admires the car but fears the price. Convince them it's the best investment of their life.",
    },
    scriptedText: {
      ru: "Взгляните на эти линии — она создана, чтобы восхищать. Мощный и экономичный мотор, салон, в котором хочется остаться. Это не просто машина — это ваша свобода на каждый день. Сядьте за руль, и вы всё поймёте сами.",
      en: "Look at these lines — she was built to impress. A powerful yet efficient engine, a cabin you won't want to leave. This isn't just a car — it's your everyday freedom. Take the wheel and you'll feel it yourself.",
    },
  },
  {
    id: "apartment",
    category: "sales",
    emoji: "🏠",
    accent: "#F5A623",
    rarity: "rare",
    dropWeight: RARITY_WEIGHT.rare,
    title: { ru: "Риелтор", en: "Real-estate agent" },
    desc: { ru: "Покажи квартиру так, будто это дом мечты", en: "Show the flat like it's the dream home" },
    scene: {
      ru: "Молодая пара выбирает первую квартиру. Проведи экскурсию так, чтобы они влюбились в неё.",
      en: "A young couple is choosing their first flat. Give a tour that makes them fall in love with it.",
    },
    scriptedText: {
      ru: "Добро пожаловать домой. Здесь по утрам солнце заливает кухню, а вечером город мерцает за окном. Просторно, тихо, уютно — место, где начинается новая жизнь. Представьте, как здесь будет звучать ваш смех.",
      en: "Welcome home. Here the morning sun floods the kitchen, and at night the city glimmers outside. Spacious, quiet, cosy — a place where a new life begins. Imagine your laughter filling these rooms.",
    },
  },
  {
    id: "handbag",
    category: "sales",
    emoji: "👜",
    accent: "#F5A623",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Бутик сумок", en: "Handbag boutique" },
    desc: { ru: "Преврати сумочку в предмет желания", en: "Turn a handbag into an object of desire" },
    scene: {
      ru: "Покупательница колеблется между двумя сумками. Помоги ей выбрать и почувствовать себя особенной.",
      en: "A shopper hesitates between two bags. Help her choose and feel special.",
    },
    scriptedText: {
      ru: "Эта сумочка — маленькое произведение искусства. Мягкая кожа, идеальные строчки, фурнитура, что ловит взгляды. Она подчеркнёт ваш стиль в любой день. С ней вы не просто выходите — вы появляетесь.",
      en: "This bag is a little work of art. Soft leather, perfect stitching, hardware that catches the eye. It will underline your style any day. With it you don't just walk in — you arrive.",
    },
  },
  {
    id: "pen",
    category: "sales",
    emoji: "🖊️",
    accent: "#F5A623",
    rarity: "legendary",
    dropWeight: RARITY_WEIGHT.legendary,
    title: { ru: "Продай мне ручку", en: "Sell me this pen" },
    desc: { ru: "Легендарный вызов: продай обычную ручку", en: "The legendary challenge: sell a plain pen" },
    scene: {
      ru: "Классика продаж. Перед тобой человек, которому «не нужна ручка». Сделай так, чтобы она стала ему необходима.",
      en: "The sales classic. In front of you a person who 'doesn't need a pen'. Make it a must-have.",
    },
    scriptedText: {
      ru: "Позвольте вопрос: когда вы в последний раз записывали важную мысль? Идеи приходят внезапно — и уходят, если их нечем поймать. Эта ручка пишет мягко, уверенно, не подведёт в нужный момент. Возьмите её — и ни одна ваша идея больше не потеряется.",
      en: "Let me ask: when did you last write down an important thought? Ideas come suddenly — and vanish if you can't catch them. This pen writes smoothly, confidently, never fails you in the moment. Take it — and no idea of yours will ever be lost again.",
    },
  },

  // ---------------------------- BLOGGER ----------------------------
  {
    id: "beauty",
    category: "blogger",
    emoji: "💄",
    accent: "#E84393",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Бьюти-блогер", en: "Beauty blogger" },
    desc: { ru: "Проведи прямой эфир про уход и макияж", en: "Go live about skincare and makeup" },
    scene: {
      ru: "Ты в прямом эфире. Расскажи подписчикам про свой любимый бьюти-ритуал и почему он меняет всё.",
      en: "You're live. Tell followers about your favourite beauty ritual and why it changes everything.",
    },
    scriptedText: {
      ru: "Привет, мои хорошие! Сегодня секрет сияющей кожи. Всё начинается с бережного очищения, потом — капелька увлажнения. Не гонитесь за трендами — слушайте своё лицо. Красота — это забота, а не борьба.",
      en: "Hi my loves! Today — the secret to glowing skin. It starts with gentle cleansing, then a drop of moisture. Don't chase trends — listen to your face. Beauty is care, not a battle.",
    },
  },
  {
    id: "humor",
    category: "blogger",
    emoji: "😂",
    accent: "#E84393",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Юмор-блогер", en: "Comedy blogger" },
    desc: { ru: "Рассмеши аудиторию за 30 секунд", en: "Make the audience laugh in 30 seconds" },
    scene: {
      ru: "Сними смешной сторис о том, как прошло твоё утро. Заряди подписчиков хорошим настроением.",
      en: "Film a funny story about how your morning went. Charge your followers with a good mood.",
    },
    scriptedText: {
      ru: "Так, ребят, история дня! Просыпаюсь я бодрый, полный планов… и понимаю, что проспал всё на свете. Кофе убежал, кот обиделся, будильник злорадствует. Но знаете что? Улыбка — лучший способ отомстить понедельнику!",
      en: "Okay folks, story of the day! I wake up fresh, full of plans… and realise I overslept everything. The coffee ran off, the cat took offence, the alarm is gloating. But you know what? A smile is the best revenge on Monday!",
    },
  },
  {
    id: "business",
    category: "blogger",
    emoji: "📈",
    accent: "#E84393",
    rarity: "rare",
    dropWeight: RARITY_WEIGHT.rare,
    title: { ru: "Бизнес-блогер", en: "Business blogger" },
    desc: { ru: "Дай мотивирующий совет предпринимателям", en: "Give a motivating tip to entrepreneurs" },
    scene: {
      ru: "Запиши мотивационное видео для начинающих предпринимателей: один урок, который ты усвоил на своём пути.",
      en: "Record a motivational clip for new entrepreneurs: one lesson you learned on your path.",
    },
    scriptedText: {
      ru: "Друзья, главный урок бизнеса прост: начинайте до того, как будете готовы. Идеального момента не существует — есть только шаг, который вы делаете сегодня. Ошибки не провал, а данные. Действуйте, учитесь, повторяйте.",
      en: "Friends, the main lesson of business is simple: start before you feel ready. The perfect moment doesn't exist — there's only the step you take today. Mistakes aren't failure, they're data. Act, learn, repeat.",
    },
  },
  {
    id: "cinema",
    category: "blogger",
    emoji: "🎥",
    accent: "#E84393",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Кино-обзорщик", en: "Movie reviewer" },
    desc: { ru: "Расскажи о фильме так, чтобы захотелось посмотреть", en: "Review a film so people must watch it" },
    scene: {
      ru: "Сделай обзор своего любимого фильма без спойлеров — так, чтобы зритель нажал «смотреть» сразу.",
      en: "Review your favourite film with no spoilers — so the viewer hits 'play' at once.",
    },
    scriptedText: {
      ru: "Есть фильмы, а есть переживания — и это второе. С первых минут тебя затягивает, а финал не отпускает ещё неделю. Игра актёров живая, музыка бьёт в самое сердце. Посмотрите — и вы поймёте, о чём я.",
      en: "There are films, and there are experiences — this is the second. It grabs you from the first minutes, and the ending stays with you for a week. The acting is alive, the score hits right in the heart. Watch it — and you'll get what I mean.",
    },
  },
  {
    id: "eco",
    category: "blogger",
    emoji: "🌿",
    accent: "#E84393",
    rarity: "rare",
    dropWeight: RARITY_WEIGHT.rare,
    title: { ru: "Эко-блогер", en: "Eco blogger" },
    desc: { ru: "Вдохнови подписчиков жить экологичнее", en: "Inspire followers to live greener" },
    scene: {
      ru: "Расскажи о простой привычке, которая помогает планете, и вдохнови людей начать сегодня.",
      en: "Tell about one simple habit that helps the planet and inspire people to start today.",
    },
    scriptedText: {
      ru: "Планета не нуждается в героях — ей нужны миллионы неравнодушных. Одна многоразовая бутылка, один отказ от лишнего пакета — и мир чуть чище. Маленькие шаги складываются в большое будущее. Начните с одного — сегодня.",
      en: "The planet doesn't need heroes — it needs millions who care. One reusable bottle, one bag you refuse — and the world is a little cleaner. Small steps add up to a big future. Start with one — today.",
    },
  },
  {
    id: "cooking",
    category: "blogger",
    emoji: "🍳",
    accent: "#E84393",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Кулинарный блогер", en: "Cooking blogger" },
    desc: { ru: "Проведи вкусный мастер-класс в эфире", en: "Host a tasty cooking class live" },
    scene: {
      ru: "Готовишь в прямом эфире. Расскажи свой любимый рецерт так, чтобы у зрителей потекли слюнки.",
      en: "You're cooking live. Share your favourite recipe so the viewers' mouths water.",
    },
    scriptedText: {
      ru: "Друзья, готовим блюдо, от которого влюбится вся семья! Немного тепла сковороды, аромат свежих трав — и кухня оживает. Секрет один: готовьте с удовольствием, и вкус это почувствует. Приятного аппетита заранее!",
      en: "Friends, we're cooking a dish the whole family will fall for! A little warmth from the pan, the aroma of fresh herbs — and the kitchen comes alive. One secret: cook with joy and the taste will feel it. Bon appétit in advance!",
    },
  },
  {
    id: "travel",
    category: "blogger",
    emoji: "✈️",
    accent: "#E84393",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Тревел-блогер", en: "Travel blogger" },
    desc: { ru: "Опиши место так, будто зритель уже там", en: "Describe a place like they're already there" },
    scene: {
      ru: "Ты стоишь в самом красивом месте своей поездки. Опиши его так, чтобы зритель захотел собрать чемодан.",
      en: "You're standing in the most beautiful spot of your trip. Describe it so the viewer wants to pack a suitcase.",
    },
    scriptedText: {
      ru: "Представьте: солёный ветер, бесконечный горизонт и город, который никогда не спит. Здесь каждый переулок — открытие, а каждый закат — маленькое чудо. Путешествие меняет нас изнутри. Соберите чемодан — приключение уже ждёт.",
      en: "Picture this: salty wind, an endless horizon and a city that never sleeps. Here every alley is a discovery, every sunset a small miracle. Travel changes us from within. Pack your bag — the adventure is already waiting.",
    },
  },
  {
    id: "lifestyle",
    category: "blogger",
    emoji: "🌸",
    accent: "#E84393",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Лайфстайл-блогер", en: "Lifestyle blogger" },
    desc: { ru: "Поделись утренним ритуалом продуктивности", en: "Share your productive morning ritual" },
    scene: {
      ru: "Расскажи подписчикам, как ты начинаешь идеальное утро и что помогает тебе быть в ресурсе.",
      en: "Tell followers how you start a perfect morning and what keeps you energised.",
    },
    scriptedText: {
      ru: "Доброе утро, друзья! Мой день начинается не с телефона, а со стакана воды и пары глубоких вдохов. Пять минут тишины — и голова ясная, а планы по местам. Заботьтесь о себе с утра, и день ответит вам тем же.",
      en: "Good morning, friends! My day starts not with the phone but with a glass of water and a few deep breaths. Five minutes of silence — and the mind is clear, the plans in place. Care for yourself in the morning and the day repays you.",
    },
  },

  // ------------------------- COMMUNICATION -------------------------
  {
    id: "barista",
    category: "communication",
    emoji: "☕",
    accent: "#00B894",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Бариста", en: "Barista" },
    desc: { ru: "Встреть гостя тепло и посоветуй напиток", en: "Greet a guest warmly and suggest a drink" },
    scene: {
      ru: "К стойке подходит уставший гость. Подними ему настроение и посоветуй идеальный напиток.",
      en: "A tired guest steps up to the counter. Lift their mood and suggest the perfect drink.",
    },
    scriptedText: {
      ru: "Доброе утро! Рад вас видеть в нашей кофейне. Сегодня советую капучино на мягком молоке — тёплый, бархатный, как раз под настроение. Устраивайтесь поудобнее, а я сделаю ваш день чуточку вкуснее.",
      en: "Good morning! Great to see you at our café. Today I'd suggest a cappuccino on silky milk — warm, velvety, just right for the mood. Get comfortable, and I'll make your day a little tastier.",
    },
  },
  {
    id: "stewardess",
    category: "communication",
    emoji: "🛫",
    accent: "#00B894",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Бортпроводник", en: "Flight attendant" },
    desc: { ru: "Успокой и поприветствуй пассажиров на борту", en: "Welcome and reassure passengers on board" },
    scene: {
      ru: "Пассажир нервничает перед полётом. Поприветствуй салон и помоги всем почувствовать себя спокойно.",
      en: "A passenger is nervous before the flight. Welcome the cabin and help everyone feel calm.",
    },
    scriptedText: {
      ru: "Дамы и господа, добро пожаловать на борт! Меня зовут Алекс, и наша команда позаботится о вашем комфорте. Пристегните ремни, откиньтесь в кресле и доверьтесь полёту. Мы желаем вам приятного путешествия и мягкой посадки.",
      en: "Ladies and gentlemen, welcome aboard! My name is Alex, and our crew will take care of your comfort. Fasten your seatbelts, lean back and trust the flight. We wish you a pleasant journey and a smooth landing.",
    },
  },
  {
    id: "reception",
    category: "communication",
    emoji: "🛎️",
    accent: "#00B894",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Ресепшн отеля", en: "Hotel reception" },
    desc: { ru: "Заряди гостя гостеприимством при заселении", en: "Charm a guest with hospitality at check-in" },
    scene: {
      ru: "Гость приехал уставший после долгой дороги. Заселяй его так, чтобы он сразу почувствовал заботу.",
      en: "A guest arrives tired after a long trip. Check them in so they instantly feel cared for.",
    },
    scriptedText: {
      ru: "Добро пожаловать в наш отель! Рады, что вы выбрали именно нас. Ваш номер уже готов — с прекрасным видом и всем для отдыха. Если что-то понадобится, я всегда на связи. Отдыхайте, вы дома.",
      en: "Welcome to our hotel! We're glad you chose us. Your room is ready — with a lovely view and everything for a rest. If you need anything, I'm always here. Relax, you're home.",
    },
  },
  {
    id: "consultant",
    category: "communication",
    emoji: "🛍️",
    accent: "#00B894",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Консультант в магазине", en: "Shop assistant" },
    desc: { ru: "Помоги покупателю выбрать без давления", en: "Help a shopper choose without pressure" },
    scene: {
      ru: "Покупатель растерян и не знает, что выбрать. Задай пару вопросов и помоги ему без навязывания.",
      en: "A shopper is lost and unsure what to pick. Ask a couple of questions and help without pushing.",
    },
    scriptedText: {
      ru: "Здравствуйте! Вижу, вы присматриваетесь — давайте помогу. Расскажите, что для вас важнее: удобство или стиль? У нас есть отличные варианты под любой вкус. Никакой спешки — выберем то, что подойдёт именно вам.",
      en: "Hello! I see you're looking around — let me help. Tell me what matters more to you: comfort or style? We have great options for any taste. No rush — we'll find what's right for you.",
    },
  },
  {
    id: "manager",
    category: "communication",
    emoji: "🤝",
    accent: "#00B894",
    rarity: "rare",
    dropWeight: RARITY_WEIGHT.rare,
    title: { ru: "Менеджер по клиентам", en: "Account manager" },
    desc: { ru: "Успокой недовольного клиента и реши вопрос", en: "Calm an upset client and solve the issue" },
    scene: {
      ru: "Клиент недоволен и раздражён. Выслушай, признай проблему и уверенно предложи решение.",
      en: "A client is unhappy and irritated. Listen, acknowledge the problem and confidently offer a solution.",
    },
    scriptedText: {
      ru: "Я вас понимаю и благодарю, что рассказали о ситуации. Мне правда важно, чтобы вы остались довольны. Давайте так: я беру вопрос под личный контроль и решаю его сегодня. Спасибо за терпение — мы всё исправим.",
      en: "I understand you, and thank you for telling me about it. It really matters to me that you stay satisfied. Here's the plan: I'll take this personally and resolve it today. Thank you for your patience — we'll make it right.",
    },
  },

  // ---------------------------- PUBLIC ----------------------------
  {
    id: "weather",
    category: "public",
    emoji: "🌦️",
    accent: "#6C5CE7",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Ведущий прогноза погоды", en: "Weather presenter" },
    desc: { ru: "Расскажи прогноз бодро и с характером", en: "Deliver the forecast bright and with character" },
    scene: {
      ru: "Ты в прямом эфире новостей. Расскажи прогноз погоды на завтра живо и с энергией.",
      en: "You're on live news. Present tomorrow's forecast with life and energy.",
    },
    scriptedText: {
      ru: "Добрый вечер! И сразу к погоде. Завтра нас ждёт солнечное утро и лёгкий ветер — идеально для прогулки. Ближе к вечеру возможен короткий дождь, так что зонт не помешает. Хороших вам дней и отличного настроения!",
      en: "Good evening! And straight to the weather. Tomorrow brings a sunny morning and a light breeze — perfect for a walk. A short shower is possible in the evening, so an umbrella won't hurt. Have great days and a wonderful mood!",
    },
  },
  {
    id: "showman",
    category: "public",
    emoji: "🎤",
    accent: "#6C5CE7",
    rarity: "rare",
    dropWeight: RARITY_WEIGHT.rare,
    title: { ru: "Шоумен", en: "Showman" },
    desc: { ru: "Заведи толпу и удержи всё внимание зала", en: "Fire up the crowd and hold the room" },
    scene: {
      ru: "Полный зал ждёт начала шоу. Выйди на сцену и заряди публику так, чтобы все были на ногах.",
      en: "A full house waits for the show. Step out and fire up the crowd until everyone's on their feet.",
    },
    scriptedText: {
      ru: "Дамы и господа, вы готовы?! Я вас не слышу! Сегодня вечер, который вы запомните надолго! Улыбки шире, руки выше — и пусть эта энергия наполнит весь зал! Поехали, это будет незабываемо!",
      en: "Ladies and gentlemen, are you ready?! I can't hear you! Tonight is a night you'll remember for a long time! Smiles wider, hands higher — let this energy fill the whole room! Let's go, this will be unforgettable!",
    },
  },
  {
    id: "host",
    category: "public",
    emoji: "🎙️",
    accent: "#6C5CE7",
    rarity: "common",
    dropWeight: RARITY_WEIGHT.common,
    title: { ru: "Ведущий мероприятия", en: "Event host" },
    desc: { ru: "Открой торжество тепло и уверенно", en: "Open a celebration warmly and confidently" },
    scene: {
      ru: "Ты открываешь торжественный вечер. Поприветствуй гостей и создай праздничное настроение.",
      en: "You're opening a gala evening. Welcome the guests and set a festive mood.",
    },
    scriptedText: {
      ru: "Дорогие гости, добрый вечер и добро пожаловать! Сегодня особенный день, и я счастлив разделить его с вами. Впереди тёплые слова, музыка и незабываемые моменты. Устраивайтесь удобнее — наш праздник начинается!",
      en: "Dear guests, good evening and welcome! Today is a special day, and I'm happy to share it with you. Ahead are warm words, music and unforgettable moments. Get comfortable — our celebration begins!",
    },
  },
  {
    id: "comedian",
    category: "public",
    emoji: "🎭",
    accent: "#6C5CE7",
    rarity: "rare",
    dropWeight: RARITY_WEIGHT.rare,
    title: { ru: "Стендап-комик", en: "Stand-up comedian" },
    desc: { ru: "Выйди на сцену и рассмеши зал", en: "Take the stage and make the room laugh" },
    scene: {
      ru: "Ты на сцене комедийного клуба. Расскажи забавную наблюдательную историю из обычной жизни.",
      en: "You're on a comedy club stage. Tell a funny, observational story from everyday life.",
    },
    scriptedText: {
      ru: "Всем привет! Вы когда-нибудь замечали, что холодильник — единственное место, куда мы заглядываем по десять раз в надежде на чудо? Открываешь — пусто. Закрываешь. Открываешь снова — вдруг там что-то появилось! Логика на нуле, но надежда бессмертна!",
      en: "Hey everyone! Have you ever noticed the fridge is the only place we check ten times hoping for a miracle? You open it — empty. Close it. Open again — maybe something appeared! Logic is zero, but hope is immortal!",
    },
  },
  {
    id: "moviestar",
    category: "public",
    emoji: "🌟",
    accent: "#6C5CE7",
    rarity: "legendary",
    dropWeight: RARITY_WEIGHT.legendary,
    title: { ru: "Кинозвезда", en: "Movie star" },
    desc: { ru: "Дай интервью на красной дорожке", en: "Give an interview on the red carpet" },
    scene: {
      ru: "Ты на красной дорожке премьеры. Журналисты спрашивают о новом фильме — отвечай ярко и обаятельно.",
      en: "You're on the premiere's red carpet. Reporters ask about your new film — answer bright and charming.",
    },
    scriptedText: {
      ru: "Спасибо, я невероятно счастлив быть здесь сегодня. Этот фильм — работа моей мечты, и каждый кадр в нём сделан с любовью. Огромное спасибо команде и, конечно, вам — зрителям. Без вашей поддержки этой магии бы не случилось.",
      en: "Thank you, I'm incredibly happy to be here tonight. This film is my dream project, and every frame was made with love. A huge thank-you to the crew and, of course, to you — the audience. Without your support this magic wouldn't have happened.",
    },
  },
  {
    id: "voice-actor",
    category: "public",
    emoji: "🎬",
    accent: "#6C5CE7",
    rarity: "rare",
    dropWeight: RARITY_WEIGHT.rare,
    title: { ru: "Актёр озвучки", en: "Voice actor" },
    desc: { ru: "Оживи персонажа только голосом", en: "Bring a character to life with voice alone" },
    scene: {
      ru: "Ты озвучиваешь героя мультфильма. Прочитай реплику так, чтобы персонаж ожил и зазвучал по-настоящему.",
      en: "You're voicing a cartoon hero. Read the line so the character comes alive and truly sounds real.",
    },
    scriptedText: {
      ru: "А-ха-ха! Так вы думали, что справитесь без меня? Ну уж нет, мои дорогие друзья! Сегодня мы отправимся в самое великое приключение всех времён! Держитесь крепче — и вперёд, к невероятному!",
      en: "A-ha-ha! So you thought you'd manage without me? Oh no, my dear friends! Today we set off on the greatest adventure of all time! Hold on tight — and onward, to the incredible!",
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function tx(text: LocalizedText, lang: Lang): string {
  return text[lang] ?? text.ru;
}

export function getRoleById(id: string): Role | undefined {
  return ROLES.find((r) => r.id === id);
}

export function getRolesByCategory(category: RoleCategory): Role[] {
  return ROLES.filter((r) => r.category === category);
}

/**
 * Weighted random pick for the spin. Higher dropWeight → lands more often, so
 * legendary roles are genuinely rare rewards. Optionally bias the wheel to a
 * subset (e.g. one category) by passing a pre-filtered pool.
 */
export function pickWeightedRole(pool: Role[] = ROLES): Role {
  const total = pool.reduce((sum, r) => sum + Math.max(1, r.dropWeight), 0);
  let ticket = Math.random() * total;
  for (const role of pool) {
    ticket -= Math.max(1, role.dropWeight);
    if (ticket <= 0) return role;
  }
  return pool[pool.length - 1];
}

/**
 * A shuffled reel used to animate the spin — the visible strip that flies past
 * before landing on `winner`. The winner is placed at the end so the reel can
 * decelerate onto it.
 */
export function buildSpinReel(winner: Role, length = 24): Role[] {
  const reel: Role[] = [];
  for (let i = 0; i < length - 1; i++) {
    reel.push(ROLES[Math.floor(Math.random() * ROLES.length)]);
  }
  reel.push(winner);
  return reel;
}
