// «Королевские манеры» — etiquette as a quiz. Each rule comes with one
// situation question: the player picks how they'd act, then sees the right
// answer and why. Passed rules collect in «Мой опыт».
//
// Copy is RU + EN + KK.
import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import { pickLang, type Lang } from "@/context/LangContext";
import { PACK as CITY } from "@/constants/manners/city";
import { PACK as HOME } from "@/constants/manners/home";
import { PACK as TRAVEL } from "@/constants/manners/travel";
import { PACK as DIGITAL } from "@/constants/manners/digital";
import { PACK as SCENES } from "@/constants/manners/scenes";

export type L = { ru: string; en?: string; kk?: string };
export const tl = (v: L, lang: Lang) => pickLang(lang, v as { ru: string; en?: string; kk?: string });

export type MannersRule = {
  id: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  /** Short rule title — what goes into «Мой опыт». */
  title: L;
  /** One-line rule, as the player should remember it. */
  rule: L;
  /** The situation question. */
  question: L;
  /** 3–4 ways to act. */
  options: L[];
  /** Index into `options` — or several indexes when more than one way is fine
   *  (any of them counts as right; all are shown as right after answering). */
  correct: number | number[];
  /** Shown after answering: why this is the royal way. */
  why: L;
  /** Optional: one short note per option, shown under it after answering. */
  notes?: L[];
  /** Optional tag: a genuinely hard case, or one with a catch. */
  kind?: "hard" | "trick";
};

/** Indexes of every acceptable answer. */
export const correctIndexes = (r: MannersRule): number[] => (Array.isArray(r.correct) ? r.correct : [r.correct]);
export const isCorrectOption = (r: MannersRule, i: number) => correctIndexes(r).includes(i);

