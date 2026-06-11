# Промпт для Replit: Редизайн экрана Profile & Settings (King Speech)

## 🎯 ЗАДАЧА

Сделай редизайн **единого экрана "Profile & Settings"** в приложении King Speech по приложенному референсу. Объедини текущий профиль и настройки в **один цельный экран** с двумя смысловыми секциями. Сохрани все существующие поля, переключатели, действия и логику — меняй **только визуал**.

Стиль должен **один-в-один** соответствовать референсу: тёмный фон с фиолетовой radial-подсветкой сверху, glass-карточка профиля, чистые минималистичные списки настроек.

---

## 🎨 ОБЩИЙ ВИЗУАЛЬНЫЙ СТИЛЬ

### Фон экрана

**Сложный многослойный градиент сверху вниз:**

```css
background: 
  radial-gradient(ellipse 120% 60% at 50% 0%, 
    #4A2B9E 0%, 
    #2D1B5E 25%, 
    #1A0F3D 50%, 
    #0E0E10 80%, 
    #0A0A0C 100%
  );
```

**Дополнительный световой акцент сверху:**
- Радиальное фиолетовое свечение в верхней трети экрана
- Center: 50% horizontal, ~15% от верха
- Color: `#9468FB` с opacity 35%
- Blur: `100px`
- Создаёт ощущение "света сверху", который размывается к низу

**Эффект:**
Верхняя треть экрана — насыщенно-фиолетовая, светящаяся. К середине плавно темнеет. Нижняя половина — глубокий чёрно-фиолетовый. Никаких резких границ, всё перетекает.

---

## 📐 СТРУКТУРА ЭКРАНА (СВЕРХУ ВНИЗ)

### 1. Header (топ-зона)

- **Safe area top inset** + 12px
- Слева: иконка **Back** (chevron left, 24px, белая, тонкая 1.5px stroke). Опционально, если экран открывается из стека.
- По центру или слева (на одной линии с Back): **"Profile & Setting"** — Inter Tight 600, 20px, белый
- Справа: пусто (либо иконка settings/edit если нужна)
- Padding: 20px по горизонтали

### 2. Profile Card (карточка пользователя)

Расположение: 24px отступ от хэдера, 20px по бокам.

**Стиль карточки:**
```css
background: rgba(255,255,255,0.04);
backdrop-filter: blur(20px);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 20px;
padding: 16px;
display: flex;
align-items: center;
gap: 14px;
```

**Внутри карточки (горизонтальный layout):**

**Слева — Аватар:**
- Круглое фото 56x56px
- Border-radius: 50%
- Если нет фото — gradient placeholder (фиолетовый) с инициалами в Instrument Serif

**Справа — текстовый блок (column):**
- **Имя пользователя** — `Jaydon Mango` style
  - Inter Tight 600, 17px, белый
  - Line-height: 22px
- **Email** — `jaydonmango@gmail.com` style
  - Inter Tight 400, 13px, `rgba(255,255,255,0.55)`
  - Margin-top: 2px
- **KYC Status badge** — ниже email, margin-top: 6px
  - Иконка circle-check 14px фиолетовая (`#9468FB`)
  - Текст: `KYC status: Verified` — Inter Tight 500, 12px, белый
  - Расположены горизонтально, gap 4px

### 3. Секция "Account Setting"

**Заголовок секции:**
- Margin-top: 28px
- Padding-left: 24px (немного больше чем у карточки, для журнальной асимметрии)
- Текст: `Account Setting` — Inter Tight 500, 15px, белый
- Без фона, просто текст
- Margin-bottom: 12px

**Список элементов:**
- Wrapper: glass-карточка для всей секции
  ```css
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  margin: 0 20px;
  overflow: hidden;
  ```

**Элемент списка (повторяется):**
- Height: 56px
- Padding: 14px 18px
- Display: flex, align-items: center
- Между элементами: разделитель `1px solid rgba(255,255,255,0.05)` (только между, не сверху/снизу секции)

**Структура элемента:**
1. **Иконка слева** (24px):
   - Outline стиль, stroke 1.5px
   - Color: белый
   - Без фоновой подложки (как в референсе — голые иконки)
