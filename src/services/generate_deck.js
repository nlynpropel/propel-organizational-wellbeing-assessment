const pptxgen = require("pptxgenjs");

// ---- Brand palette ----
const NAVY = "132340";
const NAVY_LIGHT = "1F3A5F";
const ORANGE = "E8813A";
const GREEN = "7CB342";
const DARKGREEN = "4A7C1F";
const GRAY = "9AA5B1";
const BLUEGRAY = "5C7C99";
const CARD_BG = "F7F8FA";
const LINE = "E8EBEF";
const TEXT_DARK = "1F2937";
const TEXT_GRAY = "667085";
const WHITE = "FFFFFF";

const BAND_COLORS = { Reactive: GRAY, Developing: BLUEGRAY, Established: ORANGE, Strategic: GREEN, Leading: DARKGREEN };
const BEHAVIOR_COLORS = { "Meaningful barriers": ORANGE, "Generally supportive": GREEN, "Limited support": GRAY, "Strong support": DARKGREEN };

const FONT = "Arial";
const PAGE_W = 13.333;
const PAGE_H = 7.5;
const MARGIN = 0.6;

function levelColor(level) {
  return BAND_COLORS[level] || BEHAVIOR_COLORS[level] || GRAY;
}

// ---------- shared building blocks ----------

function addFooter(slide, pageLabel) {
  slide.addText("Powered by Propel", { x: MARGIN, y: PAGE_H - 0.4, w: 3, h: 0.3, fontSize: 8, color: TEXT_GRAY, fontFace: FONT, italic: true });
  if (pageLabel) {
    slide.addText(pageLabel, { x: PAGE_W - MARGIN - 2, y: PAGE_H - 0.4, w: 2, h: 0.3, fontSize: 8, color: TEXT_GRAY, fontFace: FONT, align: "right" });
  }
}

function addHeader(slide, title) {
  slide.addText(title, { x: MARGIN, y: 0.45, w: PAGE_W - MARGIN * 2, h: 0.5, fontSize: 24, bold: true, color: NAVY, fontFace: FONT });
}

// Horizontal score bar: label + score at top, colored fill bar, level word below
function addScoreBar(slide, x, y, w, item) {
  slide.addText(item.name, { x, y, w: w - 0.9, h: 0.24, fontSize: 11, bold: true, color: TEXT_DARK, fontFace: FONT, margin: 0 });
  slide.addText(`${item.score} / 100`, { x: x + w - 0.9, y, w: 0.9, h: 0.24, fontSize: 11, bold: true, color: TEXT_DARK, fontFace: FONT, align: "right", margin: 0 });
  const barY = y + 0.3, barH = 0.14;
  slide.addShape("rect", { x, y: barY, w, h: barH, fill: { color: LINE }, line: { type: "none" } });
  const filledW = Math.max(0.06, w * Math.min(100, Math.max(0, item.score)) / 100);
  slide.addShape("rect", { x, y: barY, w: filledW, h: barH, fill: { color: levelColor(item.level) }, line: { type: "none" } });
  slide.addText(item.level, { x, y: barY + barH + 0.04, w, h: 0.2, fontSize: 9, color: TEXT_GRAY, fontFace: FONT, margin: 0 });
}

// Segmented gauge with a marker at the current score
function addGauge(slide, x, y, w, score, bands) {
  const segW = w / bands.length;
  bands.forEach((b, i) => {
    slide.addShape("rect", { x: x + i * segW, y, w: segW, h: 0.32, fill: { color: BAND_COLORS[b] || GRAY }, line: { color: WHITE, width: 1.5 } });
    slide.addText(b, { x: x + i * segW - 0.08, y: y + 0.36, w: segW + 0.16, h: 0.2, fontSize: 7, color: TEXT_GRAY, fontFace: FONT, align: "center", margin: 0, wrap: false });
  });
  const clamped = Math.min(100, Math.max(0, score));
  const markerX = x + (w * clamped) / 100 - 0.03;
  slide.addShape("rect", { x: markerX, y: y - 0.06, w: 0.06, h: 0.44, fill: { color: WHITE }, line: { color: NAVY, width: 1.25 } });
}

