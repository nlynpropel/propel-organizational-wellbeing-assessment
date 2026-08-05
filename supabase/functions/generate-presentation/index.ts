import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import pptxgen from "npm:pptxgenjs@3.12.0";

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

// Brand palette (matches generate_deck.js reference exactly)
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

type PptxSlide = ReturnType<pptxgen["addSlide"]>;
type PptxPres = InstanceType<typeof pptxgen>;

function levelColor(level: string): string {
  return BAND_COLORS[level] || BEHAVIOR_COLORS[level] || GRAY;
}

// ============================================================
// Deck payload type (server-authoritative)
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
// Shared building blocks (ported exactly from generate_deck.js)
// ============================================================

function addFooter(slide: PptxSlide, pageLabel?: string): void {
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

function addHeader(slide: PptxSlide, title: string): void {
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
  slide: PptxSlide,
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
  slide: PptxSlide,
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
  slide: PptxSlide,
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

function bg(slide: PptxSlide, color: string): void {
  slide.background = { color };
}

// ============================================================
// Deck generator (ported exactly from generate_deck.js)
// ============================================================
function generateDeck(data: DeckPayload): PptxPres {
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
// Server-side payload builder
// Loads all data from the database — never trusts client input
// ============================================================

const MATURITY_BANDS = ["Reactive", "Developing", "Established", "Strategic", "Leading"];

const DRIVER_LABELS: Record<string, string> = {
  clarity_of_value: "Clarity of Value",
  motivation_overcoming_inertia: "Motivation and Overcoming Inertia",
  trust_social_proof: "Trust and Social Proof",
  structural_environmental_friction: "Structural and Environmental Friction",
};

const DRIVER_DESCRIPTIONS: Record<string, string> = {
  clarity_of_value: "The well-being program\u2019s value and next actions are presented clearly to employees.",
  motivation_overcoming_inertia: "The program makes healthy action feel achievable, timely, and worth continuing.",
  trust_social_proof: "Employees see credible support, relatable participation, and clear privacy protections.",
  structural_environmental_friction: "The program removes access, technology, workplace, and administrative barriers to participation.",
};

function getMaturityLevel(score: number): string {
  if (score >= 85) return "Leading";
  if (score >= 70) return "Strategic";
  if (score >= 55) return "Established";
  if (score >= 35) return "Developing";
  return "Reactive";
}

function getDimensionLevel(score: number): string {
  if (score >= 85) return "Leading";
  if (score >= 70) return "Strategic";
  if (score >= 55) return "Established";
  if (score >= 35) return "Developing";
  return "Reactive";
}

function getBehavioralInterpretation(score: number): string {
  if (score >= 80) return "Strong behavioral support";
  if (score >= 65) return "Generally supportive";
  if (score >= 50) return "Meaningful barriers";
  return "Significant barriers";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function parsePhase(text: string): { title: string; body: string } {
  const colonIdx = text.indexOf(":");
  const dashIdx = text.indexOf(" - ");
  let splitIdx = -1;
  if (colonIdx > 0 && (dashIdx < 0 || colonIdx < dashIdx)) {
    splitIdx = colonIdx;
  } else if (dashIdx > 0) {
    splitIdx = dashIdx;
  }
  if (splitIdx > 0) {
    return {
      title: text.slice(0, splitIdx).trim(),
      body: text.slice(splitIdx + (text[splitIdx] === ":" ? 1 : 3)).trim(),
    };
  }
  return { title: text.trim(), body: "" };
}

// ============================================================
// Sanitize text for slides — strips internal evidence references
// without changing the approved strategy content in the database
// ============================================================

function sanitizeForSlides(text: string): string {
  if (!text || typeof text !== "string") return text;
  let cleaned = text;

  // Strip entire "see ... ;" clauses that contain file references
  cleaned = cleaned.replace(/;\s*see\s+[^;]*\.docx[^;]*/gi, "");
  cleaned = cleaned.replace(/;\s*see\s+[^;]*\.txt[^;]*/gi, "");
  cleaned = cleaned.replace(/;\s*see\s+[^;]*\.pdf[^;]*/gi, "");

  // Strip "see X.docx ..." patterns at end of text
  cleaned = cleaned.replace(/see\s+[^\s]*\.docx[^\n]*$/gi, "");
  cleaned = cleaned.replace(/see\s+[^\s]*\.txt[^\n]*$/gi, "");
  cleaned = cleaned.replace(/see\s+[^\s]*\.pdf[^\n]*$/gi, "");

  // Strip remaining file references
  cleaned = cleaned.replace(/[\w_\-]+\.docx/gi, "");
  cleaned = cleaned.replace(/[\w_\-]+\.txt/gi, "");
  cleaned = cleaned.replace(/[\w_\-]+\.pdf/gi, "");

  // Strip internal reference names
  cleaned = cleaned.replace(/propel_recommendation_bank/gi, "");
  cleaned = cleaned.replace(/Propel_Wellbeing_Strategy_Knowledge_Master_v1/gi, "");
  cleaned = cleaned.replace(/propel_knowledge_sources?/gi, "");
  cleaned = cleaned.replace(/readiness flags?/gi, "");
  cleaned = cleaned.replace(/readiness:\s*missing[^;.]*/gi, "");
  cleaned = cleaned.replace(/readiness\.missing[^;.]*/gi, "");
  cleaned = cleaned.replace(/completeness_level/gi, "");
  cleaned = cleaned.replace(/snapshot_mode/gi, "");
  cleaned = cleaned.replace(/assessment-only mode/gi, "");

  // Strip diagnostic references
  cleaned = cleaned.replace(/diagnostic\s+q\d+\s+response_score=\d+/gi, "");
  cleaned = cleaned.replace(/diagnostic\s+q\d+=\d+/gi, "");
  cleaned = cleaned.replace(/diagnostic_findings\[\d+\]/gi, "");
  cleaned = cleaned.replace(/\bq\d+=\d+/gi, "");

  // Strip evidence path references
  cleaned = cleaned.replace(/assessment\.scores\.[^\s;.)]*/gi, "");
  cleaned = cleaned.replace(/assessment\.strategy_dimension_scores\[\d+\]/gi, "");
  cleaned = cleaned.replace(/assessment\.diagnostic_findings\[\d+\]/gi, "");
  cleaned = cleaned.replace(/assessment\.behavioral_readiness\.[^\s;.)]*/gi, "");

  // Clean up artifacts
  cleaned = cleaned.replace(/\s*;\s*;\s*/g, "; ");
  cleaned = cleaned.replace(/\s*;\s*/g, "; ");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  cleaned = cleaned.replace(/\s*;\s*$/g, "");
  cleaned = cleaned.replace(/\s*and\s*$/gi, "");
  cleaned = cleaned.replace(/^\s*and\s+/gi, "");
  cleaned = cleaned.replace(/\(\s*\)/g, "");
  cleaned = cleaned.replace(/\(\s*;/g, "(");
  cleaned = cleaned.replace(/;\s*\)/g, ")");
  cleaned = cleaned.trim();

  return cleaned;
}

type BuildResult = { payload: DeckPayload | null; error: string | null };

async function buildDeckPayloadServerSide(
  supabase: ReturnType<typeof createClient>,
  assessmentInstanceId: string,
  strategyGenerationId: string
): Promise<BuildResult> {
  // 1. Load the assessment instance
  const { data: instance, error: instErr } = await supabase
    .from("assessment_instances")
    .select("*, organization:organizations(*), template:assessment_templates(*)")
    .eq("id", assessmentInstanceId)
    .maybeSingle();

  if (instErr || !instance) {
    return { payload: null, error: "Assessment instance not found" };
  }

  // 2. Load the strategy generation — must be approved
  const { data: strategyGen, error: genErr } = await supabase
    .from("analysis_generations")
    .select("*")
    .eq("id", strategyGenerationId)
    .maybeSingle();

  if (genErr || !strategyGen) {
    return { payload: null, error: "Strategy generation not found" };
  }

  if (strategyGen.status !== "approved") {
    return { payload: null, error: `Strategy generation is not approved (status: ${strategyGen.status})` };
  }

  // 3. Get the approved output — prefer reviewed_output_json, fall back to output_json
  const output = (strategyGen.reviewed_output_json ?? strategyGen.output_json) as Record<string, unknown> | null;
  if (!output) {
    return { payload: null, error: "Strategy generation has no output" };
  }

  // 4. Load assessment result for behavioral readiness
  const { data: result } = await supabase
    .from("assessment_results")
    .select("result_snapshot, normalized_score, score_band")
    .eq("assessment_instance_id", assessmentInstanceId)
    .maybeSingle();

  // 5. Load section scores
  const { data: sectionScores } = await supabase
    .from("assessment_section_scores")
    .select("*, section:assessment_sections(title, display_order)")
    .eq("assessment_instance_id", assessmentInstanceId)
    .order("display_order", { referencedTable: "section" });

  // 6. Load score bands
  let scoreBands: Array<{ band_label: string }> = [];
  if (instance.assessment_version_id) {
    const { data: bands } = await supabase
      .from("assessment_score_bands")
      .select("band_label")
      .eq("assessment_version_id", instance.assessment_version_id)
      .order("display_order");
    scoreBands = (bands ?? []) as Array<{ band_label: string }>;
  }

  // 7. Load deterministic recommendations (strengths, opportunities)
  let recommendations: Record<string, unknown> | null = null;
  try {
    const { data: recData, error: recErr } = await supabase
      .rpc("get_recommendations_for_report", { p_assessment_instance_id: assessmentInstanceId });
    if (!recErr && recData) {
      recommendations = recData as Record<string, unknown>;
    }
  } catch {
    // Recommendations RPC may not exist or may fail — continue without them
  }

  // ---- Build the payload ----
  const org = instance.organization as Record<string, unknown> | null;
  const template = instance.template as Record<string, unknown> | null;

  const clientName = (org?.organization_name as string) ?? "Unknown Client";
  const assessmentName = (template?.name as string) ?? "Well-being Opportunity Index";
  const completionDate = formatDate(instance.submitted_at ?? instance.created_at ?? null);

  const overallScore = result?.normalized_score
    ? Math.round(Number(result.normalized_score))
    : instance.overall_score
    ? Math.round(Number(instance.overall_score))
    : 0;

  const maturity = (result?.score_band as string) ?? getMaturityLevel(overallScore);
  const bands = scoreBands.length > 0 ? scoreBands.map((b) => b.band_label) : MATURITY_BANDS;

  // Dimensions from section scores
  const dimensions = ((sectionScores ?? []) as Array<Record<string, unknown>>).map((ss) => {
    const section = ss.section as Record<string, unknown> | null;
    const score = Math.round(Number(ss.normalized_score));
    return {
      name: (section?.title as string) ?? "Unknown",
      score,
      level: getDimensionLevel(score),
    };
  });

  // Behavioral drivers from result snapshot
  const snapshot = (result?.result_snapshot ?? null) as Record<string, unknown> | null;
  const br = (snapshot?.behavioral_readiness ?? null) as Record<string, unknown> | null;
  const behavioralDrivers: DeckPayload["assessment"]["behavioral_drivers"] = [];
  if (br) {
    const driverKeys = ["clarity_of_value", "motivation_overcoming_inertia", "trust_social_proof", "structural_environmental_friction"];
    for (const key of driverKeys) {
      const score = Number(br[key] ?? 0);
      behavioralDrivers.push({
        name: DRIVER_LABELS[key],
        score: Math.round(score),
        level: getBehavioralInterpretation(score),
        body: DRIVER_DESCRIPTIONS[key],
      });
    }
  }

  // Strategy from approved output
  const executiveSummary = sanitizeForSlides((output.executive_summary as string) ?? "");
  let currentMaturity = sanitizeForSlides((output.maturity_interpretation as string) ?? "");
  // Truncate current maturity to 120 words if needed
  const maturityWords = currentMaturity.trim().split(/\s+/).filter(Boolean);
  if (maturityWords.length > 120) {
    currentMaturity = maturityWords.slice(0, 120).join(" ") + "...";
  }

  // Strengths and opportunities from deterministic recommendations
  const recsData = recommendations as Record<string, unknown> | null;
  const strengths = ((recsData?.strengths as Array<Record<string, unknown>>) ?? []).map((s) => ({
    title: (s.title as string) ?? "",
    body: (s.description as string) ?? "",
  }));
  const priorityOpportunities = ((recsData?.priorityOpportunities as Array<Record<string, unknown>>) ?? []).map((o) => ({
    title: (o.title as string) ?? "",
    body: (o.description as string) ?? "",
  }));

  // Holding back from AI prioritized_barriers
  const holdingBack = ((output.prioritized_barriers as Array<Record<string, unknown>>) ?? []).map((b) => ({
    title: sanitizeForSlides((b.title as string) ?? ""),
    body: sanitizeForSlides((b.description as string) ?? ""),
  }));

  // Recommendations from AI priority_recommendations
  const deckRecommendations = ((output.priority_recommendations as Array<Record<string, unknown>>) ?? []).map((rec) => ({
    title: (rec.title as string) ?? "",
    why_it_matters: sanitizeForSlides((rec.why_this_matters as string) ?? ""),
    recommended_action: sanitizeForSlides((rec.recommended_action as string) ?? ""),
    suggested_first_step: sanitizeForSlides((rec.suggested_first_step as string) ?? ""),
    expected_impact: sanitizeForSlides((rec.expected_strategic_impact as string) ?? ""),
    implementation_order: sanitizeForSlides((rec.implementation_sequence as string) ?? ""),
    guidance: sanitizeForSlides((rec.propel_knowledge_evidence as string) ?? ""),
    related_findings: sanitizeForSlides((rec.assessment_evidence as string) ?? ""),
  }));

  // Implementation sequence
  const implSeq = (output.implementation_sequence as string[]) ?? [];
  const implementationSequence = {
    now: implSeq[0] ? parsePhase(implSeq[0]) : { title: "", body: "" },
    next: implSeq[1] ? parsePhase(implSeq[1]) : { title: "", body: "" },
    later: implSeq[2] ? parsePhase(implSeq[2]) : { title: "", body: "" },
  };

  // Discussion questions — max 3
  const discussionQuestions = ((output.client_discussion_questions as string[]) ?? []).slice(0, 3);

  const payload: DeckPayload = {
    client: {
      name: clientName,
      assessment_name: assessmentName,
      assessment_date: completionDate,
    },
    assessment: {
      overall_score: overallScore,
      maturity,
      bands,
      dimensions,
      behavioral_drivers: behavioralDrivers,
    },
    strategy: {
      executive_summary: executiveSummary,
      current_maturity: currentMaturity,
      strengths,
      priority_opportunities: priorityOpportunities,
      holding_back: holdingBack,
      recommendations: deckRecommendations,
      implementation_sequence: implementationSequence,
      discussion_questions: discussionQuestions,
    },
  };

  return { payload, error: null };
}

// ============================================================
// Validation (server-side)
// ============================================================

const PROHIBITED_PATTERNS = [
  "file-", "vs_", "file_id", "vector_store", "source:", "sources:",
  "according to the document", "see guidance in", "from the knowledge base",
  "strategy knowledge master", "recommendation bank", "propel knowledge sources",
  "materials used", "retrieved materials", "readiness flags",
  "completeness_level", "snapshot_mode", "assessment-only mode",
  ".docx", ".pdf", ".txt",
];

function countWords(text: string): number {
  if (!text || typeof text !== "string") return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function validatePayload(payload: DeckPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!payload.client.name?.trim()) errors.push("Client name is required");
  if (!payload.assessment.maturity?.trim()) errors.push("Maturity band is required");
  if (payload.assessment.dimensions.length !== 6) errors.push("Exactly 6 dimensions required");
  if (payload.assessment.behavioral_drivers.length !== 4) errors.push("Exactly 4 behavioral drivers required");
  if (!payload.strategy.executive_summary?.trim()) errors.push("Executive summary is required");
  if (payload.strategy.recommendations.length < 1) errors.push("At least 1 recommendation is required");

  // Score validation
  if (payload.assessment.overall_score < 0 || payload.assessment.overall_score > 100) {
    errors.push("Overall score must be 0-100");
  }
  for (const dim of payload.assessment.dimensions) {
    if (dim.score < 0 || dim.score > 100) errors.push(`Dimension "${dim.name}" score out of range`);
  }
  for (const d of payload.assessment.behavioral_drivers) {
    if (d.score < 0 || d.score > 100) errors.push(`Driver "${d.name}" score out of range`);
  }

  // Implementation phases
  const seq = payload.strategy.implementation_sequence;
  if (!seq.now?.title?.trim() || !seq.now?.body?.trim()) errors.push("Phase 1 (now) is incomplete");
  if (!seq.next?.title?.trim() || !seq.next?.body?.trim()) errors.push("Phase 2 (next) is incomplete");
  if (!seq.later?.title?.trim() || !seq.later?.body?.trim()) errors.push("Phase 3 (later) is incomplete");

  // Overflow checks
  if (countWords(payload.strategy.executive_summary) > 130) errors.push("Executive summary exceeds 130 words");
  if (countWords(payload.strategy.current_maturity) > 120) errors.push("Current maturity exceeds 120 words");

  // Prohibited metadata
  const allText = [
    payload.strategy.executive_summary,
    payload.strategy.current_maturity,
    ...payload.strategy.holding_back.map((h) => h.title + " " + h.body),
    ...payload.strategy.recommendations.map((r) =>
      r.title + " " + r.why_it_matters + " " + r.guidance + " " + r.related_findings
    ),
  ];
  for (const text of allText) {
    if (typeof text !== "string") continue;
    const lower = text.toLowerCase();
    for (const pattern of PROHIBITED_PATTERNS) {
      if (lower.includes(pattern)) {
        errors.push(`Prohibited metadata found: '${pattern}'`);
        break;
      }
    }
  }

  // Placeholder tokens
  const tokenPattern = /\{\{[^}]+\}\}|\$\{[^}]+\}|\[INSERT[^]]*\]/i;
  for (const text of [payload.client.name, payload.client.assessment_name, ...payload.strategy.recommendations.map((r) => r.title)]) {
    if (typeof text === "string" && tokenPattern.test(text)) {
      errors.push("Unresolved placeholder token found");
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Safe error message
// ============================================================
function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    // 2. Parse request body — only IDs, no payload
    const body = await req.json();
    const { presentation_generation_id, assessment_instance_id, strategy_generation_id } = body as {
      presentation_generation_id?: string;
      assessment_instance_id?: string;
      strategy_generation_id?: string;
    };

    if (!presentation_generation_id || !assessment_instance_id || !strategy_generation_id) {
      return new Response(
        JSON.stringify({ error: "presentation_generation_id, assessment_instance_id, and strategy_generation_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Authorize — only superadmin and propel_csm can generate
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

    if (userRole !== "superadmin" && userRole !== "propel_csm") {
      return new Response(
        JSON.stringify({ error: "Only Propel CSMs and superadmins can generate presentations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For propel_csm, verify org access
    if (userRole === "propel_csm") {
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

    // 4. Verify the presentation_generation record exists and is queued
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
        JSON.stringify({ error: `Generation is already in progress or completed (status: ${presGen.status})` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Update status to generating
    await supabase
      .from("presentation_generations")
      .update({ status: "generating" })
      .eq("id", presentation_generation_id);

    // 6. Build the payload server-side
    const { payload, error: buildError } = await buildDeckPayloadServerSide(
      supabase,
      assessment_instance_id,
      strategy_generation_id
    );

    if (buildError || !payload) {
      await supabase
        .from("presentation_generations")
        .update({
          status: "failed",
          error_message: buildError ?? "Failed to build payload",
          completed_at: new Date().toISOString(),
        })
        .eq("id", presentation_generation_id);
      return new Response(
        JSON.stringify({ error: buildError ?? "Failed to build payload" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Validate the server-built payload
    const validation = validatePayload(payload);
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
        JSON.stringify({ error: "Payload validation failed", details: validation.errors }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Save the server-built payload
    await supabase
      .from("presentation_generations")
      .update({ payload_snapshot_json: payload as unknown as Record<string, unknown> })
      .eq("id", presentation_generation_id);

    // 9. Generate the deck
    let pres: PptxPres;
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
        JSON.stringify({ error: "Deck generation failed", details: safeErrorMessage(genErr) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 10. Write to buffer
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
        JSON.stringify({ error: "Failed to write presentation file", details: safeErrorMessage(writeErr) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // 11. Upload to private bucket
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

    const { error: uploadErr } = await supabase.storage
      .from("strategy-presentations")
      .upload(storagePath, fileBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
        JSON.stringify({ error: "Failed to upload presentation file", details: safeErrorMessage(uploadErr) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 12. Update record to completed
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

    // 13. Return success
    const slideCount = 8 + payload.strategy.recommendations.length;
    return new Response(
      JSON.stringify({
        presentation_generation_id,
        status: "completed",
        storage_path: storagePath,
        file_name: fileName,
        template_version: TEMPLATE_VERSION,
        file_size: fileBuffer.byteLength,
        slide_count: slideCount,
        payload_built_by: "server",
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
