import type { ImageSourcePropType } from "react-native";

// Cover illustrations for the Show Time themes (assets/showtime-covers,
// 600×600 JPEG, from the «Обложки для Тем в Show Time» set, same order as the
// files there). Each theme gets the picture that fits its meaning; a few close
// themes share one.

const COVERS: ImageSourcePropType[] = [
  require("@/assets/showtime-covers/cover-01.jpg"), // 1 city crosswalk, people going their ways
  require("@/assets/showtime-covers/cover-02.jpg"), // 2 man on a pier at night, lost in thought
  require("@/assets/showtime-covers/cover-03.jpg"), // 3 woman against a storm wave and wind
  require("@/assets/showtime-covers/cover-04.jpg"), // 4 lying on a roof under the stars
  require("@/assets/showtime-covers/cover-05.jpg"), // 5 winding road through hills, a walker
  require("@/assets/showtime-covers/cover-06.jpg"), // 6 man on a ladder placing a star
  require("@/assets/showtime-covers/cover-07.jpg"), // 7 kid in the grass, birds form a «?»
  require("@/assets/showtime-covers/cover-08.jpg"), // 8 people around a fire at night
  require("@/assets/showtime-covers/cover-09.jpg"), // 9 a feast table of many dishes
  require("@/assets/showtime-covers/cover-10.jpg"), // 10 father and son on a pier
  require("@/assets/showtime-covers/cover-11.jpg"), // 11 alone in a cinema
  require("@/assets/showtime-covers/cover-12.jpg"), // 12 headphones on a roof, city as an equalizer
  require("@/assets/showtime-covers/cover-13.jpg"), // 13 grandma and girl kneading dough
  require("@/assets/showtime-covers/cover-14.jpg"), // 14 tin-can phone between two roofs
  require("@/assets/showtime-covers/cover-15.jpg"), // 15 sitting on a rock by a grey sea
  require("@/assets/showtime-covers/cover-16.jpg"), // 16 desk lamp in a dark room
  require("@/assets/showtime-covers/cover-17.jpg"), // 17 footprints across fresh snow
  require("@/assets/showtime-covers/cover-18.jpg"), // 18 sculptor and statue
  require("@/assets/showtime-covers/cover-19.jpg"), // 19 green future city
  require("@/assets/showtime-covers/cover-20.jpg"), // 20 speaker on a box, birds from his words
  require("@/assets/showtime-covers/cover-21.jpg"), // 21 dreaming in a tent
  require("@/assets/showtime-covers/cover-22.jpg"), // 22 two on a cliff looking out to sea
  require("@/assets/showtime-covers/cover-23.jpg"), // 23 cyclist along the coast
  require("@/assets/showtime-covers/cover-24.jpg"), // 24 grandfather and boy running on a beach
  require("@/assets/showtime-covers/cover-25.jpg"), // 25 the world from above: fields and rivers
  require("@/assets/showtime-covers/cover-26.jpg"), // 26 couple under one umbrella
  require("@/assets/showtime-covers/cover-27.jpg"), // 27 tram and skateboarder
  require("@/assets/showtime-covers/cover-28.jpg"), // 28 waiting at a bus stop
  require("@/assets/showtime-covers/cover-29.jpg"), // 29 stairs up a mountain to a star
  require("@/assets/showtime-covers/cover-30.jpg"), // 30 speaker's shadow at a podium
  require("@/assets/showtime-covers/cover-31.jpg"), // 31 rooftop: laptop, camera, bike
  require("@/assets/showtime-covers/cover-32.jpg"), // 32 path from a cave to the city
  require("@/assets/showtime-covers/cover-33.jpg"), // 33 spotlight on stage
  require("@/assets/showtime-covers/cover-34.jpg"), // 34 toddler running to dad in a park
  require("@/assets/showtime-covers/cover-35.jpg"), // 35 lying under a tree with a dog
  require("@/assets/showtime-covers/cover-36.jpg"), // 36 old man and child by a blooming tree
  require("@/assets/showtime-covers/cover-37.jpg"), // 37 looking at one's reflection in a lake
  require("@/assets/showtime-covers/cover-38.jpg"), // 38 a flock of birds released over a hill
  require("@/assets/showtime-covers/cover-39.jpg"), // 39 child on a rock, ripples spreading
  require("@/assets/showtime-covers/cover-40.jpg"), // 40 painter at the easel by the sea
  require("@/assets/showtime-covers/cover-41.jpg"), // 41 a green world in a grey puddle
  require("@/assets/showtime-covers/cover-42.jpg"), // 42 crowd lit by phones
  require("@/assets/showtime-covers/cover-43.jpg"), // 43 tree as a sundial
  require("@/assets/showtime-covers/cover-44.jpg"), // 44 brain made of a hedge maze
  require("@/assets/showtime-covers/cover-45.jpg"), // 45 two on a rock, one telling, one listening
  require("@/assets/showtime-covers/cover-46.jpg"), // 46 greenhouse workshop
  require("@/assets/showtime-covers/cover-47.jpg"), // 47 woman by a lake at dusk
  require("@/assets/showtime-covers/cover-48.jpg"), // 48 talking in a café
  require("@/assets/showtime-covers/cover-49.jpg"), // 49 leaving home with a suitcase
  require("@/assets/showtime-covers/cover-50.jpg"), // 50 coffee at a city window
  require("@/assets/showtime-covers/cover-51.jpg"), // 51 caravan by a lake
  require("@/assets/showtime-covers/cover-52.jpg"), // 52 a pool from above
];

