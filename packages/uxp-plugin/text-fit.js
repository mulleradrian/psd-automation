/**
 * Browser/UXP copy of fitTypeBlock (keep in sync with packages/shared/src/text-wrap.ts).
 * Prefers fewer lines + larger type; phrase-aware title|copy; no orphan "The".
 */
(function (global) {
  function charFactor(ch) {
    if (ch === " ") return 0.28;
    if ("ilI.,:;'’!|".includes(ch)) return 0.32;
    if ("ftj()[]r".includes(ch)) return 0.4;
    if ("mwMW@".includes(ch)) return 0.9;
    if ("ABCDEFGHOKQUNVRXYZ".includes(ch)) return 0.72;
    return 0.56;
  }

  var WIDTH_SAFETY = 1.12;
  var ORPHAN_WORDS = { a: 1, an: 1, the: 1, to: 1, of: 1, in: 1, on: 1, at: 1, for: 1, and: 1, or: 1 };

  function estimateTextWidthPx(text, fontSizePx) {
    var w = 0;
    for (var i = 0; i < text.length; i++) w += fontSizePx * charFactor(text.charAt(i));
    return w * WIDTH_SAFETY;
  }

  function linesFitInBounds(lines, fontSizePx, maxWidthPx) {
    for (var i = 0; i < lines.length; i++) {
      if (estimateTextWidthPx(lines[i], fontSizePx) > maxWidthPx + 0.5) return false;
      var words = lines[i].split(/\s+/);
      for (var j = 0; j < words.length; j++) {
        if (!words[j]) continue;
        if (estimateTextWidthPx(words[j], fontSizePx) > maxWidthPx + 0.5) return false;
      }
    }
    return true;
  }

  function wrapWordsToWidth(text, opts) {
    var normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return [];
    var words = normalized.split(" ");
    var lines = [];
    var current = "";
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      var trial = current ? current + " " + word : word;
      if (!current || estimateTextWidthPx(trial, opts.fontSizePx) <= opts.maxWidthPx) {
        current = trial;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    if (opts.maxLines && lines.length > opts.maxLines) {
      var head = lines.slice(0, opts.maxLines - 1);
      var tail = lines.slice(opts.maxLines - 1).join(" ");
      return head.concat([tail]);
    }
    return lines;
  }

  function balancedTwoLineWrap(text, opts) {
    var words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
    if (words.length < 2) return null;
    var best = null;
    var bestScore = Infinity;
    for (var i = 1; i < words.length; i++) {
      var a = words.slice(0, i).join(" ");
      var b = words.slice(i).join(" ");
      var wa = estimateTextWidthPx(a, opts.fontSizePx);
      var wb = estimateTextWidthPx(b, opts.fontSizePx);
      if (wa > opts.maxWidthPx || wb > opts.maxWidthPx) continue;
      var score = Math.abs(wa - wb);
      if (score < bestScore) {
        bestScore = score;
        best = [a, b];
      }
    }
    return best;
  }

  function preferredMaxLines(text) {
    var normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return 1;
    var chars = normalized.length;
    var words = normalized.split(" ").length;
    if (chars <= 18 || words <= 2) return 1;
    if (chars <= 42 || words <= 6) return 2;
    return 3;
  }

  function toResult(lines, fontSizePx) {
    var text = lines.join("\r");
    return { lines: lines, fontSizePx: fontSizePx, text: text, headline: text, sub: "" };
  }

  function lineQualityPenalty(lines, title, copy) {
    var pen = 0;
    for (var i = 0; i < lines.length; i++) {
      var words = lines[i].split(/\s+/).filter(Boolean);
      if (words.length === 1 && ORPHAN_WORDS[words[0].toLowerCase()]) pen += 40;
      if (words.length === 1 && words[0].length <= 3) pen += 15;
    }
    if (title && copy && lines.length >= 2) {
      for (var j = 0; j < lines.length; j++) {
        var line = lines[j];
        if (line.indexOf(copy) >= 0 && line.trim() !== copy && line.indexOf(copy) > 0) {
          pen += 35;
        }
      }
    }
    return pen;
  }

  function packIntoLines(text, opts) {
    var normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return [];
    var targetLines = opts.targetLines;
    var maxW = opts.maxWidthPx;
    var size = opts.fontSizePx;
    if (targetLines <= 1) {
      if (estimateTextWidthPx(normalized, size) <= maxW + 0.5) return [normalized];
      return null;
    }
    if (targetLines === 2) {
      var couplet = balancedTwoLineWrap(normalized, { maxWidthPx: maxW, fontSizePx: size });
      if (couplet && linesFitInBounds(couplet, size, maxW)) {
        var w0 = couplet[0].split(/\s+/).filter(Boolean);
        if (!(w0.length === 1 && ORPHAN_WORDS[w0[0].toLowerCase()])) {
          return couplet.slice();
        }
        var words = normalized.split(" ");
        var best = null;
        var bestScore = Infinity;
        for (var i = 2; i < words.length; i++) {
          var a = words.slice(0, i).join(" ");
          var b = words.slice(i).join(" ");
          var wa = estimateTextWidthPx(a, size);
          var wb = estimateTextWidthPx(b, size);
          if (wa > maxW || wb > maxW) continue;
          var score = Math.abs(wa - wb);
          if (score < bestScore) {
            bestScore = score;
            best = [a, b];
          }
        }
        if (best && linesFitInBounds(best, size, maxW)) return best.slice();
      }
    }
    var greedy = wrapWordsToWidth(normalized, {
      maxWidthPx: maxW,
      fontSizePx: size,
      maxLines: targetLines,
    });
    if (greedy.length > 0 && greedy.length <= targetLines && linesFitInBounds(greedy, size, maxW)) {
      return greedy;
    }
    return null;
  }

  function fitTypeBlock(input) {
    var hardMax = input.maxLines || 3;
    var minSize = input.minFontSizePx != null ? input.minFontSizePx : 72;
    var wantSize = Math.max(input.fontSizePx || 86, minSize);
    var title = String(input.title || "").replace(/\s+/g, " ").trim();
    var copy = String(input.copy || "").replace(/\s+/g, " ").trim();
    var full = copy ? (title + " " + copy).trim() : title;
    var maxW = input.maxWidthPx;
    if (!full) return { lines: [], fontSizePx: wantSize, text: "", headline: "", sub: "" };

    var best = null;
    var bestScore = -Infinity;

    function consider(lines, size, bonus) {
      if (!lines || !linesFitInBounds(lines, size, maxW)) return;
      var score = size * 10 - lines.length * 12 + (bonus || 0) - lineQualityPenalty(lines, title, copy);
      if (score > bestScore) {
        bestScore = score;
        best = toResult(lines, size);
      }
    }

    if (title && copy) {
      for (var sizeT = wantSize; sizeT >= minSize; sizeT -= 2) {
        if (
          estimateTextWidthPx(title, sizeT) <= maxW + 0.5 &&
          estimateTextWidthPx(copy, sizeT) <= maxW + 0.5
        ) {
          consider([title, copy], sizeT, 50);
          break;
        }
        var titleCouplet = packIntoLines(title, {
          maxWidthPx: maxW,
          fontSizePx: sizeT,
          targetLines: 2,
        });
        if (
          titleCouplet &&
          titleCouplet.length === 2 &&
          estimateTextWidthPx(copy, sizeT) <= maxW + 0.5 &&
          hardMax >= 3
        ) {
          var firstWords = titleCouplet[0].split(/\s+/).filter(Boolean);
          var orphan = firstWords.length === 1 && ORPHAN_WORDS[firstWords[0].toLowerCase()];
          if (!orphan) {
            consider(titleCouplet.concat([copy]), sizeT, 45);
            if (best && bestScore >= sizeT * 10 + 30) break;
          }
        }
      }
    }

    var preferred = Math.min(hardMax, preferredMaxLines(full));
    for (var n = 1; n <= preferred; n++) {
      for (var size = wantSize; size >= minSize; size -= 2) {
        var lines = packIntoLines(full, { maxWidthPx: maxW, fontSizePx: size, targetLines: n });
        consider(lines, size, title && copy && n === 2 ? 10 : 0);
        if (lines && linesFitInBounds(lines, size, maxW) && lineQualityPenalty(lines, title, copy) < 20) {
          break;
        }
      }
    }

    if (!best || lineQualityPenalty(best.lines, title, copy) >= 30) {
      for (var n2 = 1; n2 <= hardMax; n2++) {
        for (var size2 = wantSize; size2 >= minSize; size2 -= 2) {
          var lines2 = packIntoLines(full, {
            maxWidthPx: maxW,
            fontSizePx: size2,
            targetLines: n2,
          });
          consider(lines2, size2);
          if (
            lines2 &&
            linesFitInBounds(lines2, size2, maxW) &&
            lineQualityPenalty(lines2, title, copy) < 20
          ) {
            break;
          }
        }
      }
    }

    if (best) return best;

    var sizeF = wantSize;
    var parts = full.split(/\s+/);
    var longest = parts[0] || "";
    for (var i = 1; i < parts.length; i++) {
      if (parts[i].length > longest.length) longest = parts[i];
    }
    while (sizeF > minSize && estimateTextWidthPx(longest, sizeF) > maxW) sizeF -= 2;
    var fallback = wrapWordsToWidth(full, {
      maxWidthPx: maxW,
      fontSizePx: Math.max(sizeF, minSize),
      maxLines: hardMax,
    });
    return toResult(fallback, Math.max(sizeF, minSize));
  }

  global.P10TextFit = {
    estimateTextWidthPx: estimateTextWidthPx,
    wrapWordsToWidth: wrapWordsToWidth,
    linesFitInBounds: linesFitInBounds,
    preferredMaxLines: preferredMaxLines,
    packIntoLines: packIntoLines,
    fitTypeBlock: fitTypeBlock,
  };
})(typeof window !== "undefined" ? window : globalThis);
