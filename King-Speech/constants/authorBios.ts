// Verified, encyclopedic facts for the 15 authors present in
// assets/content/king_speech_literature_content.json. Only well-established
// public-domain facts (life years + a one-line factual note) — no invented
// detail. Keyed by the exact author string used in the content.

import type { Lang } from "@/context/LangContext";

export interface AuthorBio {
  /** Life span, e.g. "1799–1837". */
  life: string;
  /** One factual sentence (RU). */
  bio: string;
  /** Kazakh version of `bio`. */
  bioKk?: string;
  /** English version of `bio`. */
  bioEn?: string;
}

export const AUTHOR_BIOS: Record<string, AuthorBio> = {
  "Александр Пушкин": {
    life: "1799–1837",
    bio: "Русский поэт, драматург и прозаик, заложивший основы современного русского литературного языка.",
    bioKk: "Орыс ақыны, драматург және прозашы, қазіргі орыс әдеби тілінің негізін қалаушы.",
    bioEn: "Russian poet, playwright and prose writer who laid the foundations of the modern Russian literary language.",
  },
  "Михаил Лермонтов": {
    life: "1814–1841",
    bio: "Русский поэт, прозаик и драматург, автор романа «Герой нашего времени».",
    bioKk: "Орыс ақыны, прозашы және драматург, «Біздің заманның қаһарманы» романының авторы.",
    bioEn: "Russian poet, prose writer and playwright, author of the novel “A Hero of Our Time”.",
  },
  "Фёдор Тютчев": {
    life: "1803–1873",
    bio: "Русский поэт и дипломат, мастер философской и пейзажной лирики.",
    bioKk: "Орыс ақыны және дипломат, философиялық және табиғат лирикасының шебері.",
    bioEn: "Russian poet and diplomat, a master of philosophical and landscape lyric poetry.",
  },
  "Афанасий Фет": {
    life: "1820–1892",
    bio: "Русский поэт-лирик, известный пейзажной и любовной поэзией.",
    bioKk: "Орыс лирик ақыны, табиғат пен махаббат туралы өлеңдерімен танымал.",
    bioEn: "Russian lyric poet known for his landscape and love poetry.",
  },
  "Николай Некрасов": {
    life: "1821–1878",
    bio: "Русский поэт и редактор журнала «Современник», писавший о жизни народа.",
    bioKk: "Орыс ақыны, «Современник» журналының редакторы, халық өмірі туралы жазған.",
    bioEn: "Russian poet and editor of the journal “Sovremennik” who wrote about the life of ordinary people.",
  },
  "Иван Крылов": {
    life: "1769–1844",
    bio: "Русский баснописец, чьи басни вошли в народную речь.",
    bioKk: "Орыс мысалшысы, оның мысалдары халық тіліне енген.",
    bioEn: "Russian fabulist whose fables became part of everyday speech.",
  },
  "Иван Тургенев": {
    life: "1818–1883",
    bio: "Русский писатель, автор романов и цикла «Стихотворения в прозе».",
    bioKk: "Орыс жазушысы, романдар мен «Қара сөзбен жазылған өлеңдер» циклінің авторы.",
    bioEn: "Russian writer, author of novels and the cycle “Poems in Prose”.",
  },
  "Гавриил Державин": {
    life: "1743–1816",
    bio: "Русский поэт эпохи Просвещения и государственный деятель.",
    bioKk: "Ағартушылық дәуірінің орыс ақыны және мемлекет қайраткері.",
    bioEn: "Russian poet of the Age of Enlightenment and statesman.",
  },
  "Иван Бунин": {
    life: "1870–1953",
    bio: "Русский писатель и поэт, первый российский лауреат Нобелевской премии по литературе (1933).",
    bioKk: "Орыс жазушысы және ақыны, әдебиет бойынша Нобель сыйлығының алғашқы ресейлік лауреаты (1933).",
    bioEn: "Russian writer and poet, the first Russian Nobel laureate in Literature (1933).",
  },
  "Анна Ахматова": {
    life: "1889–1966",
    bio: "Русская поэтесса Серебряного века, одна из крупнейших фигур русской поэзии XX века.",
    bioKk: "Күміс ғасырдың орыс ақыны, XX ғасырдағы орыс поэзиясының ең ірі тұлғаларының бірі.",
    bioEn: "Russian poet of the Silver Age, one of the greatest figures of 20th-century Russian poetry.",
  },
  "Марина Цветаева": {
    life: "1892–1941",
    bio: "Русская поэтесса и прозаик Серебряного века.",
    bioKk: "Күміс ғасырдың орыс ақыны және прозашысы.",
    bioEn: "Russian poet and prose writer of the Silver Age.",
  },
  "Сергей Есенин": {
    life: "1895–1925",
    bio: "Русский поэт, представитель новокрестьянской поэзии и имажинизма.",
    bioKk: "Орыс ақыны, жаңа шаруа поэзиясы мен имажинизмнің өкілі.",
    bioEn: "Russian poet, a representative of new peasant poetry and Imaginism.",
  },
  "Борис Пастернак": {
    life: "1890–1960",
    bio: "Русский поэт и прозаик, лауреат Нобелевской премии по литературе (1958).",
    bioKk: "Орыс ақыны және прозашысы, әдебиет бойынша Нобель сыйлығының лауреаты (1958).",
    bioEn: "Russian poet and prose writer, Nobel laureate in Literature (1958).",
  },
  "Николай Гумилёв": {
    life: "1886–1921",
    bio: "Русский поэт, основоположник акмеизма.",
    bioKk: "Орыс ақыны, акмеизмнің негізін қалаушы.",
    bioEn: "Russian poet, founder of Acmeism.",
  },
  "Николай Заболоцкий": {
    life: "1903–1958",
    bio: "Русский поэт и переводчик.",
    bioKk: "Орыс ақыны және аудармашы.",
    bioEn: "Russian poet and translator.",
  },
};

/**
 * Author facts for the info sheet. `lang` is optional (defaults to RU) so
 * existing callers keep working; pass it to get a localized `bio`.
 */
export function getAuthorBio(author?: string, lang: Lang = "ru"): AuthorBio | null {
  if (!author) return null;
  const b = AUTHOR_BIOS[author.trim()];
  if (!b) return null;
  const bio = lang === "kk" ? b.bioKk ?? b.bio : lang === "en" ? b.bioEn ?? b.bio : b.bio;
  return { ...b, bio };
}
