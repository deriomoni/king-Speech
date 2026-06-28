import React, { createContext, useContext, useState, useMemo, useEffect, useRef, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getLevelsData, getTasksData } from "@/constants/gameContent";
import {
  getModuleFromLevelId,
  getWarmupTasksForLevel,
  getInterviewTasksForLevel,
} from "@/constants/contentLoader";
import { MODULE_QUOTES } from "@/constants/gameContent";
import { useLang, type Lang } from "@/context/LangContext";
import { useDevTools } from "@/context/DevToolsContext";
import { auth as fbAuth, db as fbDb, firebaseConfigured } from "@/lib/firebase";
import { registerGameResetter } from "@/lib/gameResetRegistry";
import { colors as brandColors, LEVEL_PALETTE_ORDER, darkenHex } from "@/theme/tokens";

export type LevelType = string;

export type StepStatus = "locked" | "available" | "completed";

export type TaskStatus = "locked" | "available" | "completed";
export type LevelStatus = "locked" | "available" | "completed";

export interface Task {
  id: string;
  taskNumber: number;
  title: string;
  instruction: string;
  content: string;
  tips: string[];
  status: TaskStatus;
  bestScore?: number;
}

export interface Level {
  id: LevelType;
  levelNumber: number;
  title: string;
  subtitle: string;
  icon: string;
  description: string;
  tasks: Task[];
  status: LevelStatus;
  completed: boolean;
  xpEarned: number;
  color: string;
  colorDark: string;
  module: number;
  philosophyQuote: string;
}

const MODULE_PALETTE: { color: string; colorDark: string }[] = LEVEL_PALETTE_ORDER.map(
  (color) => ({ color, colorDark: darkenHex(color) })
);

export const MODULE_COLORS: Record<number, { color: string; colorDark: string }> = (() => {
  const map: Record<number, { color: string; colorDark: string }> = {};
  for (let i = 1; i <= 67; i++) {
    map[i] = MODULE_PALETTE[(i - 1) % MODULE_PALETTE.length];
  }
  return map;
})();

export function getModuleQuote(module: number, lang: Lang): string {
  return MODULE_QUOTES[lang]?.[module] ?? "";
}

export const RANKS = [
  { name: "Beginner Speaker", minXp: 0, icon: "🎤" },
  { name: "Confident Voice", minXp: 25, icon: "🔥" },
  { name: "Stage Starter", minXp: 55, icon: "⭐" },
  { name: "Strong Speaker", minXp: 100, icon: "🏆" },
  { name: "Master Orator", minXp: 160, icon: "👑" },
  { name: "Grand Orator", minXp: 250, icon: "💎" },
  { name: "Legend", minXp: 400, icon: "🌟" },
];

// Modular ranks for the Path: 67 sections grouped into 5 ranks (~13–14 each).
export interface RankGroup {
  index: number;          // 1..5
  fromSection: number;    // inclusive
  toSection: number;      // inclusive
  nameKey: "rank1" | "rank2" | "rank3" | "rank4" | "rank5";
  color: string;
}

export const RANKS_MODULAR: RankGroup[] = [
  { index: 1, fromSection: 1,  toSection: 14, nameKey: "rank1", color: brandColors.rank.novice },
  { index: 2, fromSection: 15, toSection: 28, nameKey: "rank2", color: brandColors.rank.amateur },
  { index: 3, fromSection: 29, toSection: 41, nameKey: "rank3", color: brandColors.rank.confident },
  { index: 4, fromSection: 42, toSection: 54, nameKey: "rank4", color: brandColors.rank.master },
  { index: 5, fromSection: 55, toSection: 67, nameKey: "rank5", color: brandColors.rank.pro },
];

export function getRankForSection(sectionNum: number): RankGroup {
  for (const r of RANKS_MODULAR) {
    if (sectionNum >= r.fromSection && sectionNum <= r.toSection) return r;
  }
  return RANKS_MODULAR[0];
}

export function getRank(xp: number) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (xp >= r.minXp) rank = r;
  }
  return rank;
}

export function getBaseType(levelType: string): string {
  return levelType.replace(/\d+$/, "");
}

interface SavedProgress {
  levelId: string;
  status: LevelStatus;
  completed: boolean;
  xpEarned: number;
  tasks: {
    taskNumber: number;
    status: TaskStatus;
    bestScore?: number;
  }[];
}

function buildLevelsFromContent(lang: Lang, savedProgress: SavedProgress[] | null): Level[] {
  const levelsContent = getLevelsData(lang);
  const tasksContent = getTasksData(lang);

  return levelsContent.map((levelInfo, i) => {
    const saved = savedProgress?.find((p) => p.levelId === levelInfo.id);
    let taskContent = tasksContent[levelInfo.id] ?? [];
    if (getBaseType(levelInfo.id) === "warmup") {
      taskContent = getWarmupTasksForLevel(
        getModuleFromLevelId(levelInfo.id),
        lang,
      );
    } else if (getBaseType(levelInfo.id) === "interview") {
      // Light, theme-bound questions from the content pipeline (task 1.8).
      // Falls back to the legacy hardcoded tasks if no content is found.
      const interviewTasks = getInterviewTasksForLevel(levelInfo.id, lang);
      if (interviewTasks) taskContent = interviewTasks;
    }

    const tasks: Task[] = taskContent.map((t) => {
      const savedTask = saved?.tasks.find((st) => st.taskNumber === t.taskNumber);
      return {
        ...t,
        id: `${levelInfo.id}_${t.taskNumber}`,
        status: savedTask?.status ?? (i === 0 && t.taskNumber === 1 ? "available" : "locked") as TaskStatus,
        bestScore: savedTask?.bestScore,
      };
    });

    return {
      ...levelInfo,
      id: levelInfo.id as LevelType,
      tasks,
      status: saved?.status ?? (i === 0 ? "available" : "locked") as LevelStatus,
      completed: saved?.completed ?? false,
      xpEarned: saved?.xpEarned ?? 0,
    };
  });
}

