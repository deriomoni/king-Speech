/**
 * English feedback templates (spec §8.4). Mirrors templates.ru.ts structure.
 */

import { InsightId } from './insights';
import { GrowthTemplate, MetricKey } from './templates.ru';

export const GROWTH_INSIGHTS_EN: Partial<Record<InsightId, GrowthTemplate>> = {
  filler_word: {
    variants: [
      '“{word}” came up {count} times.',
      'You leaned on “{word}” {count} times.',
      '“{word}” showed up {count} times.',
      'The word “{word}” repeated {count} times.',
    ],
    action: 'Try a short pause in those spots — silence sounds more confident than any filler.',
  },
  tautology_word: {
    variants: [
      '“{word}” keeps repeating — {synonyms}',
      'The word “{word}” comes up a lot — {synonyms}',
      'You return to “{word}” often — {synonyms}',
      '“{word}” appears again and again — {synonyms}',
    ],
    action: 'Swap in an alternative the second time a word repeats.',
  },
  volume_fade: {
    variants: [
      'You started strong but faded by the end.',
      'Your voice drops toward the finish.',
      'The opening is louder than the closing.',
      'Volume sags near the end.',
    ],
    action: 'Hold your breath support to the last line — take air earlier.',
  },
  pace_drift: {
    variants: [
      'You speed up toward the end.',
      'The finish runs faster than the start.',
      'Tempo climbs by the end.',
      'The last lines come out rushed.',
    ],
    action: 'The finish matters most — slow down deliberately on it.',
  },
  swallowed_marks: {
    variants: [
      'Commas get swallowed — e.g. after “{location}”.',
      'Pauses at commas are lost, including after “{location}”.',
      'Punctuation slips by without a pause, e.g. after “{location}”.',
      'The comma pause is missing, notably after “{location}”.',
    ],
    action: 'A comma pause is a breath for the listener — give them that breath.',
  },
  ending_swallow: {
    variants: [
      'Word endings sink.',
      'The ends of words come out unclear.',
      'Final letters get lost.',
      'Words trail off before they finish.',
    ],
    action: 'Finish each word to the last letter, especially before a pause.',
  },
  monotone: {
    variants: [
      'The reading is very flat.',
      'Intonation barely changes.',
      'Your voice stays on one note.',
      'The delivery is even, with no emphasis.',
    ],
    action: 'Stress one key word in each sentence with your voice.',
  },
  breath_breaks: {
    variants: [
      'You run out of breath before the phrase ends.',
      'Phrases break for a mid-sentence breath.',
      'Air runs out before the end of the line.',
      'Extra breath pauses appear inside phrases.',
    ],
    action: 'Take air at the full stop, not in the middle of a phrase.',
  },
  missed_words: {
    variants: [
      'The word “{word}” keeps slipping.',
      '“{word}” isn’t landing yet.',
      'The word “{word}” gets lost at speed.',
      '“{word}” slips past.',
    ],
    action: 'Say it alone, slowly, three times — then bring it back up to tempo.',
  },
  speed_over_clarity: {
    variants: [
      'Speed ate your clarity.',
      'Clarity dropped at the faster tempo.',
      'The speed-up cost you crispness.',
      'The faster it got, the less clear it was.',
    ],
    action: 'Step back one notch in speed — the pace will catch up on its own.',
  },
  problem_cluster: {
    variants: [
      'Clusters with [{cluster}] still slip.',
      'The [{cluster}] cluster is the tough one right now.',
      'Sounds [{cluster}] are your current growth edge.',
      'You stumble most on the [{cluster}] combination.',
    ],
    action: 'These are the hardest sounds — drill them alone, slowly.',
  },
  syllable_hint: {
    variants: [
      'The word “{word}” came out unsure.',
      '“{word}” got blurred.',
      'The word “{word}” was unclear.',
      '“{word}” is worth saying more cleanly.',
    ],
    action: 'Say it syllable by syllable, slowly: {syllables}',
  },
};

