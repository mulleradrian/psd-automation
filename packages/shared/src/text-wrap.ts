/**
 * Smart word-wrap + shrink-to-fit for graphic type blocks.
 * Prefers fewer lines and larger type; uses 3 lines only when needed.
 */

export interface SmartWrapOptions {
  maxWidthPx: number;
  fontSizePx: number;
  maxLines?: number;
}

/**
 * Poppins-Medium–calibrated widths (PIL measured; old 0.48 avg was ~19% too narrow
 * and caused right-edge clipping after autofit).
 */
function charFactor(ch: string): number {
  if (ch === " ") return 0.28;
  if ("ilI.,:;'’!|".includes(ch)) return 0.32;
  if ("ftj()[]r".includes(ch)) return 0.4;
  if ("mwMW@".includes(ch)) return 0.9;
  if ("ABCDEFGHOKQUNVRXYZ".includes(ch)) return 0.72;
  return 0.56;
}

/** Extra safety so estimated fit never exceeds real glyph advance / edge cases. */
const WIDTH_SAFETY = 1.12;

export function estimateTextWidthPx(text: string, fontSizePx: number): number {
  let w = 0;
  for (const ch of text) w += fontSizePx * charFactor(ch);
  return w * WIDTH_SAFETY;
}

/** True if every line (and every single word) fits in maxWidthPx. */
export function linesFitInBounds(
  lines: string[],
  fontSizePx: number,
  maxWidthPx: number,
): boolean {
  for (const line of lines) {
    if (estimateTextWidthPx(line, fontSizePx) > maxWidthPx + 0.5) return false;
    for (const word of line.split(/\s+/).filter(Boolean)) {
      if (estimateTextWidthPx(word, fontSizePx) > maxWidthPx + 0.5) return false;
    }
  }
  return true;
}

export function wrapWordsToWidth(
  text: string,
  opts: SmartWrapOptions,
): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    const width = estimateTextWidthPx(trial, opts.fontSizePx);
    if (!current || width <= opts.maxWidthPx) {
      current = trial;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);

  if (opts.maxLines && lines.length > opts.maxLines) {
    const head = lines.slice(0, opts.maxLines - 1);
    const tail = lines.slice(opts.maxLines - 1).join(" ");
    return [...head, tail];
  }
  return lines;
}

export function joinPhotoshopLines(lines: string[]): string {
  return lines.join("\r");
}

export function smartLineBreak(text: string, opts: SmartWrapOptions): string {
  return joinPhotoshopLines(wrapWordsToWidth(text, opts));
}

export function balancedTwoLineWrap(
  text: string,
  opts: SmartWrapOptions,
): [string, string] | null {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (words.length < 2) return null;

  let best: [string, string] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const wa = estimateTextWidthPx(a, opts.fontSizePx);
    const wb = estimateTextWidthPx(b, opts.fontSizePx);
    if (wa > opts.maxWidthPx || wb > opts.maxWidthPx) continue;
    const score = Math.abs(wa - wb);
    if (score < bestScore) {
      bestScore = score;
      best = [a, b];
    }
  }
  return best;
}

/** Prefer 1–2 lines for short phrases; only escalate to 3 when needed. */
export function preferredMaxLines(text: string): number {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return 1;
  const chars = normalized.length;
  const words = normalized.split(" ").length;
  if (chars <= 18 || words <= 2) return 1;
  if (chars <= 42 || words <= 6) return 2;
  return 3;
}

export interface LayoutTextWrapConfig {
  canvasWidthPx: number;
  textLeftPx: number;
  rightPaddingPx: number;
  fontSizePx: number;
  maxLines?: number;
}

export function maxTextWidthPx(cfg: LayoutTextWrapConfig): number {
  return Math.max(40, cfg.canvasWidthPx - cfg.textLeftPx - cfg.rightPaddingPx);
}

export const P10_IG_4X5_WRAP: LayoutTextWrapConfig = {
  canvasWidthPx: 1080,
  textLeftPx: 108,
  rightPaddingPx: 64,
  fontSizePx: 86,
  maxLines: 3,
};

