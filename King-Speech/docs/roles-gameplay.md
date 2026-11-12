# Roles — gameplay (two-sided scenes)

Every role is a short **two-sided scene**: the player talks, the other side
answers on screen. 24 scenarios, RU + EN, one per role.

## Flow

1. **/role-brief** — the role card, the scene, **who you'll be talking to**
   (persona: avatar, name, mood, one-line description) and the **scene goals**
   (2–3). Pick Improvise / By the script and Camera / Voice only.
2. **/role-stage** — recording. The scene overlay for the role's category plays
   on top of the selfie (or the role card in voice-only mode):
   | kind    | roles | UI |
   |---------|-------|----|
   | `chat`  | sales + service (ice-cream, car, apartment, handbag, pen, barista, flight attendant, reception, consultant, manager) | persona strip with mood meter, context chips, opponent bubbles (left), your turns (right, yellow), «…» typing |
   | `live`  | bloggers (8) | «LIVE · mm:ss» + viewer counter in the top bar, comment stream, pinned question, one troll per stream, floating hearts, fake comment input |
   | `stage` | public (6), `variant` picks the flavour | `weather`: producer cues in the earpiece + forecast cards and a map strip · `showman`/`comedian`: side energy/laugh meter, hall reactions, heckler · `host`: «now on the programme» cards + guest interjections · `interview`: reporter questions with camera flashes · `voice`: character cards with direction notes |
   Everything stays in the lower third / right edge — the face tracker and the
   face area at the top are left clear.
3. **/role-result** — usual stars + 5 metrics, plus **«Цели сцены»**: the
   ending line (win/lose tint) and ✓/✗ with a short note per goal.

## Turn-taking engine — `hooks/useRoleScenario.ts`

- Mic levels come from the recorder: native `expo-audio` metering
  (`isMeteringEnabled`, 150 ms) or a Web Audio `AnalyserNode`.
- Speech = level above an adaptive noise floor (+12 dB on / +8 dB off,
  never below −52 dBFS).
- After an opponent line lands, the engine waits for the player to speak for
  `minSpeak` (1.6 s improv; ~0.22 s per word of the scripted reply, 1.5–6 s)
  and then pause **≥ 1.2 s** → «…» for ~1 s → next line.
- Silence: a nudge from the persona at 6 s; the scene moves on at 12 s
  (counted as a *silent* answer). If the player is mid-sentence at 12 s the
  engine waits up to 25 s.
- No levels at all (metering unsupported) → timed beats sized to the reply.
- Answer quality per beat: `full` (≥ 3 s or the scripted minimum), `short`,
  `silent`. It moves the mood meter (+`beat.mood` default 7 / +2 / −12) and a
  `full` answer to a beat with `goal` **ticks that goal live**.
- Live streams: viewers drift toward a target driven by mood, stream age and
  whether you're talking; hearts float while you speak; ambient chatter every
  2–5 s (scenario `ambient` + generic lines).
- After the last beat the persona's ending appears (`win` if mood ≥ 50 and
  you weren't silent on most lines; scripted mode wins unless mostly silent)
  and the take **auto-stops after 6 s**.
- A single 200 ms interval runs only while the take is recording.

### Retake

«Заново · дубль 2» while recording stops and discards the current take
(video + audio + face stats), resets the scene and shows a **3-2-1** countdown
(«Подожду» cancels back to the ready state). Max 2 takes, as before.

### Scripted mode

The teleprompter becomes a dialogue script: the opponent's current line
(small, quoted) and **your line** (big). It advances with the engine. The old
`Role.scriptedText` monologue is kept as a fallback for roles without a
scenario.

## Scoring

`role-result` posts `scenario` to `/api/analyze-role`: persona, the opponent
lines actually shown (with full/short/silent per line), goals with keyword
stems and live ticks, and whether the scene reached its ending. The judge
prompt weights `roleFit` toward how the player handled the conversation and
returns `goals: [{id, hit, note}]`. Without AI (or without a transcript) the
server marks a goal hit if any keyword stem appears in the transcript, else
uses the live tick.

## Adding / editing a scenario

Data: `constants/scenarios/{sales,blogger,communication,public}.ts`, types and
helpers in `constants/scenarios/types.ts`, registry in
`constants/roleScenarios.ts` (`getRoleScenario(roleId)`).

```ts
{
  roleId: "barista",            // must match ROLES[].id
  kind: "chat",                 // chat | live | stage (+ variant for stage)
  persona: { name, avatar: "😪", mood, about },
  chips: [{ icon: "☕", label: L("8:15 утра", "8:15 am") }],   // chat only, optional
  meterLabel: L("Настроение гостя", "Guest mood"),
  nudge: L("Э-э… я могу заказать?", "Uh… can I order?"),      // optional
  opening: L(...), openingHint: L(...),  // set → the PLAYER speaks first
  goals: [goal("warm", "ru text", "en text", ["стемы"], ["stems"])],
  beats: [
    beat("opponent ru", "opponent en", "your scripted reply ru", "… en", {
      goal: "warm",        // ticks this goal on a full answer
      mood: 10,            // mood delta for a full answer (default 7)
      from: who("lena_glow", "🌸"),        // live comment / cue / heckler (tone)
      pin: true,           // live: pin as the question of the moment
      card: { icon: "☀️", title: L(...), sub: L(...), value: "+24°" },  // stage cards
      flash: true,         // interview flashes
      ifSilent: L(...),    // alt line if the previous answer was silence
    }),
  ],
  ending: { win: L(...), lose: L(...) },
  startViewers: 200, ambient: [L("😍", "😍")],   // live only
}
```

Guidelines: 6–10 beats (~60–120 s), every goal referenced by at least one
beat, one troll/heckler per live/stage scene, keyword stems lower-case and
short (they're substring-matched), keep each line under ~140 characters so
bubbles stay in the lower third.