export const PRAISE_INSIGHTS_EN: Partial<Record<InsightId, { variants: string[] }>> = {
  strong_finish: {
    variants: [
      'The finish was as confident as the start — that’s rare.',
      'You held your voice strong to the last line.',
      'The ending didn’t sag — you held it.',
      'The finish landed as firm as the opening.',
    ],
  },
  zero_fillers: {
    variants: [
      'Not a single filler in {N} words — clean speech.',
      '{N} words and no “um” or “like” — clean.',
      'Speech with zero fillers across {N} words.',
      'Across {N} words, not one crutch word.',
    ],
  },
  clean_sprint: {
    variants: [
      'Fast AND clear — that’s a real level.',
      'Speed with no loss of clarity — strong.',
      'Pace and crispness together — great work.',
      'Clear even at high tempo — keep it up.',
    ],
  },
  all_marks_hit: {
    variants: [
      'Every pause in its place — easy to listen to.',
      'The punctuation played perfectly.',
      'All the pauses landed.',
      'The rhythm of the text held beautifully.',
    ],
  },
};

export const METRIC_GROWTH_EN: Record<MetricKey, GrowthTemplate> = {
  clarity: {
    variants: ['Clarity wavers in spots.', 'Some words sound blurred.', 'Crispness could rise.', 'Part of the words lose clarity.'],
    action: 'Articulate endings and consonants a little more sharply.',
  },
  tempo: {
    variants: ['Tempo is a touch off target.', 'The pace needs a small tune.', 'Rhythm drifts from the target a bit.', 'The tempo can be evened out.'],
    action: 'Find a steady pace — don’t rush and don’t drag.',
  },
  punct: {
    variants: ['Pauses at marks slip sometimes.', 'Not every comma and stop is played.', 'The pause rhythm can improve.', 'Punctuation deserves fuller pauses.'],
    action: 'Take a short breath at every comma and full stop.',
  },
  loudness: {
    variants: ['Volume drifts.', 'The voice level is uneven.', 'Sound goes louder then softer.', 'Volume could stay steadier.'],
    action: 'Hold a steady, confident voice level.',
  },
  breath: {
    variants: ['Breathing wobbles at times.', 'Air doesn’t always last the phrase.', 'Breath could be spread more evenly.', 'Extra breaths appear inside phrases.'],
    action: 'Take air at full stops; plan your breathing ahead.',
  },
  fillers: {
    variants: ['Filler words slip through.', 'Some crutch words appear.', 'Speech can be cleaned of extras.', 'A few fillers flicker through.'],
    action: 'Replace the extra words with a short pause.',
  },
  tautology: {
    variants: ['Some words repeat.', 'There are repeats of the same words.', 'Vocabulary could vary more.', 'A few words go in circles.'],
    action: 'Notice the repeat and pick a synonym the second time.',
  },
  diversity: {
    variants: ['Vocabulary is a bit repetitive.', 'The word choice loops.', 'You could add variety.', 'The word set could widen.'],
    action: 'Try different phrasings for the same idea.',
  },
  pauseDiscipline: {
    variants: ['There are overlong silences.', 'Some pauses drag out.', 'Long silent gaps break the rhythm.', 'Pauses run too long at times.'],
    action: 'Keep pauses short and purposeful.',
  },
};

export const METRIC_PRAISE_EN: Record<MetricKey, { variants: string[] }> = {
  clarity: {
    variants: ['Clarity is excellent — every word lands.', 'Diction is clean and easy to read.', 'Great intelligibility.', 'You speak clean and clear.'],
  },
  tempo: {
    variants: ['Tempo right on target.', 'You hold a steady, comfortable pace.', 'Rhythm held perfectly.', 'The pace is even and confident.'],
  },
  punct: {
    variants: ['Pauses at marks are spot on.', 'The pause rhythm held perfectly.', 'Punctuation played cleanly.', 'The text breathes naturally.'],
  },
  loudness: {
    variants: ['Voice is even and confident.', 'Volume stays stable.', 'Your voice level is just right.', 'You sound full and steady.'],
  },
  breath: {
    variants: ['Breathing is well spread.', 'Air lasts through the phrases.', 'You breathe steadily, no breaks.', 'Breath is under control.'],
  },
  fillers: {
    variants: ['Clean speech, no extra words.', 'Almost no fillers — great.', 'You speak without crutches.', 'No filler words slip through.'],
  },
  tautology: {
    variants: ['Almost no repeats.', 'Words don’t go in circles.', 'Vocabulary doesn’t stall.', 'Fresh phrasing throughout.'],
  },
  diversity: {
    variants: ['Rich, varied vocabulary.', 'Lively, varied word choice.', 'Phrasing is diverse.', 'Your vocabulary works for you.'],
  },
  pauseDiscipline: {
    variants: ['Precise pauses, no drag.', 'You keep the rhythm tight.', 'Silence works for you.', 'Pauses are timely and apt.'],
  },
};
