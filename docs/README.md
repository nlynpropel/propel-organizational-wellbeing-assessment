# Propel Opportunity Index — Deck Generator

This is the "reusable template" your Bolt app's AI can call to turn an approved
strategy report into a branded PowerPoint deck. It's not a static .pptx file with
`{{TOKENS}}` in text boxes — it's a small JS function, because your score bars and
the Opportunity Index gauge need to render at different widths depending on the
actual numbers, which a static token-replace file can't do. This is what the
ChatGPT plan called the "MVP: PptxGenJS with coded layouts" approach.

## Files

- **generate_deck.js** — the generator. Exports `generateDeck(data, outPath)`.
- **data.json** — example payload (the Java Coffee report from your screenshots),
  and also documents the exact shape the function expects.
- **output.pptx** — the deck generated from data.json, for you to review against
  the original PDF/screenshots.

## How to wire it into Propel

1. When a strategy report is approved, build a payload matching `data.json`'s
   shape from your `client` / `assessment` / `strategy` tables (this is the
   "presentation data payload" step from your plan — keep it separate from the
   PPTX generator itself, exactly as recommended, so the generator never queries
   the DB directly).
2. Call `generateDeck(payload, outPath)` from a Node/Bolt server function.
3. Serve the resulting file for download.

```js
const { generateDeck } = require("./generate_deck.js");
await generateDeck(payload, "/tmp/opportunity-index.pptx");
```

## Deck structure (12 slides, all data-driven)

1. Cover — client name, assessment name/date, score card + gauge
2. Opportunity Index Overview — gauge, strengths, priority opportunities
3. Strategy Dimensions — 6 score bars (2×3 grid)
4. Behavioral Readiness — 4 score bars with descriptions (2×2 grid)
5. Executive Summary + Current Maturity
6. What Is Holding Impact Back — findings list
7–11. One slide per recommendation, **looped from `strategy.recommendations`**
   — add a 6th recommendation to the array and you get a 6th slide automatically,
   no template editing required
12. Recommended Implementation Sequence (3 phase cards) + discussion questions
13. Closing

## Extending it

- **Colors/fonts** — edit the constants at the top of `generate_deck.js`
  (`NAVY`, `ORANGE`, `GREEN`, etc.) to match your final brand palette.
- **Overflow protection** (per your plan's point #7) — this version doesn't yet
  auto-shrink or paginate long text. If a client's `executive_summary` or a
  recommendation body runs long, add a word-count guard before calling
  `generateDeck` (regenerate the AI summary rather than shrinking font size,
  same as the plan recommends), or extend the script to auto-split into a
  continuation slide.
- **Validation** — before shipping a generated deck, run:
  ```
  python scripts/office/validate.py output.pptx
  ```
  (from the pptx skill) to catch corrupt XML before it reaches a client.

## Note on the two workflow options from your ChatGPT thread

Your plan also described an alternative: uploading a Canva-exported `.pptx` and
token-replacing text inside it. That's a reasonable **Phase 2** once your design
is finalized in Canva — but it can't move the score bars, so you'd still need
this same coded-shapes approach for the data visuals, and only use token-replace
for static brand/layout elements. For the MVP, one coded generator (this file)
is simpler to build and maintain than maintaining both a Canva template *and*
a shape-drawing layer on top of it.
