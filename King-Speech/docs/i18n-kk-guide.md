# Kazakh (kk) localization guide — King Speech

App languages: `ru` (base), `en`, `kk` (Қазақ тілі, Cyrillic script).
`Lang = "ru" | "en" | "kk"` lives in `context/LangContext.tsx`.

## Code rules

1. **Never let a Kazakh user see English.** `lang === "ru" ? RU : EN` is now a bug
   (kk gets English). `lang === "en" ? EN : RU` gives kk Russian — also not OK
   for UI text.
2. Use the helper from `@/context/LangContext`:
   ```ts
   import { pickLang } from "@/context/LangContext";
   pickLang(lang, { ru: "Начать", en: "Start", kk: "Бастау" })
   ```
   `pickLang` falls back to `ru` if `kk` is missing.
   Short boolean helpers like `const en = lang === "en"` + `en ? "A" : "B"` →
   replace each usage with `pickLang(lang, {...})`.
3. `Record<Lang, X>` objects → add a `kk:` entry.
   `{ ru, en }[lang]` / `X[lang]` lookups → make sure a `kk` entry exists, or use
   `X[lang] ?? X.ru`.
4. Props typed `lang: "ru" | "en"` → change to `lang: Lang` (import type).
5. Dates/numbers: `LANG_LOCALE[lang]` ("ru-RU" | "kk-KZ" | "en-US").
6. Plurals: Kazakh nouns do NOT change after numerals ("5 деңгей", "3 жұлдыз",
   "10 монета"). Where RU code has plural helpers (`plural(n, "уровень", ...)`),
   kk just uses one form.
7. Don't change logic, styling, layout or content-loading code
   (getLiterature / getTongueTwistersForModule / getShowtimeModule /
   getLevelsData / getTasksData) — only text and lang branching.
8. Keep `{name}`-style placeholders, emoji, `\n`, and markup exactly.
9. Kazakh words are often longer than Russian. If a string sits in a tight
   button/chip, prefer the shorter natural variant.

## Style

- Address the user informally with **сен** (as RU uses «ты»): «Сен жасай аласың!»,
  «Дайынсың ба?». Imperatives in 2nd person informal: «Оқы», «Айт», «Тыңда»,
  «Дем ал».
- Buttons / menu items: verbal noun (-у/-ю) form, like iOS Kazakh UI:
  «Бастау», «Жалғастыру», «Келесі», «Өткізіп жіберу», «Болдырмау», «Сақтау»,
  «Шығу», «Қайталау», «Жабу», «Дайын».
- Warm, encouraging, natural modern Kazakh (not word-for-word calque from RU,
  no Russian words where a normal Kazakh word exists, but do keep established
  loanwords: профиль, модуль, микрофон, камера, дикция, интонация, аудио,
  видео, сценарий, блогер, т.б.).
- Correct Kazakh letters: ә, ғ, қ, ң, ө, ұ, ү, һ, і. Never substitute Russian
  look-alikes (e.g. «к» for «қ», «у» for «ұ/ү», «и» for «і»).

## Glossary (use consistently)

| RU | kk |
|---|---|
| King Speech, Show Time, Pro, XP, Jenny, Оскар | unchanged |
| Путь (tab) | Жол |
| Уровень | Деңгей |
| Модуль | Модуль |
| Задание | Тапсырма |
| Шпаргалка (tab) | Шпаргалка |
| Профиль | Профиль |
| Настройки | Баптаулар |
| Распевка | Дауыс жаттығуы |
| Разминка рта / артикуляция | Ауыз жаттығуы / артикуляция |
| Скороговорка | Жаңылтпаш |
| Чтение | Оқу |
| Интервью | Сұхбат |
| Словарный запас / лексика (vocabulary level) | Сөздік қор |
| Синоним | Синоним |
| Роли | Рөлдер |
| Аудио-дневник / дневник | Аудио-күнделік / күнделік |
| Библиотека | Кітапхана |
| Монеты | Монеталар |
| Звёзды | Жұлдыздар |
| Ранг | Дәреже |
| Серия (streak) | Серия |
| Каталог тем | Тақырыптар каталогы |
| Стать автором | Автор болу |
| Выступление | Сөз сөйлеу / өнер көрсету (stage) |
| Зрители / зал | Көрермендер / зал |
| Оратор | Шешен |
| Публичные выступления | Көпшілік алдында сөйлеу |
| Дикция | Дикция |
| Темп | Қарқын |
| Паузы | Үзілістер |
| Уверенность | Сенімділік |
| Выразительность | Мәнерлілік |
| Громкость / голос | Дауыс қаттылығы / дауыс |
| Интонация | Интонация |
| Слова-паразиты | Паразит сөздер |
| Грамотность | Сауаттылық |
| Запись / записать | Жазба / жазу |
| Микрофон | Микрофон |
| Результат(ы) | Нәтиже(лер) |
| Совет | Кеңес |
| Попробуй ещё раз | Тағы байқап көр |
| Отлично! | Керемет! |
| Уровень пройден | Деңгей өтілді |
| Войти / Выйти (account) | Кіру / Шығу |
| Тема оформления (light/dark setting) | Көрініс; светлая/тёмная → Ашық / Қараңғы |
| Тема (speech topic) | Тақырып |
| Язык | Тіл |
