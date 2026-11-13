import type { ImageSourcePropType } from "react-native";

// Cover photos for the Show Time themes (assets/showtime-covers, 360×360 JPEG,
// trimmed from the photos in "Covers for topics"). Photos are matched to the
// themes by meaning; themes without a hand-picked photo cycle through the set.

const COVERS: ImageSourcePropType[] = [
  require("@/assets/showtime-covers/cover-01.jpg"), // 1 beach & rocks, lone walker
  require("@/assets/showtime-covers/cover-02.jpg"), // 2 seaside village at sunset
  require("@/assets/showtime-covers/cover-03.jpg"), // 3 person facing the sea
  require("@/assets/showtime-covers/cover-04.jpg"), // 4 happy dog on the beach
  require("@/assets/showtime-covers/cover-05.jpg"), // 5 fisherman casting a net
  require("@/assets/showtime-covers/cover-06.jpg"), // 6 island at golden hour
  require("@/assets/showtime-covers/cover-07.jpg"), // 7 bench by the sea
  require("@/assets/showtime-covers/cover-08.jpg"), // 8 crossing sign
  require("@/assets/showtime-covers/cover-09.jpg"), // 9 library
  require("@/assets/showtime-covers/cover-10.jpg"), // 10 herons at the shore
  require("@/assets/showtime-covers/cover-11.jpg"), // 11 shore through leaves
  require("@/assets/showtime-covers/cover-12.jpg"), // 12 milky way
  require("@/assets/showtime-covers/cover-13.jpg"), // 13 surfer on a wave
  require("@/assets/showtime-covers/cover-14.jpg"), // 14 old couple on a bench
  require("@/assets/showtime-covers/cover-15.jpg"), // 15 surfers walking in
  require("@/assets/showtime-covers/cover-16.jpg"), // 16 wooden house
  require("@/assets/showtime-covers/cover-17.jpg"), // 17 red barn
  require("@/assets/showtime-covers/cover-18.jpg"), // 18 field with cows
  require("@/assets/showtime-covers/cover-19.jpg"), // 19 piano
  require("@/assets/showtime-covers/cover-20.jpg"), // 20 boats in the grass
  require("@/assets/showtime-covers/cover-21.jpg"), // 21 surfboards
  require("@/assets/showtime-covers/cover-22.jpg"), // 22 house in a meadow
  require("@/assets/showtime-covers/cover-23.jpg"), // 23 green house
  require("@/assets/showtime-covers/cover-24.jpg"), // 24 clouds & flowers
  require("@/assets/showtime-covers/cover-25.jpg"), // 25 tracks through fields
  require("@/assets/showtime-covers/cover-26.jpg"), // 26 bonfire
];

// Module number → photo number (1-based), by meaning of the module title.
const PICKS: Record<number, number> = {
  1: 3, // Первый шаг
  2: 7, // Мысли вслух
  3: 2, // Язык жизни
  4: 12, // Голос внутри
  5: 4, // Маленькие радости
  6: 13, // Невидимая сила
  7: 14, // Сила доброго слова
  8: 10, // Дар слушать
  9: 26, // Сила слова
  10: 24, // Улыбка
  11: 8, // Добро и зло
  12: 6, // Звёзды над головой
  13: 1, // Эхо моего голоса
  14: 25, // Дорогу осилит идущий
  15: 11, // Почему так?
  16: 5, // Начало всего
  17: 20, // Магия цифр
  18: 22, // Наука и мир
  19: 19, // Искусство
  20: 16, // Красота в глазах смотрящего
  21: 17, // Мир до и после
  22: 15, // Кит
  23: 21, // XXI век
  24: 23, // Время
  25: 9, // Тайны мозга
  26: 18, // Почему мы видим сны
  28: 12, // Открытый космос
  30: 26, // Рождение огня
  36: 19, // Моя музыка
  42: 7, // Созерцание
  50: 9, // Учение — свет
  52: 25, // Движение
  53: 13, // Спорт — это жизнь
  55: 6, // Огромный мир вокруг
  59: 12, // Восходящая звезда
  60: 8, // Мой выбор
  64: 19, // След и искусство
};

/** Cover photo for a Show Time theme id ("showtime", "showtime2", …). */
export function showtimeCover(levelId: string): ImageSourcePropType {
  return COVERS[pickFor(levelId) - 1];
}

// Photographer of each photo (1-based, same order as COVERS) — Pexels authors.
const CREDITS: string[] = [
  ...Array(13).fill("Junior Bastos"), // 1–13
  "Muhammad Farhan Khan", // 14
  ...Array(10).fill("Nikita Igonkin"), // 15–24
  "Serkan Bayraktar", // 25
  "Serkan Bayraktar", // 26
];

function pickFor(levelId: string): number {
  const m = /^showtime(\d*)$/.exec(levelId);
  const n = m ? (m[1] ? parseInt(m[1], 10) : 1) : 1;
  return PICKS[n] ?? ((n - 1) % COVERS.length) + 1;
}

/** Name of the photographer of the theme's cover photo. */
export function showtimeCoverCredit(levelId: string): string {
  return CREDITS[pickFor(levelId) - 1] ?? "";
}
