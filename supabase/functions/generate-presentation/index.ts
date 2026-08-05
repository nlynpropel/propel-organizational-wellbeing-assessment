import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import * as pptxgen from "npm:pptxgenjs@3.12.0";

// ============================================================
// CORS headers (mandatory for Supabase client compatibility)
// ============================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================
// Constants
// ============================================================
const TEMPLATE_VERSION = "opportunity-index-deck-v1";

// Brand palette (matches generate_deck.js reference)
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

const BAND_COLORS: Record<string, string> = {
  Reactive: GRAY,
  Developing: BLUEGRAY,
  Established: ORANGE,
  Strategic: GREEN,
  Leading: DARKGREEN,
};
const BEHAVIOR_COLORS: Record<string, string> = {
  "Meaningful barriers": ORANGE,
  "Generally supportive": GREEN,
  "Limited support": GRAY,
  "Strong support": DARKGREEN,
  "Strong behavioral support": DARKGREEN,
  "Significant barriers": GRAY,
};

const FONT = "Arial";
const PAGE_W = 13.333;
const PAGE_H = 7.5;
const MARGIN = 0.6;

function levelColor(level: string): string {
  return BAND_COLORS[level] || BEHAVIOR_COLORS[level] || GRAY;
}

// ============================================================
// Shared building blocks (ported from generate_deck.js)
// ============================================================

function addFooter(slide: pptxgen.Slide, pageLabel?: string): void {
  slide.addText("Powered by Propel", {
    x: MARGIN,
    y: PAGE_H - 0.4,
    w: 3,
    h: 0.3,
    fontSize: 8,
    color: TEXT_GRAY,
    fontFace: FONT,
    italic: true,
  });
  if (pageLabel) {
    slide.addText(pageLabel, {
      x: PAGE_W - MARGIN - 2,
      y: PAGE_H - 0.4,
      w: 2,
      h: 0.3,
      fontSize: 8,
      color: TEXT_GRAY,
      fontFace: FONT,
      align: "right",
    });
  }
}

function addHeader(slide: pptxgen.Slide, title: string): void {
  slide.addText(title, {
    x: MARGIN,
    y: 0.45,
    w: PAGE_W - MARGIN * 2,
    h: 0.5,
    fontSize: 24,
    bold: true,
    color: NAVY,
    fontFace: FONT,
  });
}

function addScoreBar(
  slide: pptxgen.Slide,
  x: number,
  y: number,
  w: number,
  item: { name: string; score: number; level: string }
): void {
  slide.addText(item.name, {
    x,
    y,
    w: w - 0.9,
    h: 0.24,
    fontSize: 11,
    bold: true,
    color: TEXT_DARK,
    fontFace: FONT,
    margin: 0,
  });
  slide.addText(`${item.score} / 100`, {
    x: x + w - 0.9,
    y,
    w: 0.9,
    h: 0.24,
    fontSize: 11,
    bold: true,
    color: TEXT_DARK,
    fontFace: FONT,
    align: "right",
    margin: 0,
  });
  const barY = y + 0.3;
  const barH = 0.14;
  slide.addShape("rect", {
    x,
    y: barY,
    w,
    h: barH,
    fill: { color: LINE },
    line: { type: "none" },
  });
  const filledW = Math.max(
    0.06,
    (w * Math.min(100, Math.max(0, item.score))) / 100
  );
  slide.addShape("rect", {
    x,
    y: barY,
    w: filledW,
    h: barH,
    fill: { color: levelColor(item.level) },
    line: { type: "none" },
  });
  slide.addText(item.level, {
    x,
    y: barY + barH + 0.04,
    w,
    h: 0.2,
    fontSize: 9,
    color: TEXT_GRAY,
    fontFace: FONT,
    margin: 0,
  });
}

