import type { MannersRule } from "@/constants/mannersData";

export const PACK: MannersRule[] = [
  {
    id: "trip-plane-recline",
    icon: "airplane",
    title: {
      ru: "Откинуть кресло в самолёте",
      en: "Reclining your plane seat",
      kk: "Ұшақта орындықты шалқайту",
    },
    rule: {
      ru: "Откидывай спинку плавно и не во время еды — сначала взгляни назад",
      en: "Recline slowly and not during meals — glance behind you first",
      kk: "Арқалықты баяу және ас кезінде емес шалқайт — алдымен артыңа қара",
    },
    question: {
      ru: "Ночной рейс на 7 часов, только что начали разносить ужин. Ты устал и хочешь откинуть кресло, а сзади сидит Анна. Как поступишь?",
      en: "A 7-hour night flight, and dinner service has just started. You’re tired and want to recline, and Anna is sitting behind you. What do you do?",
      kk: "7 сағаттық түнгі рейс, кешкі ас енді ғана таратыла бастады. Шаршадың, орындықты шалқайтқың келеді, ал артыңда Анна отыр. Не істейсің?",
    },
    options: [
      {
        ru: "Откину сразу — это моё место и моя кнопка",
        en: "Recline right away — it’s my seat and my button",
        kk: "Бірден шалқайтамын — бұл менің орным, менің түймем",
      },
      {
        ru: "Не буду откидывать весь полёт, чтобы никому не мешать",
        en: "Not recline at all this flight so I don’t bother anyone",
        kk: "Ешкімге кедергі болмас үшін бүкіл рейсте шалқайтпаймын",
      },
      {
        ru: "Дождусь, пока уберут подносы, оглянусь и откину плавно",
        en: "Wait until trays are cleared, glance back, then recline slowly",
        kk: "Науалар жиналғанша күтіп, артыма қарап, баяу шалқайтамын",
      },
      {
        ru: "Попрошу бортпроводника разрешить мне откинуться",
        en: "Ask the flight attendant for permission to recline",
        kk: "Бортсеріктен шалқайтуға рұқсат сұраймын",
      },
    ],
    correct: 2,
    why: {
      ru: "Откидывать кресло на долгом ночном рейсе нормально, но во время еды спинка упирается в поднос соседа. Дождись конца ужина, коротко оглянись и опускай медленно — и тебе удобно, и у Анны не прольётся чай.",
      en: "Reclining on a long night flight is fine, but during a meal the seat back hits the tray behind you. Wait until dinner is over, glance back and lower it slowly — you get comfortable and Anna’s tea stays in its cup.",
      kk: "Ұзақ түнгі рейсте орындықты шалқайту — қалыпты нәрсе, бірақ ас кезінде арқалық артқы адамның науасына тиеді. Ас біткенше күт, артыңа бір қарап ал да, баяу түсір — өзіңе де жайлы, Аннаның шайы да төгілмейді.",
    },
    notes: [
      {
        ru: "Право у тебя есть, но во время ужина это опрокинет поднос Анны.",
        en: "You have the right, but mid-dinner it could tip over Anna’s tray.",
        kk: "Құқығың бар, бірақ ас кезінде Аннаның науасы аударылып кетуі мүмкін.",
      },
      {
        ru: "Слишком жертвенно: на ночном рейсе откидываться нормально.",
        en: "Too self-sacrificing: reclining on a night flight is normal.",
        kk: "Тым артық құрбандық: түнгі рейсте шалқаю — қалыпты жағдай.",
      },
      {
        ru: "Верно: учтены и момент, и человек за тобой.",
        en: "Right: you considered both the timing and the person behind you.",
        kk: "Дұрыс: уақыты да, артыңдағы адам да ескерілді.",
      },
      {
        ru: "Разрешение экипажа не нужно — нужна деликатность к соседу.",
        en: "You don’t need the crew’s permission — just consideration for your neighbor.",
        kk: "Экипаждың рұқсаты керек емес — көршіге деген ізет керек.",
      },
    ],
    kind: "hard",
  },
  {
    id: "trip-window-shade",
    icon: "airplane",
    title: {
      ru: "Шторка перед посадкой",
      en: "The window shade before landing",
      kk: "Қонар алдындағы терезе қалқаны",
    },
    rule: {
      ru: "Просьба экипажа о безопасности важнее чужого сна",
      en: "A crew safety request outranks a neighbor’s nap",
      kk: "Экипаждың қауіпсіздік туралы өтініші өзгенің ұйқысынан маңызды",
    },
    question: {
      ru: "Ты у окна, сосед Макс спит, шторка закрыта. Перед посадкой бортпроводник просит всех поднять шторки. Что сделаешь?",
      en: "You’re in the window seat, your neighbor Max is asleep, and the shade is down. Before landing, the flight attendant asks everyone to open their shades. What do you do?",
      kk: "Терезе жанында отырсың, көршің Макс ұйықтап жатыр, қалқан жабық. Қонар алдында бортсерік барлығынан қалқандарды ашуды сұрайды. Не істейсің?",
    },
    options: [
      {
        ru: "Тихо подниму шторку — это требование безопасности",
        en: "Quietly open the shade — it’s a safety requirement",
        kk: "Қалқанды ақырын ашамын — бұл қауіпсіздік талабы",
      },
      {
        ru: "Оставлю закрытой, чтобы не разбудить Макса",
        en: "Leave it closed so I don’t wake Max",
        kk: "Макс оянып кетпесін деп жабық қалдырамын",
      },
      {
        ru: "Разбужу Макса и спрошу, можно ли поднять",
        en: "Wake Max and ask if I may open it",
        kk: "Максты оятып, ашуға бола ма деп сұраймын",
      },
      {
        ru: "Подниму наполовину — так всем будет нормально",
        en: "Open it halfway — a fair compromise for everyone",
        kk: "Жартылай ашамын — бәріне де ыңғайлы болады",
      },
    ],
    correct: 0,
    why: {
      ru: "На взлёте и посадке шторки поднимают, чтобы экипаж видел, что происходит снаружи, а глаза пассажиров привыкли к свету. Это не вопрос вкуса, а безопасность: спрашивать соседа не нужно, достаточно сделать это тихо.",
      en: "Shades go up for takeoff and landing so the crew can see outside and passengers’ eyes adjust to the light. It’s a safety rule, not a matter of taste: no need to ask your neighbor, just do it quietly.",
      kk: "Ұшу мен қону кезінде қалқандарды ашады: экипаж сыртта не болып жатқанын көруі, ал жолаушылардың көзі жарыққа үйренуі керек. Бұл талғам емес, қауіпсіздік мәселесі — көршіден сұраудың қажеті жоқ, тек ақырын ашсаң болды.",
    },
  },
  {
    id: "trip-tip-japan",
    icon: "restaurant",
    title: {
      ru: "Чаевые в Японии",
      en: "Tipping in Japan",
      kk: "Жапониядағы шайпұл",
    },
    rule: {
      ru: "Где чаевые не приняты, благодари словами",
      en: "Where tipping isn’t the custom, thank people with words",
      kk: "Шайпұл берілмейтін жерде сөзбен алғыс айт",
    },
    question: {
      ru: "Ты в Токио, ужин в маленьком ресторане был прекрасен. Дома ты всегда оставляешь 10% чаевых. Как отблагодаришь здесь?",
      en: "You’re in Tokyo, and dinner at a small restaurant was wonderful. At home you always leave a 10% tip. How do you say thanks here?",
      kk: "Токиодасың, шағын мейрамханадағы кешкі ас керемет болды. Үйде әрдайым 10% шайпұл қалдырасың. Мұнда қалай алғыс білдіресің?",
    },
    options: [
      {
        ru: "Оставлю 10% на столе — щедрость понятна везде",
        en: "Leave 10% on the table — generosity is understood everywhere",
        kk: "Үстелге 10% қалдырамын — жомарттықты бәрі түсінеді",
      },
      {
        ru: "Незаметно вложу купюру официанту в руку",
        en: "Discreetly slip a bill into the server’s hand",
        kk: "Даяшының қолына білдіртпей ақша ұстатамын",
      },
      {
        ru: "Попрошу добавить чаевые к счёту",
        en: "Ask them to add a tip to the bill",
        kk: "Шотқа шайпұл қосуды сұраймын",
      },
      {
        ru: "Поблагодарю вслух с лёгким поклоном, без чаевых",
        en: "Thank them out loud with a slight bow, no tip",
        kk: "Сәл иіліп, дауыстап алғыс айтамын, шайпұлсыз",
      },
    ],
    correct: 3,
    why: {
      ru: "Подвох: «щедрость» здесь не к месту. В Японии чаевые не приняты — хороший сервис считается нормой, а оставленные деньги официант может побежать тебе возвращать. Лучшая благодарность — «Гочисо:сама дэсита» («Спасибо за угощение») и лёгкий поклон.",
      en: "The catch: “generosity” is out of place here. Tipping isn’t customary in Japan — good service is simply the norm, and a server may chase you down to return money left on the table. The best thanks is “Gochisōsama deshita” (“Thank you for the meal”) and a slight bow.",
      kk: "Тұзақ: мұнда «жомарттық» орынсыз. Жапонияда шайпұл беру әдетке жатпайды — жақсы қызмет қалыпты нәрсе саналады, ал үстелде қалған ақшаны даяшы саған қайтаруға жүгіріп шығуы мүмкін. Ең жақсы алғыс — «Гочисосама дэсита» («Дәмге рақмет») деп, сәл иілу.",
    },
    notes: [
      {
        ru: "Деньги на столе сочтут забытыми — тебя могут догнать на улице.",
        en: "Money on the table looks forgotten — someone may run after you.",
        kk: "Үстелдегі ақшаны ұмытылған деп ойлайды — артыңнан қуып жетуі мүмкін.",
      },
      {
        ru: "Неловко для обеих сторон: в Японии так не делают.",
        en: "Awkward for both sides: it just isn’t done in Japan.",
        kk: "Екі жаққа да ыңғайсыз: Жапонияда бұлай істемейді.",
      },
      {
        ru: "В обычном ресторане такой строки в счёте просто нет.",
        en: "An ordinary restaurant simply has no tip line on the bill.",
        kk: "Қарапайым мейрамхананың шотында мұндай жол жоқ.",
      },
      {
        ru: "Верно: здесь ценят слова благодарности, а не деньги сверху.",
        en: "Right: here, words of thanks matter more than extra money.",
        kk: "Дұрыс: мұнда артық ақшадан гөрі алғыс сөзі бағалы.",
      },
    ],
    kind: "trick",
  },
  {
    id: "trip-tip-usa",
    icon: "cash",
    title: {
      ru: "Чаевые в США",
      en: "Tipping in the USA",
      kk: "АҚШ-тағы шайпұл",
    },
    rule: {
      ru: "В США чаевые 15–20% — часть оплаты, а не награда",
      en: "In the US, a 15–20% tip is part of the price, not a bonus",
      kk: "АҚШ-та 15–20% шайпұл — сыйлық емес, төлемнің бір бөлігі",
    },
    question: {
      ru: "Кафе в Нью-Йорке. Официантка Сара была вежлива, но блюда несли долго — кухня явно не справлялась. Сколько оставишь чаевых?",
      en: "A café in New York. Your server Sara was polite, but the food took ages — the kitchen was clearly swamped. How much do you tip?",
      kk: "Нью-Йорктегі кафе. Даяшы Сара сыпайы болды, бірақ тағамды ұзақ әкелді — асхана үлгермей жатқаны анық. Қанша шайпұл қалдырасың?",
    },
    options: [
      {
        ru: "Ничего — обслуживание было медленным",
        en: "Nothing — the service was slow",
        kk: "Ештеңе — қызмет баяу болды",
      },
      {
        ru: "Обычные 15–20%: задержка — вина кухни, а не Сары",
        en: "The usual 15–20%: the delay was the kitchen’s fault, not Sara’s",
        kk: "Әдеттегі 15–20%: кешігуге Сара емес, асхана кінәлі",
      },
      {
        ru: "Символические 5%, чтобы показать недовольство",
        en: "A token 5% to show I wasn’t happy",
        kk: "Наразылығымды білдіру үшін бар-жоғы 5%",
      },
      {
        ru: "Сколько оставляю дома — около 5–10%",
        en: "What I’d leave at home — around 5–10%",
        kk: "Үйдегідей — шамамен 5–10%",
      },
    ],
    correct: 1,
    why: {
      ru: "В США заработок официанта во многом состоит из чаевых, поэтому 15–20% — норма, а не бонус. Медленная кухня — не повод наказывать официанта. Если сервис был по-настоящему плохим, честнее сказать об этом менеджеру, чем молча урезать чаевые.",
      en: "In the US, servers earn much of their income from tips, so 15–20% is the norm, not a reward. A slow kitchen is no reason to punish your server. If service was truly bad, it’s fairer to tell the manager than to silently cut the tip.",
      kk: "АҚШ-та даяшының табысының едәуір бөлігі шайпұлдан құралады, сондықтан 15–20% — сыйлық емес, норма. Асхананың баяулығы үшін даяшыны жазалауға болмайды. Қызмет шынымен нашар болса, шайпұлды үнсіз азайтқаннан гөрі менеджерге айтқан әділірек.",
    },
    notes: [
      {
        ru: "Сара останется почти без заработка за то, в чём не виновата.",
        en: "Sara loses most of her pay for something that wasn’t her fault.",
        kk: "Сара өзі кінәлі емес нәрсе үшін табыссыз қалады.",
      },
      {
        ru: "Верно: ты отделяешь работу официанта от работы кухни.",
        en: "Right: you separate the server’s work from the kitchen’s.",
        kk: "Дұрыс: даяшының жұмысын асхананың жұмысынан ажыраттың.",
      },
      {
        ru: "Сигнал получит не кухня, а Сара — и не поймёт за что.",
        en: "The message reaches Sara, not the kitchen — and she won’t know why.",
        kk: "Белгіні асхана емес, Сара алады — және неге екенін түсінбейді.",
      },
      {
        ru: "Домашняя норма тут не работает: в США 5–10% читается как недовольство.",
        en: "Your home norm doesn’t apply: in the US, 5–10% reads as a complaint.",
        kk: "Үйдегі норма мұнда жүрмейді: АҚШ-та 5–10% наразылық деп қабылданады.",
      },
    ],
    kind: "hard",
  },
  {
    id: "trip-hotel-buffet",
    icon: "cafe",
    title: {
      ru: "Завтрак «шведский стол»",
      en: "The breakfast buffet",
      kk: "«Швед үстелі» таңғы асы",
    },
    rule: {
      ru: "Бери столько, сколько съешь на месте, — и подходи ещё",
      en: "Take what you’ll eat there — and go back for more",
      kk: "Сол жерде жейтініңді ғана ал — қажет болса тағы кел",
    },
    question: {
      ru: "В отеле завтрак — «шведский стол», впереди долгая экскурсия. Хочется взять с собой булочки и фрукты на обед. Как поступишь?",
      en: "Your hotel has a breakfast buffet, and a long tour is ahead. You’d like to take some pastries and fruit along for lunch. What do you do?",
      kk: "Қонақүйде таңғы ас — «швед үстелі», алда ұзақ экскурсия. Түскі асқа тоқаш пен жеміс ала кеткің келеді. Не істейсің?",
    },
    options: [
      {
        ru: "Возьму пакет и наберу на весь день — завтрак же оплачен",
        en: "Grab a bag and stock up for the day — breakfast is paid for",
        kk: "Пакетке бір күнге жетерлік саламын — таңғы ас төленген ғой",
      },
      {
        ru: "Положу пару булочек в сумку, пока никто не видит",
        en: "Slip a couple of pastries into my bag when no one’s looking",
        kk: "Ешкім көрмей тұрғанда сөмкеге бір-екі тоқаш саламын",
      },
      {
        ru: "Поем здесь, а еду в дорогу спрошу на ресепшене или куплю",
        en: "Eat here, and ask reception about a packed lunch or buy food",
        kk: "Осында жеймін, ал жолға тамақты ресепшннен сұраймын не сатып аламын",
      },
      {
        ru: "Наложу тарелку с горкой, чтобы не ходить дважды",
        en: "Pile my plate high so I don’t have to go twice",
        kk: "Екі рет бармас үшін тәрелкеге толтыра саламын",
      },
    ],
    correct: 2,
    why: {
      ru: "Оплачен завтрак в зале, а не еда на весь день: выносить с буфета в большинстве отелей не принято, а иногда прямо запрещено. Многие отели по просьбе собирают ланч-бокс. А за столом лучше брать понемногу и подходить ещё — так меньше выбрасывают.",
      en: "You paid for breakfast in the dining room, not food for the whole day: taking food from the buffet isn’t done in most hotels and is sometimes forbidden. Many hotels will pack a lunch box on request. And at the buffet, take small portions and go back — less food gets thrown away.",
      kk: "Төленгені — залдағы таңғы ас, бүкіл күннің тамағы емес: көп қонақүйде буфеттен тамақ алып шығу қабылданбайды, кей жерде тіпті тыйым салынған. Көп қонақүй сұрасаң, жолға ланч-бокс дайындап береді. Ал үстелден аздап алып, қайта барған дұрыс — азық аз ысырап болады.",
    },
  },
  {
    id: "trip-hotel-noise",
    icon: "bed",
    title: {
      ru: "Шумные соседи в отеле",
      en: "Noisy hotel neighbors",
      kk: "Қонақүйдегі шулы көршілер",
    },
    rule: {
      ru: "Попроси вежливо лично или через ресепшн — не стучи в стену",
      en: "Ask politely in person or via reception — don’t bang on the wall",
      kk: "Өзің сыпайы сұра немесе ресепшн арқылы — қабырғаны ұрма",
    },
    question: {
      ru: "23:30, завтра рано вставать, а в соседнем номере громко играет музыка и смеются. Что сделаешь?",
      en: "It’s 11:30 p.m., you have an early start tomorrow, and the room next door is blasting music and laughing. What do you do?",
      kk: "Сағат 23:30, ертең ерте тұрасың, ал көрші бөлмеде музыка қатты ойнап, күлкі естіледі. Не істейсің?",
    },
    options: [
      {
        ru: "Постучу к ним в дверь и спокойно попрошу сделать потише",
        en: "Knock on their door and calmly ask them to keep it down",
        kk: "Есігін қағып, сабырмен дыбысты бәсеңдетуді сұраймын",
      },
      {
        ru: "Постучу в стену, чтобы поняли намёк",
        en: "Bang on the wall so they get the hint",
        kk: "Түсінсін деп қабырғаны қағамын",
      },
      {
        ru: "Позвоню на ресепшн и попрошу помочь",
        en: "Call reception and ask them to help",
        kk: "Ресепшнге қоңырау шалып, көмек сұраймын",
      },
      {
        ru: "Потерплю — вдруг у людей праздник",
        en: "Put up with it — maybe they’re celebrating",
        kk: "Шыдаймын — мүмкін, оларда той шығар",
      },
    ],
    correct: [0, 2],
    why: {
      ru: "Подходят оба спокойных пути: короткая вежливая просьба лично часто решает всё за минуту, а ресепшн — правильный выбор, если идти к незнакомцам неуютно или просьба не помогла. Стук в стену злит и ничего не объясняет, а терпеть молча не обязательно: ночью в отелях обычно действуют часы тишины.",
      en: "Both calm routes work: a short, polite request in person often fixes it in a minute, and reception is the right choice if knocking on strangers’ doors feels uncomfortable or asking didn’t help. Banging on the wall angers people without explaining anything, and you don’t have to suffer in silence: hotels usually have quiet hours at night.",
      kk: "Екі сабырлы жол да дұрыс: өзің қысқа әрі сыпайы сұрасаң, мәселе бір минутта шешілуі мүмкін, ал бейтаныс адамдарға бару ыңғайсыз болса не өтінішің көмектеспесе, ресепшнге хабарласқан жөн. Қабырғаны ұру ашуландырады, бірақ ештеңе түсіндірмейді, ал үнсіз шыдау міндетті емес: түнде қонақүйлерде әдетте тыныштық сағаттары болады.",
    },
    notes: [
      {
        ru: "Работает: прямо, вежливо и быстро.",
        en: "Works: direct, polite and quick.",
        kk: "Нәтижелі: тура, сыпайы әрі жылдам.",
      },
      {
        ru: "Пассивная агрессия: соседи скорее разозлятся, чем поймут.",
        en: "Passive-aggressive: they’ll get annoyed rather than get the point.",
        kk: "Жасырын ашу: көршілер түсінгеннен гөрі ашуланады.",
      },
      {
        ru: "Тоже верно: персонал решает такие вопросы каждый день.",
        en: "Also right: staff handle this kind of thing every day.",
        kk: "Бұл да дұрыс: қызметкерлер мұндай мәселені күнде шешеді.",
      },
      {
        ru: "Ты имеешь право на тишину ночью — молчать не нужно.",
        en: "You have a right to quiet at night — no need to stay silent.",
        kk: "Түнде тыныштыққа құқығың бар — үндемей отырудың қажеті жоқ.",
      },
    ],
    kind: "hard",
  },
  {
    id: "trip-theatre-late",
    icon: "ticket",
    title: {
      ru: "Опоздал в театр",
      en: "Late for the theatre",
      kk: "Театрға кешіктің",
    },
    rule: {
      ru: "Опоздал — жди, пока капельдинер проведёт тебя в паузу",
      en: "If you’re late, wait for an usher to seat you at a pause",
      kk: "Кешіксең — залдағы қызметкер үзілісте өткізгенше күт",
    },
    question: {
      ru: "Ты опоздал на спектакль на 10 минут, действие уже идёт. Твоё место — в середине пятого ряда. Как поступишь?",
      en: "You’re 10 minutes late for a play, and the performance has started. Your seat is in the middle of row five. What do you do?",
      kk: "Спектакльге 10 минут кешіктің, қойылым басталып кетті. Орның — бесінші қатардың ортасында. Не істейсің?",
    },
    options: [
      {
        ru: "Быстро пройду к своему месту, извиняясь шёпотом",
        en: "Hurry to my seat, whispering apologies",
        kk: "Сыбырлап кешірім сұрап, орныма тез өтемін",
      },
      {
        ru: "Подожду у входа, пока капельдинер не проведёт меня в паузу",
        en: "Wait by the door until an usher seats me at a pause",
        kk: "Залдағы қызметкер үзілісте өткізгенше есік алдында күтемін",
      },
      {
        ru: "Подсвечу себе телефоном, чтобы быстрее найти ряд",
        en: "Use my phone light to find my row faster",
        kk: "Қатарымды тез табу үшін телефонмен жарық түсіремін",
      },
      {
        ru: "Сам сяду на любое свободное место у прохода",
        en: "Just take any empty aisle seat on my own",
        kk: "Өзім өтпе жолдың жанындағы кез келген бос орынға отырамын",
      },
    ],
    correct: 1,
    why: {
      ru: "Многие театры пускают опоздавших только в удобный момент — в паузе или в антракте, а иногда временно сажают на ближайшее свободное место. Пробираться через ряд во время действия или светить телефоном — мешать и залу, и актёрам. Когда и куда тебе пройти, решает капельдинер.",
      en: "Many theatres admit latecomers only at a suitable moment — a pause or the interval — and sometimes seat them temporarily in the nearest free seat. Squeezing along a row mid-scene or using your phone light disturbs both the audience and the actors. The usher decides when and where you go.",
      kk: "Көп театр кешіккендерді тек ыңғайлы сәтте — үзілісте не антрактта кіргізеді, кейде уақытша ең жақын бос орынға отырғызады. Қойылым кезінде қатардан қысылып өту не телефонмен жарық түсіру залға да, актерлерге де кедергі. Қашан және қайда өтетініңді залдағы қызметкер шешеді.",
    },
  },
  {
    id: "trip-concert-applause",
    icon: "musical-notes",
    title: {
      ru: "Аплодисменты на концерте",
      en: "Applause at a concert",
      kk: "Концерттегі қол шапалақ",
    },
    rule: {
      ru: "В классике хлопают после всего произведения, а не между частями",
      en: "In classical music, applaud after the whole work, not between movements",
      kk: "Классикада бөлімдер арасында емес, шығарма толық біткенде қол соғады",
    },
    question: {
      ru: "Ты на симфоническом концерте. Оркестр закончил яркую быструю часть, и в зале стало тихо. Пара человек рядом уже готова хлопать. Что сделаешь?",
      en: "You’re at a symphony concert. The orchestra finishes a bright, fast section and the hall goes quiet. A couple of people nearby are about to clap. What do you do?",
      kk: "Симфониялық концерттесің. Оркестр жарқын, жылдам бөлімді аяқтап, залда тыныштық орнады. Қасыңдағы бір-екі адам қол соғуға дайын. Не істейсің?",
    },
    options: [
      {
        ru: "Подожду: возможно, это пауза между частями",
        en: "Wait: this may be a pause between movements",
        kk: "Күтемін: бұл бөлімдер арасындағы үзіліс болуы мүмкін",
      },
      {
        ru: "Похлопаю — музыканты заслужили поддержку",
        en: "Clap — the musicians deserve support",
        kk: "Қол соғамын — музыканттар қолдауға лайық",
      },
      {
        ru: "Крикну «Браво!», чтобы подбодрить оркестр",
        en: "Shout “Bravo!” to cheer the orchestra on",
        kk: "Оркестрді демеу үшін «Браво!» деп айқайлаймын",
      },
      {
        ru: "Поддержу тех, кто начал, — молчать неловко",
        en: "Join those who start — staying silent feels awkward",
        kk: "Бастағандарға қосыламын — үндемеу ыңғайсыз",
      },
    ],
    correct: 0,
    why: {
      ru: "Подвох: тишина — ещё не конец. Симфония обычно состоит из нескольких частей, и между ними принято не хлопать, чтобы не разрывать произведение. Ориентир — дирижёр: пока он не опустил руки и не повернулся к залу, музыка продолжается. Сомневаешься — вступай, когда хлопает весь зал.",
      en: "The catch: silence isn’t the end yet. A symphony usually has several movements, and it’s customary not to clap between them so the work isn’t broken up. Watch the conductor: until they lower their arms and turn to the audience, the music goes on. When in doubt, join in when the whole hall applauds.",
      kk: "Тұзақ: тыныштық — әлі соңы емес. Симфония әдетте бірнеше бөлімнен тұрады, шығарманы бөлшектемеу үшін олардың арасында қол соқпайды. Дирижерге қара: ол қолын түсіріп, залға бұрылмайынша, музыка жалғасып жатыр. Күмәнің болса, бүкіл зал қол соққанда қосыл.",
    },
    notes: [
      {
        ru: "Верно: пауза между частями — тоже часть музыки.",
        en: "Right: the pause between movements is part of the music.",
        kk: "Дұрыс: бөлімдер арасындағы үзіліс те — музыканың бір бөлігі.",
      },
      {
        ru: "Искренне, но обрывает произведение на середине.",
        en: "Sincere, but it cuts the piece off halfway.",
        kk: "Шын ниетпен, бірақ шығарманы ортасынан үзеді.",
      },
      {
        ru: "Ещё громче нарушает паузу, задуманную композитором.",
        en: "Breaks the composer’s intended pause even louder.",
        kk: "Композитор ойлаған үзілісті одан да қатты бұзады.",
      },
      {
        ru: "Пара человек — ещё не зал: смотри на дирижёра, а не на соседей.",
        en: "A couple of people aren’t the hall: watch the conductor, not your neighbors.",
        kk: "Бір-екі адам — бүкіл зал емес: көршіге емес, дирижерге қара.",
      },
    ],
    kind: "trick",
  },
  {
    id: "trip-photo-people",
    icon: "camera",
    title: {
      ru: "Фото местных жителей",
      en: "Photographing locals",
      kk: "Жергілікті тұрғындарды суретке түсіру",
    },
    rule: {
      ru: "Хочешь снять человека — сначала спроси и прими «нет»",
      en: "Want to photograph someone? Ask first, and accept a “no”",
      kk: "Адамды суретке түсіргің келсе — алдымен сұра және «жоқ» дегенін қабылда",
    },
    question: {
      ru: "На рынке в Марракеше пожилой торговец в ярком наряде раскладывает специи. Очень хочется его сфотографировать. Как поступишь?",
      en: "At a market in Marrakech, an elderly vendor in bright clothes is arranging spices. You really want to take his photo. What do you do?",
      kk: "Марракештегі базарда ашық түсті киім киген қарт саудагер дәмдеуіштерін жайып жатыр. Оны суретке түсіргің келеді. Не істейсің?",
    },
    options: [
      {
        ru: "Сниму издалека на зум — он и не заметит",
        en: "Shoot from afar with the zoom — he won’t even notice",
        kk: "Алыстан зуммен түсіремін — ол байқамайды да",
      },
      {
        ru: "Покажу на камеру, улыбнусь и жестом спрошу разрешения",
        en: "Point to my camera, smile and ask permission with a gesture",
        kk: "Камераны көрсетіп, күліп, ыммен рұқсат сұраймын",
      },
      {
        ru: "Сфотографирую, а потом покажу ему снимок",
        en: "Take the photo, then show it to him",
        kk: "Суретке түсіріп, кейін оған көрсетемін",
      },
      {
        ru: "Куплю специи, пообщаюсь и спрошу, можно ли снять",
        en: "Buy some spices, chat, then ask if I may take a photo",
        kk: "Дәмдеуіш сатып алып, сөйлесіп, суретке түсіруге бола ма деп сұраймын",
      },
    ],
    correct: [1, 3],
    why: {
      ru: "Подходят оба варианта, где ты спрашиваешь до съёмки: жест с улыбкой понятен без слов, а покупка и разговор делают просьбу естественной. Главное — принять отказ. В Марокко многие не любят, когда их снимают, а некоторые торговцы просят за фото небольшую плату — это тоже нормальный ответ.",
      en: "Both options where you ask before shooting work: a smile and a gesture need no words, and buying something and chatting make the request feel natural. What matters is accepting a refusal. In Morocco many people dislike being photographed, and some vendors ask for a small fee — that’s a fair answer too.",
      kk: "Түсірмес бұрын сұрайтын екі нұсқа да дұрыс: күлкі мен ым сөзсіз түсінікті, ал сатып алып, сөйлескен соң өтініш табиғи естіледі. Ең бастысы — бас тартса, қабылдау. Мароккода көп адам суретке түсірілгенді ұнатпайды, ал кейбір саудагерлер сурет үшін аздаған ақы сұрайды — бұл да қалыпты жауап.",
    },
    notes: [
      {
        ru: "Тайная съёмка — неуважение, даже если тебя не заметили.",
        en: "Secret photos are disrespectful, even if you go unnoticed.",
        kk: "Жасырын түсіру — байқамаса да, құрметсіздік.",
      },
      {
        ru: "Верно: разрешение спрошено, отказ можно принять.",
        en: "Right: you asked first, and a refusal is easy to accept.",
        kk: "Дұрыс: рұқсат сұралды, бас тартса да қабылдауға болады.",
      },
      {
        ru: "Согласие после снимка уже ничего не решает.",
        en: "Consent after the photo is taken doesn’t count.",
        kk: "Суреттен кейінгі келісім енді ештеңе шешпейді.",
      },
      {
        ru: "Тоже хорошо: сначала знакомство, потом просьба.",
        en: "Also good: connection first, request second.",
        kk: "Бұл да жақсы: алдымен танысу, сосын өтініш.",
      },
    ],
  },
  {
    id: "trip-not-understood",
    icon: "language",
    title: {
      ru: "Тебя не понимают",
      en: "When you’re not understood",
      kk: "Сені түсінбесе",
    },
    rule: {
      ru: "Не повышай голос — смени способ: адрес, карта, переводчик",
      en: "Don’t raise your voice — switch tools: address, map, translator",
      kk: "Дауысыңды көтерме — тәсілді ауыстыр: мекенжай, карта, аудармашы",
    },
    question: {
      ru: "Ты в Сеуле ищешь свой отель. Спросил прохожую по-английски, а она растерянно качает головой. Что дальше?",
      en: "You’re in Seoul looking for your hotel. You asked a passer-by in English, and she shakes her head, confused. What next?",
      kk: "Сеулде қонақүйіңді іздеп жүрсің. Өтіп бара жатқан әйелден ағылшынша сұрадың, ол түсінбей басын шайқайды. Енді не істейсің?",
    },
    options: [
      {
        ru: "Повторю медленнее и громче — так точно поймёт",
        en: "Repeat it slower and louder — that should do it",
        kk: "Баяуырақ әрі қаттырақ қайталаймын — енді түсінеді",
      },
      {
        ru: "Объясню подробнее, другими словами",
        en: "Explain in more detail, using other words",
        kk: "Басқа сөздермен толығырақ түсіндіремін",
      },
      {
        ru: "Покажу адрес на экране или фразу в переводчике",
        en: "Show her the address on my screen or a phrase in a translator app",
        kk: "Экраннан мекенжайды не аудармашыдағы сөйлемді көрсетемін",
      },
      {
        ru: "Молча уйду, чтобы не создавать неловкость",
        en: "Walk away silently to avoid awkwardness",
        kk: "Ыңғайсыз болмасын деп үнсіз кетіп қаламын",
      },
    ],
    correct: 2,
    why: {
      ru: "Громкость не помогает понять чужой язык, а только смущает человека. Лучше перейти на то, что понятно без слов: адрес на местном языке, карта, переводчик. Не сработало — поблагодари и спроси в магазине или кафе, где к таким вопросам привыкли.",
      en: "Volume doesn’t help anyone understand a foreign language; it just makes them uncomfortable. Switch to what works without words: the address in the local language, a map, a translator app. If that fails, thank her and ask in a shop or café, where people are used to such questions.",
      kk: "Қатты сөйлеу бөтен тілді түсінуге көмектеспейді, тек адамды қысылтады. Сөзсіз түсінікті нәрсеге көшкен дұрыс: жергілікті тілдегі мекенжай, карта, аудармашы. Бұл да көмектеспесе — алғыс айтып, мұндай сұраққа үйреніп қалған дүкен не кафеден сұра.",
    },
  },
  {
    id: "trip-temple-dress",
    icon: "shirt",
    title: {
      ru: "Одежда в святом месте",
      en: "Dressing for a sacred site",
      kk: "Киелі орындағы киім",
    },
    rule: {
      ru: "В святом месте одевайся по его правилам, а не по погоде",
      en: "At a sacred site, dress by its rules, not by the weather",
      kk: "Киелі орында ауа райына емес, оның тәртібіне сай кин",
    },
    question: {
      ru: "Жара, на тебе шорты и майка. На входе в мечеть тебе протягивают длинную накидку. Как поступишь?",
      en: "It’s hot, and you’re in shorts and a tank top. At the entrance to a mosque, someone hands you a long wrap. What do you do?",
      kk: "Ыстық, үстіңде шорт пен майка. Мешіттің кіреберісінде саған ұзын жамылғы ұсынады. Не істейсің?",
    },
    options: [
      {
        ru: "Откажусь: я турист, на меня это не распространяется",
        en: "Decline: I’m a tourist, so it doesn’t apply to me",
        kk: "Бас тартамын: мен туристпін, бұл маған қатысты емес",
      },
      {
        ru: "Надену накидку и сниму обувь, если так принято",
        en: "Put on the wrap and take off my shoes if that’s the custom",
        kk: "Жамылғыны киіп, солай қабылданса, аяқ киімімді шешемін",
      },
      {
        ru: "Пройду быстро, пока никто толком не заметил",
        en: "Walk through quickly before anyone really notices",
        kk: "Ешкім байқамай тұрғанда тез өтіп кетемін",
      },
      {
        ru: "Попрошу пропустить так — я же всего на пять минут",
        en: "Ask to be let in as I am — it’s only for five minutes",
        kk: "Осы күйімде кіргізуді сұраймын — бар болғаны бес минутқа ғой",
      },
    ],
    correct: 1,
    why: {
      ru: "Правила одежды в мечетях и храмах касаются всех, включая туристов: обычно нужно закрыть плечи и колени, а женщинам часто и голову. Накидки на входе дают именно для этого — надеть её значит проявить уважение к месту и к тем, кто пришёл молиться.",
      en: "Dress codes at mosques and temples apply to everyone, tourists included: shoulders and knees are usually covered, and women are often asked to cover their hair. Wraps are offered at the entrance for exactly this reason — wearing one shows respect for the place and for the people who came to pray.",
      kk: "Мешіт пен ғибадатханалардағы киім тәртібі бәріне, соның ішінде туристерге де қатысты: әдетте иық пен тізе жабық болуы керек, ал әйелдерден көбіне басын жабу сұралады. Кіреберісте жамылғыны дәл осы үшін береді — оны кию сол орынға және құлшылық етуге келгендерге деген құрмет.",
    },
  },
  {
    id: "trip-gesture-ok",
    icon: "hand-right",
    title: {
      ru: "Жест «окей» за границей",
      en: "The “OK” sign abroad",
      kk: "Шетелдегі «окей» ымы",
    },
    rule: {
      ru: "Привычный жест за границей может значить другое — благодари словами",
      en: "A familiar gesture can mean something else abroad — thank with words",
      kk: "Шетелде таныс ым басқа мағына беруі мүмкін — сөзбен алғыс айт",
    },
    question: {
      ru: "Ты в Бразилии. Таксист Педру помог донести тяжёлые чемоданы до двери. Хочешь показать, что всё отлично. Как?",
      en: "You’re in Brazil. Your taxi driver Pedro helped carry your heavy suitcases to the door. You want to show that everything was great. How?",
      kk: "Бразилиядасың. Такси жүргізушісі Педру ауыр чемодандарыңды есікке дейін жеткізіп берді. Бәрі керемет екенін білдіргің келеді. Қалай?",
    },
    options: [
      {
        ru: "Покажу знак «окей» — колечко из пальцев",
        en: "Make the “OK” sign — a ring with my fingers",
        kk: "«Окей» белгісін көрсетемін — саусақпен сақина жасаймын",
      },
      {
        ru: "Скажу «спасибо» по-русски — интонация всё объяснит",
        en: "Say “thank you” in my own language — the tone will explain",
        kk: "Өз тілімде «рақмет» деймін — интонациядан түсінеді",
      },
      {
        ru: "Улыбнусь, скажу «обригаду» и подниму большой палец",
        en: "Smile, say “obrigado” and give a thumbs-up",
        kk: "Күліп, «обригаду» деп, бас бармағымды көтеремін",
      },
      {
        ru: "Скажу «спасибо» и для ясности покажу «окей»",
        en: "Say “thanks” and add the “OK” sign to be clear",
        kk: "«Рақмет» деп, түсінікті болу үшін «окей» белгісін көрсетемін",
      },
    ],
    correct: 2,
    why: {
      ru: "Подвох в самом жесте: в Бразилии колечко из пальцев считается грубым, примерно как средний палец. А вот большой палец вверх там — привычный знак «всё хорошо». Жесты меняют смысл от страны к стране, поэтому надёжнее всего улыбка и спасибо на местном языке.",
      en: "The catch is the gesture itself: in Brazil the finger ring is considered rude, roughly like the middle finger. A thumbs-up, on the other hand, is a common “all good” sign there. Gestures change meaning from country to country, so a smile and a thank-you in the local language are the safest bet.",
      kk: "Тұзақ ымның өзінде: Бразилияда саусақпен жасалған сақина дөрекі саналады, ортаңғы саусақты көрсеткенмен бірдей. Ал бас бармақты көтеру онда «бәрі жақсы» деген әдеттегі белгі. Ымдардың мағынасы елден елге өзгереді, сондықтан ең сенімдісі — күлкі мен жергілікті тілдегі «рақмет».",
    },
    notes: [
      {
        ru: "В Бразилии это оскорбительный жест — ровно наоборот твоему замыслу.",
        en: "In Brazil this is an insult — the exact opposite of what you meant.",
        kk: "Бразилияда бұл — қорлайтын ым, ойыңа мүлде қарама-қарсы.",
      },
      {
        ru: "Не грубо, но слабее: местное «спасибо» звучит теплее.",
        en: "Not rude, but weaker: a local “thank you” lands warmer.",
        kk: "Дөрекі емес, бірақ әлсіздеу: жергілікті «рақмет» жылырақ естіледі.",
      },
      {
        ru: "Верно: местное «спасибо» и большой палец в Бразилии понятны и приятны.",
        en: "Right: a local “thanks” and a thumbs-up are clear and friendly in Brazil.",
        kk: "Дұрыс: Бразилияда жергілікті «рақмет» пен бас бармақ түсінікті әрі жағымды.",
      },
      {
        ru: "Вежливое слово не исправит грубый жест.",
        en: "A polite word won’t fix a rude gesture.",
        kk: "Сыпайы сөз дөрекі ымды түзей алмайды.",
      },
    ],
    kind: "trick",
  },
  {
    id: "trip-guide-mistake",
    icon: "flag",
    title: {
      ru: "Гид ошибся",
      en: "The guide got it wrong",
      kk: "Гид қателесті",
    },
    rule: {
      ru: "Поправляй тактично: наедине или вопросом, не уличая при всех",
      en: "Correct tactfully: in private or as a question, never as a public catch",
      kk: "Әдеппен түзет: оңаша не сұрақ ретінде, жұрт алдында әшкерелемей",
    },
    question: {
      ru: "На экскурсии гид Ли называет неправильный год постройки собора. Ты точно знаешь верную дату. Что сделаешь?",
      en: "On a tour, your guide Li gives the wrong year the cathedral was built. You know the correct date for sure. What do you do?",
      kk: "Экскурсияда гид Ли собордың салынған жылын қате айтады. Сен дұрыс жылды нақты білесің. Не істейсің?",
    },
    options: [
      {
        ru: "Сразу поправлю при всей группе — люди должны знать правду",
        en: "Correct Li right away in front of the group — people deserve the facts",
        kk: "Бүкіл топтың алдында бірден түзетемін — адамдар шындықты білуі керек",
      },
      {
        ru: "Подойду к Ли после рассказа и скажу наедине",
        en: "Go up to Li after the talk and mention it privately",
        kk: "Әңгімеден кейін Лиге жеке барып, оңаша айтамын",
      },
      {
        ru: "Промолчу — не моё дело, да и мелочь",
        en: "Say nothing — it’s not my business, and it’s minor",
        kk: "Үндемеймін — менің шаруам емес, оның үстіне ұсақ-түйек",
      },
      {
        ru: "Спрошу вслух: «Я читал другую дату — как правильно?»",
        en: "Ask aloud: “I read a different date — which one is right?”",
        kk: "Дауыстап сұраймын: «Мен басқа жылды оқыған едім — қайсысы дұрыс?»",
      },
    ],
    correct: [1, 3],
    why: {
      ru: "Подходят оба способа, которые сохраняют лицо гида: разговор наедине — самый мягкий, а вопрос вместо обвинения даёт Ли шанс проверить себя без унижения. Резкая поправка при группе выставляет человека некомпетентным, а молчание оставляет ошибку в головах всей группы.",
      en: "Both ways that let the guide save face work: a private word is the gentlest, and a question instead of an accusation gives Li a chance to check without being embarrassed. A blunt public correction makes the guide look incompetent, while silence leaves the mistake in everyone’s heads.",
      kk: "Гидтің беделін сақтайтын екі тәсіл де дұрыс: оңаша сөйлесу — ең жұмсағы, ал айыптаудың орнына сұрақ қою Лиге ұялмай, өзін тексеруге мүмкіндік береді. Топтың алдында қатаң түзету адамды білімсіз етіп көрсетеді, ал үнсіздік қатені бүкіл топтың есінде қалдырады.",
    },
    notes: [
      {
        ru: "Факт верный, но форма унижает гида перед группой.",
        en: "The fact is right, but the delivery humiliates the guide.",
        kk: "Дерек дұрыс, бірақ айту тәсілі гидті топ алдында қорлайды.",
      },
      {
        ru: "Верно: ошибка исправлена, а гид не теряет лицо.",
        en: "Right: the mistake gets fixed and the guide keeps face.",
        kk: "Дұрыс: қате түзелді, гидтің беделі де сақталды.",
      },
      {
        ru: "Вежливо, но неправда так и останется у всех в головах.",
        en: "Polite, but the wrong fact stays in everyone’s heads.",
        kk: "Сыпайы, бірақ қате дерек бәрінің есінде қалады.",
      },
      {
        ru: "Тоже верно: вопрос даёт гиду проверить себя без неловкости.",
        en: "Also right: a question lets the guide check without awkwardness.",
        kk: "Бұл да дұрыс: сұрақ гидке ыңғайсызданбай тексеруге мүмкіндік береді.",
      },
    ],
    kind: "hard",
  },
  {
    id: "trip-train-table",
    icon: "train",
    title: {
      ru: "Столик в поезде",
      en: "The table on a sleeper train",
      kk: "Пойыздағы үстел",
    },
    rule: {
      ru: "Днём столик в купе общий, но присесть на чужую полку — спроси",
      en: "By day the table is shared, but ask before sitting on someone’s berth",
      kk: "Күндіз үстел ортақ, бірақ біреудің сөресіне отырар алдында сұра",
    },
    question: {
      ru: "Ты едешь в купе на верхней полке. Время обеда, а внизу сидит Айгерим — у неё нижнее место. Где ты поешь?",
      en: "You’re on the upper berth in a sleeper compartment. It’s lunchtime, and Aigerim, who has the lower berth, is sitting below. Where do you eat?",
      kk: "Купеде жоғарғы сөреде келе жатырсың. Түскі ас уақыты, ал төменде Айгерім отыр — оның орны төменгі сөреде. Қай жерде тамақтанасың?",
    },
    options: [
      {
        ru: "Спрошу Айгерим, можно ли присесть к столику",
        en: "Ask Aigerim if I can sit at the table",
        kk: "Айгерімнен үстелге отыруға бола ма деп сұраймын",
      },
      {
        ru: "Поем наверху, чтобы никого не беспокоить",
        en: "Eat up on my berth so I don’t bother anyone",
        kk: "Ешкімді мазаламас үшін жоғарыда тамақтанамын",
      },
      {
        ru: "Просто сяду внизу — столик же общий",
        en: "Just sit down below — the table is shared anyway",
        kk: "Жай ғана төменге отырамын — үстел ортақ қой",
      },
      {
        ru: "Поем стоя в коридоре",
        en: "Eat standing in the corridor",
        kk: "Дәлізде тұрып тамақтанамын",
      },
    ],
    correct: 0,
    why: {
      ru: "В поездах днём столик принято делить на всё купе, и пассажиры верхних полок едят внизу. Но нижняя полка — это всё-таки чьё-то место для сна, поэтому короткое «Можно присесть?» делает всё по-человечески. Есть наверху неудобно, да и легко что-нибудь уронить на соседей.",
      en: "On trains, the table is shared by the whole compartment during the day, and upper-berth passengers eat downstairs. But the lower berth is still someone’s bed, so a quick “Mind if I sit here?” keeps things friendly. Eating up top is awkward, and it’s easy to drop something on the people below.",
      kk: "Пойызда күндіз үстелді бүкіл купе бөлісіп пайдаланады, жоғарғы сөредегілер төменде тамақтанады. Бірақ төменгі сөре — бәрібір біреудің ұйықтайтын орны, сондықтан «Отыруға бола ма?» деген қысқа сұрақ бәрін адамгершілікпен шешеді. Жоғарыда тамақтану ыңғайсыз, оның үстіне төмендегілерге бірдеңе түсіріп алу оңай.",
    },
  },
];
