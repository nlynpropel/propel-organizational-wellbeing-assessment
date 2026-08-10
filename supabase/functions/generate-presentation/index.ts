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
// Propel brand tokens
const NAVY = "031C40";
const NAVY_LIGHT = "12345F";
const ORANGE = "FF6600";
const GREEN = "8BC64E";
const DARKGREEN = "5C9433";
const RED = "FF1C00";
const GRAY = "667180";
const BLUEGRAY = "4A6B8A";
const DARK = "303640";
const CARD_BG = "F5F7F9";
const LINE = "E4E8EC";
const TEXT_DARK = "303640";
const TEXT_GRAY = "667180";
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

const FONT = "Calibri";
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

// "Powered by" + Propel logo mark, used in the footer everywhere.
// Edge functions can't read the frontend's local public/ folder, so the
// logo is fetched once per invocation (from the deployed site's public
// URL) and embedded as base64 -- see fetchLogoDataUri() near the bottom
// of this file. Falls back to text-only if the fetch fails for any
// reason (site down, SITE_URL unset, etc.) so a logo outage never
// blocks report generation.
const LOGO_ASPECT = 366 / 1299;
let CURRENT_LOGO_DATA_URI: string | null = null;

function addPoweredByPropel(
  slide: PptxSlide,
  x: number,
  y: number,
  align: "left" | "right" = "left"
): void {
  const textW = 0.62, logoW = 0.55, gap = 0.02;
  const logoH = logoW * LOGO_ASPECT;
  const rowH = 0.3;
  const totalW = textW + gap + logoW;
  const startX = align === "right" ? x - totalW : x;
  slide.addText("Powered by", {
    x: startX, y, w: textW, h: rowH,
    fontSize: 9, color: GRAY, fontFace: FONT, italic: true, valign: "middle", margin: 0,
  });
  if (CURRENT_LOGO_DATA_URI) {
    slide.addImage({
      data: CURRENT_LOGO_DATA_URI,
      x: startX + textW + gap,
      y: y + (rowH - logoH) / 2,
      w: logoW,
      h: logoH,
    });
  } else {
    // Graceful fallback if the logo couldn't be fetched this run.
    slide.addText("Propel", {
      x: startX + textW + gap, y, w: logoW, h: rowH,
      fontSize: 9.5, bold: true, italic: true, color: GREEN, fontFace: FONT, valign: "middle", margin: 0,
    });
  }
}

