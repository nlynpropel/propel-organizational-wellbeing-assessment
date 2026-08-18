import pptxgen from "npm:pptxgenjs@3.12.0";

const NAVY = "031C40";
const ORANGE = "FF6600";
const GREEN = "8BC64E";
const DARKGREEN = "5C9433";
const GRAY = "667180";
const BLUEGRAY = "4A6B8A";
const TEXT_DARK = "303640";
const TEXT_GRAY = "667180";
const CARD_BG = "F5F7F9";
const LINE = "E4E8EC";
const WHITE = "FFFFFF";
const LIGHT_GREEN = "EEF6E3";
const LIGHT_ORANGE = "FFF1E8";
const LIGHT_GRAY = "F3F4F6";
const FONT = "Calibri";
const PAGE_W = 13.333;
const PAGE_H = 7.5;
const MARGIN = 0.6;
const LOGO_ASPECT = 366 / 1299;

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

const BAND_BOUNDARIES = [0, 40, 60, 75, 90, 100];

type PptxSlide = ReturnType<pptxgen["addSlide"]>;
type PptxPres = InstanceType<typeof pptxgen>;

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
    behavioral_drivers: Array<{ name: string; score: number; level: string; body: string }>;
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

let CURRENT_LOGO_DATA_URI: string | null = null;

function levelColor(level: string): string {
  return BAND_COLORS[level] || BEHAVIOR_COLORS[level] || GRAY;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function bg(slide: PptxSlide, color = WHITE): void {
  slide.background = { color };
}

function addLogo(slide: PptxSlide, x: number, y: number, w: number): void {
  const h = w * LOGO_ASPECT;
  if (CURRENT_LOGO_DATA_URI) {
    slide.addImage({ data: CURRENT_LOGO_DATA_URI, x, y, w, h });
  } else {
    slide.addText("Propel", {
      x, y, w, h: h + 0.05, fontSize: 16, bold: true, italic: true,
      color: GREEN, fontFace: FONT, margin: 0, valign: "middle",
    });
  }
}

function addPoweredByPropel(slide: PptxSlide, x = MARGIN, y = PAGE_H - 0.42): void {
  const textW = 0.62;
  const logoW = 0.55;
  const gap = 0.08;
  const rowH = 0.3;
  const logoH = logoW * LOGO_ASPECT;
  slide.addText("Powered by", {
    x, y, w: textW, h: rowH, fontSize: 9, color: GRAY, fontFace: FONT,
    italic: true, valign: "middle", margin: 0,
  });
  if (CURRENT_LOGO_DATA_URI) {
    slide.addImage({ data: CURRENT_LOGO_DATA_URI, x: x + textW + gap, y: y + (rowH - logoH) / 2, w: logoW, h: logoH });
  } else {
    slide.addText("Propel", {
      x: x + textW + gap, y, w: logoW, h: rowH, fontSize: 9.5,
      color: GREEN, fontFace: FONT, bold: true, italic: true, valign: "middle", margin: 0,
    });
  }
}

function addFooter(slide: PptxSlide): void {
  addPoweredByPropel(slide);
}

function addHeader(slide: PptxSlide, title: string, opts: { center?: boolean; y?: number; size?: number } = {}): void {
  slide.addText(title, {
    x: MARGIN,
    y: opts.y ?? 0.42,
    w: PAGE_W - MARGIN * 2,
    h: 0.55,
    fontSize: opts.size ?? 24,
    bold: true,
    color: NAVY,
    fontFace: FONT,
    align: opts.center ? "center" : "left",
    margin: 0,
  });
}

function addBandScale(slide: PptxSlide, x: number, y: number, w: number, score: number, bands: string[]): void {
  const names = bands.length ? bands : ["Reactive", "Developing", "Established", "Strategic", "Leading"];
  let cursor = x;
  names.forEach((band, i) => {
    const segW = ((BAND_BOUNDARIES[i + 1] - BAND_BOUNDARIES[i]) / 100) * w;
    slide.addShape("rect", {
      x: cursor,
      y,
      w: segW,
      h: 0.34,
      fill: { color: BAND_COLORS[band] || GRAY },
      line: { color: WHITE, width: 1.2 },
    });
    slide.addText(band, {
      x: cursor - 0.06,
      y: y + 0.42,
      w: segW + 0.12,
      h: 0.2,
      fontSize: 9,
      color: TEXT_GRAY,
      fontFace: FONT,
      align: "center",
      margin: 0,
      wrap: false,
    });
    cursor += segW;
  });
  const markerX = x + (w * Math.max(0, Math.min(100, score))) / 100 - 0.025;
  slide.addShape("rect", {
    x: markerX,
    y: y - 0.08,
    w: 0.05,
    h: 0.5,
    fill: { color: WHITE },
    line: { color: NAVY, width: 1.25 },
  });
}

function addScoreBadge(slide: PptxSlide, score: number, maturity: string): void {
  const x = 5.58;
  const y = 1.35;
  const w = 1.9;
  const h = 1.45;
  slide.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.07,
    fill: { color: WHITE },
    line: { color: "D0D0D0", width: 1 },
    shadow: { type: "outer", color: "000000", opacity: 0.18, blur: 5, offset: 2, angle: 90 },
  });
  slide.addText(String(Math.round(score)), {
    x, y: y + 0.2, w, h: 0.65, fontSize: 40, bold: true,
    color: levelColor(maturity), fontFace: FONT, align: "center", margin: 0,
  });
  slide.addShape("rect", {
    x: x + 0.28, y: y + 0.95, w: w - 0.56, h: 0.34,
    fill: { color: levelColor(maturity) }, line: { type: "none" },
  });
  slide.addText(maturity, {
    x: x + 0.28, y: y + 0.98, w: w - 0.56, h: 0.24,
    fontSize: 10.5, bold: true, color: WHITE, fontFace: FONT,
    align: "center", margin: 0,
  });
}