export interface FitTypeBlockInput {
  title: string;
  copy?: string;
  maxWidthPx: number;
  fontSizePx: number;
  minFontSizePx?: number;
  maxLines?: number;
}

export interface FitTypeBlockResult {
  lines: string[];
  fontSizePx: number;
  /** Full block for a single text layer (lines joined with \\r) */
  text: string;
  /**
   * @deprecated Use `text` — kept as an alias of `text` for older callers.
   */
  headline: string;
  /** @deprecated Always empty; accents anchor to the single text block. */
  sub: string;
}

function linesFit(lines: string[], fontSizePx: number, maxWidthPx: number): boolean {
  return linesFitInBounds(lines, fontSizePx, maxWidthPx);
}

function toResult(lines: string[], fontSizePx: number): FitTypeBlockResult {
  const text = joinPhotoshopLines(lines);
  return { lines, fontSizePx, text, headline: text, sub: "" };
}

const ORPHAN_WORDS = new Set(["a", "an", "the", "to", "of", "in", "on", "at", "for", "and", "or"]);

/** Penalize ugly breaks: orphan articles, glued title+copy mid-phrase. */
function lineQualityPenalty(lines: string[], title?: string, copy?: string): number {
  let pen = 0;
  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 1 && ORPHAN_WORDS.has(words[0]!.toLowerCase())) pen += 40;
    if (words.length === 1 && words[0]!.length <= 3) pen += 15;
  }
  if (title && copy && lines.length >= 2) {
    const joined = lines.join(" ");
    // Prefer keeping copy as its own trailing line(s)
    const copyIdx = joined.indexOf(copy);
    if (copyIdx > 0) {
      const before = joined.slice(0, copyIdx).trim();
      if (before !== title && !before.endsWith(title)) {
        // copy glued after partial title on same visual line
        for (const line of lines) {
          if (line.includes(copy) && !line.trim().startsWith(copy) && line !== copy) {
            pen += 35; // e.g. "knows Find calm here."
          }
        }
      }
    }
  }
  return pen;
}

/**
 * Pack full text into at most `targetLines` at the given size.
 * Returns null if it cannot fit without overflowing a line.
 */
export function packIntoLines(
  text: string,
  opts: SmartWrapOptions & { targetLines: number },
): string[] | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const { targetLines, maxWidthPx, fontSizePx } = opts;

  if (targetLines <= 1) {
    if (estimateTextWidthPx(normalized, fontSizePx) <= maxWidthPx + 0.5) {
      return [normalized];
    }
    return null;
  }

  if (targetLines === 2) {
    const couplet = balancedTwoLineWrap(normalized, { maxWidthPx, fontSizePx });
    if (couplet && linesFit(couplet, fontSizePx, maxWidthPx)) {
      // Reject orphan-article first line when another split exists
      const w0 = couplet[0].split(/\s+/).filter(Boolean);
      if (!(w0.length === 1 && ORPHAN_WORDS.has(w0[0]!.toLowerCase()))) {
        return [...couplet];
      }
      // Try next-best couplet without orphan
      const words = normalized.split(" ");
      let best: [string, string] | null = null;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let i = 2; i < words.length; i++) {
        const a = words.slice(0, i).join(" ");
        const b = words.slice(i).join(" ");
        const wa = estimateTextWidthPx(a, fontSizePx);
        const wb = estimateTextWidthPx(b, fontSizePx);
        if (wa > maxWidthPx || wb > maxWidthPx) continue;
        const score = Math.abs(wa - wb);
        if (score < bestScore) {
          bestScore = score;
          best = [a, b];
        }
      }
      if (best && linesFit(best, fontSizePx, maxWidthPx)) return [...best];
    }
  }

  const greedy = wrapWordsToWidth(normalized, {
    maxWidthPx,
    fontSizePx,
    maxLines: targetLines,
  });
  if (
    greedy.length > 0 &&
    greedy.length <= targetLines &&
    linesFit(greedy, fontSizePx, maxWidthPx)
  ) {
    return greedy;
  }
  return null;
}

/**
 * Fit title (+ optional copy) preferring fewer lines and larger type.
 * Recalculates breaks for the given maxWidthPx (per-ratio type column).
 * When both title and copy exist, keep copy on its own line group — never
 * glue "knows Find calm here." Mid-phrase. Avoid orphan "The" lines.
 */
