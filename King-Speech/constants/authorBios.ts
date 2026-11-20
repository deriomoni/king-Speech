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
  // ── Kazakh literature (assets/content/kk/literature_kk.json) ──
  "Абай Құнанбайұлы": {
    life: "1845–1904",
    bio: "Великий казахский поэт, мыслитель и переводчик, основоположник казахской письменной литературы, автор «Слов назидания» (Қара сөздер).",
    bioKk: "Ұлы қазақ ақыны, ойшыл, аудармашы, қазақ жазба әдебиетінің негізін салушы, «Қара сөздердің» авторы.",
    bioEn: "The great Kazakh poet, thinker and translator, founder of Kazakh written literature and author of the «Book of Words» (Qara sözder).",
  },
  "Ыбырай Алтынсарин": {
    life: "1841–1889",
    bio: "Казахский просветитель и педагог, открывавший первые светские школы для казахских детей и составивший «Киргизскую хрестоматию» (1879) со своими стихами и рассказами.",
    bioKk: "Қазақ ағартушысы әрі педагогі, қазақ балаларына арналған алғашқы мектептерді ашып, өз өлеңдері мен әңгімелері енген «Қазақ хрестоматиясын» (1879) құрастырған.",
    bioEn: "Kazakh educator and enlightener who opened the first secular schools for Kazakh children and compiled the «Kyrgyz Chrestomathy» (1879) containing his own poems and stories.",
  },
  "Ахмет Байтұрсынұлы": {
    life: "1872–1937",
    bio: "Казахский поэт, языковед и общественный деятель движения «Алаш», реформатор казахской письменности, издавший сборник басен «Қырық мысал» (1909) по мотивам Крылова.",
    bioKk: "Қазақ ақыны, тіл ғалымы, «Алаш» қозғалысының қайраткері, қазақ жазуын реформалаған; Крылов мысалдары негізінде «Қырық мысал» (1909) жинағын шығарған.",
    bioEn: "Kazakh poet, linguist and Alash movement figure who reformed Kazakh writing and published «Forty Fables» (1909), adapted from Krylov.",
  },
  "Міржақып Дулатұлы": {
    life: "1885–1935",
    bio: "Казахский поэт и писатель, деятель движения «Алаш», автор сборника стихов «Оян, қазақ!» (1909) и первого казахского романа «Бақытсыз Жамал» (1910).",
    bioKk: "Қазақ ақыны мен жазушысы, «Алаш» қозғалысының қайраткері, «Оян, қазақ!» (1909) өлеңдер жинағының және алғашқы қазақ романы «Бақытсыз Жамалдың» (1910) авторы.",
    bioEn: "Kazakh poet, writer and Alash movement figure, author of the poetry collection «Wake Up, Kazakh!» (1909) and the first Kazakh novel «Unhappy Zhamal» (1910).",
  },
  "Халық ауыз әдебиеті": {
    life: "Халық мұрасы",
    bio: "Казахское устное народное творчество — эпосы, песни, сказки и пословицы, веками передававшиеся из уст в уста сказителями-жырау и акынами.",
    bioKk: "Қазақ халық ауыз әдебиеті – ғасырлар бойы жыраулар мен ақындар ауыздан-ауызға жеткізген жырлар, ертегілер, мақал-мәтелдер.",
    bioEn: "Kazakh oral folk literature: epics, songs, tales and proverbs passed down by word of mouth by bards (zhyrau) and akyns over centuries.",
  },
  "Мағжан Жұмабаев": {
    life: "1893–1938",
    bio: "Казахский поэт и педагог, деятель движения «Алаш», автор сборника «Шолпан» (1912); репрессирован и расстрелян в 1938 году.",
    bioKk: "Қазақ ақыны, педагог, Алаш қозғалысының қайраткері, «Шолпан» (1912) жинағының авторы; 1938 жылы қуғын-сүргін құрбаны болды.",
    bioEn: "Kazakh poet and educator, a figure of the Alash movement and author of the collection Sholpan (1912); executed during the purges in 1938.",
  },
  "Сәкен Сейфуллин": {
    life: "1894–1938",
    bio: "Казахский поэт и писатель, один из основоположников современной казахской литературы, автор поэм «Көкшетау» и «Аққудың айрылуы»; репрессирован в 1938 году.",
    bioKk: "Қазақ ақыны, жазушы, қазіргі қазақ әдебиетінің негізін қалаушылардың бірі, «Көкшетау», «Аққудың айрылуы» поэмаларының авторы; 1938 жылы қуғын-сүргін құрбаны болды.",
    bioEn: "Kazakh poet and writer, one of the founders of modern Kazakh literature, author of the poems Kokshetau and Akkudyn airyluy; executed during the purges in 1938.",
  },
  "Ілияс Жансүгіров": {
    life: "1894–1938",
    bio: "Казахский поэт и писатель, автор поэм «Құлагер», «Күй», «Күйші» и стихотворения «Жетісу суреттері»; репрессирован в 1938 году.",
    bioKk: "Қазақ ақыны, жазушы, «Құлагер», «Күй», «Күйші» поэмаларының және «Жетісу суреттері» өлеңінің авторы; 1938 жылы қуғын-сүргін құрбаны болды.",
    bioEn: "Kazakh poet and writer, author of the poems Kulager, Kui and Kuishi and of Zhetisu suretteri; executed during the purges in 1938.",
  },
  "Сұлтанмахмұт Торайғыров": {
    life: "1893–1920",
    bio: "Казахский поэт-просветитель, автор романа «Қамар сұлу» и поэм «Адасқан өмір» и «Кедей»; умер молодым от туберкулёза.",
    bioKk: "Қазақ ағартушы ақыны, «Қамар сұлу» романының, «Адасқан өмір», «Кедей» поэмаларының авторы; жас кезінде туберкулезден қайтыс болды.",
    bioEn: "Kazakh enlightener poet, author of the novel Kamar sulu and the poems Adaskan omir and Kedei; died young of tuberculosis.",
  },
  "Ақан сері": {
    life: "1843–1913",
    bio: "Акан сери Корамсаулы — казахский поэт, певец и композитор из Кокшетауского края, автор песен «Құлагер», «Сырымбет», «Балқадиша», «Маңмаңгер».",
    bioKk: "Ақан сері Қорамсаұлы – Көкшетау өңірінен шыққан ақын, әнші әрі сазгер, «Құлагер», «Сырымбет», «Балқадиша», «Маңмаңгер» әндерінің авторы.",
    bioEn: "Akan Seri Koramsauly was a Kazakh poet, singer and composer from the Kokshetau region, author of the songs «Kulager», «Syrymbet», «Balkadisha» and «Manmanger».",
  },
  "Шәкәрім Құдайбердіұлы": {
    life: "1858–1931",
    bio: "Шакарим Кудайбердиулы — казахский поэт, философ, историк, переводчик и композитор, племянник и ученик Абая.",
    bioKk: "Шәкәрім Құдайбердіұлы – ақын, философ, тарихшы, аудармашы әрі сазгер, Абайдың інісі әрі шәкірті.",
    bioEn: "Shakarim Kudaiberdiuly was a Kazakh poet, philosopher, historian, translator and composer, the nephew and disciple of Abai.",
  },
  "Махамбет Өтемісұлы": {
    life: "1803–1846",
    bio: "Махамбет Утемисулы — казахский поэт и батыр, соратник Исатая Тайманулы в восстании 1836–1838 годов в Букеевской Орде.",
    bioKk: "Махамбет Өтемісұлы – ақын әрі батыр, Бөкей Ордасындағы 1836–1838 жылғы көтерілісте Исатай Тайманұлының серігі болған.",
    bioEn: "Makhambet Utemisuly was a Kazakh poet and warrior, comrade-in-arms of Isatai Taimanuly in the 1836–1838 uprising in the Bukey Horde.",
  },
  "Бұқар жырау": {
    life: "1668–1781",
    bio: "Бухар-жырау Калкаманулы — казахский поэт-жырау XVIII века, советник хана Абылая.",
    bioKk: "Бұқар жырау Қалқаманұлы – XVIII ғасырдағы қазақ жырауы, Абылай ханның кеңесшісі.",
    bioEn: "Bukhar Zhyrau Kalkamanuly was an 18th-century Kazakh poet-bard (zhyrau) and adviser to Ablai Khan.",
  },
  "Төле би": {
    life: "1663–1756",
    bio: "Төле Алибекулы — верховный бий Старшего жуза, прославленный оратор и мудрец, один из составителей свода законов «Жеті жарғы» при Тауке-хане.",
    bioKk: "Төле Әлібекұлы – Ұлы жүздің бас биі, атақты шешен әрі дана, Тәуке хан тұсында «Жеті жарғы» заңын жасасқан билердің бірі.",
    bioEn: "Töle Älibekuly was the chief biy (judge) of the Senior Zhuz, a renowned orator and sage, and one of the compilers of the «Zhety Zhargy» law code under Tauke Khan.",
  },
  "Қазыбек би": {
    life: "1667–1764",
    bio: "Казыбек Келдибекулы — верховный бий Среднего жуза, оратор и дипломат по прозвищу «Қаз дауысты» («с голосом гуся»), участник переговоров с Джунгарским ханством.",
    bioKk: "Қазыбек Келдібекұлы – Орта жүздің бас биі, «Қаз дауысты» атанған шешен әрі елші, Жоңғар хандығымен келіссөздерге қатысқан.",
    bioEn: "Kazybek Keldibekuly was the chief biy of the Middle Zhuz, an orator and diplomat nicknamed «the goose-voiced», who took part in negotiations with the Dzungar Khanate.",
  },
  "Әйтеке би": {
    life: "1644–1700",
    bio: "Айтеке Байбекулы — верховный бий Младшего жуза, знаменитый оратор, один из составителей свода законов «Жеті жарғы» при Тауке-хане.",
    bioKk: "Әйтеке Байбекұлы – Кіші жүздің бас биі, атақты шешен, Тәуке хан тұсында «Жеті жарғы» заңын жасасқан билердің бірі.",
    bioEn: "Äiteke Baibekuly was the chief biy of the Junior Zhuz, a famous orator and one of the compilers of the «Zhety Zhargy» law code under Tauke Khan.",
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