function addScoreBar(slide: PptxSlide, x: number, y: number, w: number, item: { name: string; score: number; level: string }, opts: { showDescription?: string } = {}): void {
  slide.addText(item.name, {
    x, y, w: w - 1.0, h: 0.24, fontSize: 11, bold: true, color: NAVY, fontFace: FONT, margin: 0,
  });
  slide.addText(`${Math.round(item.score)} / 100`, {
    x: x + w - 1.0, y, w: 1.0, h: 0.24, fontSize: 11, bold: true,
    color: NAVY, fontFace: FONT, align: "right", margin: 0,
  });
  const barY = y + 0.32;
  slide.addShape("roundRect", {
    x, y: barY, w, h: 0.14, rectRadius: 0.07,
    fill: { color: LINE }, line: { type: "none" },
  });
  slide.addShape("roundRect", {
    x, y: barY, w: Math.max(0.14, (w * Math.max(0, Math.min(100, item.score))) / 100), h: 0.14, rectRadius: 0.07,
    fill: { color: levelColor(item.level) }, line: { type: "none" },
  });
  slide.addText(item.level, {
    x, y: barY + 0.18, w, h: 0.2, fontSize: 9.5, color: TEXT_GRAY, fontFace: FONT, margin: 0,
  });
  if (opts.showDescription) {
    slide.addText(opts.showDescription, {
      x, y: barY + 0.42, w, h: 0.42, fontSize: 9.2, color: TEXT_GRAY, fontFace: FONT, margin: 0,
      valign: "top",
    });
  }
}

function addCheckCard(slide: PptxSlide, x: number, y: number, w: number, title: string, body: string): void {
  slide.addShape("roundRect", {
    x, y, w, h: 1.85, rectRadius: 0.06,
    fill: { color: CARD_BG },
    line: { type: "none" },
    shadow: { type: "outer", color: "000000", opacity: 0.16, blur: 5, offset: 2, angle: 90 },
  });
  slide.addShape("roundRect", {
    x: x + 0.28, y: y + 0.25, w: 0.48, h: 0.48, rectRadius: 0.10,
    fill: { color: "DCEFC8" }, line: { type: "none" },
  });
  slide.addText("✓", {
    x: x + 0.28, y: y + 0.22, w: 0.48, h: 0.48, fontSize: 25, bold: true,
    color: DARKGREEN, fontFace: FONT, align: "center", valign: "middle", margin: 0,
  });
  slide.addText(title, {
    x: x + 0.28, y: y + 0.88, w: w - 0.56, h: 0.36, fontSize: 13.5, bold: true,
    color: NAVY, fontFace: FONT, margin: 0, valign: "top",
  });
  slide.addText(body, {
    x: x + 0.28, y: y + 1.30, w: w - 0.56, h: 0.42, fontSize: 9.4,
    color: TEXT_DARK, fontFace: FONT, margin: 0, valign: "top",
  });
}