2. **Title** (Inter Tight 500, 15px, белый):
   - Margin-left: 14px от иконки
3. **Spacer** (flex: 1)
4. **Chevron right** (16px, `rgba(255,255,255,0.4)`)

**Элементы секции "Account Setting":**
1. 🧑 **Support/FAQ** — иконка `user-headset` или `life-buoy`
2. 🔒 **Security** — иконка `shield` или `lock`
3. 🔔 **Notification** — иконка `bell`

---

### 4. Секция "Community Settings"

**Margin-top от предыдущей секции:** 28px

Структура **идентична** секции "Account Setting" (тот же заголовок-стиль, тот же glass-wrapper, те же элементы списка).

**Элементы секции "Community Settings":**
1. 👥 **Friends & Social** — иконка `users` или `user-friends`
2. 📋 **Following List** — иконка `list` (3 горизонтальные линии)
3. ❓ **Help Center** — иконка `help-circle` или `info`
4. ⚙️ **Setting** — иконка `settings` (шестерёнка)

---

### 5. Кнопка Logout / Sign out (если есть в текущей логике)

Расположение: 32px после последней секции.

**Стиль:**
- Centered text-button
- Текст: `Sign out` — Inter Tight 500, 15px
- Color: `#FF6B6B` (мягкий красный, не агрессивный)
- Без фона, без бордера
- Padding: 14px
- Tap area: вся ширина экрана

### 6. Нижний отступ

Safe area bottom + 24px дополнительно (чтобы Floating Tab Bar не перекрывал контент при скролле).

---

## 🎨 ИКОНКИ — ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ

**Библиотека:** Lucide Icons (или Phosphor Icons — outline вариант)

**Параметры:**
- Stroke width: 1.5px
- Size: 24px (в списках), 14px (в badges)
- Color: `#FFFFFF`
- Без заливки

**Маппинг функциональности → иконка:**

| Функция | Lucide Icon |
|---|---|
| Support/FAQ | `LifeBuoy` или `HeadphonesIcon` |
| Security | `ShieldCheck` |
| Notification | `Bell` |
| Friends & Social | `Users` |
| Following List | `List` |
| Help Center | `HelpCircle` |
| Setting | `Settings` |
| KYC Verified | `CheckCircle2` (filled, фиолетовая) |
| Back | `ChevronLeft` |
| Chevron в списках | `ChevronRight` |
| Sign out | без иконки |

---

## 🎨 ЦВЕТА (использовать только эти)

| Назначение | HEX / RGBA |
|---|---|
| Background top accent | `#4A2B9E` |
| Background mid | `#2D1B5E` → `#1A0F3D` |
| Background bottom | `#0E0E10` |
| Glow purple | `#9468FB` @ 35% opacity, blur 100px |
| Glass card surface | `rgba(255,255,255,0.04)` |
| Glass card border | `rgba(255,255,255,0.08)` |
| List wrapper surface | `rgba(255,255,255,0.03)` |
| List divider | `rgba(255,255,255,0.05)` |
| Text primary | `#FFFFFF` |
| Text secondary | `rgba(255,255,255,0.55)` |
| Text tertiary / chevrons | `rgba(255,255,255,0.4)` |
| Primary accent | `#9468FB` |
| Sign out red | `#FF6B6B` |

---

## ✍️ ТИПОГРАФИКА

Используй уже подключённые в проекте шрифты:

| Элемент | Шрифт / Вес | Размер |
|---|---|---|
| Page title "Profile & Setting" | Inter Tight 600 | 20px |
| Section label "Account Setting" | Inter Tight 500 | 15px |
| User name "Jaydon Mango" | Inter Tight 600 | 17px |
| User email | Inter Tight 400 | 13px |
| KYC badge text | Inter Tight 500 | 12px |
| List item title | Inter Tight 500 | 15px |
| Sign out | Inter Tight 500 | 15px |

**Letter-spacing для всех:** `-0.01em` (чуть тайтнее для премиальности)

---

## 🎬 АНИМАЦИИ