export function fitTypeBlock(input: FitTypeBlockInput): FitTypeBlockResult {
  const hardMax = input.maxLines ?? 3;
  const minSize = input.minFontSizePx ?? 72;
  const wantSize = Math.max(input.fontSizePx, minSize);
  const title = (input.title || "").replace(/\s+/g, " ").trim();
  const copy = (input.copy || "").replace(/\s+/g, " ").trim();
  const full = copy ? `${title} ${copy}`.trim() : title;
  const maxW = input.maxWidthPx;
  if (!full) return { lines: [], fontSizePx: wantSize, text: "", headline: "", sub: "" };

  let best: FitTypeBlockResult | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  function consider(lines: string[] | null, size: number, bonus = 0) {
    if (!lines || !linesFit(lines, size, maxW)) return;
    const n = lines.length;
    const penalty = lineQualityPenalty(lines, title || undefined, copy || undefined);
    const score = size * 10 - n * 12 + bonus - penalty;
    if (score > bestScore) {
      bestScore = score;
      best = toResult(lines, size);
    }
  }

  // --- Phrase-aware path: title block + copy block (copy never mid-glued) ---
  if (title && copy) {
    for (let size = wantSize; size >= minSize; size -= 2) {
      // 1) Title one line + copy one line
      if (
        estimateTextWidthPx(title, size) <= maxW + 0.5 &&
        estimateTextWidthPx(copy, size) <= maxW + 0.5
      ) {
        consider([title, copy], size, 50);
        break; // best possible phrase layout at the largest size that fits
      }

      // 2) Title as balanced 2 lines + copy on its own line (≤3)
      const titleCouplet = packIntoLines(title, {
        maxWidthPx: maxW,
        fontSizePx: size,
        targetLines: 2,
      });
      if (
        titleCouplet &&
        titleCouplet.length === 2 &&
        estimateTextWidthPx(copy, size) <= maxW + 0.5 &&
        hardMax >= 3
      ) {
        const orphan =
          titleCouplet[0]!.split(/\s+/).filter(Boolean).length === 1 &&
          ORPHAN_WORDS.has(titleCouplet[0]!.split(/\s+/)[0]!.toLowerCase());
        if (!orphan) {
          consider([...titleCouplet, copy], size, 45);
          // Keep scanning smaller only if we don't have a hit yet
          if (best && bestScore >= size * 10 + 30) break;
        }
      }
    }
  }

  // --- Full-string path (single field or fallback) ---
  const preferred = Math.min(hardMax, preferredMaxLines(full));
  for (let n = 1; n <= preferred; n++) {
    for (let size = wantSize; size >= minSize; size -= 2) {
      const lines = packIntoLines(full, {
        maxWidthPx: maxW,
        fontSizePx: size,
        targetLines: n,
      });
      consider(lines, size, title && copy && n === 2 ? 10 : 0);
      if (lines && linesFit(lines, size, maxW) && lineQualityPenalty(lines, title, copy) < 20) {
        break;
      }
    }
  }

  if (!best || lineQualityPenalty(best.lines, title, copy) >= 30) {
    for (let n = 1; n <= hardMax; n++) {
      for (let size = wantSize; size >= minSize; size -= 2) {
        const lines = packIntoLines(full, {
          maxWidthPx: maxW,
          fontSizePx: size,
          targetLines: n,
        });
        consider(lines, size);
        if (lines && linesFit(lines, size, maxW) && lineQualityPenalty(lines, title, copy) < 20) {
          break;
        }
      }
    }
  }

  if (best) return best;

  // Last resort: shrink until longest word fits, then greedy wrap
  let size = wantSize;
  const longest = full.split(/\s+/).reduce((a, b) => (a.length >= b.length ? a : b), "");
  while (size > minSize && estimateTextWidthPx(longest, size) > maxW) {
    size -= 2;
  }
  const fallback = wrapWordsToWidth(full, {
    maxWidthPx: maxW,
    fontSizePx: Math.max(size, minSize),
    maxLines: hardMax,
  });
  return toResult(fallback, Math.max(size, minSize));
}