function extractProgress(levels: Level[]): SavedProgress[] {
  return levels.map((l) => ({
    levelId: l.id,
    status: l.status,
    completed: l.completed,
    xpEarned: l.xpEarned,
    tasks: l.tasks.map((t) => ({
      taskNumber: t.taskNumber,
      status: t.status,
      bestScore: t.bestScore,
    })),
  }));
}

const STORAGE_KEY = "@kingspeech_levels_v4";
const XP_KEY = "@kingspeech_xp_v4";
const PROGRESS_KEY = "@kingspeech_progress_v5";
const RANK_KEY = "@kingspeech_current_rank_v1";
const SHOWTIME_RECORDINGS_KEY = "@kingspeech_showtime_recordings_v1";
// v3: rank-scoped per-metric weakness scores aggregated from real Show Time
// analyses. Shape: { [rankId]: { [metricName]: { sum, count } } }
const METRIC_SCORES_KEY = "@kingspeech_metric_scores_v3";
// v1: rank-scoped per-metric ordered series — every recorded analysis is
// pushed in chronological order so we can compute "before vs now" trends
// inside a rank window. Shape: { [rankId]: { [metricName]: number[] } }
const METRIC_SERIES_KEY = "@kingspeech_metric_series_v1";
const PORTAL_DONE_KEY = "@kingspeech_portal_done_v1";
// v1: the player's private reading library — every poem/prose they record on
// a Reading level is appended here so they can re-listen any time from their
// profile. Flat, newest-first list. Audio lives in a durable directory on
// native; on web we keep a data: URI.
const READING_LIBRARY_KEY = "@kingspeech_reading_library_v1";
// Hard cap so the library can't grow without bound on a heavy user.
const READING_LIBRARY_CAP = 100;

// Hard cap per metric per rank so the series cannot grow unbounded if a
// player records dozens of takes inside one world.
const METRIC_SERIES_CAP = 40;

// Average score below which a metric is considered weak enough to surface as
// a tip. The AI grades each metric on a 1–5 scale, so anything below 4 is
// treated as a real area to work on.
const WEAK_METRIC_THRESHOLD = 4;

export type MetricScores = Record<string, { sum: number; count: number }>;
export type MetricSeries = Record<string, number[]>;

// Snapshot of how a single metric improved (or regressed) across a rank
// window. `before` is the average of the earliest takes, `now` the average
// of the most recent takes; `samples` is the total number of recorded
// values in the window.
export interface MetricTrend {
  before: number;
  now: number;
  samples: number;
}

export interface ShowTimeRecording {
  uri: string;
  label?: string;
}

// A single saved reading take in the player's private library. `selfRating`
// is the 1–5 stars the player gave themselves after listening back; `aiStars`
// / `aiScore` mirror the background AI verdict so the library can show both.
export interface ReadingRecording {
  uri: string;
  title: string;
  author?: string;
  category?: string;        // "poetry" | "prose" | "fable"
  date: number;             // ms epoch — when it was recorded
  durationSec?: number;
  selfRating?: number;      // 1–5, the player's own score
  aiStars?: number;         // 0–5, derived from the AI overall score
  aiScore?: number;         // 0–10 AI overall (optional)
}

