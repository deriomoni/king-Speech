// «Королевские манеры» — etiquette as a quiz. Each rule comes with one
// situation question: the player picks how they'd act, then sees the right
// answer and why. Passed rules collect in «Мой опыт».
//
// Copy is RU + EN; KK falls back to RU via pickLang until it's translated.
import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import { pickLang, type Lang } from "@/context/LangContext";

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
  options: L[];
  /** Index into `options`. */
  correct: number;
  /** Shown after answering: why this is the royal way. */
  why: L;
};

export const MANNERS_RULES: MannersRule[] = [
  {
    id: "greet-all",
    icon: "hand-left",
    title: { ru: "Здоровайся со всеми", en: "Greet everyone" },
    rule: { ru: "Входя, приветствуй всех присутствующих — не только знакомых.", en: "When you walk in, greet everyone present — not only people you know." },
    question: { ru: "Ты вошёл в комнату, где сидят пятеро. Знаешь только одного. Что сделаешь первым делом?", en: "You walk into a room with five people. You know only one. What do you do first?" },
    options: [
      { ru: "Подойду к знакомому и поздороваюсь с ним", en: "Walk up to the one I know and greet them" },
      { ru: "Скажу «Добрый день» всем и улыбнусь", en: "Say “Good afternoon” to everyone and smile" },
      { ru: "Молча сяду — меня всё равно не знают", en: "Sit down quietly — they don't know me anyway" },
    ],
    correct: 1,
    why: { ru: "Приветствие всем сразу показывает уважение к каждому. Выделив одного, ты невольно делаешь остальных «невидимыми».", en: "Greeting everyone shows respect for each person. Singling out one person quietly makes the rest invisible." },
  },
  {
    id: "who-greets-first",
    icon: "people",
    title: { ru: "Кто здоровается первым", en: "Who greets first" },
    rule: { ru: "Первым здоровается входящий и младший по положению.", en: "The one who enters and the junior in rank greet first." },
    question: { ru: "Ты заходишь в кабинет к директору. Кто должен поздороваться первым?", en: "You walk into the director's office. Who should greet first?" },
    options: [
      { ru: "Директор — он старше по должности", en: "The director — they're senior" },
      { ru: "Я — я вхожу и я младше по положению", en: "Me — I'm entering and I'm junior" },
      { ru: "Неважно, кто успеет", en: "Doesn't matter, whoever's quicker" },
    ],
    correct: 1,
    why: { ru: "Входящий приветствует тех, кто уже в комнате, а младший — старшего. Здесь оба правила указывают на тебя.", en: "The person entering greets those already inside, and the junior greets the senior. Both rules point to you." },
  },
  {
    id: "handshake",
    icon: "hand-right",
    title: { ru: "Рука — по инициативе старшего", en: "The senior offers a hand" },
    rule: { ru: "Руку для рукопожатия первым протягивает старший по возрасту или положению.", en: "The senior in age or rank is the one who offers a hand first." },
    question: { ru: "Тебя знакомят с генеральным директором компании. Как поступишь?", en: "You're introduced to the company's CEO. What do you do?" },
    options: [
      { ru: "Сразу протяну руку — так увереннее", en: "Offer my hand right away — it looks confident" },
      { ru: "Поздороваюсь и подожду, протянет ли он руку", en: "Say hello and wait to see if they offer a hand" },
      { ru: "Обниму — так теплее", en: "Hug them — it's warmer" },
    ],
    correct: 1,
    why: { ru: "Право начать рукопожатие — за старшим. Протянет руку — пожми уверенно, не протянет — достаточно кивка и улыбки.", en: "The right to start a handshake belongs to the senior. If they offer, shake firmly; if not, a nod and a smile are enough." },
  },
  {
    id: "introductions",
    icon: "git-compare",
    title: { ru: "Кого кому представляют", en: "Who's introduced to whom" },
    rule: { ru: "Младшего представляют старшему, мужчину — женщине, своего — гостю.", en: "Introduce the junior to the senior, the man to the woman, your colleague to the guest." },
    question: { ru: "Тебе нужно познакомить стажёра с руководителем отдела. С чего начнёшь?", en: "You need to introduce an intern to the head of department. How do you start?" },
    options: [
      { ru: "«Анна Петровна, познакомьтесь — это Максим, наш стажёр»", en: "“Anna, let me introduce Max, our intern”" },
      { ru: "«Максим, это Анна Петровна, наш руководитель»", en: "“Max, this is Anna, our head of department”" },
      { ru: "Пусть знакомятся сами", en: "Let them introduce themselves" },
    ],
    correct: 0,
    why: { ru: "Сначала обращаются к старшему: ему «представляют» младшего. Так ты подчёркиваешь его статус.", en: "You address the senior first and present the junior to them. It acknowledges their status." },
  },
  {
    id: "start-dialog",
    icon: "chatbubbles",
    title: { ru: "Как начать разговор", en: "How to start a conversation" },
    rule: { ru: "Приветствие, имя, затем вопрос о собеседнике — не о себе.", en: "Greeting, your name, then a question about them — not about you." },
    question: { ru: "На конференции рядом с тобой незнакомый человек. Как лучше начать разговор?", en: "At a conference you're next to a stranger. What's the best way to start?" },
    options: [
      { ru: "Сразу рассказать о своём проекте", en: "Jump straight into pitching my project" },
      { ru: "«Здравствуйте, я Алекс. Как вам доклад?»", en: "“Hi, I'm Alex. What did you think of the talk?”" },
      { ru: "Ждать, пока он заговорит первым", en: "Wait for them to speak first" },
    ],
    correct: 1,
    why: { ru: "Приветствие и имя снимают напряжение, а вопрос о его мнении приглашает к диалогу. Люди охотнее говорят, когда интересуются ими.", en: "A greeting and your name ease the tension; asking their opinion invites a dialogue. People open up when you're interested in them." },
  },
  {
    id: "no-back",
    icon: "body",
    title: { ru: "Не стой спиной к людям", en: "Never turn your back" },
    rule: { ru: "Держись лицом к собеседникам; уходя — сначала шаг назад, потом разворот.", en: "Keep facing the people you're with; when leaving, step back first, then turn." },
    question: { ru: "Ты закончил разговор с группой коллег и уходишь. Как поступишь?", en: "You've finished talking to a group of colleagues and you're leaving. What do you do?" },
    options: [
      { ru: "Резко развернусь и пойду", en: "Turn around sharply and go" },
      { ru: "Попрощаюсь, сделаю шаг назад и только потом развернусь", en: "Say goodbye, take a step back, then turn" },
      { ru: "Буду пятиться до самой двери", en: "Walk backwards all the way to the door" },
    ],
    correct: 1,
    why: { ru: "Спина читается как «разговор мне больше не интересен». Шаг назад после прощания — мягкий сигнал, что ты уходишь с уважением.", en: "Your back reads as “I'm no longer interested”. A step back after saying goodbye signals you're leaving respectfully." },
  },
  {
    id: "no-chewing",
    icon: "restaurant",
    title: { ru: "Не жуй во время разговора", en: "Don't chew while talking" },
    rule: { ru: "Сначала проглоти, потом отвечай; жвачку убери до встречи.", en: "Swallow first, then answer; get rid of gum before a meeting." },
    question: { ru: "Ты жуёшь, и к тебе обращается коллега с вопросом. Что сделаешь?", en: "You're chewing when a colleague asks you a question. What do you do?" },
    options: [
      { ru: "Отвечу сразу, прикрыв рот рукой", en: "Answer right away, covering my mouth" },
      { ru: "Покажу жестом «минуту», проглочу и отвечу", en: "Gesture “one moment”, swallow, then answer" },
      { ru: "Сделаю вид, что не услышал", en: "Pretend I didn't hear" },
    ],
    correct: 1,
    why: { ru: "Говорить с едой во рту неприятно для собеседника. Короткий жест и пауза в пару секунд — вежливее, чем невнятный ответ.", en: "Talking with food in your mouth is unpleasant to watch. A quick gesture and a two-second pause is more polite than a mumbled reply." },
  },
  {
    id: "eye-contact",
    icon: "eye",
    title: { ru: "Смотри в глаза", en: "Keep eye contact" },
    rule: { ru: "Смотри собеседнику в глаза большую часть разговора, но без пристального взгляда.", en: "Look the person in the eye for most of the conversation — without staring." },
    question: { ru: "Тебе задают вопрос на собеседовании. Куда смотришь, пока отвечаешь?", en: "You're asked a question at an interview. Where do you look while answering?" },
    options: [
      { ru: "В пол — так легче сосредоточиться", en: "At the floor — it helps me focus" },
      { ru: "В глаза, иногда отводя взгляд, чтобы подумать", en: "In their eyes, glancing away now and then to think" },
      { ru: "Не отрываясь, прямо в глаза", en: "Straight into their eyes without a break" },
    ],
    correct: 1,
    why: { ru: "Зрительный контакт говорит «я с тобой и мне нечего скрывать». Но взгляд без пауз давит — естественно иногда отводить глаза.", en: "Eye contact says “I'm with you and have nothing to hide”. A non-stop stare feels pushy — glancing away now and then is natural." },
  },
  {
    id: "phone-away",
    icon: "phone-portrait",
    title: { ru: "Телефон — в сторону", en: "Phone away" },
    rule: { ru: "В разговоре телефон убран экраном вниз или в карман.", en: "In a conversation, the phone goes face-down or in your pocket." },
    question: { ru: "Во время беседы приходит сообщение. Что сделаешь?", en: "A message arrives mid-conversation. What do you do?" },
    options: [
      { ru: "Быстро гляну — это займёт секунду", en: "Take a quick look — it's just a second" },
      { ru: "Не буду смотреть до конца разговора", en: "Leave it until the conversation is over" },
      { ru: "Отвечу, продолжая кивать собеседнику", en: "Reply while nodding along" },
    ],
    correct: 1,
    why: { ru: "Взгляд в телефон сообщает: «кто-то важнее тебя». Если ждёшь срочный звонок — предупреди заранее и извинись.", en: "Glancing at your phone says “someone matters more than you”. If you expect an urgent call, warn them in advance." },
  },
  {
    id: "no-interrupt",
    icon: "hand-left-outline",
    title: { ru: "Не перебивай", en: "Don't interrupt" },
    rule: { ru: "Дай договорить; хочешь вставить слово — дождись паузы.", en: "Let people finish; wait for a pause to speak." },
    question: { ru: "Собеседник рассказывает долго, а у тебя есть важное дополнение. Как поступишь?", en: "Someone is talking at length and you have an important point. What do you do?" },
    options: [
      { ru: "Перебью, пока не забыл", en: "Cut in before I forget" },
      { ru: "Дождусь паузы и скажу «Можно добавлю?»", en: "Wait for a pause and say “May I add something?”" },
      { ru: "Промолчу совсем", en: "Stay silent altogether" },
    ],
    correct: 1,
    why: { ru: "Перебивая, ты показываешь, что твои мысли важнее чужих. Пауза и короткая просьба сохраняют и твою мысль, и уважение.", en: "Interrupting suggests your thoughts matter more. A pause and a short request keep both your point and the respect." },
  },
  {
    id: "use-name",
    icon: "person-circle",
    title: { ru: "Обращайся по имени", en: "Use their name" },
    rule: { ru: "Запомни имя при знакомстве и называй человека по нему.", en: "Remember the name when you meet and use it." },
    question: { ru: "Тебе представили человека, и ты сразу забыл его имя. Что лучше сделать?", en: "You were introduced to someone and instantly forgot their name. What's best?" },
    options: [
      { ru: "Весь разговор обходиться без имени", en: "Avoid using a name the whole time" },
      { ru: "Сразу честно переспросить: «Простите, как вас зовут?»", en: "Ask right away: “Sorry, what was your name?”" },
      { ru: "Назвать наугад — вдруг угадаю", en: "Guess — maybe I'll get it right" },
    ],
    correct: 1,
    why: { ru: "Переспросить в начале — нормально и даже вежливо. Неловко становится, когда имя выясняется через час разговора.", en: "Asking again at the start is fine, even polite. It only gets awkward an hour into the conversation." },
  },
  {
    id: "formal-you",
    icon: "ribbon",
    title: { ru: "На «вы» — по умолчанию", en: "Formal by default" },
    rule: { ru: "С незнакомыми и старшими — на «вы», пока не предложат иначе.", en: "Use the formal form with strangers and seniors until invited otherwise." },
    question: { ru: "Новый клиент твоего возраста. Как обратишься в первом письме?", en: "A new client your age. How do you address them in the first email?" },
    options: [
      { ru: "На «ты» — мы ровесники", en: "Informally — we're the same age" },
      { ru: "На «вы», пока он сам не предложит перейти на «ты»", en: "Formally, until they suggest otherwise" },
      { ru: "Без обращения вообще", en: "No address at all" },
    ],
    correct: 1,
    why: { ru: "«Вы» — безопасная дистанция уважения. Перейти на «ты» легко, а вот вернуть дистанцию после фамильярности — почти невозможно.", en: "Formality is a safe, respectful distance. Going informal is easy; restoring distance after being too familiar is nearly impossible." },
  },
  {
    id: "knock",
    icon: "enter",
    title: { ru: "Постучи, прежде чем войти", en: "Knock before entering" },
    rule: { ru: "В закрытую дверь стучат и ждут ответа; входят — здороваясь.", en: "Knock on a closed door and wait for an answer; greet as you walk in." },
    question: { ru: "Дверь в переговорную закрыта, внутри голоса. Тебе нужно передать документ.", en: "The meeting room door is closed and you hear voices. You need to hand over a document." },
    options: [
      { ru: "Тихо войду, чтобы не мешать", en: "Slip in quietly so as not to disturb" },
      { ru: "Постучу, дождусь «да», войду и извинюсь за беспокойство", en: "Knock, wait for “come in”, enter and apologise for interrupting" },
      { ru: "Подсуну документ под дверь", en: "Slide it under the door" },
    ],
    correct: 1,
    why: { ru: "Стук даёт людям секунду подготовиться. Короткое «извините, что прерываю» показывает, что ты ценишь их время.", en: "A knock gives people a moment to prepare. A brief “sorry to interrupt” shows you value their time." },
  },
  {
    id: "posture",
    icon: "accessibility",
    title: { ru: "Руки — не в карманах", en: "Hands out of pockets" },
    rule: { ru: "Держи руки открыто: не в карманах и не скрещенными на груди.", en: "Keep your hands open: not in pockets, not folded across your chest." },
    question: { ru: "Ты слушаешь выступление коллеги, стоя рядом. Как держишь руки?", en: "You're standing, listening to a colleague's talk. What do you do with your hands?" },
    options: [
      { ru: "Скрещу на груди — так удобно", en: "Fold my arms — it's comfortable" },
      { ru: "Свободно вдоль тела или в лёгком замке спереди", en: "Relaxed at my sides or lightly clasped in front" },
      { ru: "В карманах брюк", en: "In my trouser pockets" },
    ],
    correct: 1,
    why: { ru: "Скрещённые руки читаются как защита или несогласие, руки в карманах — как небрежность. Открытая поза говорит «я с вами».", en: "Folded arms read as defensive or disagreeing, hands in pockets as careless. An open posture says “I'm with you”." },
  },
  {
    id: "thank",
    icon: "heart",
    title: { ru: "Благодари вслух", en: "Say thank you" },
    rule: { ru: "Благодари конкретно: за что именно ты признателен.", en: "Be specific when you thank someone: say exactly what for." },
    question: { ru: "Коллега помог подготовить твою презентацию. Как поблагодаришь?", en: "A colleague helped you prepare your presentation. How do you thank them?" },
    options: [
      { ru: "«Спасибо» в чате", en: "A quick “thanks” in chat" },
      { ru: "Лично: «Спасибо за схему на третьем слайде — она всё объяснила»", en: "In person: “Thanks for the diagram on slide three — it made it all clear”" },
      { ru: "Не стоит — это его работа", en: "No need — it's their job" },
    ],
    correct: 1,
    why: { ru: "Конкретная благодарность показывает, что ты действительно заметил вклад. Её запоминают надолго.", en: "Specific thanks shows you truly noticed the effort. People remember it." },
  },
  {
    id: "goodbye",
    icon: "exit",
    title: { ru: "Заверши разговор красиво", en: "End the conversation well" },
    rule: { ru: "Подведи итог, поблагодари за время и попрощайся по имени.", en: "Sum up, thank them for their time and say goodbye by name." },
    question: { ru: "Разговор на встрече подошёл к концу. Как уйдёшь?", en: "A conversation at an event is winding down. How do you leave?" },
    options: [
      { ru: "Скажу «ну ладно» и отойду", en: "Say “well, okay” and walk off" },
      { ru: "«Рад был познакомиться, Игорь. Спасибо за советы!»", en: "“Great to meet you, Igor. Thanks for the advice!”" },
      { ru: "Дождусь, пока он сам уйдёт", en: "Wait until they leave first" },
    ],
    correct: 1,
    why: { ru: "Последние слова запоминаются лучше всего. Имя и благодарность в финале оставляют тёплое впечатление о всей встрече.", en: "Last words stick the most. A name and a thank-you at the end leave a warm impression of the whole meeting." },
  },
];

export const MANNERS_TOTAL = MANNERS_RULES.length;

export function getMannersRule(id: string): MannersRule | undefined {
  return MANNERS_RULES.find((r) => r.id === id);
}

/** A quiz round: unseen rules first, then the rest, shuffled. */
export function pickMannersRound(count: number, seen: string[] = []): MannersRule[] {
  const shuffle = <T,>(a: T[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const fresh = shuffle(MANNERS_RULES.filter((r) => !seen.includes(r.id)));
  const old = shuffle(MANNERS_RULES.filter((r) => seen.includes(r.id)));
  return [...fresh, ...old].slice(0, count);
}

/** Deterministic pick for a Path module (same question each visit). */
export function mannersForModule(moduleId: number, count = 1): MannersRule[] {
  const out: MannersRule[] = [];
  for (let i = 0; i < count; i++) {
    out.push(MANNERS_RULES[(moduleId * 3 + i * 7) % MANNERS_RULES.length]);
  }
  return out;
}