function addPriorityCard(slide: PptxSlide, x: number, y: number, w: number, idx: number, title: string, body: string): void {
  slide.addShape("roundRect", {
    x, y, w, h: 2.25, rectRadius: 0.18,
    fill: { color: WHITE }, line: { color: LINE, transparency: 55, width: 1 },
    shadow: { type: "outer", color: "000000", opacity: 0.18, blur: 6, offset: 3, angle: 90 },
  });
  slide.addShape("ellipse", {
    x: x + w / 2 - 0.19, y: y - 0.18, w: 0.38, h: 0.38,
    fill: { color: "B7B7B7" }, line: { type: "none" },
  });
  slide.addText(String(idx + 1), {
    x: x + w / 2 - 0.19, y: y - 0.15, w: 0.38, h: 0.28, fontSize: 9.5,
    bold: true, color: WHITE, fontFace: FONT, align: "center", margin: 0,
  });
  slide.addText(title, {
    x: x + 0.34, y: y + 0.46, w: w - 0.68, h: 0.62, fontSize: 13.2, bold: true,
    color: NAVY, fontFace: FONT, align: "center", margin: 0, valign: "middle", fit: "shrink",
  });
  slide.addText(body, {
    x: x + 0.42, y: y + 1.16, w: w - 0.84, h: 0.60, fontSize: 10.2,
    color: TEXT_DARK, fontFace: FONT, align: "center", margin: 0, valign: "top", fit: "shrink",
  });
}

function addSmallSection(slide: PptxSlide, label: string, body: string, x: number, y: number, w: number, h: number, bodySize = 10.5): void {
  slide.addText(label, {
    x, y, w, h: 0.22, fontSize: 9.5, bold: true, color: TEXT_GRAY,
    fontFace: FONT, charSpacing: 1, margin: 0,
  });
  slide.addText(body || "—", {
    x, y: y + 0.25, w, h, fontSize: bodySize, color: TEXT_DARK,
    fontFace: FONT, margin: 0, valign: "top", fit: "shrink",
  });
}

function addNumberedFinding(slide: PptxSlide, idx: number, title: string, body: string, x: number, y: number, w: number): void {
  slide.addText(String(idx + 1), {
    x, y: y - 0.02, w: 0.25, h: 0.25, fontSize: 13, bold: true,
    color: NAVY, fontFace: FONT, margin: 0,
  });
  slide.addText(title, {
    x: x + 0.36, y, w: w - 0.36, h: 0.22, fontSize: 12.2, bold: true,
    color: NAVY, fontFace: FONT, margin: 0,
  });
  slide.addText(body, {
    x: x + 0.36, y: y + 0.30, w: w - 0.36, h: 0.45, fontSize: 10.2,
    color: TEXT_DARK, fontFace: FONT, margin: 0, valign: "top", fit: "shrink",
  });
}