interface GameContextValue {
  levels: Level[];
  totalXp: number;
  completeTask: (levelId: LevelType, taskNumber: number, score: number) => void;
  completeAllTasksForLevel: (levelId: LevelType, score: number) => void;
  addXP: (amount: number) => void;
  markLevelComplete: (levelId: LevelType) => void;
  deductXp: (amount: number) => void;
  getLevelById: (id: LevelType) => Level | undefined;
  isLoaded: boolean;
  resetProgress: () => void;
  // Multi-rank world progression
  currentRank: number;            // 1..5
  advanceRank: () => void;
  // Dev-only direct rank setter — used by Open Testing to jump between
  // ranks without having to complete the full progression. The setter
  // itself does not gate on the dev flag; callers (the rank switcher UI)
  // are only mounted while Open Testing is enabled.
  setCurrentRank: (rank: number) => void;
  showTimeRecordings: Record<number, ShowTimeRecording[]>; // rankId -> recordings
  addShowTimeRecording: (rankId: number, uri: string) => void;
  renameShowTimeRecording: (rankId: number, uri: string, label: string) => void;
  removeShowTimeRecording: (rankId: number, uri: string) => void;
  // Aggregated per-metric scores from every Show Time recording in the rank
  // window. Used by RankUpScreen to surface the user's actual weakest areas.
  metricScores: Record<number, MetricScores>;
  // Record one analysis result for a rank: pass an object like
  // { clarity: 4, expressiveness: 3, volume: 2, confidence: 4, tempo: 3, pauses: 2 }.
  recordMetricScores: (rankId: number, scores: Record<string, number>) => void;
  // Worst-first list of metric names for a rank, capped to `limit`. Only
  // returns metrics whose average score is below the weakness threshold —
  // strong metrics are not surfaced as "things to refine".
  getWorstMetricsForRank: (rankId: number, limit: number) => string[];
  // "Before vs now" trend for a single metric inside a rank window. Returns
  // null when the player hasn't recorded enough Show Time analyses yet for
  // a meaningful comparison (we need at least 4 samples).
  getMetricTrendForRank: (rankId: number, metric: string) => MetricTrend | null;
  portalCompleted: Record<number, boolean>; // which rank portals were finished
  markPortalCompleted: (rankId: number) => void;
  // Private reading library — every recorded reading take, newest first.
  readingRecordings: ReadingRecording[];
  addReadingRecording: (rec: ReadingRecording) => void;
  removeReadingRecording: (uri: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const { isOpenTestingEnabled } = useDevTools();
  const [savedProgress, setSavedProgress] = useState<SavedProgress[] | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentRank, setCurrentRankState] = useState(1);
  const [showTimeRecordings, setShowTimeRecordings] = useState<Record<number, ShowTimeRecording[]>>({});
  const [metricScores, setMetricScores] = useState<Record<number, MetricScores>>({});
  const [metricSeries, setMetricSeries] = useState<Record<number, MetricSeries>>({});
  const [portalCompleted, setPortalCompleted] = useState<Record<number, boolean>>({});
  const [readingRecordings, setReadingRecordings] = useState<ReadingRecording[]>([]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(PROGRESS_KEY),
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(XP_KEY),
      AsyncStorage.getItem(RANK_KEY),
      AsyncStorage.getItem(SHOWTIME_RECORDINGS_KEY),
      AsyncStorage.getItem(METRIC_SCORES_KEY),
      AsyncStorage.getItem(METRIC_SERIES_KEY),
      AsyncStorage.getItem(PORTAL_DONE_KEY),
      AsyncStorage.getItem(READING_LIBRARY_KEY),
    ]).then(([progressRaw, legacyRaw, xpRaw, rankRaw, recRaw, scoresRaw, seriesRaw, portalRaw, readingRaw]) => {
      let progress: SavedProgress[] | null = null;

      if (progressRaw) {
        try {
          progress = JSON.parse(progressRaw) as SavedProgress[];
        } catch {}
      } else if (legacyRaw) {
        try {
          const legacyLevels = JSON.parse(legacyRaw) as Level[];
          progress = extractProgress(legacyLevels);
          AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
        } catch {}
      }

      setSavedProgress(progress);

      if (xpRaw) {
        try { setTotalXp(parseInt(xpRaw, 10)); } catch {}
      }

      if (rankRaw) {
        const r = parseInt(rankRaw, 10);
        if (!Number.isNaN(r) && r >= 1 && r <= 5) setCurrentRankState(r);
      }
      if (recRaw) {
        try {
          const obj = JSON.parse(recRaw);
          if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            // Migrate legacy shape (rankId -> string[]) to new
            // (rankId -> { uri, label? }[]).
            const migrated: Record<number, ShowTimeRecording[]> = {};
            let didMigrate = false;
            for (const [k, v] of Object.entries(obj)) {
              if (!Array.isArray(v)) continue;
              const items: ShowTimeRecording[] = v
                .map((entry) => {
                  if (typeof entry === "string") {
                    didMigrate = true;
                    return { uri: entry };
                  }
                  if (entry && typeof entry === "object" && typeof (entry as any).uri === "string") {
                    const label = typeof (entry as any).label === "string" ? (entry as any).label : undefined;
                    return label ? { uri: (entry as any).uri, label } : { uri: (entry as any).uri };
                  }
                  return null;
                })
                .filter((x): x is ShowTimeRecording => !!x);
              migrated[Number(k)] = items;
            }
            setShowTimeRecordings(migrated);
            if (didMigrate) {
              AsyncStorage.setItem(SHOWTIME_RECORDINGS_KEY, JSON.stringify(migrated)).catch(() => {});
            }
          }
        } catch {}
      }
      if (scoresRaw) {
        try {
          const obj = JSON.parse(scoresRaw);
          if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            setMetricScores(obj);
          }
        } catch {}
      }
      if (seriesRaw) {
        try {
          const obj = JSON.parse(seriesRaw);
          if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            setMetricSeries(obj);
          }
        } catch {}
      }
      if (portalRaw) {
        try {
          const obj = JSON.parse(portalRaw);
          if (obj && typeof obj === "object") setPortalCompleted(obj);
        } catch {}
      }
      if (readingRaw) {
        try {
          const arr = JSON.parse(readingRaw);
          if (Array.isArray(arr)) {
            const clean = arr.filter(
              (r): r is ReadingRecording =>
                r && typeof r.uri === "string" && typeof r.title === "string",
            );
            setReadingRecordings(clean);
          }
        } catch {}
      }

      setIsLoaded(true);
    });
  }, []);

  const levels = useMemo(
    () => buildLevelsFromContent(lang, savedProgress),
    [lang, savedProgress]
  );

  const persistProgress = (newLevels: Level[]) => {
    const progress = extractProgress(newLevels);
    setSavedProgress(progress);
    AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newLevels));
  };

  const completeTask = (levelId: LevelType, taskNumber: number, score: number) => {
    // Open Testing is a pure runtime override: never persist progress while it
    // is enabled, so toggling it off restores the original lock state. The
    // task panel still advances visually because `effectiveStatus` in
    // app/level/[id].tsx coerces locked→available while Open Testing is on,
    // and the parent screen drives `activeTaskIndex` directly.
    if (isOpenTestingEnabled) return;

    const levelExists = levels.find((l) => l.id === levelId);
    if (!levelExists) return;
    const taskExists = levelExists.tasks.find((t) => t.taskNumber === taskNumber);
    if (!taskExists) return;
    if (taskExists.status === "completed") return;

    let next = levels.map((level) => {
      if (level.id !== levelId) return level;

      const newTasks = level.tasks.map((task) => {
        if (task.taskNumber === taskNumber) {
          return {
            ...task,
            status: "completed" as TaskStatus,
            bestScore: Math.max(task.bestScore ?? 0, score),
          };
        }
        if (task.taskNumber === taskNumber + 1) {
          return { ...task, status: "available" as TaskStatus };
        }
        return task;
      });

      const levelCompleted = newTasks.every((t) => t.status === "completed");
      const xpEarned = levelCompleted ? (level.xpEarned === 0 ? 10 : level.xpEarned) : level.xpEarned;

      return {
        ...level,
        tasks: newTasks,
        completed: levelCompleted,
        status: levelCompleted ? "completed" as LevelStatus : "available" as LevelStatus,
        xpEarned,
      };
    });

    const thisLevel = next.find((l) => l.id === levelId);
    if (thisLevel?.completed) {
      next = next.map((level) => {
        if (level.levelNumber === thisLevel.levelNumber + 1 && level.status === "locked") {
          return {
            ...level,
            status: "available" as LevelStatus,
            tasks: level.tasks.map((t) =>
              t.taskNumber === 1 ? { ...t, status: "available" as TaskStatus } : t
            ),
          };
        }
        return level;
      });
    }

    persistProgress(next);

    const xpBonus = score >= 9 ? 5 : score >= 8 ? 2 : 0;
    const taskXp = 4 + xpBonus;
    setTotalXp((prev) => {
      const n = prev + taskXp;
      AsyncStorage.setItem(XP_KEY, String(n));
      return n;
    });
  };

  // For reading levels: complete every task in one shot, unlock the next
  // level, and award XP only once.
  const completeAllTasksForLevel = (levelId: LevelType, score: number) => {
    if (isOpenTestingEnabled) return;
    const target = levels.find((l) => l.id === levelId);
    if (!target) return;
    if (target.tasks.every((t) => t.status === "completed")) return;

    let next = levels.map((level) => {
      if (level.id !== levelId) return level;
      const newTasks = level.tasks.map((task) => ({
        ...task,
        status: "completed" as TaskStatus,
        bestScore: Math.max(task.bestScore ?? 0, score),
      }));
      const xpEarned = level.xpEarned === 0 ? 10 : level.xpEarned;
      return {
        ...level,
        tasks: newTasks,
        completed: true,
        status: "completed" as LevelStatus,
        xpEarned,
      };
    });

    next = next.map((level) => {
      if (level.levelNumber === target.levelNumber + 1 && level.status === "locked") {
        return {
          ...level,
          status: "available" as LevelStatus,
          tasks: level.tasks.map((t) =>
            t.taskNumber === 1 ? { ...t, status: "available" as TaskStatus } : t
          ),
        };
      }
      return level;
    });

    persistProgress(next);

    const xpBonus = score >= 9 ? 5 : score >= 8 ? 2 : 0;
    const taskXp = 4 + xpBonus;
    setTotalXp((prev) => {
      const n = prev + taskXp;
      AsyncStorage.setItem(XP_KEY, String(n));
      return n;
    });
  };

  // Generic XP add — used by free-form game modes (e.g. vocabulary) where
  // the score is computed inside the screen and the standard
  // completeAllTasksForLevel XP formula doesn't apply.
  const addXP = (amount: number) => {
    if (isOpenTestingEnabled) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    setTotalXp((prev) => {
      const n = prev + Math.floor(amount);
      AsyncStorage.setItem(XP_KEY, String(n));
      return n;
    });
  };

  // Mark a level as completed and unlock the next level in the path. Used
  // by vocabulary screens that don't fit the per-task scoring model.
  const markLevelComplete = (levelId: LevelType) => {
    if (isOpenTestingEnabled) return;
    const target = levels.find((l) => l.id === levelId);
    if (!target) return;
    if (target.completed) return;
    let next = levels.map((level) => {
      if (level.id !== levelId) return level;
      const newTasks = level.tasks.map((task) => ({
        ...task,
        status: "completed" as TaskStatus,
        bestScore: Math.max(task.bestScore ?? 0, 10),
      }));
      return {
        ...level,
        tasks: newTasks,
        completed: true,
        status: "completed" as LevelStatus,
        xpEarned: level.xpEarned === 0 ? 10 : level.xpEarned,
      };
    });
    next = next.map((level) => {
      if (level.levelNumber === target.levelNumber + 1 && level.status === "locked") {
        return {
          ...level,
          status: "available" as LevelStatus,
          tasks: level.tasks.map((t) =>
            t.taskNumber === 1 ? { ...t, status: "available" as TaskStatus } : t,
          ),
        };
      }
      return level;
    });
    persistProgress(next);
  };

  const deductXp = (amount: number) => {
    if (isOpenTestingEnabled) return;
    setTotalXp((prev) => {
      const n = Math.max(0, prev - amount);
      AsyncStorage.setItem(XP_KEY, String(n));
      return n;
    });
  };

  const getLevelById = (id: LevelType) => levels.find((l) => l.id === id);

  const resetProgress = () => {
    setSavedProgress(null);
    setTotalXp(0);
    setCurrentRankState(1);
    setShowTimeRecordings({});
    setMetricScores({});
    setMetricSeries({});
    setPortalCompleted({});
    setReadingRecordings([]);
    AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify([]));
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(buildLevelsFromContent(lang, null)));
    AsyncStorage.setItem(XP_KEY, "0");
    AsyncStorage.setItem(RANK_KEY, "1");
    AsyncStorage.setItem(SHOWTIME_RECORDINGS_KEY, JSON.stringify({}));
    AsyncStorage.setItem(METRIC_SCORES_KEY, JSON.stringify({}));
    AsyncStorage.setItem(METRIC_SERIES_KEY, JSON.stringify({}));
    AsyncStorage.setItem(PORTAL_DONE_KEY, JSON.stringify({}));
    AsyncStorage.setItem(READING_LIBRARY_KEY, JSON.stringify([]));
  };

  const advanceRank = () => {
    if (isOpenTestingEnabled) return;
    setCurrentRankState((prev) => {
      const next = Math.min(5, prev + 1);
      AsyncStorage.setItem(RANK_KEY, String(next));
      return next;
    });
  };

  const setCurrentRank = (rank: number) => {
    const clamped = Math.max(1, Math.min(5, Math.floor(rank)));
    setCurrentRankState(clamped);
    AsyncStorage.setItem(RANK_KEY, String(clamped)).catch(() => {});
  };

  const addShowTimeRecording = (rankId: number, uri: string) => {
    if (!uri) return;
    setShowTimeRecordings((prev) => {
      const list = prev[rankId] ?? [];
      // Avoid storing the same uri twice in a row.
      if (list.some((r) => r.uri === uri)) return prev;
      const entry: ShowTimeRecording = { uri };
      // Cap at 10 per rank but always preserve index 0 (first-ever take).
      const nextList: ShowTimeRecording[] =
        list.length >= 10
          ? [list[0], ...list.slice(-8), entry]
          : [...list, entry];
      const updated = { ...prev, [rankId]: nextList };
      AsyncStorage.setItem(SHOWTIME_RECORDINGS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const renameShowTimeRecording = (rankId: number, uri: string, label: string) => {
    if (!uri) return;
    const trimmed = label.trim();
    setShowTimeRecordings((prev) => {
      const list = prev[rankId];
      if (!list) return prev;
      let changed = false;
      const nextList = list.map((r) => {
        if (r.uri !== uri) return r;
        changed = true;
        if (trimmed) return { uri: r.uri, label: trimmed };
        // Empty string clears the custom label and reverts to the auto label.
        const { label: _omit, ...rest } = r;
        return { ...rest };
      });
      if (!changed) return prev;
      const updated = { ...prev, [rankId]: nextList };
      AsyncStorage.setItem(SHOWTIME_RECORDINGS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const removeShowTimeRecording = (rankId: number, uri: string) => {
    if (!uri) return;
    setShowTimeRecordings((prev) => {
      const list = prev[rankId];
      if (!list) return prev;
      const nextList = list.filter((r) => r.uri !== uri);
      if (nextList.length === list.length) return prev;
      const updated = { ...prev, [rankId]: nextList };
      AsyncStorage.setItem(SHOWTIME_RECORDINGS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const addReadingRecording = (rec: ReadingRecording) => {
    if (!rec || !rec.uri || !rec.title) return;
    setReadingRecordings((prev) => {
      // Dedupe by uri (re-saving the same take just updates it in place).
      const withoutDup = prev.filter((r) => r.uri !== rec.uri);
      const next = [rec, ...withoutDup].slice(0, READING_LIBRARY_CAP);
      AsyncStorage.setItem(READING_LIBRARY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const removeReadingRecording = (uri: string) => {
    if (!uri) return;
    setReadingRecordings((prev) => {
      const next = prev.filter((r) => r.uri !== uri);
      if (next.length === prev.length) return prev;
      AsyncStorage.setItem(READING_LIBRARY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const recordMetricScores = (rankId: number, scores: Record<string, number>) => {
    if (!scores || typeof scores !== "object") return;
    // Drop invalid entries (NaN / out-of-range / silent zeros). The AI
    // returns 1-5; a 0 means "silent run" — that doesn't represent a real
    // weakness profile and would unfairly skew the average.
    const clean = Object.entries(scores).filter(
      ([, v]) => typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 5
    );
    if (clean.length === 0) return;

    setMetricScores((prev) => {
      const rankBucket: MetricScores = { ...(prev[rankId] ?? {}) };
      for (const [metric, value] of clean) {
        const cur = rankBucket[metric] ?? { sum: 0, count: 0 };
        rankBucket[metric] = { sum: cur.sum + value, count: cur.count + 1 };
      }
      const updated = { ...prev, [rankId]: rankBucket };
      AsyncStorage.setItem(METRIC_SCORES_KEY, JSON.stringify(updated));
      return updated;
    });

    // Mirror every value into a chronological per-metric series so the
    // rank-up screen can render real before/now trends. The aggregated
    // sum/count above stays authoritative for "which metrics are weakest"
    // — this series only adds the temporal dimension.
    setMetricSeries((prev) => {
      const rankBucket: MetricSeries = { ...(prev[rankId] ?? {}) };
      for (const [metric, value] of clean) {
        const cur = rankBucket[metric] ?? [];
        const next = [...cur, value as number];
        // Trim from the middle: keep the earliest sample (anchors "before")
        // and the most recent samples (the freshest "now").
        rankBucket[metric] =
          next.length > METRIC_SERIES_CAP
            ? [next[0], ...next.slice(next.length - (METRIC_SERIES_CAP - 1))]
            : next;
      }
      const updated = { ...prev, [rankId]: rankBucket };
      AsyncStorage.setItem(METRIC_SERIES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const getWorstMetricsForRank = (rankId: number, limit: number): string[] => {
    const bucket = metricScores[rankId];
    if (!bucket) return [];
    const ranked = Object.entries(bucket)
      .map(([metric, { sum, count }]) => ({
        metric,
        avg: count > 0 ? sum / count : 5,
        count,
      }))
      .filter((e) => e.count > 0 && e.avg < WEAK_METRIC_THRESHOLD)
      .sort((a, b) => a.avg - b.avg);
    return ranked.slice(0, Math.max(0, limit)).map((e) => e.metric);
  };

  const getMetricTrendForRank = (
    rankId: number,
    metric: string,
  ): MetricTrend | null => {
    const series = metricSeries[rankId]?.[metric];
    if (!series || series.length < 4) return null;
    // With 6+ samples we lock the window size to 3-and-3 so the chip is
    // stable as more takes pile in. With 4-5 samples we split in half so
    // every value still contributes to the comparison.
    const windowSize = series.length >= 6 ? 3 : Math.floor(series.length / 2);
    const head = series.slice(0, windowSize);
    const tail = series.slice(series.length - windowSize);
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const before = avg(head);
    const now = avg(tail);
    if (!Number.isFinite(before) || !Number.isFinite(now)) return null;
    return { before, now, samples: series.length };
  };

  // ---- Firebase Firestore sync ----
  // Hydrate flow (per uid, fires once on sign-in):
  //   1. Read CURRENT local XP/progress from AsyncStorage directly — never
  //      from React state, which would be a stale closure from mount.
  //   2. Fetch cloud snapshot. If cloud is strictly richer (higher XP OR
  //      more completed levels), overwrite local state + AsyncStorage.
  //   3. Mark uid as hydrated so the push effect can safely upload.
  // Push flow:
  //   - Debounced 1.5s after any change in totalXp / savedProgress /
  //     currentRank / showTimeRecordings / portalCompleted.
  //   - Gated on hydratedUidRef === currentUser.uid so we never overwrite
  //     the cloud with a not-yet-merged local snapshot.
  const hydratedUidRef = useRef<string | null>(null);
  const pushTimerRef = useRef<any>(null);
  const hydrateRetryRef = useRef<any>(null);
  const hydrateAttemptsRef = useRef<number>(0);

  // Expose an offline-safe full reset so AuthContext.signOut() can wipe
  // local game state regardless of whether Firebase is configured.
  useEffect(() => {
    return registerGameResetter(async () => {
      hydratedUidRef.current = null;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      setSavedProgress(null);
      setTotalXp(0);
      setCurrentRankState(1);
      setShowTimeRecordings({});
      setMetricScores({});
      setMetricSeries({});
      setPortalCompleted({});
      setReadingRecordings([]);
      try {
        await Promise.all([
          AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify([])),
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(buildLevelsFromContent(lang, null))),
          AsyncStorage.setItem(XP_KEY, "0"),
          AsyncStorage.setItem(RANK_KEY, "1"),
          AsyncStorage.setItem(SHOWTIME_RECORDINGS_KEY, JSON.stringify({})),
          AsyncStorage.setItem(METRIC_SCORES_KEY, JSON.stringify({})),
          AsyncStorage.setItem(METRIC_SERIES_KEY, JSON.stringify({})),
          AsyncStorage.setItem(PORTAL_DONE_KEY, JSON.stringify({})),
          AsyncStorage.setItem(READING_LIBRARY_KEY, JSON.stringify([])),
        ]);
      } catch (e) {
        console.warn("[game] registered reset failed:", e);
      }
    });
  }, [lang]);

  useEffect(() => {
    if (!firebaseConfigured || !fbAuth || !fbDb) return;
    // Forward-declared so the catch-block retry can re-invoke the same flow.
    const hydrate = async (fbUser: FirebaseUser) => {
      await onAuth(fbUser);
    };
    const onAuth = async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        // Transitioning from signed-in → signed-out: wipe both
        // AsyncStorage and in-memory game state so the NEXT account on
        // this device starts clean and never has prior progress pushed
        // into its cloud doc. (One device + multiple accounts safety.)
        if (hydratedUidRef.current) {
          hydratedUidRef.current = null;
          if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
          setSavedProgress(null);
          setTotalXp(0);
          setCurrentRankState(1);
          setShowTimeRecordings({});
          setMetricScores({});
          setMetricSeries({});
          setPortalCompleted({});
          try {
            await Promise.all([
              AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify([])),
              AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(buildLevelsFromContent(lang, null))),
              AsyncStorage.setItem(XP_KEY, "0"),
              AsyncStorage.setItem(RANK_KEY, "1"),
              AsyncStorage.setItem(SHOWTIME_RECORDINGS_KEY, JSON.stringify({})),
              AsyncStorage.setItem(METRIC_SCORES_KEY, JSON.stringify({})),
              AsyncStorage.setItem(METRIC_SERIES_KEY, JSON.stringify({})),
              AsyncStorage.setItem(PORTAL_DONE_KEY, JSON.stringify({})),
            ]);
          } catch (e) {
            console.warn("[game] sign-out reset failed:", e);
          }
        }
        return;
      }
      if (hydratedUidRef.current === fbUser.uid) return;
      try {
        // 1) Read FRESH local values from AsyncStorage — never from React
        // state (would be a stale closure from mount, often initial defaults
        // like rank=1 / recordings={} / portal={}).
        const [xpRaw, progRaw, rankRaw, recRaw, portalRaw] = await Promise.all([
          AsyncStorage.getItem(XP_KEY),
          AsyncStorage.getItem(PROGRESS_KEY),
          AsyncStorage.getItem(RANK_KEY),
          AsyncStorage.getItem(SHOWTIME_RECORDINGS_KEY),
          AsyncStorage.getItem(PORTAL_DONE_KEY),
        ]);
        const localXp = xpRaw ? Number(xpRaw) || 0 : 0;
        let localProgress: SavedProgress[] = [];
        if (progRaw) {
          try {
            const parsed = JSON.parse(progRaw);
            if (Array.isArray(parsed)) localProgress = parsed;
          } catch {}
        }
        const localDone = localProgress.filter((p) => p?.completed).length;
        const localRank = rankRaw ? Number(rankRaw) || 1 : 1;
        let localRecordings: Record<string, any[]> = {};
        if (recRaw) {
          try {
            const parsed = JSON.parse(recRaw);
            if (parsed && typeof parsed === "object") localRecordings = parsed;
          } catch {}
        }
        let localPortal: Record<string, boolean> = {};
        if (portalRaw) {
          try {
            const parsed = JSON.parse(portalRaw);
            if (parsed && typeof parsed === "object") localPortal = parsed;
          } catch {}
        }

        // 2) Pull cloud snapshot and build a FIELD-WISE MONOTONIC merge
        // (`resolved`). Each field independently picks the richer side:
        //   - totalXp: max
        //   - progress: side with more completed levels
        //   - currentRank: max
        //   - showTimeRecordings: per-key longer-list
        //   - portalCompleted: union of true flags
        // After merging we both update local state/AsyncStorage AND push
        // the resolved snapshot to the cloud whenever it differs from the
        // cloud doc. This guarantees no field can ever be demoted on
        // either side during initial reconciliation.
        const snap = await getDoc(doc(fbDb!, "users", fbUser.uid, "game", "state"));
        const cloud = snap.exists() ? (snap.data() as any) : {};

        const cloudXp =
          typeof cloud.totalXp === "number" ? cloud.totalXp : 0;
        const cloudProgress: SavedProgress[] = Array.isArray(cloud.progress)
          ? (cloud.progress as SavedProgress[])
          : [];
        const cloudDone = cloudProgress.filter((p: any) => p?.completed).length;
        const cloudRank =
          typeof cloud.currentRank === "number" ? cloud.currentRank : 1;
        const cloudRecRaw =
          cloud.showTimeRecordings && typeof cloud.showTimeRecordings === "object"
            ? (cloud.showTimeRecordings as Record<string, unknown>)
            : {};
        const cloudPortal =
          cloud.portalCompleted && typeof cloud.portalCompleted === "object"
            ? (cloud.portalCompleted as Record<string, boolean>)
            : {};

        const resolvedXp = Math.max(localXp, cloudXp);

        // Per-`levelId` set-wise merge: if either side has the level
        // marked completed it stays completed; per-task best-score is
        // kept as the max. Avoids the equal-count overwrite edge case
        // where two devices complete different levels.
        const progressById = new Map<string, SavedProgress>();
        const mergeOne = (p: SavedProgress) => {
          if (!p?.levelId) return;
          const prev = progressById.get(p.levelId);
          if (!prev) {
            progressById.set(p.levelId, { ...p, tasks: [...(p.tasks ?? [])] });
            return;
          }
          const completed = prev.completed || p.completed;
          const xpEarned = Math.max(prev.xpEarned ?? 0, p.xpEarned ?? 0);
          const taskMap = new Map<number, SavedProgress["tasks"][number]>();
          for (const t of prev.tasks ?? []) taskMap.set(t.taskNumber, { ...t });
          for (const t of p.tasks ?? []) {
            const ex = taskMap.get(t.taskNumber);
            if (!ex) {
              taskMap.set(t.taskNumber, { ...t });
            } else {
              taskMap.set(t.taskNumber, {
                ...ex,
                status:
                  ex.status === "completed" || t.status === "completed"
                    ? "completed"
                    : ex.status === "available" || t.status === "available"
                    ? "available"
                    : ex.status,
                bestScore: Math.max(ex.bestScore ?? 0, t.bestScore ?? 0),
              });
            }
          }
          progressById.set(p.levelId, {
            ...prev,
            completed,
            xpEarned,
            status: completed ? "completed" : prev.status,
            tasks: Array.from(taskMap.values()).sort(
              (a, b) => a.taskNumber - b.taskNumber,
            ),
          });
        };
        for (const p of localProgress) mergeOne(p);
        for (const p of cloudProgress) mergeOne(p);
        const resolvedProgress: SavedProgress[] = Array.from(progressById.values());
        const resolvedDone = resolvedProgress.filter((p) => p?.completed).length;
        const resolvedRank = Math.max(localRank, cloudRank);

        const resolvedRecordings: Record<string, any[]> = { ...localRecordings };
        for (const k of Object.keys(cloudRecRaw)) {
          const lList = Array.isArray(resolvedRecordings[k])
            ? resolvedRecordings[k]
            : [];
          const cList = Array.isArray(cloudRecRaw[k])
            ? (cloudRecRaw[k] as any[])
            : [];
          if (cList.length > lList.length) resolvedRecordings[k] = cList;
        }

        const resolvedPortal: Record<string, boolean> = { ...localPortal };
        for (const k of Object.keys(cloudPortal)) {
          if (cloudPortal[k] === true) resolvedPortal[k] = true;
        }

        // Apply to local state + AsyncStorage only when richer than what
        // we already have locally (avoids unnecessary re-renders).
        if (resolvedXp > localXp) {
          setTotalXp(resolvedXp);
          AsyncStorage.setItem(XP_KEY, String(resolvedXp));
        }
        const progressChanged =
          JSON.stringify(resolvedProgress) !== JSON.stringify(localProgress);
        if (progressChanged) {
          setSavedProgress(resolvedProgress);
          AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(resolvedProgress));
        }
        if (resolvedRank > localRank) {
          setCurrentRankState(resolvedRank);
          AsyncStorage.setItem(RANK_KEY, String(resolvedRank));
        }
        const recordingsChanged =
          JSON.stringify(resolvedRecordings) !== JSON.stringify(localRecordings);
        if (recordingsChanged) {
          setShowTimeRecordings(resolvedRecordings);
          AsyncStorage.setItem(
            SHOWTIME_RECORDINGS_KEY,
            JSON.stringify(resolvedRecordings),
          );
        }
        const portalChanged =
          JSON.stringify(resolvedPortal) !== JSON.stringify(localPortal);
        if (portalChanged) {
          setPortalCompleted(resolvedPortal);
          AsyncStorage.setItem(PORTAL_DONE_KEY, JSON.stringify(resolvedPortal));
        }

        // 3) Push resolved snapshot to cloud whenever any field is richer
        // than what cloud currently has (or cloud doc is missing). Always
        // uses POST-MERGE values, so no field can be downgraded on cloud.
        // Compare resolved vs CLOUD (not just local) so a richer local
        // recordings/portal snapshot still triggers an upload even when
        // XP/progress/rank are equal to cloud.
        const cloudRecordingsJson = JSON.stringify(cloudRecRaw);
        const cloudPortalJson = JSON.stringify(cloudPortal);
        const resolvedRecordingsJson = JSON.stringify(resolvedRecordings);
        const resolvedPortalJson = JSON.stringify(resolvedPortal);
        const needsPush =
          !snap.exists() ||
          resolvedXp > cloudXp ||
          resolvedDone > cloudDone ||
          resolvedRank > cloudRank ||
          resolvedRecordingsJson !== cloudRecordingsJson ||
          resolvedPortalJson !== cloudPortalJson;
        if (needsPush) {
          try {
            await setDoc(
              doc(fbDb!, "users", fbUser.uid, "game", "state"),
              {
                totalXp: resolvedXp,
                progress: resolvedProgress,
                currentRank: resolvedRank,
                showTimeRecordings: resolvedRecordings,
                portalCompleted: resolvedPortal,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          } catch (e) {
            console.warn("[game] initial reconciliation push failed:", e);
          }
        }
        // 4) Only now allow future pushes — hydrate succeeded. If we set
        // the flag on transient failures, the next debounced push could
        // overwrite richer cloud state with stale local data.
        hydratedUidRef.current = fbUser.uid;
        hydrateAttemptsRef.current = 0;
        if (hydrateRetryRef.current) {
          clearTimeout(hydrateRetryRef.current);
          hydrateRetryRef.current = null;
        }
      } catch (e) {
        console.warn("[game] cloud hydrate failed:", e);
        // Leave hydratedUidRef unchanged so pushes stay blocked until a
        // successful hydrate. Schedule an exponential-backoff retry so a
        // transient network failure right after sign-in doesn't leave the
        // cloud sync permanently blocked until the next auth event.
        const attempt = ++hydrateAttemptsRef.current;
        if (attempt <= 5) {
          const delay = Math.min(60_000, 2_000 * 2 ** (attempt - 1));
          if (hydrateRetryRef.current) clearTimeout(hydrateRetryRef.current);
          hydrateRetryRef.current = setTimeout(() => {
            hydrateRetryRef.current = null;
            const cur = fbAuth?.currentUser;
            if (
              cur &&
              cur.uid === fbUser.uid &&
              hydratedUidRef.current !== cur.uid
            ) {
              // Re-invoke the same handler with the same user.
              void hydrate(cur);
            }
          }, delay);
        }
      }
    };
    const unsub = onAuthStateChanged(fbAuth, onAuth);
    return () => {
      unsub();
      if (hydrateRetryRef.current) {
        clearTimeout(hydrateRetryRef.current);
        hydrateRetryRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!firebaseConfigured || !fbAuth || !fbDb) return;
    if (!isLoaded) return;
    const cur = fbAuth.currentUser;
    if (!cur) return;
    // Gate: do not push until we've hydrated for THIS user. Prevents
    // overwriting cloud state with a pre-merge local snapshot.
    if (hydratedUidRef.current !== cur.uid) return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    const uid = cur.uid;
    pushTimerRef.current = setTimeout(async () => {
      try {
        await setDoc(
          doc(fbDb!, "users", uid, "game", "state"),
          {
            totalXp,
            progress: savedProgress ?? [],
            currentRank,
            showTimeRecordings,
            portalCompleted,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (e) {
        console.warn("[game] cloud push failed:", e);
      }
    }, 1500);
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [isLoaded, totalXp, savedProgress, currentRank, showTimeRecordings, portalCompleted]);

  const markPortalCompleted = (rankId: number) => {
    // Guard: only allow marking complete when all rank levels are done.
    const range = RANKS_MODULAR.find((r) => r.index === rankId);
    if (!range) return;
    const rankLevels = levels.filter(
      (l) => l.module >= range.fromSection && l.module <= range.toSection
    );
    if (rankLevels.length === 0) return;
    const allDone = rankLevels.every((l) => l.completed);
    if (!allDone && !isOpenTestingEnabled) return;
    setPortalCompleted((prev) => {
      if (prev[rankId]) return prev;
      const next = { ...prev, [rankId]: true };
      AsyncStorage.setItem(PORTAL_DONE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const value = useMemo(
    () => ({
      levels,
      totalXp,
      completeTask,
      completeAllTasksForLevel,
      addXP,
      markLevelComplete,
      deductXp,
      getLevelById,
      isLoaded,
      resetProgress,
      currentRank,
      advanceRank,
      setCurrentRank,
      showTimeRecordings,
      addShowTimeRecording,
      renameShowTimeRecording,
      removeShowTimeRecording,
      metricScores,
      recordMetricScores,
      getWorstMetricsForRank,
      getMetricTrendForRank,
      portalCompleted,
      markPortalCompleted,
      readingRecordings,
      addReadingRecording,
      removeReadingRecording,
    }),
    [levels, totalXp, isLoaded, currentRank, showTimeRecordings, metricScores, metricSeries, portalCompleted, readingRecordings]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
