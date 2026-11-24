import type { ImageSourcePropType } from "react-native";

// Cover illustrations for the Show Time themes (assets/showtime-covers,
// 600×600 JPEG, from the «Обложки для Тем в Show Time» set). Each theme gets
// the picture that fits its meaning; a few close themes share one.

const COVERS: ImageSourcePropType[] = [
  require("@/assets/showtime-covers/cover-01.jpg"), // 1 winding road through hills, a walker
  require("@/assets/showtime-covers/cover-02.jpg"), // 2 man on a ladder placing a star
  require("@/assets/showtime-covers/cover-03.jpg"), // 3 kid in the grass, birds form a «?»
  require("@/assets/showtime-covers/cover-04.jpg"), // 4 people around a fire at night
  require("@/assets/showtime-covers/cover-05.jpg"), // 5 a feast table of many dishes
  require("@/assets/showtime-covers/cover-06.jpg"), // 6 father and son on a pier
  require("@/assets/showtime-covers/cover-07.jpg"), // 7 alone in a cinema
  require("@/assets/showtime-covers/cover-08.jpg"), // 8 headphones on a roof, city as an equalizer
  require("@/assets/showtime-covers/cover-09.jpg"), // 9 grandma and girl kneading dough
  require("@/assets/showtime-covers/cover-10.jpg"), // 10 tin-can phone between two roofs
  require("@/assets/showtime-covers/cover-11.jpg"), // 11 sitting on a rock by a grey sea
  require("@/assets/showtime-covers/cover-12.jpg"), // 12 desk lamp in a dark room
  require("@/assets/showtime-covers/cover-13.jpg"), // 13 footprints across fresh snow
  require("@/assets/showtime-covers/cover-14.jpg"), // 14 sculptor and statue
  require("@/assets/showtime-covers/cover-15.jpg"), // 15 green future city
  require("@/assets/showtime-covers/cover-16.jpg"), // 16 speaker on a box, birds from his words
  require("@/assets/showtime-covers/cover-17.jpg"), // 17 dreaming in a tent
  require("@/assets/showtime-covers/cover-18.jpg"), // 18 two on a cliff looking out to sea
  require("@/assets/showtime-covers/cover-19.jpg"), // 19 cyclist along the coast
  require("@/assets/showtime-covers/cover-20.jpg"), // 20 grandfather and boy running on a beach
  require("@/assets/showtime-covers/cover-21.jpg"), // 21 the world from above: fields and rivers
  require("@/assets/showtime-covers/cover-22.jpg"), // 22 couple under one umbrella
  require("@/assets/showtime-covers/cover-23.jpg"), // 23 tram and skateboarder
  require("@/assets/showtime-covers/cover-24.jpg"), // 24 waiting at a bus stop
  require("@/assets/showtime-covers/cover-25.jpg"), // 25 stairs up a mountain to a star
  require("@/assets/showtime-covers/cover-26.jpg"), // 26 speaker's shadow at a podium
  require("@/assets/showtime-covers/cover-27.jpg"), // 27 rooftop: laptop, camera, bike
  require("@/assets/showtime-covers/cover-28.jpg"), // 28 path from a cave to the city
  require("@/assets/showtime-covers/cover-29.jpg"), // 29 spotlight on stage
  require("@/assets/showtime-covers/cover-30.jpg"), // 30 toddler running to dad in a park
  require("@/assets/showtime-covers/cover-31.jpg"), // 31 lying under a tree with a dog
  require("@/assets/showtime-covers/cover-32.jpg"), // 32 old man and child by a blooming tree
  require("@/assets/showtime-covers/cover-33.jpg"), // 33 looking at one's reflection in a lake
  require("@/assets/showtime-covers/cover-34.jpg"), // 34 a flock of birds released over a hill
  require("@/assets/showtime-covers/cover-35.jpg"), // 35 child on a rock, ripples spreading
  require("@/assets/showtime-covers/cover-36.jpg"), // 36 painter at the easel by the sea
  require("@/assets/showtime-covers/cover-37.jpg"), // 37 a green world in a grey puddle
  require("@/assets/showtime-covers/cover-38.jpg"), // 38 crowd lit by phones
  require("@/assets/showtime-covers/cover-39.jpg"), // 39 tree as a sundial
  require("@/assets/showtime-covers/cover-40.jpg"), // 40 brain made of a hedge maze
  require("@/assets/showtime-covers/cover-41.jpg"), // 41 two on a rock, one telling, one listening
  require("@/assets/showtime-covers/cover-42.jpg"), // 42 greenhouse workshop
  require("@/assets/showtime-covers/cover-43.jpg"), // 43 woman by a lake at dusk
  require("@/assets/showtime-covers/cover-44.jpg"), // 44 talking in a café
  require("@/assets/showtime-covers/cover-45.jpg"), // 45 leaving home with a suitcase
  require("@/assets/showtime-covers/cover-46.jpg"), // 46 coffee at a city window
  require("@/assets/showtime-covers/cover-47.jpg"), // 47 caravan by a lake
  require("@/assets/showtime-covers/cover-48.jpg"), // 48 a pool from above
];