const BASE_RULES: MannersRule[] = [
  {
    id: "greet-all",
    icon: "hand-left",
    title: { ru: "Здоровайся со всеми", en: "Greet everyone", kk: "Барлығымен амандас" },
    rule: { ru: "Входя, приветствуй всех присутствующих — не только знакомых.", en: "When you walk in, greet everyone present — not only people you know.", kk: "Кіргенде тек таныстарыңмен емес, бүкіл отырғандармен амандас." },
    question: { ru: "Ты вошёл в комнату, где сидят пятеро. Знаешь только одного. Что сделаешь первым делом?", en: "You walk into a room with five people. You know only one. What do you do first?", kk: "Бес адам отырған бөлмеге кірдің. Тек біреуін ғана танисың. Ең алдымен не істейсің?" },
    options: [
      { ru: "Подойду к знакомому и поздороваюсь с ним", en: "Walk up to the one I know and greet them", kk: "Танысыма барып, тек онымен амандасамын" },
      { ru: "Скажу «Добрый день» всем и улыбнусь", en: "Say “Good afternoon” to everyone and smile", kk: "Барлығына «Қайырлы күн» деп, жымиып қараймын" },
      { ru: "Молча сяду — меня всё равно не знают", en: "Sit down quietly — they don't know me anyway", kk: "Үнсіз отыра кетемін — бәрібір мені танымайды" },
    ],
    correct: 1,
    why: { ru: "Приветствие всем сразу показывает уважение к каждому. Выделив одного, ты невольно делаешь остальных «невидимыми».", en: "Greeting everyone shows respect for each person. Singling out one person quietly makes the rest invisible.", kk: "Барлығымен бірден амандасу әр адамға деген құрметті көрсетеді. Біреуін ғана бөліп алсаң, қалғандарын байқамағандай боласың." },
  },
  {
    id: "who-greets-first",
    icon: "people",
    title: { ru: "Кто здоровается первым", en: "Who greets first", kk: "Кім бірінші амандасады" },
    rule: { ru: "Первым здоровается входящий и младший по положению.", en: "The one who enters and the junior in rank greet first.", kk: "Бірінші болып кіріп келе жатқан адам және лауазымы кішісі амандасады." },
    question: { ru: "Ты заходишь в кабинет к директору. Кто должен поздороваться первым?", en: "You walk into the director's office. Who should greet first?", kk: "Директордың кабинетіне кіріп келесің. Кім бірінші амандасуы керек?" },
    options: [
      { ru: "Директор — он старше по должности", en: "The director — they're senior", kk: "Директор — ол лауазымы жағынан үлкен" },
      { ru: "Я — я вхожу и я младше по положению", en: "Me — I'm entering and I'm junior", kk: "Мен — мен кіріп келемін және лауазымым кіші" },
      { ru: "Неважно, кто успеет", en: "Doesn't matter, whoever's quicker", kk: "Маңызы жоқ, кім ерте үлгерсе" },
    ],
    correct: 1,
    why: { ru: "Входящий приветствует тех, кто уже в комнате, а младший — старшего. Здесь оба правила указывают на тебя.", en: "The person entering greets those already inside, and the junior greets the senior. Both rules point to you.", kk: "Кіріп келген адам бөлмедегілермен, ал кішісі үлкенімен амандасады. Мұнда екі ереже де саған нұсқайды." },
  },
  {
    id: "handshake",
    icon: "hand-right",
    title: { ru: "Рука — по инициативе старшего", en: "The senior offers a hand", kk: "Қолды үлкені ұсынады" },
    rule: { ru: "Руку для рукопожатия первым протягивает старший по возрасту или положению.", en: "The senior in age or rank is the one who offers a hand first.", kk: "Амандасу үшін қолды алдымен жасы не лауазымы үлкен адам ұсынады." },
    question: { ru: "Тебя знакомят с генеральным директором компании. Как поступишь?", en: "You're introduced to the company's CEO. What do you do?", kk: "Сені компанияның бас директорымен таныстырып жатыр. Не істейсің?" },
    options: [
      { ru: "Сразу протяну руку — так увереннее", en: "Offer my hand right away — it looks confident", kk: "Бірден қол ұсынамын — солай сенімдірек" },
      { ru: "Поздороваюсь и подожду, протянет ли он руку", en: "Say hello and wait to see if they offer a hand", kk: "Амандасып, оның қол ұсынғанын күтемін" },
      { ru: "Обниму — так теплее", en: "Hug them — it's warmer", kk: "Құшақтаймын — солай жылырақ" },
    ],
    correct: 1,
    why: { ru: "Право начать рукопожатие — за старшим. Протянет руку — пожми уверенно, не протянет — достаточно кивка и улыбки.", en: "The right to start a handshake belongs to the senior. If they offer, shake firmly; if not, a nod and a smile are enough.", kk: "Қол алысуды бастау құқығы үлкендікі. Қол ұсынса — сенімді түрде қыс, ұсынбаса — бас изеп, жымиғаның жеткілікті." },
  },
  {
    id: "introductions",
    icon: "git-compare",
    title: { ru: "Кого кому представляют", en: "Who's introduced to whom", kk: "Кімді кімге таныстырады" },
    rule: { ru: "Младшего представляют старшему, мужчину — женщине, своего — гостю.", en: "Introduce the junior to the senior, the man to the woman, your colleague to the guest.", kk: "Кішіні үлкенге, ер адамды әйелге, өз адамыңды қонаққа таныстырады." },
    question: { ru: "Тебе нужно познакомить стажёра с руководителем отдела. С чего начнёшь?", en: "You need to introduce an intern to the head of department. How do you start?", kk: "Тағылымдамадан өтіп жүрген жас маманды бөлім басшысымен таныстыру керек. Неден бастайсың?" },
    options: [
      { ru: "«Анна Петровна, познакомьтесь — это Максим, наш стажёр»", en: "“Anna, let me introduce Max, our intern”", kk: "«Анна Петровна, танысыңыз — бұл Максим, біздің тағылымдамашымыз»" },
      { ru: "«Максим, это Анна Петровна, наш руководитель»", en: "“Max, this is Anna, our head of department”", kk: "«Максим, бұл Анна Петровна, біздің басшымыз»" },
      { ru: "Пусть знакомятся сами", en: "Let them introduce themselves", kk: "Өздері таныса берсін" },
    ],
    correct: 0,
    why: { ru: "Сначала обращаются к старшему: ему «представляют» младшего. Так ты подчёркиваешь его статус.", en: "You address the senior first and present the junior to them. It acknowledges their status.", kk: "Алдымен үлкенге жүгінеді: кішіні соған «таныстырады». Осылайша оның мәртебесін құрметтейсің." },
  },
  {
    id: "start-dialog",
    icon: "chatbubbles",
    title: { ru: "Как начать разговор", en: "How to start a conversation", kk: "Әңгімені қалай бастау керек" },
    rule: { ru: "Приветствие, имя, затем вопрос о собеседнике — не о себе.", en: "Greeting, your name, then a question about them — not about you.", kk: "Сәлем, есімің, сосын өзің туралы емес, әңгімелесушің туралы сұрақ." },
    question: { ru: "На конференции рядом с тобой незнакомый человек. Как лучше начать разговор?", en: "At a conference you're next to a stranger. What's the best way to start?", kk: "Конференцияда қасыңда бейтаныс адам отыр. Әңгімені қалай бастаған дұрыс?" },
    options: [
      { ru: "Сразу рассказать о своём проекте", en: "Jump straight into pitching my project", kk: "Бірден өз жобам туралы айтып беремін" },
      { ru: "«Здравствуйте, я Алекс. Как вам доклад?»", en: "“Hi, I'm Alex. What did you think of the talk?”", kk: "«Сәлеметсіз бе, мен Алекспін. Баяндама сізге ұнады ма?»" },
      { ru: "Ждать, пока он заговорит первым", en: "Wait for them to speak first", kk: "Ол бірінші сөйлегенше күтемін" },
    ],
    correct: 1,
    why: { ru: "Приветствие и имя снимают напряжение, а вопрос о его мнении приглашает к диалогу. Люди охотнее говорят, когда интересуются ими.", en: "A greeting and your name ease the tension; asking their opinion invites a dialogue. People open up when you're interested in them.", kk: "Сәлемдесу мен есім шиеленісті басады, ал оның пікірін сұрау диалогқа шақырады. Адамдар өздеріне қызығушылық танытқанда ашыла сөйлейді." },
  },
  {
    id: "no-back",
    icon: "body",
    title: { ru: "Не стой спиной к людям", en: "Never turn your back", kk: "Адамдарға арқаңмен тұрма" },
    rule: { ru: "Держись лицом к собеседникам; уходя — сначала шаг назад, потом разворот.", en: "Keep facing the people you're with; when leaving, step back first, then turn.", kk: "Әңгімелесушілерге бетіңмен тұр; кетерде алдымен бір қадам артқа шегініп, сосын бұрыл." },
    question: { ru: "Ты закончил разговор с группой коллег и уходишь. Как поступишь?", en: "You've finished talking to a group of colleagues and you're leaving. What do you do?", kk: "Әріптестеріңмен әңгімені аяқтап, кетіп барасың. Не істейсің?" },
    options: [
      { ru: "Резко развернусь и пойду", en: "Turn around sharply and go", kk: "Кенет бұрылып кете беремін" },
      { ru: "Попрощаюсь, сделаю шаг назад и только потом развернусь", en: "Say goodbye, take a step back, then turn", kk: "Қоштасып, бір қадам артқа шегінемін де, сосын ғана бұрыламын" },
      { ru: "Буду пятиться до самой двери", en: "Walk backwards all the way to the door", kk: "Есікке дейін шегіншектеп барамын" },
    ],
    correct: 1,
    why: { ru: "Спина читается как «разговор мне больше не интересен». Шаг назад после прощания — мягкий сигнал, что ты уходишь с уважением.", en: "Your back reads as “I'm no longer interested”. A step back after saying goodbye signals you're leaving respectfully.", kk: "Арқаң «әңгіме маған енді қызық емес» дегендей көрінеді. Қоштасқаннан кейінгі бір қадам артқа — құрметпен кетіп бара жатқаныңның жұмсақ белгісі." },
  },
  {
    id: "no-chewing",
    icon: "restaurant",
    title: { ru: "Не жуй во время разговора", en: "Don't chew while talking", kk: "Сөйлескенде шайнама" },
    rule: { ru: "Сначала проглоти, потом отвечай; жвачку убери до встречи.", en: "Swallow first, then answer; get rid of gum before a meeting.", kk: "Алдымен жұтып ал, сосын жауап бер; кездесуге дейін сағызды тастап таста." },
    question: { ru: "Ты жуёшь, и к тебе обращается коллега с вопросом. Что сделаешь?", en: "You're chewing when a colleague asks you a question. What do you do?", kk: "Сен бірдеңе шайнап отырсың, сол кезде әріптесің саған сұрақ қойды. Не істейсің?" },
    options: [
      { ru: "Отвечу сразу, прикрыв рот рукой", en: "Answer right away, covering my mouth", kk: "Аузымды қолыммен жауып, бірден жауап беремін" },
      { ru: "Покажу жестом «минуту», проглочу и отвечу", en: "Gesture “one moment”, swallow, then answer", kk: "Ым-ишарамен «бір минут» деп көрсетіп, жұтып алып, жауап беремін" },
      { ru: "Сделаю вид, что не услышал", en: "Pretend I didn't hear", kk: "Естімеген болып отырамын" },
    ],
    correct: 1,
    why: { ru: "Говорить с едой во рту неприятно для собеседника. Короткий жест и пауза в пару секунд — вежливее, чем невнятный ответ.", en: "Talking with food in your mouth is unpleasant to watch. A quick gesture and a two-second pause is more polite than a mumbled reply.", kk: "Аузыңда тамақ тұрып сөйлеу әңгімелесушіге жағымсыз. Қысқа ишара мен екі секундтық үзіліс түсініксіз жауаптан әлдеқайда сыпайы." },
  },
  {
    id: "eye-contact",
    icon: "eye",
    title: { ru: "Смотри в глаза", en: "Keep eye contact", kk: "Көзге қара" },
    rule: { ru: "Смотри собеседнику в глаза большую часть разговора, но без пристального взгляда.", en: "Look the person in the eye for most of the conversation — without staring.", kk: "Әңгіменің басым бөлігінде әңгімелесушінің көзіне қара, бірақ қадалып қарама." },
    question: { ru: "Тебе задают вопрос на собеседовании. Куда смотришь, пока отвечаешь?", en: "You're asked a question at an interview. Where do you look while answering?", kk: "Сұхбатта саған сұрақ қойды. Жауап бергенде қайда қарайсың?" },
    options: [
      { ru: "В пол — так легче сосредоточиться", en: "At the floor — it helps me focus", kk: "Еденге — солай ойымды жинау оңай" },
      { ru: "В глаза, иногда отводя взгляд, чтобы подумать", en: "In their eyes, glancing away now and then to think", kk: "Көзіне қараймын, ойлану үшін анда-санда көз аударамын" },
      { ru: "Не отрываясь, прямо в глаза", en: "Straight into their eyes without a break", kk: "Көз алмай, тура көзіне қараймын" },
    ],
    correct: 1,
    why: { ru: "Зрительный контакт говорит «я с тобой и мне нечего скрывать». Но взгляд без пауз давит — естественно иногда отводить глаза.", en: "Eye contact says “I'm with you and have nothing to hide”. A non-stop stare feels pushy — glancing away now and then is natural.", kk: "Көзбе-көз қарау «мен сенімен біргемін, менің жасыратын ештеңем жоқ» дейді. Бірақ үзіліссіз қадалу қысым көрсетеді — анда-санда көз аудару табиғи." },
  },
  {
    id: "phone-away",
    icon: "phone-portrait",
    title: { ru: "Телефон — в сторону", en: "Phone away", kk: "Телефон — бір шетте" },
    rule: { ru: "В разговоре телефон убран экраном вниз или в карман.", en: "In a conversation, the phone goes face-down or in your pocket.", kk: "Әңгіме кезінде телефон экранымен төмен қаратылып немесе қалтада тұрады." },
    question: { ru: "Во время беседы приходит сообщение. Что сделаешь?", en: "A message arrives mid-conversation. What do you do?", kk: "Әңгіме үстінде хабарлама келді. Не істейсің?" },
    options: [
      { ru: "Быстро гляну — это займёт секунду", en: "Take a quick look — it's just a second", kk: "Тез қарап шығамын — бір секунд қана" },
      { ru: "Не буду смотреть до конца разговора", en: "Leave it until the conversation is over", kk: "Әңгіме біткенше қарамаймын" },
      { ru: "Отвечу, продолжая кивать собеседнику", en: "Reply while nodding along", kk: "Әңгімелесушіге бас изей отырып, жауап жазамын" },
    ],
    correct: 1,
    why: { ru: "Взгляд в телефон сообщает: «кто-то важнее тебя». Если ждёшь срочный звонок — предупреди заранее и извинись.", en: "Glancing at your phone says “someone matters more than you”. If you expect an urgent call, warn them in advance.", kk: "Телефонға қарау «сенен маңыздырақ біреу бар» дегенді білдіреді. Шұғыл қоңырау күтіп отырсаң — алдын ала ескертіп, кешірім сұра." },
  },
  {
    id: "no-interrupt",
    icon: "hand-left-outline",
    title: { ru: "Не перебивай", en: "Don't interrupt", kk: "Сөзді бөлме" },
    rule: { ru: "Дай договорить; хочешь вставить слово — дождись паузы.", en: "Let people finish; wait for a pause to speak.", kk: "Сөзін аяқтауға мүмкіндік бер; бір сөз қосқың келсе — үзілісті күт." },
    question: { ru: "Собеседник рассказывает долго, а у тебя есть важное дополнение. Как поступишь?", en: "Someone is talking at length and you have an important point. What do you do?", kk: "Әңгімелесушің ұзақ әңгімелеп жатыр, ал сенде маңызды толықтыру бар. Не істейсің?" },
    options: [
      { ru: "Перебью, пока не забыл", en: "Cut in before I forget", kk: "Ұмытып қалмас үшін сөзін бөлемін" },
      { ru: "Дождусь паузы и скажу «Можно добавлю?»", en: "Wait for a pause and say “May I add something?”", kk: "Үзілісті күтіп, «Бір нәрсе қосуға бола ма?» деймін" },
      { ru: "Промолчу совсем", en: "Stay silent altogether", kk: "Мүлдем үндемеймін" },
    ],
    correct: 1,
    why: { ru: "Перебивая, ты показываешь, что твои мысли важнее чужих. Пауза и короткая просьба сохраняют и твою мысль, и уважение.", en: "Interrupting suggests your thoughts matter more. A pause and a short request keep both your point and the respect.", kk: "Сөзді бөлу арқылы өз ойыңның өзгенікінен маңызды екенін көрсетесің. Үзіліс пен қысқа сұраныс ойыңды да, құрметті де сақтайды." },
  },
  {
    id: "use-name",
    icon: "person-circle",
    title: { ru: "Обращайся по имени", en: "Use their name", kk: "Атымен атап сөйле" },
    rule: { ru: "Запомни имя при знакомстве и называй человека по нему.", en: "Remember the name when you meet and use it.", kk: "Танысқанда есімін есте сақтап, адамды атымен ата." },
    question: { ru: "Тебе представили человека, и ты сразу забыл его имя. Что лучше сделать?", en: "You were introduced to someone and instantly forgot their name. What's best?", kk: "Сені бір адаммен таныстырды, ал сен оның атын бірден ұмытып қалдың. Не істеген дұрыс?" },
    options: [
      { ru: "Весь разговор обходиться без имени", en: "Avoid using a name the whole time", kk: "Әңгіме бойы атын атамай-ақ қоямын" },
      { ru: "Сразу честно переспросить: «Простите, как вас зовут?»", en: "Ask right away: “Sorry, what was your name?”", kk: "Бірден шынымды айтып, қайта сұраймын: «Кешіріңіз, атыңыз кім еді?»" },
      { ru: "Назвать наугад — вдруг угадаю", en: "Guess — maybe I'll get it right", kk: "Кездейсоқ атай саламын — мүмкін табармын" },
    ],
    correct: 1,
    why: { ru: "Переспросить в начале — нормально и даже вежливо. Неловко становится, когда имя выясняется через час разговора.", en: "Asking again at the start is fine, even polite. It only gets awkward an hour into the conversation.", kk: "Басында қайта сұрау — қалыпты, тіпті сыпайы. Ыңғайсыз жағдай есім бір сағаттық әңгімеден кейін ғана анықталғанда болады." },
  },
  {
    id: "formal-you",
    icon: "ribbon",
    title: { ru: "На «вы» — по умолчанию", en: "Formal by default", kk: "Әдепкіде — «сіз» деп" },
    rule: { ru: "С незнакомыми и старшими — на «вы», пока не предложат иначе.", en: "Use the formal form with strangers and seniors until invited otherwise.", kk: "Бейтаныс адамдармен және үлкендермен, өздері басқаша ұсынбайынша, «сіз» деп сөйле." },
    question: { ru: "Новый клиент твоего возраста. Как обратишься в первом письме?", en: "A new client your age. How do you address them in the first email?", kk: "Жаңа клиент сенімен құрдас. Алғашқы хатта оған қалай жүгінесің?" },
    options: [
      { ru: "На «ты» — мы ровесники", en: "Informally — we're the same age", kk: "«Сен» деп — біз құрдаспыз" },
      { ru: "На «вы», пока он сам не предложит перейти на «ты»", en: "Formally, until they suggest otherwise", kk: "Ол өзі «сен» деп сөйлесуді ұсынғанша, «сіз» деп" },
      { ru: "Без обращения вообще", en: "No address at all", kk: "Мүлдем жүгінбей-ақ жазамын" },
    ],
    correct: 1,
    why: { ru: "«Вы» — безопасная дистанция уважения. Перейти на «ты» легко, а вот вернуть дистанцию после фамильярности — почти невозможно.", en: "Formality is a safe, respectful distance. Going informal is easy; restoring distance after being too familiar is nearly impossible.", kk: "«Сіз» — құрметтің қауіпсіз арақашықтығы. «Сенге» көшу оңай, ал тым жақын сөйлесіп қойғаннан кейін арақашықтықты қайтару мүмкін емес дерлік." },
  },
  {
    id: "knock",
    icon: "enter",
    title: { ru: "Постучи, прежде чем войти", en: "Knock before entering", kk: "Кірер алдында есік қақ" },
    rule: { ru: "В закрытую дверь стучат и ждут ответа; входят — здороваясь.", en: "Knock on a closed door and wait for an answer; greet as you walk in.", kk: "Жабық есікті қағып, жауап күтеді; кіргенде амандасады." },
    question: { ru: "Дверь в переговорную закрыта, внутри голоса. Тебе нужно передать документ.", en: "The meeting room door is closed and you hear voices. You need to hand over a document.", kk: "Келіссөз бөлмесінің есігі жабық, ішінен дауыстар естіледі. Саған құжат беру керек." },
    options: [
      { ru: "Тихо войду, чтобы не мешать", en: "Slip in quietly so as not to disturb", kk: "Кедергі жасамас үшін ақырын кіремін" },
      { ru: "Постучу, дождусь «да», войду и извинюсь за беспокойство", en: "Knock, wait for “come in”, enter and apologise for interrupting", kk: "Есікті қағып, «иә» дегенін күтіп, кіремін де мазаларын алғаным үшін кешірім сұраймын" },
      { ru: "Подсуну документ под дверь", en: "Slide it under the door", kk: "Құжатты есіктің астынан сұғып жіберемін" },
    ],
    correct: 1,
    why: { ru: "Стук даёт людям секунду подготовиться. Короткое «извините, что прерываю» показывает, что ты ценишь их время.", en: "A knock gives people a moment to prepare. A brief “sorry to interrupt” shows you value their time.", kk: "Есік қағу адамдарға дайындалуға бір сәт береді. Қысқа ғана «бөлгенім үшін кешіріңіз» олардың уақытын бағалайтыныңды көрсетеді." },
  },
  {
    id: "posture",
    icon: "accessibility",
    title: { ru: "Руки — не в карманах", en: "Hands out of pockets", kk: "Қол — қалтада емес" },
    rule: { ru: "Держи руки открыто: не в карманах и не скрещенными на груди.", en: "Keep your hands open: not in pockets, not folded across your chest.", kk: "Қолыңды ашық ұста: қалтада да, кеудеңе айқастырып та емес." },
    question: { ru: "Ты слушаешь выступление коллеги, стоя рядом. Как держишь руки?", en: "You're standing, listening to a colleague's talk. What do you do with your hands?", kk: "Әріптесіңнің сөзін қасында тұрып тыңдап тұрсың. Қолыңды қалай ұстайсың?" },
    options: [
      { ru: "Скрещу на груди — так удобно", en: "Fold my arms — it's comfortable", kk: "Кеудеме айқастырамын — солай ыңғайлы" },
      { ru: "Свободно вдоль тела или в лёгком замке спереди", en: "Relaxed at my sides or lightly clasped in front", kk: "Денем бойымен еркін түсіріп немесе алдыңғы жақта жеңіл ұстасып" },
      { ru: "В карманах брюк", en: "In my trouser pockets", kk: "Шалбарымның қалтасында" },
    ],
    correct: 1,
    why: { ru: "Скрещённые руки читаются как защита или несогласие, руки в карманах — как небрежность. Открытая поза говорит «я с вами».", en: "Folded arms read as defensive or disagreeing, hands in pockets as careless. An open posture says “I'm with you”.", kk: "Айқасқан қол қорғаныс не келіспеушілік ретінде, қалтадағы қол — немқұрайлылық ретінде қабылданады. Ашық дене қалпы «мен сіздермен біргемін» дейді." },
  },
  {
    id: "thank",
    icon: "heart",
    title: { ru: "Благодари вслух", en: "Say thank you", kk: "Дауыстап алғыс айт" },
    rule: { ru: "Благодари конкретно: за что именно ты признателен.", en: "Be specific when you thank someone: say exactly what for.", kk: "Нақты алғыс айт: нақ не үшін ризашылық білдіретініңді айт." },
    question: { ru: "Коллега помог подготовить твою презентацию. Как поблагодаришь?", en: "A colleague helped you prepare your presentation. How do you thank them?", kk: "Әріптесің презентацияңды дайындауға көмектесті. Оған қалай алғыс айтасың?" },
    options: [
      { ru: "«Спасибо» в чате", en: "A quick “thanks” in chat", kk: "Чатқа «Рақмет» деп жазамын" },
      { ru: "Лично: «Спасибо за схему на третьем слайде — она всё объяснила»", en: "In person: “Thanks for the diagram on slide three — it made it all clear”", kk: "Жеке өзі: «Үшінші слайдтағы сызба үшін рақмет — ол бәрін түсіндіріп берді»" },
      { ru: "Не стоит — это его работа", en: "No need — it's their job", kk: "Керегі жоқ — бұл оның жұмысы" },
    ],
    correct: 1,
    why: { ru: "Конкретная благодарность показывает, что ты действительно заметил вклад. Её запоминают надолго.", en: "Specific thanks shows you truly noticed the effort. People remember it.", kk: "Нақты алғыс сенің оның еңбегін шынымен байқағаныңды көрсетеді. Ол ұзақ есте қалады." },
  },
  {
    id: "goodbye",
    icon: "exit",
    title: { ru: "Заверши разговор красиво", en: "End the conversation well", kk: "Әңгімені әдемі аяқта" },
    rule: { ru: "Подведи итог, поблагодари за время и попрощайся по имени.", en: "Sum up, thank them for their time and say goodbye by name.", kk: "Қорытынды жаса, уақыты үшін алғыс айт және атымен атап қоштас." },
    question: { ru: "Разговор на встрече подошёл к концу. Как уйдёшь?", en: "A conversation at an event is winding down. How do you leave?", kk: "Кездесудегі әңгіме аяқталуға жақын. Қалай кетесің?" },
    options: [
      { ru: "Скажу «ну ладно» и отойду", en: "Say “well, okay” and walk off", kk: "«Жарайды онда» деп, кете беремін" },
      { ru: "«Рад был познакомиться, Игорь. Спасибо за советы!»", en: "“Great to meet you, Igor. Thanks for the advice!”", kk: "«Танысқаныма қуаныштымын, Игорь. Кеңестеріңізге рақмет!»" },
      { ru: "Дождусь, пока он сам уйдёт", en: "Wait until they leave first", kk: "Ол өзі кеткенше күтемін" },
    ],
    correct: 1,
    why: { ru: "Последние слова запоминаются лучше всего. Имя и благодарность в финале оставляют тёплое впечатление о всей встрече.", en: "Last words stick the most. A name and a thank-you at the end leave a warm impression of the whole meeting.", kk: "Соңғы сөздер бәрінен жақсы есте қалады. Соңында айтылған есім мен алғыс бүкіл кездесу туралы жылы әсер қалдырады." },
  },
];