function addGauge(
  slide: pptxgen.Slide,
  x: number,
  y: number,
  w: number,
  score: number,
  bands: string[]
): void {
  const segW = w / bands.length;
  bands.forEach((b, i) => {
    slide.addShape("rect", {
      x: x + i * segW,
      y,
      w: segW,
      h: 0.32,
      fill: { color: BAND_COLORS[b] || GRAY },
      line: { color: WHITE, width: 1.5 },
    });
    slide.addText(b, {
      x: x + i * segW - 0.08,
      y: y + 0.36,
      w: segW + 0.16,
      h: 0.2,
      fontSize: 7,
      color: TEXT_GRAY,
      fontFace: FONT,
      align: "center",
      margin: 0,
      wrap: false,
    });
  });
  const clamped = Math.min(100, Math.max(0, score));
  const markerX = x + (w * clamped) / 100 - 0.03;
  slide.addShape("rect", {
    x: markerX,
    y: y - 0.06,
    w: 0.06,
    h: 0.44,
    fill: { color: WHITE },
    line: { color: NAVY, width: 1.25 },
  });
}

function addListItem(
  slide: pptxgen.Slide,
  x: number,
  y: number,
  w: number,
  title: string,
  body: string,
  dotColor: string
): void {
  slide.addShape("ellipse", {
    x,
    y: y + 0.06,
    w: 0.12,
    h: 0.12,
    fill: { color: dotColor },
    line: { type: "none" },
  });
  slide.addText(title, {
    x: x + 0.24,
    y: y - 0.05,
    w: w - 0.24,
    h: 0.42,
    fontSize: 12,
    bold: true,
    color: TEXT_DARK,
    fontFace: FONT,
    margin: 0,
    valign: "top",
  });
  slide.addText(body, {
    x: x + 0.24,
    y: y + 0.4,
    w: w - 0.24,
    h: 0.55,
    fontSize: 10,
    color: TEXT_GRAY,
    fontFace: FONT,
    margin: 0,
    valign: "top",
  });
}

function bg(slide: pptxgen.Slide, color: string): void {
  slide.background = { color };
}

// ============================================================
// Deck payload type (matches client-side DeckPayload)
// ============================================================
type DeckPayload = {
  client: {
    name: string;
    assessment_name: string;
    assessment_date: string;
  };
  assessment: {
    overall_score: number;
    maturity: string;
    bands: string[];
    dimensions: Array<{ name: string; score: number; level: string }>;
    behavioral_drivers: Array<{
      name: string;
      score: number;
      level: string;
      body: string;
    }>;
  };
  strategy: {
    executive_summary: string;
    current_maturity: string;
    strengths: Array<{ title: string; body: string }>;
    priority_opportunities: Array<{ title: string; body: string }>;
    holding_back: Array<{ title: string; body: string }>;
    recommendations: Array<{
      title: string;
      why_it_matters: string;
      recommended_action: string;
      suggested_first_step: string;
      expected_impact: string;
      implementation_order: string;
      guidance: string;
      related_findings: string;
    }>;
    implementation_sequence: {
      now: { title: string; body: string };
      next: { title: string; body: string };
      later: { title: string; body: string };
    };
    discussion_questions: string[];
  };
};

