import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Rect } from "react-native-svg";
import { useTheme } from "@/context/ThemeContext";
import { rs } from "@/lib/responsive";
import { useLang, pickLang, type Lang } from "@/context/LangContext";
import CoinIcon from "@/components/CoinIcon";
import StageGlassDialog from "@/components/showtime/StageGlassDialog";
import { POS_LABELS_RU, DIFFICULTY_LABEL_RU, type VocabWord } from "@/constants/vocabularyData";
import type { WaveBar } from "@/hooks/useWaveformBars";
import Timer, { type TimerState } from "./Timer";
import RecorderBar from "./RecorderBar";
import WordSticker, { type StickerSize } from "./WordSticker";

// Word-chip labels (part of speech · difficulty) per UI language.
const POS_LABELS: Record<Lang, Record<VocabWord["partOfSpeech"], string>> = {
  ru: POS_LABELS_RU,
  en: { noun: "noun", verb: "verb", adjective: "adjective" },
  kk: { noun: "зат есім", verb: "етістік", adjective: "сын есім" },
};
const DIFFICULTY_LABELS: Record<Lang, Record<VocabWord["difficulty"], string>> = {
  ru: DIFFICULTY_LABEL_RU,
  en: { 1: "easy", 2: "medium", 3: "hard" },
  kk: { 1: "жеңіл", 2: "орташа", 3: "қиын" },
};

/**
 * «Словарный запас · Отсчёт / Игра» (Figma 149:415, 149:441, 149:510, 196:2013)
 * and its pop-ups (37:4929, 37:4790, 37:4629). Pure view — all game logic
 * (timer, speech recognition, coins) lives in app/vocabulary-level.tsx.
 */

export type VocabWrongItem = { id: string; word: string };
export type VocabModal = null | "replace" | "exit";
export type VocabAdFor = null | "replace" | "hint" | "time";

export const HINT_COST = 30;
export const REPLACE_COST = 15;
export const EXTRA_TIME_COST = 25;

const norm = (s: string) => s.toLowerCase().trim().replace(/ё/g, "е");

// First 3 letters + a bullet per hidden letter (Figma «тес••••••»), capped
// so very long words still fit on a sticker.
const MAX_BULLETS = 7;
export function maskSynonym(word: string): string {
  let shown = 0;
  let bullets = 0;
  let out = "";
  for (const ch of word) {
    if (ch === " " || ch === "-") {
      if (shown < 3) out += ch;
      continue;
    }
    if (shown < 3) {
      out += ch;
      shown += 1;
    } else if (bullets < MAX_BULLETS) {
      out += "•";
      bullets += 1;
    }
  }
  return out;
}

// Sticker slots (centre x/y, rotation) on a 354×330 board / 354×336 hint card,
// taken from the Figma frames; scaled to the real board size at runtime.
const SLOTS_LARGE: [number, number, number][] = [
  [88, 71, 8],
  [245, 99, -6],
  [119, 175, -5],
  [253, 241, 7],
  [139, 290, 3],
];
const SLOTS_COMPACT: [number, number, number][] = [
  [96, 50, 6],
  [258, 64, -5],
  [112, 124, -4],
  [262, 140, 5],
  [92, 198, 4],
  [252, 212, -6],
  [120, 274, -3],
  [262, 286, 6],
];
const SLOTS_HINT: [number, number, number][] = [
  [72, 105, 6],
  [241, 101, -5],
  [111, 167, -4],
  [292, 166, 5],
  [65, 229, 3],
  [203, 218, 7],
  [118, 294, -5],
  [274, 285, -6],
];

function Bulb({ color }: { color: string }) {
  return (
    <Svg width={rs(18)} height={rs(18)} viewBox="0 0 18 18">
      <Circle cx={9} cy={7} r={6} fill={color} />
      <Rect x={6} y={13.5} width={6} height={4} rx={1.5} fill={color} />
    </Svg>
  );
}