function addCover(slide: PptxSlide, data: DeckPayload): void {
  bg(slide, WHITE);
  addLogo(slide, MARGIN, 0.28, 1.1);
  slide.addText("WELL-BEING SCORECARD REPORT", {
    x: 1.9, y: 0.35, w: 4.2, h: 0.25, fontSize: 12, bold: true,
    color: GRAY, fontFace: FONT, charSpacing: 2, margin: 0,
  });
  slide.addText("PREPARED FOR", {
    x: 0.95, y: 2.82, w: 2.3, h: 0.28, fontSize: 15, color: TEXT_GRAY,
    fontFace: FONT, margin: 0,
  });
  slide.addText(data.client.name.toUpperCase(), {
    x: 0.9, y: 3.25, w: 5.3, h: 0.78, fontSize: 38, bold: true,
    color: NAVY, fontFace: FONT, margin: 0, fit: "shrink",
  });
  slide.addText(data.client.assessment_date, {
    x: MARGIN, y: PAGE_H - 0.38, w: 2, h: 0.22, fontSize: 8.5, italic: true,
    color: TEXT_GRAY, fontFace: FONT, margin: 0,
  });

  // Permanent cover image slot. If a branded cover photo is added later, this
  // right-side container can be replaced with an image while preserving layout.
  slide.addShape("roundRect", {
    x: 6.65, y: 0.32, w: 6.15, h: 6.70, rectRadius: 0.15,
    fill: { color: "EAF4F8" }, line: { type: "none" },
  });
  slide.addShape("arc", {
    x: 5.95, y: 0.62, w: 6.7, h: 6.7,
    adjustPoint: 0.28,
    fill: { color: "D4EAF0", transparency: 35 },
    line: { type: "none" },
  } as unknown as Record<string, unknown>);
  slide.addText("Propel", {
    x: 8.55, y: 3.03, w: 2.4, h: 0.7, fontSize: 24, italic: true, bold: true,
    color: GREEN, fontFace: FONT, align: "center", margin: 0,
  });
}

function addOverview(slide: PptxSlide, data: DeckPayload): void {
  bg(slide, WHITE);
  addHeader(slide, "Well-being Scorecard Overview", { center: true, size: 26, y: 0.5 });
  addScoreBadge(slide, data.assessment.overall_score, data.assessment.maturity);
  addBandScale(slide, MARGIN, 3.02, PAGE_W - MARGIN * 2, data.assessment.overall_score, data.assessment.bands);
  slide.addText(data.strategy.executive_summary, {
    x: MARGIN, y: 3.95, w: PAGE_W - MARGIN * 2, h: 0.72, fontSize: 10.5,
    color: TEXT_DARK, fontFace: FONT, margin: 0, valign: "top", fit: "shrink",
  });
  slide.addText("STRENGTHS", {
    x: MARGIN, y: 4.90, w: 3, h: 0.25, fontSize: 11, bold: true,
    color: DARKGREEN, fontFace: FONT, charSpacing: 1, margin: 0,
  });
  const cardW = 5.9;
  data.strategy.strengths.slice(0, 2).forEach((s, i) => {
    addCheckCard(slide, MARGIN + i * (cardW + 0.42), 5.28, cardW, s.title, s.body);
  });
  addFooter(slide);
}

function addPriorityOpportunities(slide: PptxSlide, data: DeckPayload): void {
  bg(slide, WHITE);
  slide.addText("Priority Opportunities", {
    x: 0, y: 0.78, w: PAGE_W, h: 0.25, fontSize: 12, bold: true,
    color: NAVY, fontFace: FONT, align: "center", margin: 0,
  });
  slide.addText("The three areas most likely to move\nthe needle first.", {
    x: 2.8, y: 1.12, w: 7.75, h: 0.78, fontSize: 25, color: "111111",
    fontFace: FONT, align: "center", margin: 0, breakLine: false,
  });
  const items = data.strategy.priority_opportunities.slice(0, 3);
  const cardW = 3.78;
  const gap = 0.42;
  const startX = (PAGE_W - (cardW * items.length + gap * Math.max(0, items.length - 1))) / 2;
  items.forEach((item, i) => addPriorityCard(slide, startX + i * (cardW + gap), 2.92, cardW, i, item.title, item.body));
  addFooter(slide);
}