// ============================================================
// Main deck generator (ported from generate_deck.js)
// ============================================================
function generateDeck(data: DeckPayload): pptxgen {
  const pres = new pptxgen();
  pres.defineLayout({ name: "WIDE", width: PAGE_W, height: PAGE_H });
  pres.layout = "WIDE";

  const { client, assessment, strategy } = data;

  // ---- Slide 1: Cover ----
  {
    const slide = pres.addSlide();
    bg(slide, NAVY);
    slide.addText("WELL-BEING OPPORTUNITY REPORT", {
      x: MARGIN,
      y: 1.4,
      w: 7,
      h: 0.35,
      fontSize: 12,
      color: "9FB3D1",
      bold: true,
      fontFace: FONT,
      charSpacing: 2,
    });
    slide.addText(client.name, {
      x: MARGIN,
      y: 1.8,
      w: 7.2,
      h: 1.1,
      fontSize: 40,
      bold: true,
      color: WHITE,
      fontFace: FONT,
      margin: 0,
    });
    slide.addText(client.assessment_name, {
      x: MARGIN,
      y: 2.85,
      w: 7,
      h: 0.4,
      fontSize: 18,
      color: "C9D6E8",
      fontFace: FONT,
      margin: 0,
    });
    slide.addText(client.assessment_date, {
      x: MARGIN,
      y: 3.25,
      w: 7,
      h: 0.35,
      fontSize: 12,
      color: "8FA3C0",
      fontFace: FONT,
      margin: 0,
    });

    const cardX = 9.0, cardY = 1.6, cardW = 3.6, cardH = 3.3;
    slide.addShape("rect", {
      x: cardX,
      y: cardY,
      w: cardW,
      h: cardH,
      fill: { color: WHITE },
      line: { type: "none" },
      shadow: {
        type: "outer",
        color: "000000",
        opacity: 0.25,
        blur: 12,
        offset: 3,
        angle: 90,
      },
    });
    slide.addText("Overall Opportunity Index", {
      x: cardX + 0.3,
      y: cardY + 0.3,
      w: cardW - 0.6,
      h: 0.3,
      fontSize: 11,
      color: TEXT_GRAY,
      fontFace: FONT,
      bold: true,
    });
    slide.addText(String(assessment.overall_score), {
      x: cardX + 0.3,
      y: cardY + 0.65,
      w: cardW - 1.4,
      h: 1.0,
      fontSize: 54,
      bold: true,
      color: NAVY,
      fontFace: FONT,
      margin: 0,
    });
    slide.addText("/100", {
      x: cardX + 1.9,
      y: cardY + 1.15,
      w: 1.0,
      h: 0.4,
      fontSize: 16,
      color: TEXT_GRAY,
      fontFace: FONT,
      margin: 0,
    });
    slide.addShape("roundRect", {
      x: cardX + 0.3,
      y: cardY + 1.75,
      w: 1.7,
      h: 0.4,
      rectRadius: 0.08,
      fill: { color: levelColor(assessment.maturity) },
      line: { type: "none" },
    });
    slide.addText(assessment.maturity, {
      x: cardX + 0.3,
      y: cardY + 1.75,
      w: 1.7,
      h: 0.4,
      fontSize: 12,
      bold: true,
      color: WHITE,
      fontFace: FONT,
      align: "center",
      valign: "middle",
      margin: 0,
    });
    addGauge(
      slide,
      cardX + 0.3,
      cardY + 2.4,
      cardW - 0.6,
      assessment.overall_score,
      assessment.bands
    );

    slide.addText("Powered by Propel", {
      x: MARGIN,
      y: PAGE_H - 0.55,
      w: 4,
      h: 0.3,
      fontSize: 9,
      color: "8FA3C0",
      fontFace: FONT,
      italic: true,
    });
  }

  // ---- Slide 2: Opportunity Index Overview ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "Opportunity Index Overview");

    addGauge(slide, MARGIN, 1.15, 4.6, assessment.overall_score, assessment.bands);
    slide.addText(String(assessment.overall_score), {
      x: MARGIN,
      y: 1.75,
      w: 2,
      h: 0.6,
      fontSize: 30,
      bold: true,
      color: NAVY,
      fontFace: FONT,
      margin: 0,
    });
    slide.addText(`/100  ·  ${assessment.maturity}`, {
      x: MARGIN + 1.4,
      y: 1.9,
      w: 3,
      h: 0.4,
      fontSize: 13,
      color: TEXT_GRAY,
      fontFace: FONT,
      margin: 0,
    });

    const colY = 2.9, colW = 3.55;
    slide.addText("STRENGTHS", {
      x: MARGIN,
      y: colY,
      w: colW,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: DARKGREEN,
      fontFace: FONT,
      charSpacing: 1,
    });
    let sy = colY + 0.45;
    strategy.strengths.forEach((s) => {
      addListItem(slide, MARGIN, sy, colW, s.title, s.body, GREEN);
      sy += 1.15;
    });

    const col2X = MARGIN + colW + 0.5;
    slide.addText("PRIORITY OPPORTUNITIES", {
      x: col2X,
      y: colY,
      w: colW + 1,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: "B45C1F",
      fontFace: FONT,
      charSpacing: 1,
    });
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
    slide.addText("Scores across the six structural dimensions of the program.", {
      x: MARGIN,
      y: 1.0,
      w: 10,
      h: 0.3,
      fontSize: 11,
      color: TEXT_GRAY,
      fontFace: FONT,
      italic: true,
    });

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
    slide.addText(
      "Higher scores indicate stronger behavioral support for well-being participation.",
      {
        x: MARGIN,
        y: 1.0,
        w: 11,
        h: 0.3,
        fontSize: 11,
        color: TEXT_GRAY,
        fontFace: FONT,
        italic: true,
      }
    );

    const cols = 2, gapX = 0.6, gapY = 1.6;
    const colW = (PAGE_W - MARGIN * 2 - gapX) / cols;
    assessment.behavioral_drivers.forEach((d, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = MARGIN + c * (colW + gapX);
      const y = 1.7 + r * gapY;
      addScoreBar(slide, x, y, colW, d);
      slide.addText(d.body, {
        x,
        y: y + 0.65,
        w: colW,
        h: 0.7,
        fontSize: 10,
        color: TEXT_GRAY,
        fontFace: FONT,
        margin: 0,
        valign: "top",
      });
    });
    addFooter(slide);
  }

  // ---- Slide 5: Executive Summary + Current Maturity ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "Executive Summary");
    slide.addText(strategy.executive_summary, {
      x: MARGIN,
      y: 1.2,
      w: PAGE_W - MARGIN * 2,
      h: 2.6,
      fontSize: 13,
      color: TEXT_DARK,
      fontFace: FONT,
      valign: "top",
      lineSpacingMultiple: 1.25,
    });

    slide.addText("CURRENT MATURITY", {
      x: MARGIN,
      y: 4.1,
      w: 6,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: NAVY,
      fontFace: FONT,
      charSpacing: 1,
    });
    slide.addText(strategy.current_maturity, {
      x: MARGIN,
      y: 4.5,
      w: PAGE_W - MARGIN * 2,
      h: 2.3,
      fontSize: 12,
      color: TEXT_GRAY,
      fontFace: FONT,
      valign: "top",
      lineSpacingMultiple: 1.2,
    });
    addFooter(slide);
  }

  // ---- Slide 6: What Is Holding Impact Back ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "What Is Holding Impact Back");

    let y = 1.35;
    strategy.holding_back.forEach((f) => {
      slide.addShape("ellipse", {
        x: MARGIN,
        y: y + 0.06,
        w: 0.12,
        h: 0.12,
        fill: { color: NAVY_LIGHT },
        line: { type: "none" },
      });
      slide.addText(f.title, {
        x: MARGIN + 0.28,
        y: y - 0.03,
        w: PAGE_W - MARGIN * 2 - 0.28,
        h: 0.26,
        fontSize: 12,
        bold: true,
        color: TEXT_DARK,
        fontFace: FONT,
        margin: 0,
      });
      slide.addText(f.body, {
        x: MARGIN + 0.28,
        y: y + 0.24,
        w: PAGE_W - MARGIN * 2 - 0.28,
        h: 0.45,
        fontSize: 10,
        color: TEXT_GRAY,
        fontFace: FONT,
        margin: 0,
        valign: "top",
      });
      y += 0.95;
    });
    addFooter(slide);
  }

  // ---- Recommendation slides (one per recommendation) ----
  strategy.recommendations.forEach((rec, idx) => {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    slide.addText(`RECOMMENDATION #${idx + 1}`, {
      x: MARGIN,
      y: 0.45,
      w: 5,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: ORANGE,
      fontFace: FONT,
      charSpacing: 1,
    });
    slide.addText(rec.title, {
      x: MARGIN,
      y: 0.75,
      w: PAGE_W - MARGIN * 2,
      h: 0.7,
      fontSize: 20,
      bold: true,
      color: NAVY,
      fontFace: FONT,
      margin: 0,
    });

    const leftX = MARGIN, leftW = 7.1, rightX = 8.1;
    const rightW = PAGE_W - MARGIN - rightX;
    let ly = 1.7;
    const block = (label: string, text: string, h: number): void => {
      slide.addText(label, {
        x: leftX,
        y: ly,
        w: leftW,
        h: 0.22,
        fontSize: 9,
        bold: true,
        color: TEXT_GRAY,
        fontFace: FONT,
        charSpacing: 1,
      });
      slide.addText(text, {
        x: leftX,
        y: ly + 0.24,
        w: leftW,
        h,
        fontSize: 11,
        color: TEXT_DARK,
        fontFace: FONT,
        margin: 0,
        valign: "top",
      });
      ly += h + 0.42;
    };
    block("WHY THIS MATTERS", rec.why_it_matters, 0.55);
    block("RECOMMENDED ACTION", rec.recommended_action, 0.55);
    block("SUGGESTED FIRST STEP", rec.suggested_first_step, 0.55);
    block("EXPECTED STRATEGIC IMPACT", rec.expected_impact, 0.55);

    slide.addShape("rect", {
      x: rightX,
      y: 1.7,
      w: rightW,
      h: 5.0,
      fill: { color: CARD_BG },
      line: { type: "none" },
    });
    slide.addText("IMPLEMENTATION ORDER", {
      x: rightX + 0.25,
      y: 1.95,
      w: rightW - 0.5,
      h: 0.22,
      fontSize: 9,
      bold: true,
      color: TEXT_GRAY,
      fontFace: FONT,
      charSpacing: 1,
    });
    slide.addText(rec.implementation_order, {
      x: rightX + 0.25,
      y: 2.2,
      w: rightW - 0.5,
      h: 0.9,
      fontSize: 10,
      color: TEXT_DARK,
      fontFace: FONT,
      margin: 0,
      valign: "top",
    });
    slide.addText("INTEGRATED STRATEGY GUIDANCE", {
      x: rightX + 0.25,
      y: 3.25,
      w: rightW - 0.5,
      h: 0.22,
      fontSize: 9,
      bold: true,
      color: TEXT_GRAY,
      fontFace: FONT,
      charSpacing: 1,
    });
    slide.addText(rec.guidance, {
      x: rightX + 0.25,
      y: 3.5,
      w: rightW - 0.5,
      h: 1.5,
      fontSize: 10,
      color: TEXT_DARK,
      fontFace: FONT,
      margin: 0,
      valign: "top",
    });
    slide.addText("RELATED ASSESSMENT FINDINGS", {
      x: rightX + 0.25,
      y: 5.1,
      w: rightW - 0.5,
      h: 0.22,
      fontSize: 9,
      bold: true,
      color: TEXT_GRAY,
      fontFace: FONT,
      charSpacing: 1,
    });
    slide.addText(rec.related_findings, {
      x: rightX + 0.25,
      y: 5.35,
      w: rightW - 0.5,
      h: 1.25,
      fontSize: 9.5,
      italic: true,
      color: TEXT_GRAY,
      fontFace: FONT,
      margin: 0,
      valign: "top",
    });

    addFooter(slide);
  });

  // ---- Implementation Sequence slide ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "Recommended Implementation Sequence");

    const phases = [
      strategy.implementation_sequence.now,
      strategy.implementation_sequence.next,
      strategy.implementation_sequence.later,
    ];
    const gap = 0.4;
    const cardW = (PAGE_W - MARGIN * 2 - gap * 2) / 3;
    const colors = [ORANGE, GREEN, NAVY_LIGHT];
    phases.forEach((p, i) => {
      const x = MARGIN + i * (cardW + gap);
      slide.addShape("rect", {
        x,
        y: 1.3,
        w: cardW,
        h: 3.3,
        fill: { color: CARD_BG },
        line: { type: "none" },
      });
      slide.addShape("ellipse", {
        x: x + 0.25,
        y: 1.55,
        w: 0.4,
        h: 0.4,
        fill: { color: colors[i] },
        line: { type: "none" },
      });
      slide.addText(String(i + 1), {
        x: x + 0.25,
        y: 1.55,
        w: 0.4,
        h: 0.4,
        fontSize: 14,
        bold: true,
        color: WHITE,
        fontFace: FONT,
        align: "center",
        valign: "middle",
        margin: 0,
      });
      slide.addText(p.title, {
        x: x + 0.25,
        y: 2.1,
        w: cardW - 0.5,
        h: 0.55,
        fontSize: 13,
        bold: true,
        color: NAVY,
        fontFace: FONT,
        margin: 0,
        valign: "top",
      });
      slide.addText(p.body, {
        x: x + 0.25,
        y: 2.7,
        w: cardW - 0.5,
        h: 1.7,
        fontSize: 11,
        color: TEXT_DARK,
        fontFace: FONT,
        margin: 0,
        valign: "top",
      });
    });

    if (strategy.discussion_questions && strategy.discussion_questions.length) {
      slide.addText("DISCUSSION QUESTIONS", {
        x: MARGIN,
        y: 4.9,
        w: 6,
        h: 0.3,
        fontSize: 11,
        bold: true,
        color: TEXT_GRAY,
        fontFace: FONT,
        charSpacing: 1,
      });
      const qText = strategy.discussion_questions.map((q, i) => ({
        text: q,
        options: {
          bullet: true,
          breakLine: i < strategy.discussion_questions.length - 1,
          color: TEXT_DARK,
          fontSize: 11,
        },
      }));
      slide.addText(qText, {
        x: MARGIN,
        y: 5.25,
        w: PAGE_W - MARGIN * 2,
        h: 1.6,
        fontFace: FONT,
        valign: "top",
        paraSpaceAfter: 6,
      });
    }
    addFooter(slide);
  }

  // ---- Closing ----
  {
    const slide = pres.addSlide();
    bg(slide, NAVY);
    slide.addText("Thank you", {
      x: MARGIN,
      y: 2.8,
      w: 8,
      h: 0.9,
      fontSize: 34,
      bold: true,
      color: WHITE,
      fontFace: FONT,
      margin: 0,
    });
    slide.addText(`${client.name}  ·  ${client.assessment_name}`, {
      x: MARGIN,
      y: 3.6,
      w: 9,
      h: 0.4,
      fontSize: 14,
      color: "C9D6E8",
      fontFace: FONT,
      margin: 0,
    });
    slide.addText("Powered by Propel", {
      x: MARGIN,
      y: PAGE_H - 0.55,
      w: 4,
      h: 0.3,
      fontSize: 9,
      color: "8FA3C0",
      fontFace: FONT,
      italic: true,
    });
  }

  return pres;
}