function PlayBadge({ color, bg }: { color: string; bg: string }) {
  return (
    <View style={[styles.playBadge, { backgroundColor: bg }]}>
      <Ionicons name="play" size={rs(10)} color={color} style={{ marginLeft: rs(1) }} />
    </View>
  );
}

// Bottom action: gold primary or the «Образец серой кнопки» (157:2105) grey.
function ActionButton({
  label,
  cost,
  affordable,
  variant,
  dimCoin,
  onPress,
  disabled,
  a11y,
}: {
  label: string;
  cost: number;
  affordable: boolean;
  variant: "gold" | "grey";
  dimCoin?: boolean;
  onPress: () => void;
  disabled?: boolean;
  a11y: string;
}) {
  const { theme, themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const gold = variant === "gold";
  const ink = gold ? theme.accentText : isDark ? "#FFFFFF" : theme.text;
  const coinColor = gold
    ? theme.accentText
    : dimCoin
      ? isDark
        ? "rgba(240,238,233,0.4)"
        : "rgba(38,38,40,0.35)"
      : isDark
        ? theme.accent
        : theme.accentDeep;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.action,
        gold
          ? { backgroundColor: theme.accent, borderColor: theme.ctaStroke, borderWidth: 4 }
          : { backgroundColor: theme.btnSecondary },
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.actionText, { color: ink }]}>{affordable ? `${label} ·` : label}</Text>
      {affordable ? (
        <>
          <Text style={[styles.actionText, { color: ink }]}>{cost}</Text>
          <CoinIcon size={rs(16)} color={coinColor} />
        </>
      ) : (
        <PlayBadge
          color={ink}
          bg={gold ? "rgba(38,38,40,0.14)" : isDark ? "rgba(240,238,233,0.12)" : "rgba(38,38,40,0.1)"}
        />
      )}
    </Pressable>
  );
}