### При появлении экрана:
1. **Profile card** — fade in + slide up (translateY 12px → 0), delay 0ms, duration 400ms
2. **Section "Account Setting" + items** — fade in + slide up, stagger 60ms между элементами, delay 100ms
3. **Section "Community Settings" + items** — то же самое, delay 250ms
4. **Sign out** — fade in, delay 500ms

**Easing:** `cubic-bezier(0.32, 0.72, 0, 1)`

### При тапе по элементу списка:
- Background элемента на 150ms становится `rgba(255,255,255,0.06)` (highlight)
- Лёгкое сжатие иконки и chevron (scale 0.96 → 1.0)
- Spring переход к следующему экрану

### При тапе по Profile card:
- Scale 0.98 → 1.0 (press feedback)
- Переход на экран редактирования профиля (если такой флоу существует)

### KYC badge:
- При первой загрузке checkmark иконка появляется с лёгким scale-bounce (0 → 1.15 → 1.0, spring 400ms)

---

## 📐 СПЕЙСИНГ — ТОЧНЫЕ ОТСТУПЫ

```
Safe area top
+12px → Header
+24px → Profile card
+28px → Section "Account Setting" label
+12px → Glass wrapper списка
   ├─ 56px → Support/FAQ
   ├─ divider
   ├─ 56px → Security
   ├─ divider
   └─ 56px → Notification
+28px → Section "Community Settings" label
+12px → Glass wrapper списка
   ├─ 56px → Friends & Social
   ├─ divider
   ├─ 56px → Following List
   ├─ divider
   ├─ 56px → Help Center
   ├─ divider
   └─ 56px → Setting
+32px → Sign out button (56px высота)
+24px → Safe area bottom
```

**Горизонтальные отступы:**
- Контент (карточки, секции): 20px от краёв экрана
- Текст внутри карточек: 18px от края карточки
- Section labels: 24px от края экрана (чуть больше для асимметрии)

---

## 📱 АДАПТИВНОСТЬ

- Экран должен корректно отображаться на iPhone SE (375px) и iPhone 15 Pro Max (430px)
- На маленьких устройствах — контент скроллится; на больших — может умещаться без скролла
- Скролл должен быть мягким (`-webkit-overflow-scrolling: touch`)
- Bottom Floating Tab Bar **не перекрывает** последний элемент списка (отступ снизу с учётом таб-бара)

---

## ✅ ЧЕКЛИСТ ГОТОВНОСТИ

1. ✅ Фон экрана: radial purple gradient сверху → чёрный снизу, с дополнительным glow
2. ✅ Заголовок "Profile & Setting" в хэдере
3. ✅ Glass profile card: фото + имя + email + KYC verified badge
4. ✅ Две секции с лейблами "Account Setting" и "Community Settings"
5. ✅ Каждая секция в собственной glass-карточке-обёртке
6. ✅ Элементы списка: outline иконка + текст + chevron, с разделителями
7. ✅ Все 7 пунктов (3 + 4) присутствуют с корректными иконками
8. ✅ Sign out внизу красным цветом
9. ✅ Анимация stagger при появлении
10. ✅ Press-эффекты на всех интерактивных элементах
11. ✅ Совместимость с floating Bottom Tab Bar (если экран в табах)
12. ✅ Сохранена вся существующая логика и переходы

---

## ❌ ЗАПРЕЩЕНО

- ❌ Менять структуру навигации и переходы между экранами
- ❌ Добавлять иконкам цветные подложки/квадратики (в референсе иконки голые)
- ❌ Использовать filled иконки (только outline 1.5px stroke)
- ❌ Использовать другие цвета помимо указанных
- ❌ Делать резкие переходы цвета на фоне — только плавные gradients
- ❌ Менять порядок секций или пунктов в них (если в текущем приложении он другой — сохрани логику текущего, но применяй визуал референса)
- ❌ Использовать тяжёлые тени — только glass и glow
- ❌ Добавлять декоративные элементы помимо описанных

---

## 🎁 ФИНАЛЬНЫЙ КРИТЕРИЙ

Если поставить готовый экран рядом с референсом — они должны ощущаться **как один и тот же дизайн-язык**. Тот же глубокий фиолетовый верх, та же тишина списков, та же premium-аура. Никаких визуальных компромиссов.

Действуй.