// Base rules + themed packs (city, home & traditions, travel, digital, big scenes).
export const MANNERS_RULES: MannersRule[] = [...BASE_RULES, ...CITY, ...HOME, ...TRAVEL, ...DIGITAL, ...SCENES];

export const MANNERS_TOTAL = MANNERS_RULES.length;

export function getMannersRule(id: string): MannersRule | undefined {
  return MANNERS_RULES.find((r) => r.id === id);
}

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

// Rules of the previous round — the next one avoids them while it can.
let lastRound = new Set<string>();

/**
 * A quiz round that always feels new: unseen rules first, then the ones the
 * player got wrong, then the rest — never the previous round's rules while
 * there are others. Every round of 4+ carries at least one hard or trick case
 * when the pool has one.
 */
export function pickMannersRound(
  count: number,
  seen: string[] = [],
  missed: string[] = [],
): MannersRule[] {
  const seenSet = new Set(seen);
  const missedSet = new Set(missed);
  const pool = MANNERS_RULES.filter((r) => !lastRound.has(r.id));
  const base = pool.length >= count ? pool : MANNERS_RULES;
  const ranked = [
    ...shuffle(base.filter((r) => !seenSet.has(r.id))),
    ...shuffle(base.filter((r) => seenSet.has(r.id) && missedSet.has(r.id))),
    ...shuffle(base.filter((r) => seenSet.has(r.id) && !missedSet.has(r.id))),
  ];
  let round = ranked.slice(0, count);
  if (count >= 4) {
    const tough = (r: MannersRule) => !!r.kind;
    if (!round.some(tough)) {
      const extra = ranked.slice(count).find(tough);
      if (extra) round = [...round.slice(0, count - 1), extra];
    }
  }
  round = shuffle(round);
  lastRound = new Set(round.map((r) => r.id));
  return round;
}

/** Deterministic pick for a Path module (same question each visit). */
export function mannersForModule(moduleId: number, count = 1): MannersRule[] {
  const out: MannersRule[] = [];
  for (let i = 0; i < count; i++) {
    out.push(MANNERS_RULES[(moduleId * 3 + i * 7) % MANNERS_RULES.length]);
  }
  return out;
}
