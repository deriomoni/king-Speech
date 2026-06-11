# Agent Prompt — King Speech Brand Identity Implementation

Copy-paste the prompt below into Cursor / Replit agent.

---

## TASK: Implement the King Speech brand identity system (design tokens, fonts, colors)

You are working on King Speech — an Expo 54 + React Native 0.81 + Expo Router app for public speaking training. We are implementing a finalized brand identity. Work carefully and ONLY touch what is listed below. Do NOT redesign screens, do NOT change layout or business logic, do NOT modify the "Show Time" screen styling at all.

### 1. Create a single source of truth for design tokens

Create `theme/tokens.ts` (or extend the existing theme file if one exists — find it first) with exactly these values:

```ts
export const colors = {
  // core
  bg: '#0E0E10',
  surface: '#1A1A1F',
  border: '#2A2A31',
  gold: '#FFCF34',        // DOMINANT accent: CTA buttons, rewards, progress, mascot
  purple: '#9468FB',      // SUPPORT accent: secondary highlights, links, glows

  // text on dark
  textPrimary: '#F5F5F7',
  textSecondary: '#C9C9D1',
  textTertiary: '#8A8A93',
  onGold: '#41310A',      // text color on gold fills — never pure black
  onPurple: '#F0E9FF',

  // semantic
  success: '#4FD9A0',
  warning: '#FF9E4A',
  error: '#FF6B6B',
  info: '#58B6FF',

  // rank colors (progression: Новичок → Профи)
  rank: {
    novice: '#4FD9A0',
    amateur: '#58B6FF',
    confident: '#FF6F61',
    master: '#9468FB',
    pro: '#FFCF34',
  },

  // 12-color level palette (single warm undertone, tuned for dark bg)
  level: {
    coral: '#FF6F61',
    apricot: '#FF9E4A',
    gold: '#FFCF34',
    lime: '#C8E04F',
    mint: '#4FD9A0',
    turquoise: '#3DCFC9',
    sky: '#58B6FF',
    ultramarine: '#7C8CFF',
    violet: '#9468FB',
    orchid: '#BD7DF5',
    pink: '#F472B6',
    terracotta: '#E07A50',
  },
} as const;

export const radii = {
  card: 22,
  button: 16,
  chip: 12,
  // Rule: rounded corners everywhere, radius ≈ 20–25% of element size. No sharp corners.
} as const;

export const spring = {
  appear: { damping: 15, stiffness: 200, mass: 1 },
  press: { damping: 12, stiffness: 250, mass: 1 },
  // Press feedback: scale 0.97 → 1 with spring.press
} as const;
```

### 2. Replace fonts

Remove Instrument Serif and Inter Tight. Install and load:

- `@expo-google-fonts/rubik` — weights 500, 600, 700 (headings, display, rank numbers)
- `@expo-google-fonts/nunito` — weights 400, 700, 800 (body, UI, buttons)
- `@expo-google-fonts/literata` — weights 400, 500 (reading texts inside levels ONLY)

Load via `useFonts` in the root layout. Add a `typography` section to the tokens file:

```ts
export const typography = {
  display: { fontFamily: 'Rubik_700Bold', fontSize: 32, lineHeight: 38 },
  h1: { fontFamily: 'Rubik_600SemiBold', fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: 'Rubik_500Medium', fontSize: 20, lineHeight: 26 },
  body: { fontFamily: 'Nunito_400Regular', fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: 'Nunito_700Bold', fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 18 },
  button: { fontFamily: 'Nunito_800ExtraBold', fontSize: 16, lineHeight: 20 },
  reading: { fontFamily: 'Literata_400Regular', fontSize: 18, lineHeight: 30 },
} as const;
```

Apply `reading` ONLY to the long-form text component inside reading/level screens. Everything else uses Rubik/Nunito per the roles above.

### 3. Kazakh glyph verification (critical)

The app supports Russian, English, and Kazakh. After loading fonts, render this test string in Rubik, Nunito, and Literata on a temporary dev screen or storybook entry:

```
Сәлеметсіз бе! Қош келдіңіз. Ә Ғ Қ Ң Ө Ұ Ү Һ І — ә ғ қ ң ө ұ ү һ і
```

Visually confirm the Kazakh-specific letters render in the SAME typeface as surrounding text (not a system-font fallback, which looks visibly different). If any font lacks these glyphs, report it back instead of silently shipping. If Literata fails the test, substitute `@expo-google-fonts/noto-serif` for the reading role.

### 4. Color usage migration

- Find places where purple `#9468FB` is used as the PRIMARY action color (main CTA buttons, primary progress indicators) and switch those to gold `#FFCF34` with text color `onGold` (`#41310A`). Purple remains for secondary accents, highlights, and glows.
- Replace any pure black (`#000`, `#000000`) text on colored fills with the matching dark tone from the same hue family (use `onGold` for gold fills as the reference pattern).
- Wire rank screens/components to `colors.rank.*` and level-type accents to `colors.level.*`. If a mapping config for level types already exists, update it to reference these tokens instead of hardcoded hex values.
- Do NOT change the dark background system: `bg: #0E0E10`, surfaces `#1A1A1F` stay as is.

### 5. Constraints

- Do NOT touch the Show Time screen.
- Do NOT modify navigation structure, business logic, API calls, or content files.
- Do NOT introduce new dependencies beyond the three font packages.
- Replace hardcoded hex values with token imports ONLY in files you already need to edit; do not do a repo-wide refactor in this pass.
- After changes, list every file you modified and why.

### Acceptance checklist

1. `theme/tokens.ts` exists with colors, radii, spring, typography exactly as specified.
2. App boots with Rubik/Nunito/Literata loaded; no references to Instrument Serif or Inter Tight remain.
3. Kazakh test string renders correctly in all three fonts (screenshot or confirmation).
4. Primary CTAs are gold with dark-gold text; purple is secondary.
5. Show Time screen is byte-identical in styling.