function addStrategyDimensions(slide: PptxSlide, data: DeckPayload): void {
  bg(slide, WHITE);
  addHeader(slide, "Strategy Dimensions");
  slide.addText("Scores across the six structural dimensions of the assessment.", {
    x: MARGIN, y: 1.0, w: 10, h: 0.28, fontSize: 11, color: TEXT_GRAY,
    fontFace: FONT, italic: true, margin: 0,
  });
  const colW = (PAGE_W - MARGIN * 2 - 0.7) / 2;
  data.assessment.dimensions.forEach((dim, i) => {
    const c = i % 2;
    const r = Math.floor(i / 2);
    addScoreBar(slide, MARGIN + c * (colW + 0.7), 1.62 + r * 0.86, colW, dim);
  });
  slide.addText("CURRENT MATURITY", {
    x: MARGIN, y: 4.85, w: 3.2, h: 0.25, fontSize: 11, bold: true,
    color: NAVY, fontFace: FONT, charSpacing: 1, margin: 0,
  });
  slide.addText(data.strategy.current_maturity, {
    x: MARGIN, y: 5.20, w: PAGE_W - MARGIN * 2, h: 0.95, fontSize: 10.4,
    color: TEXT_DARK, fontFace: FONT, margin: 0, fit: "shrink", valign: "top",
  });
  addFooter(slide);
}

function addBehavioralReadiness(slide: PptxSlide, data: DeckPayload): void {
  bg(slide, WHITE);
  addHeader(slide, "Behavioral Readiness");
  slide.addText("Higher scores indicate stronger behavioral support for well-being participation.", {
    x: MARGIN, y: 1.0, w: 9, h: 0.25, fontSize: 11, color: TEXT_GRAY,
    fontFace: FONT, margin: 0,
  });
  slide.addText("WHY BEHAVIORAL READINESS MATTERS", {
    x: MARGIN, y: 1.47, w: 5.5, h: 0.26, fontSize: 11, bold: true,
    color: TEXT_GRAY, fontFace: FONT, charSpacing: 1, margin: 0,
  });
  slide.addText(
    "A well-being program performs best when employees are ready and able to take action. That means they understand why an action matters, feel motivated to participate, trust the program and the people promoting it, and can engage without unnecessary friction. Those four conditions align with the assessment’s behavioral drivers: Clarity of Value, Motivation and Overcoming Inertia, Trust and Social Proof, and Structural and Environmental Friction.\n\nWhen readiness is low, even a strong program can underperform. Measuring behavioral readiness helps identify why participation is breaking down, so the organization can improve activation instead of simply adding more programs.",
    { x: MARGIN, y: 1.82, w: PAGE_W - MARGIN * 2, h: 1.55, fontSize: 10.4, color: TEXT_DARK, fontFace: FONT, margin: 0, valign: "top", fit: "shrink" },
  );
  const colW = (PAGE_W - MARGIN * 2 - 0.65) / 2;
  data.assessment.behavioral_drivers.forEach((driver, i) => {
    const c = i % 2;
    const r = Math.floor(i / 2);
    addScoreBar(slide, MARGIN + c * (colW + 0.65), 4.02 + r * 1.15, colW, driver, { showDescription: driver.body });
  });
  addFooter(slide);
}

function addHoldingBack(slide: PptxSlide, data: DeckPayload): void {
  bg(slide, WHITE);
  addHeader(slide, "What's Holding Participation Back");
  const findings = data.strategy.holding_back.slice(0, 5);
  findings.forEach((f, i) => addNumberedFinding(slide, i, f.title, f.body, MARGIN, 1.35 + i * 0.92, PAGE_W - MARGIN * 2));
  addFooter(slide);
}

function addRecommendation(slide: PptxSlide, rec: DeckPayload["strategy"]["recommendations"][number], idx: number): void {
  bg(slide, WHITE);
  slide.addText(`RECOMMENDATION #${idx + 1}`, {
    x: MARGIN, y: 0.42, w: 4.0, h: 0.24, fontSize: 10.5, bold: true,
    color: ORANGE, fontFace: FONT, charSpacing: 1, margin: 0,
  });
  slide.addText(rec.title, {
    x: MARGIN, y: 0.78, w: 6.0, h: 0.70, fontSize: 18, bold: true,
    color: NAVY, fontFace: FONT, margin: 0, fit: "shrink", valign: "top",
  });

  const rightX = 6.55;
  const rightW = 5.95;
  addSmallSection(slide, "IMPLEMENTATION ORDER", rec.implementation_order, rightX, 1.22, rightW, 0.45, 10.2);
  addSmallSection(slide, "INTEGRATED STRATEGY GUIDANCE", rec.guidance, rightX, 2.25, rightW, 0.88, 10.0);
  addSmallSection(slide, "RELATED ASSESSMENT FINDINGS", rec.related_findings, rightX, 3.70, rightW, 0.78, 10.0);

  const leftX = MARGIN;
  const leftW = 6.25;
  addSmallSection(slide, "WHY THIS MATTERS", rec.why_it_matters, leftX, 4.58, leftW, 0.36, 10.0);
  addSmallSection(slide, "RECOMMENDED ACTION", rec.recommended_action, leftX, 5.28, leftW, 0.38, 10.0);
  addSmallSection(slide, "SUGGESTED FIRST STEP", rec.suggested_first_step, leftX, 5.98, leftW, 0.38, 10.0);
  addSmallSection(slide, "EXPECTED STRATEGIC IMPACT", rec.expected_impact, 7.05, 5.98, 5.3, 0.40, 10.0);
  addFooter(slide);
}