// Module number → cover number (1-based), by meaning of the module theme.
const PICKS: Record<number, number> = {
  1: 45, // Первый шаг — leaving home with a suitcase
  2: 43, // Мысли вслух
  3: 41, // Язык жизни
  4: 33, // Голос внутри — one's reflection
  5: 31, // Маленькие радости
  6: 11, // Невидимая сила
  7: 30, // Сила доброго слова
  8: 41, // Дар слушать
  9: 34, // Сила слова — birds released
  10: 30, // Улыбка
  11: 1, // Добро и зло — the road you choose
  12: 2, // Звёзды над головой
  13: 35, // Эхо моего голоса — ripples
  14: 1, // Дорогу осилит идущий
  15: 3, // Почему так?
  16: 2, // Начало всего
  17: 39, // Магия цифр — sundial
  18: 21, // Наука и мир
  19: 36, // Искусство
  20: 37, // Красота в глазах смотрящего
  21: 28, // Мир До и после
  22: 18, // Кит — the sea
  23: 27, // XXI век
  24: 39, // Время — sundial
  25: 40, // Тайны мозга
  26: 17, // Почему мы видим сны
  27: 21, // Земля круглая?
  28: 2, // Открытый космос
  29: 28, // Первый человек
  30: 4, // Рождение огня
  31: 26, // Первая речь
  32: 44, // Язык тела
  33: 42, // Труд сделал из обезьяны человека
  34: 5, // Еда народов
  35: 6, // Отцы и дети
  36: 8, // Моя Музыка
  37: 7, // Любимое кино
  38: 38, // WI-FI
  39: 9, // Связь поколений
  40: 15, // ИИ
  41: 10, // Связь
  42: 46, // Созерцание
  43: 12, // Идея
  44: 13, // С чистого листа
  45: 14, // Художник и его творение
  46: 15, // Технологии будущего
  47: 16, // Свобода слова
  48: 38, // Что такое маркетинг
  49: 48, // Лекарство юмор
  50: 12, // Учение — свет
  51: 17, // Говори о своей мечте
  52: 19, // Движение
  53: 20, // Спорт — это жизнь
  54: 36, // Творчество незаменимо
  55: 18, // Огромный мир вокруг
  56: 22, // Сила любви
  57: 23, // Назад в будущее
  58: 16, // Герой нашего времени
  59: 25, // Восходящая звезда
  60: 47, // Мой выбор
  61: 26, // Власть слова
  62: 23, // Миллениалы
  63: 42, // Дело жизни
  64: 32, // След и искусство
  65: 28, // Путь человечества
  66: 24, // Завтрашний день
  67: 29, // Под светом софитов
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

/** Author credit for a theme's cover — none for these in-house illustrations. */
export function showtimeCoverCredit(_levelId: string): string {
  return "";
}