export default function VocabPlayView({
  word,
  stage,
  countdown,
  timeLeft,
  timeTotal,
  timerState,
  foundSynonyms,
  wrongItems,
  bars,
  paused,
  hintRevealed,
  allFoundBanner,
  coins,
  extraTimeUsed,
  recognitionError,
  fallbackInput,
  onFallbackChange,
  onFallbackSubmit,
  modal,
  adFor,
  topPad,
  bottomPad,
  onClosePress,
  onReplacePress,
  onHintPress,
  onExtraTimePress,
  onConfirmReplace,
  onConfirmExit,
  onDismissModal,
  onAdCancel,
  onAdComplete,
}: {
  word: VocabWord;
  stage: "countdown" | "active";
  countdown: number;
  timeLeft: number;
  timeTotal: number;
  timerState: TimerState;
  foundSynonyms: string[];
  wrongItems: VocabWrongItem[];
  bars: WaveBar[];
  paused: boolean;
  hintRevealed: boolean;
  allFoundBanner: boolean;
  coins: number;
  extraTimeUsed: boolean;
  recognitionError: string | null;
  fallbackInput: string;
  onFallbackChange: (t: string) => void;
  onFallbackSubmit: () => void;
  modal: VocabModal;
  adFor: VocabAdFor;
  topPad: number;
  bottomPad: number;
  onClosePress: () => void;
  onReplacePress: () => void;
  onHintPress: () => void;
  onExtraTimePress: () => void;
  onConfirmReplace: () => void;
  onConfirmExit: () => void;
  onDismissModal: () => void;
  onAdCancel: () => void;
  onAdComplete: () => void;
}) {
  const { theme, themeMode } = useTheme();
  const { lang } = useLang();
  const isDark = themeMode === "dark";
  const ink = (a: number) => (isDark ? `rgba(240,238,233,${a})` : `rgba(38,38,40,${a})`);
  const [board, setBoard] = useState({ w: 354, h: 330 });
  const [hintBox, setHintBox] = useState({ w: 354, h: 336 });

  const total = word.synonyms.length;
  const foundCount = foundSynonyms.length;
  const canReplace = coins >= REPLACE_COST;
  const canHint = coins >= HINT_COST;
  const canTime = coins >= EXTRA_TIME_COST;
  const isActive = stage === "active";
  // Characteristics chip: on the countdown and while the hint is open (Figma).
  const showMeta = !isActive || hintRevealed;
  const orderOf = (syn: string) => {
    const i = foundSynonyms.findIndex((f) => norm(f) === norm(syn));
    return i >= 0 ? i + 1 : 0;
  };

  const foundSize: StickerSize = foundCount <= SLOTS_LARGE.length ? "large" : "compact";
  const foundSlots = foundSize === "large" ? SLOTS_LARGE : SLOTS_COMPACT;

  return (
    <View style={[styles.root, { paddingTop: topPad + rs(8), paddingBottom: bottomPad }]}>
      {/* ── Top bar: close · timer · boost ×2 ───────────────────────────── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={onClosePress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={pickLang(lang, { ru: "Закрыть", en: "Close", kk: "Жабу" })}
          style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="close" size={rs(26)} color={theme.text} />
        </Pressable>
        <View pointerEvents="none" style={styles.timerSlot}>
          <Timer seconds={timeLeft} total={timeTotal} state={timerState} />
        </View>
        {isActive ? (
          <Pressable
            onPress={onExtraTimePress}
            disabled={extraTimeUsed}
            accessibilityRole="button"
            accessibilityLabel={pickLang(lang, { ru: "Добавить время ×2", en: "Add time ×2", kk: "Уақыт қосу ×2" })}
            style={({ pressed }) => [
              styles.boost,
              { borderColor: theme.accent, opacity: extraTimeUsed ? 0.4 : pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={[styles.boostText, { color: theme.text }]}>×2</Text>
            {extraTimeUsed ? (
              <Ionicons name="checkmark" size={rs(16)} color={theme.text} />
            ) : canTime ? (
              <>
                <Text style={[styles.boostText, { color: theme.text }]}>{EXTRA_TIME_COST}</Text>
                <CoinIcon size={rs(16)} color={isDark ? theme.accent : theme.accentDeep} />
              </>
            ) : (
              <PlayBadge color={theme.text} bg={ink(0.12)} />
            )}
          </Pressable>
        ) : null}
      </View>

      {/* ── Word + characteristics ──────────────────────────────────────── */}
      <View style={[styles.wordBlock, { marginTop: isActive ? rs(26) : rs(34) }]}>
        <Text style={[styles.word, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {word.word.toUpperCase()}
        </Text>
        {showMeta ? (
          <View style={[styles.meta, { backgroundColor: ink(0.06), borderColor: ink(0.1) }]}>
            <Text style={[styles.metaText, { color: ink(0.6) }]}>
              {`${(POS_LABELS[lang] ?? POS_LABELS.ru)[word.partOfSpeech]} · ${(DIFFICULTY_LABELS[lang] ?? DIFFICULTY_LABELS.ru)[word.difficulty]}`}
            </Text>
          </View>
        ) : null}
      </View>

      {!isActive ? (
        // ── Countdown 3 · 2 · 1 · СТАРТ ───────────────────────────────────
        <View style={styles.countdownBody}>
          <Animated.Text
            key={countdown}
            entering={FadeInDown.duration(180)}
            style={[
              styles.countdownNum,
              { color: theme.text },
              countdown === 0 && { fontSize: rs(64), lineHeight: rs(120), letterSpacing: rs(-1.3) },
            ]}
          >
            {countdown === 0 ? pickLang(lang, { ru: "СТАРТ", en: "START", kk: "СТАРТ" }) : countdown}
          </Animated.Text>
          <Text style={[styles.countdownHint, { color: ink(0.6) }]}>{pickLang(lang, { ru: "Готовься называть синонимы", en: "Get ready to name synonyms", kk: "Синонимдерді атауға дайындалыңыз" })}</Text>
        </View>
      ) : (
        <>
          {/* ── Progress: N из 8 синонимов + segments ─────────────────────── */}
          <View style={styles.counterRow}>
            <Text style={[styles.counterNum, { color: theme.text }]}>
              {pickLang(lang, { ru: `${foundCount} из ${total}`, en: `${foundCount} of ${total}`, kk: `${foundCount}/${total}` })}
            </Text>
            <Text style={[styles.counterLabel, { color: ink(0.5) }]}>{pickLang(lang, { ru: "синонимов", en: "synonyms", kk: "синоним" })}</Text>
          </View>
          <View style={styles.segs}>
            {word.synonyms.map((_, i) => (
              <View
                key={i}
                style={[styles.seg, { backgroundColor: i < foundCount ? theme.accent : ink(0.12) }]}
              />
            ))}
          </View>

          <View style={{ marginTop: rs(18) }}>
            <RecorderBar bars={bars} dim={paused} />
          </View>

          {recognitionError ? (
            <View style={styles.fallback}>
              <Text style={[styles.fallbackText, { color: ink(0.5) }]}>{recognitionError}</Text>
              <View style={styles.fallbackRow}>
                <TextInput
                  value={fallbackInput}
                  onChangeText={onFallbackChange}
                  placeholder={pickLang(lang, { ru: "Введите синоним", en: "Type a synonym", kk: "Синоним енгізіңіз" })}
                  placeholderTextColor={ink(0.4)}
                  style={[
                    styles.fallbackInput,
                    { color: theme.text, backgroundColor: ink(0.06), borderColor: ink(0.12) },
                  ]}
                  onSubmitEditing={onFallbackSubmit}
                  returnKeyType="send"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  onPress={onFallbackSubmit}
                  accessibilityLabel={pickLang(lang, { ru: "Отправить", en: "Send", kk: "Жіберу" })}
                  style={({ pressed }) => [
                    styles.fallbackSend,
                    { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Ionicons name="arrow-up" size={rs(20)} color={theme.accentText} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {hintRevealed ? (
            // ── Hint card: found stickers + masked first letters ───────────
            <>
              <Animated.View
                entering={FadeIn.duration(220)}
                onLayout={(e) => setHintBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
                style={[
                  styles.hintCard,
                  {
                    backgroundColor: isDark ? "rgba(255,216,87,0.06)" : "rgba(255,216,87,0.12)",
                    borderColor: isDark ? "rgba(255,216,87,0.45)" : "rgba(255,189,47,0.65)",
                  },
                ]}
              >
                <View style={styles.hintHead}>
                  <Bulb color={theme.accent} />
                  <Text style={[styles.hintTitle, { color: theme.accentInk }]}>{pickLang(lang, { ru: "ПОДСКАЗКА", en: "HINT", kk: "КӨМЕК" })}</Text>
                </View>
                <Text style={[styles.hintSub, { color: ink(0.5) }]}>{pickLang(lang, { ru: "Первые буквы синонимов", en: "First letters of the synonyms", kk: "Синонимдердің бірінші әріптері" })}</Text>
                {word.synonyms.slice(0, SLOTS_HINT.length).map((syn, i) => {
                  const [x, y, r] = SLOTS_HINT[i];
                  const order = orderOf(syn);
                  return (
                    <WordSticker
                      key={syn}
                      word={order ? syn : maskSynonym(syn)}
                      found={order > 0}
                      order={order || undefined}
                      size="hint"
                      cx={(x / 354) * hintBox.w}
                      cy={(y / 336) * hintBox.h}
                      rotate={r}
                      boxW={hintBox.w}
                    />
                  );
                })}
              </Animated.View>
              <Text style={[styles.hintUsed, { color: ink(0.45) }]}>{pickLang(lang, { ru: "Подсказка использована", en: "Hint used", kk: "Көмек пайдаланылды" })}</Text>
            </>
          ) : (
            // ── Found synonyms board ───────────────────────────────────────
            <>
              <Text style={[styles.sectionLabel, { color: ink(0.45) }]}>{pickLang(lang, { ru: "НАЙДЕННЫЕ СИНОНИМЫ", en: "SYNONYMS FOUND", kk: "ТАБЫЛҒАН СИНОНИМДЕР" })}</Text>
              <View
                onLayout={(e) => setBoard({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
                style={[styles.board, { backgroundColor: ink(0.03), borderColor: ink(0.14) }]}
              >
                {foundCount === 0 ? (
                  <View style={styles.boardEmpty}>
                    <Text style={[styles.boardEmptyText, { color: ink(0.4) }]}>
                      {pickLang(lang, {
                        ru: "Скажи первое слово -\nоно появится здесь",
                        en: "Say the first word -\nit will appear here",
                        kk: "Бірінші сөзді айтыңыз -\nол осы жерде шығады",
                      })}
                    </Text>
                  </View>
                ) : (
                  foundSynonyms.slice(0, foundSlots.length).map((syn, i) => {
                    const [x, y, r] = foundSlots[i];
                    return (
                      <WordSticker
                        key={syn}
                        word={syn}
                        found
                        order={i + 1}
                        size={foundSize}
                        cx={(x / 354) * board.w}
                        cy={(y / 330) * board.h}
                        rotate={r}
                        boxW={board.w}
                      />
                    );
                  })
                )}
                {allFoundBanner ? (
                  <Animated.View
                    entering={FadeIn.duration(220)}
                    style={[styles.banner, { backgroundColor: theme.accent, borderColor: theme.ctaStroke }]}
                  >
                    <Text style={[styles.bannerText, { color: theme.accentText }]}>
                      {pickLang(lang, { ru: "Отлично! Все синонимы найдены!", en: "Excellent! All synonyms found!", kk: "Керемет! Барлық синоним табылды!" })}
                    </Text>
                  </Animated.View>
                ) : null}
              </View>
            </>
          )}

          {/* Wrong guesses — a short red toast over the board. */}
          <View pointerEvents="none" style={styles.wrongLayer}>
            {wrongItems.slice(-1).map((w) => (
              <Animated.View
                key={w.id}
                entering={FadeInDown.duration(200)}
                exiting={FadeOut.duration(300)}
                style={styles.wrong}
              >
                <Text style={styles.wrongText}>× {w.word}</Text>
              </Animated.View>
            ))}
          </View>

          {/* ── Bottom actions ─────────────────────────────────────────── */}
          <View style={[styles.actions, { marginTop: hintRevealed ? rs(37) : rs(44) }]}>
            <ActionButton
              label={pickLang(lang, { ru: "Заменить", en: "Replace", kk: "Ауыстыру" })}
              cost={REPLACE_COST}
              affordable={canReplace}
              variant="grey"
              onPress={onReplacePress}
              a11y={pickLang(lang, { ru: "Заменить слово", en: "Replace word", kk: "Сөзді ауыстыру" })}
            />
            <ActionButton
              label={pickLang(lang, { ru: "Подсказка", en: "Hint", kk: "Көмек" })}
              cost={HINT_COST}
              affordable={canHint || hintRevealed}
              variant={hintRevealed ? "grey" : "gold"}
              dimCoin={hintRevealed}
              disabled={hintRevealed}
              onPress={onHintPress}
              a11y={pickLang(lang, { ru: "Подсказка", en: "Hint", kk: "Көмек" })}
            />
          </View>
        </>
      )}

      {/* ── Pop-ups ─────────────────────────────────────────────────────── */}
      <StageGlassDialog
        visible={modal === "replace"}
        title={pickLang(lang, { ru: "Вы точно хотите заменить слово?", en: "Are you sure you want to replace the word?", kk: "Сөзді шынымен ауыстырасыз ба?" })}
        message={canReplace ? undefined : pickLang(lang, { ru: "Не хватает монет. Можно посмотреть рекламу.", en: "Not enough coins. You can watch an ad.", kk: "Монета жетпейді. Жарнама көруге болады." })}
        onRequestClose={onDismissModal}
        buttons={[
          { label: pickLang(lang, { ru: "Нет", en: "No", kk: "Жоқ" }), variant: "secondary", onPress: onDismissModal },
          canReplace
            ? {
                label: pickLang(lang, { ru: "Да ·", en: "Yes ·", kk: "Иә ·" }),
                variant: "primary",
                onPress: onConfirmReplace,
                trailing: (
                  <>
                    <Text style={[styles.dlgCost, { color: theme.accentText }]}>{REPLACE_COST}</Text>
                    <CoinIcon size={rs(20)} color={theme.accentText} />
                  </>
                ),
              }
            : {
                label: pickLang(lang, { ru: "Да ·", en: "Yes ·", kk: "Иә ·" }),
                variant: "secondary",
                onPress: onConfirmReplace,
                trailing: (
                  <>
                    <Text style={[styles.dlgCost, { color: ink(0.6) }]}>{REPLACE_COST}</Text>
                    <CoinIcon size={rs(20)} color={ink(0.6)} />
                  </>
                ),
              },
        ]}
      >
        <View style={styles.costRow}>
          <Text style={[styles.costLabel, { color: ink(0.6) }]}>{pickLang(lang, { ru: "Замена стоит", en: "Replacing costs", kk: "Ауыстыру бағасы" })}</Text>
          <Text style={[styles.costNum, { color: ink(0.9) }]}>{REPLACE_COST}</Text>
          <CoinIcon size={rs(16)} color={isDark ? theme.accent : theme.accentDeep} />
        </View>
      </StageGlassDialog>

      <StageGlassDialog
        visible={!!adFor}
        title={
          adFor === "replace"
            ? pickLang(lang, { ru: "Реклама за замену слова", en: "Ad for a word swap", kk: "Сөзді ауыстыру үшін жарнама" })
            : adFor === "time"
              ? pickLang(lang, { ru: "Реклама за доп. время", en: "Ad for extra time", kk: "Қосымша уақыт үшін жарнама" })
              : pickLang(lang, { ru: "Реклама за подсказку", en: "Ad for a hint", kk: "Көмек үшін жарнама" })
        }
        message={pickLang(lang, { ru: "Досмотрите короткий ролик, чтобы получить награду.", en: "Watch a short video to get the reward.", kk: "Сыйлық алу үшін қысқа роликті соңына дейін көріңіз." })}
        onRequestClose={onAdCancel}
        buttons={[
          { label: pickLang(lang, { ru: "Отмена", en: "Cancel", kk: "Болдырмау" }), variant: "secondary", onPress: onAdCancel },
          { label: pickLang(lang, { ru: "Смотреть", en: "Watch", kk: "Көру" }), variant: "primary", onPress: onAdComplete },
        ]}
      />

      <StageGlassDialog
        visible={modal === "exit"}
        title={pickLang(lang, { ru: "Выйти?", en: "Leave?", kk: "Шығасыз ба?" })}
        message={pickLang(lang, { ru: "Прогресс этого задания не сохранится", en: "Progress on this task won't be saved", kk: "Бұл тапсырманың прогресі сақталмайды" })}
        onRequestClose={onDismissModal}
        buttons={[
          { label: pickLang(lang, { ru: "Остаться", en: "Stay", kk: "Қалу" }), variant: "secondary", onPress: onDismissModal },
          { label: pickLang(lang, { ru: "Выйти", en: "Leave", kk: "Шығу" }), variant: "primary", onPress: onConfirmExit },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  topBar: { height: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  timerSlot: { position: "absolute", left: 0, right: 0, top: 2, alignItems: "center" },
  boost: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 4,
    borderRadius: 32,
    marginRight: 3,
    marginTop: -6,
  },
  boostText: { fontFamily: "Geologica_900Black", fontSize: 14 },
  playBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  wordBlock: { height: 84, alignItems: "center" },
  word: {
    fontFamily: "Geologica_900Black",
    fontSize: 36,
    letterSpacing: -0.72,
    textAlign: "center",
    alignSelf: "stretch",
  },
  meta: { marginTop: 5, borderWidth: 2, borderRadius: 32, paddingHorizontal: 12, paddingVertical: 4 },
  metaText: { fontFamily: "Geologica_700Bold", fontSize: 12 },

  countdownBody: { flex: 1, alignItems: "center" },
  countdownNum: {
    marginTop: 148,
    height: 120,
    fontFamily: "Geologica_900Black",
    fontSize: 120,
    lineHeight: 120,
    letterSpacing: -3.6,
    textAlign: "center",
  },
  countdownHint: { marginTop: 80, fontFamily: "Geologica_600SemiBold", fontSize: 16, textAlign: "center" },

  counterRow: { marginTop: 26, flexDirection: "row", alignItems: "center", gap: 6 },
  counterNum: { fontFamily: "Geologica_900Black", fontSize: 14 },
  counterLabel: { fontFamily: "Geologica_600SemiBold", fontSize: 14 },
  segs: { marginTop: 10, flexDirection: "row", gap: 6 },
  seg: { flex: 1, height: 6, borderRadius: 3 },

  fallback: { marginTop: 12, gap: 8 },
  fallbackText: { fontFamily: "Geologica_600SemiBold", fontSize: 12, textAlign: "center" },
  fallbackRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  fallbackInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    paddingHorizontal: 16,
    fontFamily: "Geologica_500Medium",
    fontSize: 15,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  fallbackSend: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },

  sectionLabel: { marginTop: 30, fontFamily: "Geologica_900Black", fontSize: 11, letterSpacing: 0.55 },
  board: {
    marginTop: 10,
    flex: 1,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 22,
    overflow: "hidden",
  },
  boardEmpty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  boardEmptyText: { fontFamily: "Geologica_600SemiBold", fontSize: 15, lineHeight: 18, textAlign: "center" },
  banner: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    justifyContent: "center",
  },
  bannerText: { fontFamily: "Geologica_800ExtraBold", fontSize: 13 },

  hintCard: { marginTop: 30, flex: 1, borderWidth: 2, borderRadius: 22, overflow: "hidden" },
  hintHead: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 17, marginLeft: 19 },
  hintTitle: { fontFamily: "Geologica_900Black", fontSize: 11, letterSpacing: 0.55 },
  hintSub: { marginTop: 8, marginLeft: 19, fontFamily: "Geologica_600SemiBold", fontSize: 13 },
  hintUsed: { marginTop: 10, fontFamily: "Geologica_600SemiBold", fontSize: 12, textAlign: "center" },

  wrongLayer: { position: "absolute", left: 0, right: 0, top: "52%", alignItems: "center" },
  wrong: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "rgba(255,77,61,0.55)",
    backgroundColor: "rgba(255,77,61,0.16)",
    justifyContent: "center",
  },
  wrongText: { fontFamily: "Geologica_700Bold", fontSize: 14, color: "#FF4D3D" },

  actions: { flexDirection: "row", gap: 12 },
  action: {
    flex: 1,
    height: 56,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
  },
  actionText: { fontFamily: "Geologica_900Black", fontSize: 15 },

  dlgCost: { fontFamily: "Geologica_900Black", fontSize: 16 },
  costRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  costLabel: { fontFamily: "Geologica_600SemiBold", fontSize: 14 },
  costNum: { fontFamily: "Geologica_900Black", fontSize: 14 },
});
