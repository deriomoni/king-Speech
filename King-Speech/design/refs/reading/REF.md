# Reading — reference (Phenotycs "Resonance V01" typographic posters)

Two poster refs provided by the user (light "paper" + dark). Design language we adopt
for the Reading level's IDLE state:

- **Left anchor, zero centering.** Everything hangs off the left edge.
- **Top-left swatch strip** — a gradient of grey segments (dark → light) ending in a
  bright square with a 4-point sparkle. → our progress strip ("накопление света"),
  crown segment = Oscar mark, lights gold only at 100%.
- **Top-right quote glyph** — heavy `”`, decorative, low-alpha.
- **Hero title** — huge heavy grotesque, tight leading (~0.95), tight tracking,
  multi-line, left-aligned. → work title (Rubik 800).
- **Kicker** — small uppercase bold with wide tracking. → "АВТОР · ЖАНР".
- **Body** — readable, generous line-height, line ≤ 60 chars.
- **Footer meta** — two columns, tiny bold uppercase. → "ЧТЕНИЕ · 04" / "РАНГ II".
- **Two themes** — dark charcoal + light paper.

Karaoke palette is taken from the swatch's grey gradient (see `theme/tokens.ts` →
`reading.dark.word`): unread = shadow, read = lit, active = brightest warm-white spark.
No gold/violet in running text — gold appears once (crown at 100%).