function addImplementationSequence(slide: PptxSlide, data: DeckPayload): void {
  bg(slide, WHITE);
  addHeader(slide, "Recommended Implementation Sequence", { size: 26, y: 0.45 });
  const phases = [data.strategy.implementation_sequence.now, data.strategy.implementation_sequence.next, data.strategy.implementation_sequence.later];
  const cardW = 3.78;
  const gap = 0.52;
  const colors = [ORANGE, GREEN, NAVY];
  const startX = MARGIN;
  slide.addShape("line", {
    x: startX + 0.25, y: 1.82, w: PAGE_W - MARGIN * 2 - 0.5, h: 0,
    line: { color: LINE, width: 2, dashType: "dash" },
  });
  phases.forEach((phase, i) => {
    const x = startX + i * (cardW + gap);
    slide.addShape("roundRect", {
      x, y: 1.32, w: cardW, h: 3.35, rectRadius: 0.06,
      fill: { color: CARD_BG }, line: { type: "none" },
      shadow: { type: "outer", color: "000000", opacity: 0.16, blur: 6, offset: 3, angle: 90 },
    });
    slide.addShape("ellipse", {
      x: x + 0.25, y: 1.58, w: 0.4, h: 0.4,
      fill: { color: colors[i] }, line: { color: WHITE, width: 1.3 },
    });
    slide.addText(String(i + 1), {
      x: x + 0.25, y: 1.61, w: 0.4, h: 0.28, fontSize: 12, bold: true,
      color: WHITE, fontFace: FONT, align: "center", margin: 0,
    });
    slide.addText(phase.title, {
      x: x + 0.25, y: 2.14, w: cardW - 0.5, h: 0.42, fontSize: 14.5, bold: true,
      color: NAVY, fontFace: FONT, margin: 0,
    });
    slide.addText(phase.body, {
      x: x + 0.25, y: 2.76, w: cardW - 0.5, h: 1.52, fontSize: 10.5,
      color: TEXT_DARK, fontFace: FONT, margin: 0, valign: "top", fit: "shrink",
    });
  });
  if (data.strategy.discussion_questions?.length) {
    slide.addText("KEY DISCUSSION QUESTIONS", {
      x: MARGIN, y: 5.08, w: 5, h: 0.26, fontSize: 11, bold: true,
      color: TEXT_GRAY, fontFace: FONT, charSpacing: 1, margin: 0,
    });
    const qText = data.strategy.discussion_questions.slice(0, 3).map((q, i) => ({
      text: q,
      options: { bullet: true, breakLine: i < Math.min(3, data.strategy.discussion_questions.length) - 1, color: TEXT_DARK, fontSize: 10.5 },
    }));
    slide.addText(qText, { x: MARGIN, y: 5.44, w: PAGE_W - MARGIN * 2, h: 1.0, fontFace: FONT, valign: "top", paraSpaceAfter: 4 });
  }
  addFooter(slide);
}