function addFooter(slide: PptxSlide, pageLabel?: string): void {
  addPoweredByPropel(slide, MARGIN, PAGE_H - 0.42, "left");
  if (pageLabel) {
    slide.addText(pageLabel, {
      x: PAGE_W - MARGIN - 2,
      y: PAGE_H - 0.4,
      w: 2,
      h: 0.3,
      fontSize: 9,
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

// Full band-scale bar: all five maturity bands (Reactive -> Leading),
// sized proportionally to their actual score thresholds (NOT equal
// fifths -- Established and Strategic are narrower bands than Reactive
// or Developing), with a marker showing exactly where this score falls.
const BAND_BOUNDARIES = [0, 35, 55, 70, 85, 100];

function addBandScale(
  slide: PptxSlide,
  x: number,
  y: number,
  w: number,
  score: number,
  bands: string[]
): void {
  let cursor = x;
  bands.forEach((b, i) => {
    const segW = ((BAND_BOUNDARIES[i + 1] - BAND_BOUNDARIES[i]) / 100) * w;
    slide.addShape("rect", {
      x: cursor, y, w: segW, h: 0.32,
      fill: { color: BAND_COLORS[b] || GRAY },
      line: { color: WHITE, width: 1.5 },
    });
    slide.addText(b, {
      x: cursor - 0.08, y: y + 0.36, w: segW + 0.16, h: 0.2,
      fontSize: 9.5, color: TEXT_GRAY, fontFace: FONT, align: "center", margin: 0, wrap: false,
    });
    cursor += segW;
  });
  const clamped = Math.min(100, Math.max(0, score));
  const markerX = x + (w * clamped) / 100 - 0.03;
  slide.addShape("rect", {
    x: markerX, y: y - 0.06, w: 0.06, h: 0.44,
    fill: { color: WHITE }, line: { color: NAVY, width: 1.25 },
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
  const barY = y + 0.32;
  const barH = 0.16;
  slide.addShape("roundRect", {
    x,
    y: barY,
    w,
    h: barH,
    rectRadius: barH / 2,
    fill: { color: CARD_BG },
    line: { type: "none" },
  });
  const filledW = Math.max(
    barH,
    (w * Math.min(100, Math.max(0, item.score))) / 100
  );
  slide.addShape("roundRect", {
    x,
    y: barY,
    w: filledW,
    h: barH,
    rectRadius: barH / 2,
    fill: { color: levelColor(item.level) },
    line: { type: "none" },
  });
  slide.addText(item.level, {
    x,
    y: barY + barH + 0.04,
    w,
    h: 0.2,
    fontSize: 10,
    color: TEXT_GRAY,
    fontFace: FONT,
    margin: 0,
  });
}

// Radial arc gauge -- the deck's signature element. A 250-degree sweep
// (matching the forward "propel" motion of the brand) filled to the
// score, with the number set inside the arc rather than beside it.
function addRadialGauge(
  slide: PptxSlide,
  cx: number,
  cy: number,
  size: number,
  score: number,
  maturity: string,
  opts: { trackColor: string; textColor: string; subTextColor: string }
): void {
  const START = -125;
  const SWEEP = 250;
  const clamped = Math.min(100, Math.max(0, score));
  const endAngle = START + (SWEEP * clamped) / 100;
  const fillColor = levelColor(maturity);

  slide.addShape("blockArc", {
    x: cx,
    y: cy,
    w: size,
    h: size,
    angleRange: [START, START + SWEEP],
    fill: { color: opts.trackColor },
    line: { type: "none" },
    arcThicknessRatio: 0.26,
  } as unknown as Record<string, unknown>);

  slide.addShape("blockArc", {
    x: cx,
    y: cy,
    w: size,
    h: size,
    angleRange: [START, Math.max(START + 8, endAngle)],
    fill: { color: fillColor },
    line: { type: "none" },
    arcThicknessRatio: 0.26,
  } as unknown as Record<string, unknown>);

  const textW = size * 0.62;
  const textX = cx + (size - textW) / 2;
  slide.addText(String(Math.round(clamped)), {
    x: textX,
    y: cy + size * 0.4,
    w: textW,
    h: size * 0.32,
    fontSize: Math.round(size * 15),
    bold: true,
    align: "center",
    color: opts.textColor,
    fontFace: FONT,
    margin: 0,
  });
  slide.addText("/ 100", {
    x: textX,
    y: cy + size * 0.68,
    w: textW,
    h: size * 0.14,
    fontSize: Math.round(size * 5),
    align: "center",
    color: opts.subTextColor,
    fontFace: FONT,
    margin: 0,
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

// Concentric-ring background texture -- template-inspired signature
// device. Faint, radiating from one focal point, never competing with
// content. Used behind the cover and section-divider-style slides.
function addConcentricRings(slide: PptxSlide, cx: number, cy: number, opts: { color: string; count?: number; step?: number }): void {
  const count = opts.count ?? 6;
  const step = opts.step ?? 1.15;
  for (let i = 1; i <= count; i++) {
    const r = i * step;
    slide.addShape("ellipse", {
      x: cx - r, y: cy - r, w: r * 2, h: r * 2,
      fill: { type: "none" },
      line: { color: opts.color, width: 0.75, transparency: 55 },
    });
  }
}

// ============================================================
// Deck generator (ported exactly from generate_deck.js)
// ============================================================
async function fetchLogoDataUri(): Promise<string | null> {
  try {
    const siteUrl = Deno.env.get("SITE_URL");
    if (!siteUrl) return null;
    const res = await fetch(`${siteUrl.replace(/\/$/, "")}/Propel_Logo_2020_Main.png`);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch (err) {
    console.error("Failed to fetch Propel logo for deck:", err);
    return null;
  }
}

function generateDeck(data: DeckPayload, logoDataUri?: string | null): PptxPres {
  CURRENT_LOGO_DATA_URI = logoDataUri ?? null;
  const pres = new pptxgen();
  pres.defineLayout({ name: "WIDE", width: PAGE_W, height: PAGE_H });
  pres.layout = "WIDE";

  const { client, assessment, strategy } = data;

  // ---- Slide 1: Cover ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addConcentricRings(slide, PAGE_W - 1.2, PAGE_H / 2, { color: GREEN, count: 7, step: 1.3 });

    slide.addText("WELL-BEING OPPORTUNITY REPORT", {
      x: MARGIN, y: 1.3, w: 8, h: 0.35,
      fontSize: 12, color: GRAY, bold: true, fontFace: FONT, charSpacing: 2,
    });
    slide.addText(client.name.toUpperCase(), {
      x: MARGIN, y: 1.7, w: 9.5, h: 1.7,
      fontSize: 52, bold: true, color: NAVY, fontFace: FONT, margin: 0, valign: "top",
    });
    slide.addText(client.assessment_name, {
      x: MARGIN, y: 3.15, w: 7, h: 0.4,
      fontSize: 16, color: TEXT_GRAY, fontFace: FONT, margin: 0,
    });

    // Floating content pills -- echoes the template's abstract concept
    // badges, but grounded in this client's actual top dimensions.
    const topDims = [...assessment.dimensions].sort((a, b) => b.score - a.score).slice(0, 2);
    const pillData: Array<{ label: string; color: string; x: number; y: number; dark?: boolean }> = [
      { label: assessment.maturity, color: NAVY, x: 8.7, y: 1.5, dark: true },
      { label: topDims[0]?.name ?? "", color: CARD_BG, x: 10.55, y: 2.15 },
      { label: topDims[1]?.name ?? "", color: CARD_BG, x: 9.2, y: 2.85 },
    ];
    pillData.forEach((p) => {
      if (!p.label) return;
      const w = Math.min(3.2, 0.35 + p.label.length * 0.095);
      slide.addShape("roundRect", {
        x: p.x, y: p.y, w, h: 0.5, rectRadius: 0.25,
        fill: { color: p.color }, line: p.dark ? { type: "none" } : { color: LINE, width: 1 },
      });
      slide.addText(p.label, {
        x: p.x, y: p.y, w, h: 0.5,
        fontSize: 11, bold: true, color: p.dark ? WHITE : NAVY, fontFace: FONT,
        align: "center", valign: "middle", margin: 0,
      });
    });

    // Score, presented plainly -- large numeral, no card, letting the
    // whitespace and rings carry the visual weight instead.
    slide.addText(String(assessment.overall_score), {
      x: MARGIN, y: 4.35, w: 3, h: 1.3,
      fontSize: 72, bold: true, color: levelColor(assessment.maturity), fontFace: FONT, margin: 0,
    });
    slide.addText("OVERALL OPPORTUNITY INDEX  /  100", {
      x: MARGIN, y: 5.55, w: 5, h: 0.3,
      fontSize: 10.5, color: GRAY, bold: true, fontFace: FONT, charSpacing: 1,
    });

    slide.addText(client.assessment_date, {
      x: MARGIN, y: PAGE_H - 0.55, w: 4, h: 0.3,
      fontSize: 9.5, color: GRAY, fontFace: FONT, italic: true,
    });
    addPoweredByPropel(slide, PAGE_W - MARGIN, PAGE_H - 0.55, "right");
  }

  // ---- Slide 2: Opportunity Index Overview ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "Opportunity Index Overview");

    slide.addText(strategy.executive_summary, {
      x: MARGIN, y: 0.98, w: PAGE_W - MARGIN * 2, h: 0.95,
      fontSize: 11.5, color: TEXT_DARK, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.2,
    });

    slide.addText(String(assessment.overall_score), {
      x: MARGIN, y: 2.05, w: 1.7, h: 0.9,
      fontSize: 42, bold: true, color: levelColor(assessment.maturity), fontFace: FONT, margin: 0,
    });
    slide.addShape("roundRect", {
      x: MARGIN + 1.75, y: 2.28, w: 1.5, h: 0.42, rectRadius: 0.1,
      fill: { color: levelColor(assessment.maturity) }, line: { type: "none" },
    });
    slide.addText(assessment.maturity, {
      x: MARGIN + 1.75, y: 2.28, w: 1.5, h: 0.42,
      fontSize: 12, bold: true, color: WHITE, fontFace: FONT, align: "center", valign: "middle", margin: 0,
    });

    addBandScale(slide, MARGIN, 3.15, PAGE_W - MARGIN * 2, assessment.overall_score, assessment.bands);

    // Strengths as 2-up icon cards -- shortened to make room above.
    slide.addText("STRENGTHS", {
      x: MARGIN, y: 4.05, w: 6, h: 0.3,
      fontSize: 12, bold: true, color: DARKGREEN, fontFace: FONT, charSpacing: 1,
    });
    const cardGap = 0.4;
    const cardW = (PAGE_W - MARGIN * 2 - cardGap) / 2;
    strategy.strengths.slice(0, 2).forEach((s, i) => {
      const x = MARGIN + i * (cardW + cardGap);
      const y = 4.45;
      slide.addShape("roundRect", {
        x, y, w: cardW, h: 1.9, rectRadius: 0.08,
        fill: { color: CARD_BG }, line: { type: "none" },
      });
      slide.addShape("roundRect", {
        x: x + 0.28, y: y + 0.25, w: 0.48, h: 0.48, rectRadius: 0.12,
        fill: { color: "DCEDC8" }, line: { type: "none" },
      });
      slide.addShape("ellipse", {
        x: x + 0.42, y: y + 0.39, w: 0.2, h: 0.2,
        fill: { color: DARKGREEN }, line: { type: "none" },
      });
      slide.addText(s.title, {
        x: x + 0.28, y: y + 0.85, w: cardW - 0.56, h: 0.4,
        fontSize: 13.5, bold: true, color: NAVY, fontFace: FONT, margin: 0, valign: "top",
      });
      slide.addText(s.body, {
        x: x + 0.28, y: y + 1.28, w: cardW - 0.56, h: 0.55,
        fontSize: 10, color: TEXT_DARK, fontFace: FONT, margin: 0, valign: "top",
      });
    });

    addFooter(slide);
  }

  // ---- Slide 3: Priority Opportunities (numbered circles) ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "Priority Opportunities");
    slide.addText("The three areas most likely to move the needle first.", {
      x: MARGIN, y: 1.0, w: 10, h: 0.3, fontSize: 11, color: TEXT_GRAY, fontFace: FONT, italic: true,
    });

    const priItems = strategy.priority_opportunities.slice(0, 3);
    const priN = priItems.length;
    const priUsable = PAGE_W - MARGIN * 2;
    const priGap = 0.35;
    const priColW = (priUsable - priGap * (priN - 1)) / priN;
    const cardY = 1.65, cardH = 4.7;
    const circleY = cardY + 0.4, circleSize = 0.85;
    const circleColors = [ORANGE, GREEN, NAVY];
    const tintColors = ["FFEDDF", "EEF6E3", "E3E9F0"];

    priItems.forEach((item, i) => {
      const colX = MARGIN + i * (priColW + priGap);
      slide.addShape("roundRect", {
        x: colX, y: cardY, w: priColW, h: cardH, rectRadius: 0.08,
        fill: { color: tintColors[i % tintColors.length] }, line: { type: "none" },
      });
      const cx = colX + priColW / 2 - circleSize / 2;
      slide.addShape("ellipse", {
        x: cx, y: circleY, w: circleSize, h: circleSize,
        fill: { color: circleColors[i % circleColors.length] }, line: { type: "none" },
      });
      slide.addText(String(i + 1).padStart(2, "0"), {
        x: cx, y: circleY, w: circleSize, h: circleSize,
        fontSize: 22, bold: true, color: WHITE, fontFace: FONT, align: "center", valign: "middle", margin: 0,
      });
      slide.addText(item.title, {
        x: colX + 0.3, y: circleY + circleSize + 0.35, w: priColW - 0.6, h: 0.9,
        fontSize: 15, bold: true, color: NAVY, fontFace: FONT, align: "center", valign: "top", margin: 0,
      });
      slide.addText(item.body, {
        x: colX + 0.4, y: circleY + circleSize + 1.3, w: priColW - 0.8, h: 1.6,
        fontSize: 11, color: TEXT_DARK, fontFace: FONT, align: "center", valign: "top", margin: 0,
      });
    });
    addFooter(slide);
  }

  // ---- Slide 5: Strategy Dimensions (detail bars) ----
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

    slide.addShape("line", {
      x: MARGIN, y: 4.55, w: PAGE_W - MARGIN * 2, h: 0,
      line: { color: LINE, width: 1 },
    });
    slide.addText("CURRENT MATURITY", {
      x: MARGIN, y: 4.75, w: 6, h: 0.3,
      fontSize: 12, bold: true, color: NAVY, fontFace: FONT, charSpacing: 1,
    });
    slide.addText(strategy.current_maturity, {
      x: MARGIN, y: 5.1, w: PAGE_W - MARGIN * 2, h: 1.6,
      fontSize: 11.5, color: TEXT_GRAY, fontFace: FONT, valign: "top", lineSpacingMultiple: 1.2,
    });
    addFooter(slide);
  }

  // ---- Slide 4: Behavioral Readiness + What's Holding Participation Back (merged) ----
  {
    const slide = pres.addSlide();
    bg(slide, WHITE);
    addHeader(slide, "What's Holding Participation Back");
    slide.addText(
      "Behavioral readiness scores, and the specific findings behind them.",
      { x: MARGIN, y: 1.0, w: 11, h: 0.3, fontSize: 11, color: TEXT_GRAY, fontFace: FONT, italic: true }
    );

    // Left: compact behavioral driver bars
    const leftX = MARGIN, leftW = 4.5;
    slide.addText("BEHAVIORAL READINESS", {
      x: leftX, y: 1.55, w: leftW, h: 0.28,
      fontSize: 11, bold: true, color: NAVY, fontFace: FONT, charSpacing: 1,
    });
    let by = 2.05;
    assessment.behavioral_drivers.forEach((d) => {
      addScoreBar(slide, leftX, by, leftW, d);
      by += 0.85;
    });

    // Right: findings, in a tinted panel for visual contrast
    const panelX = leftX + leftW + 0.5;
    const panelW = PAGE_W - MARGIN - panelX;
    const panelY = 1.5, panelH = 5.0;
    slide.addShape("roundRect", {
      x: panelX, y: panelY, w: panelW, h: panelH, rectRadius: 0.08,
      fill: { color: NAVY }, line: { type: "none" },
    });
    slide.addText("WHAT'S HOLDING PARTICIPATION BACK", {
      x: panelX + 0.35, y: panelY + 0.3, w: panelW - 0.7, h: 0.3,
      fontSize: 11, bold: true, color: "9FB3D1", fontFace: FONT, charSpacing: 1,
    });
    let fy = panelY + 0.85;
    const findingH = (panelH - 1.1) / Math.max(1, strategy.holding_back.length);
    strategy.holding_back.forEach((f, i) => {
      slide.addShape("ellipse", {
        x: panelX + 0.35, y: fy, w: 0.34, h: 0.34,
        fill: { color: ORANGE }, line: { type: "none" },
      });
      slide.addText(String(i + 1), {
        x: panelX + 0.35, y: fy, w: 0.34, h: 0.34,
        fontSize: 12, bold: true, color: WHITE, fontFace: FONT, align: "center", valign: "middle", margin: 0,
      });
      slide.addText(f.title, {
        x: panelX + 0.85, y: fy - 0.03, w: panelW - 1.2, h: 0.32,
        fontSize: 13, bold: true, color: WHITE, fontFace: FONT, margin: 0,
      });
      slide.addText(f.body, {
        x: panelX + 0.85, y: fy + 0.3, w: panelW - 1.2, h: findingH - 0.4,
        fontSize: 12, color: "C9D6E8", fontFace: FONT, margin: 0, valign: "top",
      });
      fy += findingH;
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
        fontSize: 9.5,
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
      fontSize: 9.5,
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
      fontSize: 9.5,
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
      fontSize: 9.5,
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
      fontSize: 10,
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
    const gap = 0.5;
    const cardW = (PAGE_W - MARGIN * 2 - gap * 2) / 3;
    const colors = [ORANGE, GREEN, NAVY];
    const badgeY = 1.55, badgeSize = 0.4;

    // Flow line connecting the three phases -- makes the sequence read
    // left-to-right at a glance, not just three separate cards.
    slide.addShape("line", {
      x: MARGIN + badgeSize / 2, y: badgeY + badgeSize / 2,
      w: PAGE_W - MARGIN * 2 - badgeSize, h: 0,
      line: { color: LINE, width: 2, dashType: "dash" },
    });

    phases.forEach((p, i) => {
      const x = MARGIN + i * (cardW + gap);
      slide.addShape("roundRect", {
        x,
        y: 1.3,
        w: cardW,
        h: 3.3,
        rectRadius: 0.06,
        fill: { color: CARD_BG },
        line: { type: "none" },
        shadow: { type: "outer", color: "000000", opacity: 0.1, blur: 8, offset: 3, angle: 90 },
      });
      slide.addShape("ellipse", {
        x: x + 0.25,
        y: badgeY,
        w: badgeSize,
        h: badgeSize,
        fill: { color: colors[i] },
        line: { color: WHITE, width: 2 },
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
    bg(slide, WHITE);
    addConcentricRings(slide, PAGE_W - 1.2, PAGE_H / 2, { color: GREEN, count: 7, step: 1.3 });
    slide.addText("Thank you", {
      x: MARGIN,
      y: 2.8,
      w: 8,
      h: 0.9,
      fontSize: 40,
      bold: true,
      color: NAVY,
      fontFace: FONT,
      margin: 0,
    });
    slide.addText(`${client.name}  \u00b7  ${client.assessment_name}`, {
      x: MARGIN,
      y: 3.75,
      w: 9,
      h: 0.4,
      fontSize: 14,
      color: TEXT_GRAY,
      fontFace: FONT,
      margin: 0,
    });
    addPoweredByPropel(slide, MARGIN, PAGE_H - 0.55, "left");
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

    // 8b. Fetch the Propel logo for the footer (best-effort -- generateDeck
    //     falls back to text-only "Propel" if this returns null)
    const logoDataUri = await fetchLogoDataUri();

    // 9. Generate the deck
    let pres: PptxPres;
    try {
      pres = generateDeck(payload, logoDataUri);
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