// Where the subject sits, for frames wider than the square (the «Тема недели»
// card): 0 = keep the top, 0.5 = centre, 1 = keep the bottom. Default 0.5.
const FOCUS_Y: Record<number, number> = {
  4: 0.8, // the stargazer lies at the bottom
  5: 0.65, // the walker on the road
  6: 0.35, // the man on the ladder
  7: 0.45, // the «?» and the kid under it
  29: 0.8, // the girl at the foot of the stairs
  30: 0.65, // the podium with the microphone
  33: 0.75, // the figure in the spotlight
  34: 0.7, // father and toddler
  35: 0.7, // the man under the tree
  36: 0.65, // old man and child
  37: 0.85, // the woman at the water
  39: 0.75, // the child on the rock
  43: 0.25, // the sundial tree at the top
};

// Module number → cover number (1-based), by meaning of the module theme.
const PICKS: Record<number, number> = {
  1: 49, // Первый шаг — leaving home with a suitcase
  2: 2, // Мысли вслух — alone with one's thoughts on a pier
  3: 45, // Язык жизни — one tells, the other listens
  4: 37, // Голос внутри — one's reflection
  5: 50, // Маленькие радости — morning coffee at the window
  6: 3, // Невидимая сила — standing against the wind
  7: 34, // Сила доброго слова
  8: 45, // Дар слушать
  9: 38, // Сила слова — birds released
  10: 35, // Улыбка
  11: 5, // Добро и зло — the road you choose
  12: 4, // Звёзды над головой
  13: 39, // Эхо моего голоса — ripples
  14: 5, // Дорогу осилит идущий
  15: 7, // Почему так?
  16: 4, // Начало всего — the night sky
  17: 43, // Магия цифр — sundial
  18: 25, // Наука и мир
  19: 40, // Искусство
  20: 41, // Красота в глазах смотрящего
  21: 32, // Мир До и после
  22: 22, // Кит — the sea
  23: 31, // XXI век
  24: 43, // Время — sundial
  25: 44, // Тайны мозга
  26: 21, // Почему мы видим сны
  27: 25, // Земля круглая?
  28: 6, // Открытый космос
  29: 32, // Первый человек
  30: 8, // Рождение огня
  31: 30, // Первая речь
  32: 48, // Язык тела
  33: 46, // Труд сделал из обезьяны человека
  34: 9, // Еда народов
  35: 10, // Отцы и дети
  36: 12, // Моя Музыка
  37: 11, // Любимое кино
  38: 42, // WI-FI
  39: 13, // Связь поколений
  40: 19, // ИИ
  41: 14, // Связь
  42: 15, // Созерцание
  43: 16, // Идея
  44: 17, // С чистого листа
  45: 18, // Художник и его творение
  46: 19, // Технологии будущего
  47: 20, // Свобода слова
  48: 42, // Что такое маркетинг
  49: 52, // Лекарство юмор
  50: 16, // Учение — свет
  51: 47, // Говори о своей мечте
  52: 23, // Движение
  53: 24, // Спорт — это жизнь
  54: 40, // Творчество незаменимо
  55: 22, // Огромный мир вокруг
  56: 26, // Сила любви
  57: 27, // Назад в будущее
  58: 20, // Герой нашего времени
  59: 6, // Восходящая звезда — placing a star
  60: 51, // Мой выбор
  61: 30, // Власть слова
  62: 1, // Миллениалы — the city crossroads
  63: 29, // Дело жизни — the climb
  64: 36, // След и искусство
  65: 32, // Путь человечества
  66: 28, // Завтрашний день
  67: 33, // Под светом софитов
};

function pickFor(levelId: string): number {
  const m = /^showtime(\d*)$/.exec(levelId);
  const n = m ? (m[1] ? parseInt(m[1], 10) : 1) : 1;
  return PICKS[n] ?? ((n - 1) % COVERS.length) + 1;
}

/** Cover illustration for a Show Time theme id ("showtime", "showtime2", …). */
export function showtimeCover(levelId: string): ImageSourcePropType {
  return COVERS[pickFor(levelId) - 1];
}

/** Vertical focus of a theme's cover for wide frames (see FOCUS_Y). */
export function showtimeCoverFocusY(levelId: string): number {
  return FOCUS_Y[pickFor(levelId)] ?? 0.5;
}

/** Author credit for a theme's cover — none for these in-house illustrations. */
export function showtimeCoverCredit(_levelId: string): string {
  return "";
}