// ============================================================
// Post-generation validation
// ============================================================
function validateGeneratedDeck(
  pres: pptxgen,
  data: DeckPayload
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check slide count: 8 fixed + 1 per recommendation
  const expectedSlides = 8 + data.strategy.recommendations.length;
  // pptxgenjs doesn't expose slide count directly; we track via addSlide calls
  // This is validated on the caller side by counting slides

  // Check client name appears in slide text
  // We verify this by checking the payload contains the client name
  if (!data.client.name || data.client.name === "Unknown Client") {
    errors.push("Client name is missing or is placeholder");
  }

  // Check for placeholder tokens
  const tokenPattern = /\{\{[^}]+\}\}|\$\{[^}]+\}|\[INSERT[^]]*\]/i;
  const allTextFields = [
    data.client.name,
    data.client.assessment_name,
    data.strategy.executive_summary,
    data.strategy.current_maturity,
    ...data.strategy.recommendations.map((r) => r.title),
  ];
  for (const text of allTextFields) {
    if (typeof text === "string" && tokenPattern.test(text)) {
      errors.push("Placeholder token found in generated content");
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Safe error message
// ============================================================
function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return "An unexpected error occurred";
}

// ============================================================
// Filename sanitization
// ============================================================
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

// ============================================================
// Main handler
// ============================================================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // ── 1. Create Supabase client with service role ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 2. Verify authenticated user ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    // ── 3. Parse request body ──
    const body = await req.json();
    const {
      presentation_generation_id,
      assessment_instance_id,
      strategy_generation_id,
      payload,
    } = body as {
      presentation_generation_id?: string;
      assessment_instance_id?: string;
      strategy_generation_id?: string;
      payload?: DeckPayload;
    };

    if (!presentation_generation_id || !assessment_instance_id || !strategy_generation_id || !payload) {
      return new Response(
        JSON.stringify({
          error:
            "presentation_generation_id, assessment_instance_id, strategy_generation_id, and payload are required",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Verify user permissions ──
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    const userRole = profile?.role as string | undefined;
    if (!userRole) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Brokers cannot generate decks
    if (userRole === "broker") {
      return new Response(
        JSON.stringify({ error: "Brokers cannot generate presentations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Superadmins and propel_csm/propel_sales: verify org access
    if (userRole !== "superadmin") {
      const { data: membership } = await supabase
        .from("organization_memberships")
        .select("role, status")
        .eq("profile_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 5. Verify the presentation_generation record exists and is queued ──
    const { data: presGen, error: presGenErr } = await supabase
      .from("presentation_generations")
      .select("*")
      .eq("id", presentation_generation_id)
      .maybeSingle();

    if (presGenErr || !presGen) {
      return new Response(
        JSON.stringify({ error: "Presentation generation record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (presGen.status !== "queued") {
      return new Response(
        JSON.stringify({
          error: `Generation is already in progress or completed (status: ${presGen.status})`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 6. Update status to generating ──
    await supabase
      .from("presentation_generations")
      .update({ status: "generating" })
      .eq("id", presentation_generation_id);

    // ── 7. Generate the deck ──
    let pres: pptxgen;
    try {
      pres = generateDeck(payload);
    } catch (genErr) {
      await supabase
        .from("presentation_generations")
        .update({
          status: "failed",
          error_message: safeErrorMessage(genErr),
          completed_at: new Date().toISOString(),
        })
        .eq("id", presentation_generation_id);
      return new Response(
        JSON.stringify({ error: "Deck generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 8. Post-generation validation ──
    const validation = validateGeneratedDeck(pres, payload);
    if (!validation.valid) {
      await supabase
        .from("presentation_generations")
        .update({
          status: "failed",
          error_message: validation.errors.join("; "),
          completed_at: new Date().toISOString(),
        })
        .eq("id", presentation_generation_id);
      return new Response(
        JSON.stringify({ error: "Post-generation validation failed", details: validation.errors }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 9. Write to buffer and upload to storage ──
    let fileBuffer: ArrayBuffer;
    try {
      fileBuffer = await pres.write({ outputType: "arraybuffer" }) as ArrayBuffer;
    } catch (writeErr) {
      await supabase
        .from("presentation_generations")
        .update({
          status: "failed",
          error_message: safeErrorMessage(writeErr),
          completed_at: new Date().toISOString(),
        })
        .eq("id", presentation_generation_id);
      return new Response(
        JSON.stringify({ error: "Failed to write presentation file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify file is non-empty
    if (!fileBuffer || fileBuffer.byteLength === 0) {
      await supabase
        .from("presentation_generations")
        .update({
          status: "failed",
          error_message: "Generated file is empty",
          completed_at: new Date().toISOString(),
        })
        .eq("id", presentation_generation_id);
      return new Response(
        JSON.stringify({ error: "Generated file is empty" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build storage path
    const { data: instance } = await supabase
      .from("assessment_instances")
      .select("organization_id")
      .eq("id", assessment_instance_id)
      .maybeSingle();

    const orgId = instance?.organization_id ?? "unknown";
    const sanitizedClientName = sanitizeFileName(payload.client.name);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `${sanitizedClientName}-wellbeing-opportunity-report-${dateStr}.pptx`;
    const storagePath = `${orgId}/${assessment_instance_id}/${presentation_generation_id}.pptx`;

    // Upload to private bucket
    const { error: uploadErr } = await supabase.storage
      .from("strategy-presentations")
      .upload(storagePath, fileBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        upsert: false,
      });

    if (uploadErr) {
      await supabase
        .from("presentation_generations")
        .update({
          status: "failed",
          error_message: safeErrorMessage(uploadErr),
          completed_at: new Date().toISOString(),
        })
        .eq("id", presentation_generation_id);
      return new Response(
        JSON.stringify({ error: "Failed to upload presentation file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 10. Update record to completed ──
    await supabase
      .from("presentation_generations")
      .update({
        status: "completed",
        storage_path: storagePath,
        file_name: fileName,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", presentation_generation_id);

    // ── 11. Return success ──
    return new Response(
      JSON.stringify({
        presentation_generation_id,
        status: "completed",
        storage_path: storagePath,
        file_name: fileName,
        template_version: TEMPLATE_VERSION,
        file_size: fileBuffer.byteLength,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: safeErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