function addHowPropelCanHelp(slide: PptxSlide): void {
  bg(slide, WHITE);
  slide.addShape("rect", { x: 0, y: 0, w: 5.45, h: PAGE_H, fill: { color: GREEN }, line: { type: "none" } });
  slide.addShape("parallelogram", {
    x: 4.5, y: 0, w: 2.1, h: PAGE_H,
    fill: { color: GREEN }, line: { type: "none" },
    rotate: 0,
  } as unknown as Record<string, unknown>);
  slide.addText("HOW PROPEL CAN HELP", {
    x: 1.28, y: 2.95, w: 3.3, h: 0.25, fontSize: 10.5, color: WHITE,
    fontFace: FONT, charSpacing: 2, margin: 0,
  });
  slide.addText("Custom Activation\nInfrastructure", {
    x: 1.28, y: 3.28, w: 3.7, h: 0.78, fontSize: 24, color: WHITE,
    fontFace: FONT, margin: 0, breakLine: false,
  });
  slide.addText("Propel® is an Activation Platform\nrooted in organizational culture and\nbehavioral economics, designed\nspecifically for enterprise employers to\ndrive real engagement and results in\nwell-being.", {
    x: 1.28, y: 4.32, w: 3.6, h: 1.15, fontSize: 12.5, color: WHITE,
    fontFace: FONT, margin: 0, fit: "shrink",
  });
  slide.addText("Propelwellbeing.com", {
    x: 1.28, y: 6.72, w: 3.4, h: 0.26, fontSize: 11, color: WHITE,
    fontFace: FONT, charSpacing: 3, margin: 0,
  });
  slide.addShape("ellipse", {
    x: 5.18, y: 2.74, w: 1.65, h: 1.65,
    fill: { color: "C5E5AA", transparency: 20 }, line: { type: "none" },
  });
  addLogo(slide, 5.60, 3.23, 0.85);
  slide.addShape("ellipse", { x: 8.9, y: 1.45, w: 0.72, h: 0.72, fill: { color: "BFBFBF" }, line: { type: "none" } });
  slide.addText("ϟ", { x: 8.9, y: 1.53, w: 0.72, h: 0.42, fontSize: 18, bold: true, color: WHITE, fontFace: FONT, align: "center", margin: 0 });
  slide.addText("We build each well-being platform from\nthe ground up, based on your unique\npopulation and challenges.", {
    x: 8.35, y: 2.45, w: 4.1, h: 0.82, fontSize: 15, color: TEXT_GRAY,
    fontFace: FONT, margin: 0, fit: "shrink",
  });
  slide.addShape("line", { x: 7.35, y: 3.82, w: 5.8, h: 0, line: { color: LINE, width: 1 } });
  slide.addShape("ellipse", { x: 7.72, y: 4.35, w: 0.72, h: 0.72, fill: { color: "BFBFBF" }, line: { type: "none" } });
  slide.addText("⚙", { x: 7.72, y: 4.44, w: 0.72, h: 0.42, fontSize: 16, bold: true, color: WHITE, fontFace: FONT, align: "center", margin: 0 });
  slide.addText("We provide white-glove service\nmanagement, detailed reporting,\nstrategic recommendations, and full\nplatform management.", {
    x: 7.72, y: 5.45, w: 4.5, h: 0.9, fontSize: 15, color: TEXT_GRAY,
    fontFace: FONT, margin: 0, fit: "shrink",
  });
}

export function generateDeckV2(data: DeckPayload, logoDataUri?: string | null): PptxPres {
  CURRENT_LOGO_DATA_URI = logoDataUri ?? null;
  const pres = new pptxgen();
  pres.defineLayout({ name: "WIDE", width: PAGE_W, height: PAGE_H });
  pres.layout = "WIDE";
  pres.author = "Propel";
  pres.subject = "Well-being Scorecard Report";
  pres.title = `${data.client.name} Well-being Scorecard Report`;
  pres.company = "Propel";

  addCover(pres.addSlide(), data);
  addOverview(pres.addSlide(), data);
  addPriorityOpportunities(pres.addSlide(), data);
  addStrategyDimensions(pres.addSlide(), data);
  addBehavioralReadiness(pres.addSlide(), data);
  addHoldingBack(pres.addSlide(), data);
  data.strategy.recommendations.forEach((rec, idx) => addRecommendation(pres.addSlide(), rec, idx));
  addImplementationSequence(pres.addSlide(), data);
  addHowPropelCanHelp(pres.addSlide());

  return pres;
}