// A left-accented list item (title + body), used for strengths/opportunities/findings
function addListItem(slide, x, y, w, title, body, dotColor) {
  slide.addShape("ellipse", { x, y: y + 0.06, w: 0.12, h: 0.12, fill: { color: dotColor }, line: { type: "none" } });
  slide.addText(title, { x: x + 0.24, y: y - 0.05, w: w - 0.24, h: 0.42, fontSize: 12, bold: true, color: TEXT_DARK, fontFace: FONT, margin: 0, valign: "top" });
  slide.addText(body, { x: x + 0.24, y: y + 0.4, w: w - 0.24, h: 0.55, fontSize: 10, color: TEXT_GRAY, fontFace: FONT, margin: 0, valign: "top" });
}

function bg(slide, color) {
  slide.background = { color };
}

// ---------- main generator ----------

function generateDeck(data, outPath) {
  const pres = new pptxgen();
  pres.defineLayout({ name: "WIDE", width: PAGE_W, height: PAGE_H });
  pres.layout = "WIDE";

  const { client, assessment, strategy } = data;

  // ---- Slide 1: Cover ----
  {
    const slide = pres.addSlide();
    bg(slide, NAVY);
    slide.addText("WELL-BEING OPPORTUNITY REPORT", { x: MARGIN, y: 1.4, w: 7, h: 0.35, fontSize: 12, color: "9FB3D1", bold: true, fontFace: FONT, charSpacing: 2 });
    slide.addText(client.name, { x: MARGIN, y: 1.8, w: 7.2, h: 1.1, fontSize: 40, bold: true, color: WHITE, fontFace: FONT, margin: 0 });
    slide.addText(client.assessment_name, { x: MARGIN, y: 2.85, w: 7, h: 0.4, fontSize: 18, color: "C9D6E8", fontFace: FONT, margin: 0 });
    slide.addText(client.assessment_date, { x: MARGIN, y: 3.25, w: 7, h: 0.35, fontSize: 12, color: "8FA3C0", fontFace: FONT, margin: 0 });

    // Score card, right side
    const cardX = 9.0, cardY = 1.6, cardW = 3.6, cardH = 3.3;
    slide.addShape("rect", { x: cardX, y: cardY, w: cardW, h: cardH, fill: { color: WHITE }, line: { type: "none" }, shadow: { type: "outer", color: "000000", opacity: 0.25, blur: 12, offset: 3, angle: 90 } });
    slide.addText("Overall Opportunity Index", { x: cardX + 0.3, y: cardY + 0.3, w: cardW - 0.6, h: 0.3, fontSize: 11, color: TEXT_GRAY, fontFace: FONT, bold: true });
    slide.addText(String(assessment.overall_score), { x: cardX + 0.3, y: cardY + 0.65, w: cardW - 1.4, h: 1.0, fontSize: 54, bold: true, color: NAVY, fontFace: FONT, margin: 0 });
    slide.addText("/100", { x: cardX + 1.9, y: cardY + 1.15, w: 1.0, h: 0.4, fontSize: 16, color: TEXT_GRAY, fontFace: FONT, margin: 0 });
    slide.addShape("roundRect", { x: cardX + 0.3, y: cardY + 1.75, w: 1.7, h: 0.4, rectRadius: 0.08, fill: { color: levelColor(assessment.maturity) }, line: { type: "none" } });
    slide.addText(assessment.maturity, { x: cardX + 0.3, y: cardY + 1.75, w: 1.7, h: 0.4, fontSize: 12, bold: true, color: WHITE, fontFace: FONT, align: "center", valign: "middle", margin: 0 });
    addGauge(slide, cardX + 0.3, cardY + 2.4, cardW - 0.6, assessment.overall_score, assessment.bands);

    slide.addText("Powered by Propel", { x: MARGIN, y: PAGE_H - 0.55, w: 4, h: 0.3, fontSize: 9, color: "8FA3C0", fontFace: FONT, italic: true });
  }

  // ---- Slide 2: Opportunity Index Overview (gauge recap + strengths + priority opportunities) ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "Opportunity Index Overview");

    addGauge(slide, MARGIN, 1.15, 4.6, assessment.overall_score, assessment.bands);
    slide.addText(String(assessment.overall_score), { x: MARGIN, y: 1.75, w: 2, h: 0.6, fontSize: 30, bold: true, color: NAVY, fontFace: FONT, margin: 0 });
    slide.addText(`/100  ·  ${assessment.maturity}`, { x: MARGIN + 1.4, y: 1.9, w: 3, h: 0.4, fontSize: 13, color: TEXT_GRAY, fontFace: FONT, margin: 0 });

    // Strengths column
    const colY = 2.9, colW = 3.55;
    slide.addText("STRENGTHS", { x: MARGIN, y: colY, w: colW, h: 0.3, fontSize: 12, bold: true, color: DARKGREEN, fontFace: FONT, charSpacing: 1 });
    let sy = colY + 0.45;
    strategy.strengths.forEach((s) => {
      addListItem(slide, MARGIN, sy, colW, s.title, s.body, GREEN);
      sy += 1.15;
    });

    // Priority opportunities column
    const col2X = MARGIN + colW + 0.5;
    slide.addText("PRIORITY OPPORTUNITIES", { x: col2X, y: colY, w: colW + 1, h: 0.3, fontSize: 12, bold: true, color: "B45C1F", fontFace: FONT, charSpacing: 1 });
    let oy = colY + 0.45;
    strategy.priority_opportunities.forEach((o) => {
      addListItem(slide, col2X, oy, colW + 1, o.title, o.body, ORANGE);
      oy += 1.15;
    });

    addFooter(slide);
  }

  // ---- Slide 3: Strategy Dimensions ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "Strategy Dimensions");
    slide.addText("Scores across the six structural dimensions of the program.", { x: MARGIN, y: 1.0, w: 10, h: 0.3, fontSize: 11, color: TEXT_GRAY, fontFace: FONT, italic: true });

    const cols = 2, rows = 3, gapX = 0.6, gapY = 0.95;
    const colW = (PAGE_W - MARGIN * 2 - gapX) / cols;
    assessment.dimensions.forEach((dim, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = MARGIN + c * (colW + gapX);
      const y = 1.7 + r * gapY;
      addScoreBar(slide, x, y, colW, dim);
    });
    addFooter(slide);
  }

  // ---- Slide 4: Behavioral Readiness ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "Behavioral Readiness");
    slide.addText("Higher scores indicate stronger behavioral support for well-being participation.", { x: MARGIN, y: 1.0, w: 11, h: 0.3, fontSize: 11, color: TEXT_GRAY, fontFace: FONT, italic: true });

    const cols = 2, gapX = 0.6, gapY = 1.6;
    const colW = (PAGE_W - MARGIN * 2 - gapX) / cols;
    assessment.behavioral_drivers.forEach((d, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = MARGIN + c * (colW + gapX);
      const y = 1.7 + r * gapY;
      addScoreBar(slide, x, y, colW, d);
      slide.addText(d.body, { x, y: y + 0.65, w: colW, h: 0.7, fontSize: 10, color: TEXT_GRAY, fontFace: FONT, margin: 0, valign: "top" });
    });
    addFooter(slide);
  }

  // ---- Slide 5: Executive Summary + Current Maturity ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "Executive Summary");
    slide.addText(strategy.executive_summary, { x: MARGIN, y: 1.2, w: PAGE_W - MARGIN * 2, h: 2.6, fontSize: 13, color: TEXT_DARK, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.25 });

    slide.addText("CURRENT MATURITY", { x: MARGIN, y: 4.1, w: 6, h: 0.3, fontSize: 12, bold: true, color: NAVY, fontFace: FONT, charSpacing: 1 });
    slide.addText(strategy.current_maturity, { x: MARGIN, y: 4.5, w: PAGE_W - MARGIN * 2, h: 2.3, fontSize: 12, color: TEXT_GRAY, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.2 });
    addFooter(slide);
  }

  // ---- Slide 6: What Is Holding Impact Back ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "What Is Holding Impact Back");

    let y = 1.35;
    strategy.holding_back.forEach((f) => {
      slide.addShape("ellipse", { x: MARGIN, y: y + 0.06, w: 0.12, h: 0.12, fill: { color: NAVY_LIGHT }, line: { type: "none" } });
      slide.addText(f.title, { x: MARGIN + 0.28, y: y - 0.03, w: PAGE_W - MARGIN * 2 - 0.28, h: 0.26, fontSize: 12, bold: true, color: TEXT_DARK, fontFace: FONT, margin: 0 });
      slide.addText(f.body, { x: MARGIN + 0.28, y: y + 0.24, w: PAGE_W - MARGIN * 2 - 0.28, h: 0.45, fontSize: 10, color: TEXT_GRAY, fontFace: FONT, margin: 0, valign: "top" });
      y += 0.95;
    });
    addFooter(slide);
  }

  // ---- Recommendation slides (one per recommendation, looped from data) ----
  strategy.recommendations.forEach((rec, idx) => {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    slide.addText(`RECOMMENDATION #${idx + 1}`, { x: MARGIN, y: 0.45, w: 5, h: 0.3, fontSize: 11, bold: true, color: ORANGE, fontFace: FONT, charSpacing: 1 });
    slide.addText(rec.title, { x: MARGIN, y: 0.75, w: PAGE_W - MARGIN * 2, h: 0.7, fontSize: 20, bold: true, color: NAVY, fontFace: FONT, margin: 0 });

    const leftX = MARGIN, leftW = 7.1, rightX = 8.1, rightW = PAGE_W - MARGIN - rightX;
    let ly = 1.7;
    const block = (label, text, h) => {
      slide.addText(label, { x: leftX, y: ly, w: leftW, h: 0.22, fontSize: 9, bold: true, color: TEXT_GRAY, fontFace: FONT, charSpacing: 1 });
      slide.addText(text, { x: leftX, y: ly + 0.24, w: leftW, h, fontSize: 11, color: TEXT_DARK, fontFace: FONT, margin: 0, valign: "top" });
      ly += h + 0.42;
    };
    block("WHY THIS MATTERS", rec.why_it_matters, 0.55);
    block("RECOMMENDED ACTION", rec.recommended_action, 0.55);
    block("SUGGESTED FIRST STEP", rec.suggested_first_step, 0.55);
    block("EXPECTED STRATEGIC IMPACT", rec.expected_impact, 0.55);

    // right rail: sidebar card
    slide.addShape("rect", { x: rightX, y: 1.7, w: rightW, h: 5.0, fill: { color: CARD_BG }, line: { type: "none" } });
    slide.addText("IMPLEMENTATION ORDER", { x: rightX + 0.25, y: 1.95, w: rightW - 0.5, h: 0.22, fontSize: 9, bold: true, color: TEXT_GRAY, fontFace: FONT, charSpacing: 1 });
    slide.addText(rec.implementation_order, { x: rightX + 0.25, y: 2.2, w: rightW - 0.5, h: 0.9, fontSize: 10, color: TEXT_DARK, fontFace: FONT, margin: 0, valign: "top" });
    slide.addText("INTEGRATED STRATEGY GUIDANCE", { x: rightX + 0.25, y: 3.25, w: rightW - 0.5, h: 0.22, fontSize: 9, bold: true, color: TEXT_GRAY, fontFace: FONT, charSpacing: 1 });
    slide.addText(rec.guidance, { x: rightX + 0.25, y: 3.5, w: rightW - 0.5, h: 1.5, fontSize: 10, color: TEXT_DARK, fontFace: FONT, margin: 0, valign: "top" });
    slide.addText("RELATED ASSESSMENT FINDINGS", { x: rightX + 0.25, y: 5.1, w: rightW - 0.5, h: 0.22, fontSize: 9, bold: true, color: TEXT_GRAY, fontFace: FONT, charSpacing: 1 });
    slide.addText(rec.related_findings, { x: rightX + 0.25, y: 5.35, w: rightW - 0.5, h: 1.25, fontSize: 9.5, italic: true, color: TEXT_GRAY, fontFace: FONT, margin: 0, valign: "top" });

    addFooter(slide);
  });

  // ---- Implementation Sequence slide ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "Recommended Implementation Sequence");

    const phases = [strategy.implementation_sequence.now, strategy.implementation_sequence.next, strategy.implementation_sequence.later];
    const gap = 0.4;
    const cardW = (PAGE_W - MARGIN * 2 - gap * 2) / 3;
    const colors = [ORANGE, GREEN, NAVY_LIGHT];
    phases.forEach((p, i) => {
      const x = MARGIN + i * (cardW + gap);
      slide.addShape("rect", { x, y: 1.3, w: cardW, h: 3.3, fill: { color: CARD_BG }, line: { type: "none" } });
      slide.addShape("ellipse", { x: x + 0.25, y: 1.55, w: 0.4, h: 0.4, fill: { color: colors[i] }, line: { type: "none" } });
      slide.addText(String(i + 1), { x: x + 0.25, y: 1.55, w: 0.4, h: 0.4, fontSize: 14, bold: true, color: WHITE, fontFace: FONT, align: "center", valign: "middle", margin: 0 });
      slide.addText(p.title, { x: x + 0.25, y: 2.1, w: cardW - 0.5, h: 0.55, fontSize: 13, bold: true, color: NAVY, fontFace: FONT, margin: 0, valign: "top" });
      slide.addText(p.body, { x: x + 0.25, y: 2.7, w: cardW - 0.5, h: 1.7, fontSize: 11, color: TEXT_DARK, fontFace: FONT, margin: 0, valign: "top" });
    });

    if (strategy.discussion_questions && strategy.discussion_questions.length) {
      slide.addText("DISCUSSION QUESTIONS", { x: MARGIN, y: 4.9, w: 6, h: 0.3, fontSize: 11, bold: true, color: TEXT_GRAY, fontFace: FONT, charSpacing: 1 });
      const qText = strategy.discussion_questions.map((q, i) => ({ text: q, options: { bullet: true, breakLine: i < strategy.discussion_questions.length - 1, color: TEXT_DARK, fontSize: 11 } }));
      slide.addText(qText, { x: MARGIN, y: 5.25, w: PAGE_W - MARGIN * 2, h: 1.6, fontFace: FONT, valign: "top", paraSpaceAfter: 6 });
    }
    addFooter(slide);
  }

  // ---- Closing ----
  {
    const slide = pres.addSlide();
    bg(slide, NAVY);
    slide.addText("Thank you", { x: MARGIN, y: 2.8, w: 8, h: 0.9, fontSize: 34, bold: true, color: WHITE, fontFace: FONT, margin: 0 });
    slide.addText(`${client.name}  ·  ${client.assessment_name}`, { x: MARGIN, y: 3.6, w: 9, h: 0.4, fontSize: 14, color: "C9D6E8", fontFace: FONT, margin: 0 });
    slide.addText("Powered by Propel", { x: MARGIN, y: PAGE_H - 0.55, w: 4, h: 0.3, fontSize: 9, color: "8FA3C0", fontFace: FONT, italic: true });
  }

  return pres.writeFile({ fileName: outPath });
}

module.exports = { generateDeck };

// CLI usage: node generate_deck.js data.json output.pptx
if (require.main === module) {
  const fs = require("fs");
  const dataPath = process.argv[2] || "data.json";
  const outPath = process.argv[3] || "output.pptx";
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  generateDeck(data, outPath).then(() => console.log("Wrote", outPath));
}
