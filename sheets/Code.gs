/**
 * Google Apps Script — attach to the Social Media Content Calendar spreadsheet.
 *
 * Install:
 * 1. Extensions → Apps Script
 * 2. Paste this file
 * 3. Reload the spreadsheet — menu "PSD Automation" appears
 *
 * The menu only writes Jobs rows (Queued). A Windows tray/CLI on the render PC
 * polls Jobs / local queue and drives Photoshop. Apps Script cannot talk to Photoshop.
 */

var MACHINE_TABS = [
  "Content_DB",
  "Brand_Kits",
  "Templates",
  "Layer_Bindings",
  "Jobs",
];

var HOTEL1_GID = 690745977;
var HOTEL1_TAB_ALIASES = ["Hotel 1", "Hotel1", "hotel_1"];

/**
 * Case-insensitive header aliases → Content_DB field (see docs/hotel1-column-map.md).
 * Copy is OPTIONAL — PSD has one text box; Title alone is enough. Copy (if present)
 * is merged into the same box as a second phrase / line group.
 */
var HOTEL1_FIELD_ALIASES = {
  Content_ID: ["Content_ID", "Content ID", "ID", "Post ID", "QW", "Post#", "Post #"],
  Property: ["Property", "Hotel", "Brand"],
  Publish_Date: ["Publish_Date", "Publish Date", "Date", "Week", "Go Live", "Go-Live"],
  Title: [
    "Title",
    "Headline",
    "Hook",
    "Post",
    "Post Title",
    "Caption",
    "Text",
    "Message",
    "Content",
    "Primary Text",
    "EN Title",
    "English",
  ],
  // Optional second phrase — NOT a second PSD layer
  Copy: ["Copy", "Body", "Sub", "Subtitle", "Subhead", "Supporting", "Secondary"],
  Copy_ZH: ["Copy_ZH", "Copy ZH", "中文", "ZH", "Chinese"],
  Hashtags: ["Hashtags", "Tags", "Hash Tags"],
  Platforms: ["Platforms", "Channel", "Platform"],
  // Explicit ratio list OR asset-description multi-select (parsed separately)
  Ratios: [
    "Ratios",
    "Ratio",
    "Formats",
    "Aspect",
    "Aspect Ratio",
    "Aspect Ratios",
    "Asset Description",
    "Asset Descriptions",
    "Assets",
    "Asset",
    "Output",
    "Outputs",
    "Sizes",
    "Size",
  ],
  Hero_File: ["Hero_File", "Hero", "Hero File"],
  Bg_File: ["Bg_File", "BG", "Bg", "Background", "Plate", "BG #", "Bg #"],
  Status: ["Status"],
  Preview_URL: ["Preview_URL", "Preview URL", "Preview Link", "Preview"],
};

/** Canonical ratios we understand. Never invent the full set as a default. */
var KNOWN_RATIOS = ["4:5", "1:1", "9:16", "16:9"];
var RATIO_TOKEN_RE = /\b(4\s*[:x×]\s*5|1\s*[:x×]\s*1|9\s*[:x×]\s*16|16\s*[:x×]\s*9)\b/gi;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("PSD Automation")
    .addItem("Ensure machine tabs", "ensureMachineTabs")
    .addItem("Sync Hotel 1 → Content_DB", "syncHotel1ToContentDb")
    .addItem("Queue selected Content_IDs", "queueSelectedContentIds")
    .addItem("Queue all Approved rows", "queueApproved")
    .addItem("Queue Approved for this week", "queueApprovedThisWeek")
    .addSeparator()
    .addItem("Seed sample Q1_W1_01", "seedSampleRow")
    .addToUi();
}

function ensureMachineTabs() {
  var ss = SpreadsheetApp.getActive();
  var headers = {
    Content_DB: [
      "Content_ID",
      "Property",
      "Publish_Date",
      "Title",
      "Copy",
      "Copy_ZH",
      "Hashtags",
      "Platforms",
      "Ratios",
      "Template_ID",
      "WorkingSet_Folder_ID",
      "WorkingSet_Path",
      "Hero_File",
      "Bg_File",
      "Content_Group_ID",
      "Status",
      "Preview_URL",
      "Render_Error",
    ],
    Brand_Kits: [
      "Property",
      "color_bg",
      "color_accent",
      "color_type",
      "font_headline",
      "font_body",
      "logo_file_id",
      "logo_filename",
      "default_template_4x5",
      "default_template_1x1",
      "default_template_9x16",
      "default_template_16x9",
    ],
    Templates: [
      "Template_ID",
      "Master_PSD_Drive_ID",
      "Master_PSD_Path",
      "Ratio",
      "Artboard",
      "Photoshop_Min_Version",
    ],
    Layer_Bindings: ["Template_ID", "layer_name", "kind", "field"],
    Jobs: [
      "Job_ID",
      "Content_ID",
      "Requested_By",
      "Status",
      "Worker",
      "Parent_Job_ID",
      "Template_ID",
      "Ratio",
      "Created_At",
      "Updated_At",
      "Output_Links",
      "Error",
    ],
  };

  MACHINE_TABS.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers[name]);
      sheet.setFrozenRows(1);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers[name]);
      sheet.setFrozenRows(1);
    }
  });
  SpreadsheetApp.getUi().alert("Machine tabs ready: " + MACHINE_TABS.join(", "));
}

function getSheetOrThrow(name) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) {
    throw new Error("Missing tab " + name + " — run Ensure machine tabs first");
  }
  return sheet;
}

function sheetToObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      obj[header[c]] = values[i][c];
    }
    if (obj.Content_ID || obj.Property || obj.Template_ID || obj.Job_ID) {
      rows.push(obj);
    }
  }
  return rows;
}

function appendJob(contentId, worker, ratio, parentId) {
  var jobs = getSheetOrThrow("Jobs");
  var now = new Date().toISOString();
  var jobId = "job_" + Utilities.getUuid().slice(0, 8) + "_" + String(ratio).replace(":", "x");
  jobs.appendRow([
    jobId,
    contentId,
    Session.getActiveUser().getEmail(),
    "Queued",
    worker || "uxp",
    parentId || jobId,
    "",
    ratio || "",
    now,
    now,
    "",
    "",
  ]);
  return jobId;
}

function queueContentIds(ids, worker) {
  ensureMachineTabs();
  var contentSheet = getSheetOrThrow("Content_DB");
  var rows = sheetToObjects(contentSheet);
  var queued = 0;
  var skippedNoRatios = [];
  var missing = [];
  ids.forEach(function (id) {
    var row = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].Content_ID) === String(id)) {
        row = rows[i];
        break;
      }
    }
    if (!row) {
      missing.push(String(id));
      return;
    }
    var parentId = "job_" + Utilities.getUuid().slice(0, 8);
    var ratios = String(row.Ratios || "")
      .split(/[,;|/]+/)
      .map(function (r) {
        return r.trim();
      })
      .filter(Boolean);
    if (!ratios.length) {
      skippedNoRatios.push(String(id));
      return;
    }
    ratios.forEach(function (ratio) {
      appendJob(id, worker || "uxp", ratio, parentId);
      queued++;
    });
  });
  var msg = "Queued " + queued + " job row(s).";
  if (skippedNoRatios.length) {
    msg +=
      "\n\nSkipped (blank Ratios — no invented 4:5):\n" + skippedNoRatios.slice(0, 12).join(", ");
  }
  if (missing.length) {
    msg += "\n\nMissing Content_ID:\n" + missing.slice(0, 12).join(", ");
  }
  SpreadsheetApp.getUi().alert(msg);
}

function queueSelectedContentIds() {
  var sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== "Content_DB") {
    SpreadsheetApp.getUi().alert("Select rows on the Content_DB tab");
    return;
  }
  var range = sheet.getActiveRange();
  var values = range.getValues();
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idCol = header.indexOf("Content_ID");
  if (idCol < 0) {
    SpreadsheetApp.getUi().alert("Content_ID column missing");
    return;
  }
  var ids = [];
  values.forEach(function (row) {
    if (row[idCol]) ids.push(String(row[idCol]));
  });
  queueContentIds(ids, "uxp");
}

function queueApproved() {
  ensureMachineTabs();
  var rows = sheetToObjects(getSheetOrThrow("Content_DB"));
  var ids = rows
    .filter(function (r) {
      return String(r.Status).toLowerCase() === "approved";
    })
    .map(function (r) {
      return String(r.Content_ID);
    });
  queueContentIds(ids, "uxp");
}

function queueApprovedThisWeek() {
  ensureMachineTabs();
  var rows = sheetToObjects(getSheetOrThrow("Content_DB"));
  var now = new Date();
  var start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  var ids = rows
    .filter(function (r) {
      if (String(r.Status).toLowerCase() !== "approved") return false;
      var d = new Date(r.Publish_Date);
      if (isNaN(d.getTime())) return true;
      return d >= start;
    })
    .map(function (r) {
      return String(r.Content_ID);
    });
  queueContentIds(ids, "uxp");
}

function seedSampleRow() {
  ensureMachineTabs();
  var content = getSheetOrThrow("Content_DB");
  var existing = sheetToObjects(content);
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].Content_ID === "Q1_W1_01") {
      SpreadsheetApp.getUi().alert("Q1_W1_01 already present");
      return;
    }
  }
  content.appendRow([
    "Q1_W1_01",
    "hotel_1",
    "1.1.26",
    "Unlock the peace you deserve",
    "Find calm in every stay.",
    "在每一次住宿中找到平静。",
    "#peace #stay #hotel",
    "Instagram,TikTok,Facebook,Red Book",
    "4:5,1:1",
    "",
    "1IjyC-xQ1-1ctnDCE2TGUzJJsl0Xs-JPG",
    "",
    "hero.jpg",
    "bg.jpg",
    "",
    "Approved",
    "",
    "",
  ]);

  var brands = getSheetOrThrow("Brand_Kits");
  if (brands.getLastRow() < 2) {
    brands.appendRow([
      "hotel_1",
      "#F5F0E8",
      "#1A1A1A",
      "#111111",
      "MyriadPro-Bold",
      "MyriadPro-Regular",
      "",
      "logo.png",
      "tpl_ig_4x5",
      "tpl_ig_1x1",
      "tpl_story_9x16",
      "tpl_cover_16x9",
    ]);
  }

  SpreadsheetApp.getUi().alert("Seeded Q1_W1_01 + Brand_Kits sample");
}

function findHotel1Sheet() {
  var ss = SpreadsheetApp.getActive();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === HOTEL1_GID) return sheets[i];
  }
  for (var a = 0; a < HOTEL1_TAB_ALIASES.length; a++) {
    var byName = ss.getSheetByName(HOTEL1_TAB_ALIASES[a]);
    if (byName) return byName;
  }
  return null;
}

function normalizeHeaderKey(h) {
  return String(h || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
}

function buildHotel1ColumnIndex(headerRow) {
  var index = {};
  var normToCol = {};
  for (var c = 0; c < headerRow.length; c++) {
    var key = normalizeHeaderKey(headerRow[c]);
    if (!key) continue;
    // First occurrence wins (avoid overwriting when duplicate empty headers)
    if (normToCol[key] == null) normToCol[key] = c;
  }
  var fields = Object.keys(HOTEL1_FIELD_ALIASES);
  for (var f = 0; f < fields.length; f++) {
    var field = fields[f];
    var aliases = HOTEL1_FIELD_ALIASES[field];
    for (var i = 0; i < aliases.length; i++) {
      var col = normToCol[normalizeHeaderKey(aliases[i])];
      if (col != null) {
        index[field] = col;
        break;
      }
    }
  }
  return index;
}

/** Find the header row within the first N rows (calendars often have title banners above). */
function findHotel1HeaderRow(values, maxScan) {
  var limit = Math.min(values.length, maxScan || 8);
  var best = null;
  var bestScore = -1;
  var bestIdx = 0;
  for (var r = 0; r < limit; r++) {
    var idx = buildHotel1ColumnIndex(values[r]);
    var score = 0;
    if (idx.Title != null) score += 3;
    if (idx.Copy != null) score += 1;
    if (idx.Content_ID != null) score += 2;
    if (idx.Publish_Date != null) score += 1;
    if (idx.Bg_File != null) score += 1;
    if (idx.Ratios != null) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = idx;
      bestIdx = r;
    }
  }
  return { headerRowIndex: bestIdx, colIndex: best, score: bestScore };
}

function hotel1HeaderPreview(headerRow) {
  var names = [];
  for (var c = 0; c < headerRow.length; c++) {
    var h = String(headerRow[c] || "").trim();
    if (h) names.push(h);
  }
  return names.length ? names.join(" | ") : "(no non-empty headers)";
}

function cellLooksLikeUrl(val) {
  var s = String(val || "").trim();
  return /^https?:\/\//i.test(s) || /drive\.google\.com/i.test(s);
}

function normalizeRatioToken(raw) {
  var s = String(raw || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[×x]/g, ":");
  if (s === "4:5") return "4:5";
  if (s === "1:1") return "1:1";
  if (s === "9:16") return "9:16";
  if (s === "16:9") return "16:9";
  return "";
}

function cellIsTruthySelection(val) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0 || val == null || val === "") return false;
  var s = String(val).trim().toLowerCase();
  if (!s) return false;
  if (
    s === "false" ||
    s === "no" ||
    s === "n" ||
    s === "0" ||
    s === "off" ||
    s === "unchecked" ||
    s === "-"
  ) {
    return false;
  }
  // Checkbox TRUE, "x", "✓", "yes", or the ratio itself written in the cell
  return true;
}

/**
 * Extract selected ratios from Hotel 1 — never invents a full default set.
 * Sources (in order):
 * 1) Dedicated Ratios / Asset Description cell text (tokens like 4:5, 1:1…)
 * 2) Per-ratio checkbox / mark columns whose header is a known ratio
 * 3) Any other cell in the row that clearly lists ratio tokens (last resort)
 */
function extractRatiosFromHotelRow(values, headerRow, colIndex) {
  var found = [];
  var seen = {};

  function add(ratio) {
    var r = normalizeRatioToken(ratio);
    if (!r || seen[r]) return;
    seen[r] = true;
    found.push(r);
  }

  function addFromText(text) {
    if (text == null || text === "") return;
    var s = String(text);
    var m;
    RATIO_TOKEN_RE.lastIndex = 0;
    while ((m = RATIO_TOKEN_RE.exec(s))) {
      add(m[1]);
    }
  }

  // 1) Mapped Ratios / Asset Description column
  if (colIndex.Ratios != null) {
    addFromText(values[colIndex.Ratios]);
  }

  // 2) Columns whose header IS a ratio (checkbox / multi-select layout)
  for (var c = 0; c < headerRow.length; c++) {
    var headerRatio = normalizeRatioToken(headerRow[c]);
    if (!headerRatio) continue;
    if (cellIsTruthySelection(values[c])) add(headerRatio);
  }

  // 3) REMOVED: whole-row scan that could pick stray ratio tokens from unrelated cells.
  // Only Asset Description / Ratios column + explicit ratio checkbox headers count.

  return found;
}

function hotel1RowToContent(values, headerRow, colIndex, rowNumber) {
  function get(field) {
    var c = colIndex[field];
    if (c == null) return "";
    var v = values[c];
    return v == null ? "" : v;
  }
  function getTrimmed(field) {
    return String(get(field) || "").trim();
  }

  // Single PSD text box: Title is primary; Copy is optional second phrase
  var title = getTrimmed("Title");
  var copy = getTrimmed("Copy");
  if (!title && !copy) return null;
  if (!title && copy) {
    title = copy;
    copy = "";
  }

  var warnings = [];
  var idRaw = getTrimmed("Content_ID");
  var idSynthesized = false;
  var baseId = idRaw;
  if (!baseId) {
    baseId = "H1_R" + rowNumber;
    idSynthesized = true;
    warnings.push("Content_ID synthesized (" + baseId + ")");
  }

  var property = getTrimmed("Property");
  if (!property) {
    if (colIndex.Property == null) {
      property = "hotel_1";
      warnings.push("Property set from Hotel 1 tab (no Property column)");
    } else {
      warnings.push("Property blank in Hotel 1");
    }
  }

  var bgRaw = String(get("Bg_File") || "").replace(/\D/g, "");
  var bg = bgRaw;

  var previewRaw = get("Preview_URL");
  var previewUrl = cellLooksLikeUrl(previewRaw) ? String(previewRaw).trim() : "";

  var ratios = extractRatiosFromHotelRow(values, headerRow, colIndex);
  if (!ratios.length) {
    warnings.push("Ratios missing (Asset Description / ratio columns)");
  }

  var platformsRaw = getTrimmed("Platforms");
  if (!platformsRaw && colIndex.Platforms != null) {
    warnings.push("Platforms blank in Hotel 1");
  } else if (!platformsRaw && colIndex.Platforms == null) {
    warnings.push("no Platforms column");
  }

  var statusRaw = getTrimmed("Status");

  return {
    baseId: baseId,
    ratios: ratios,
    Property: property,
    Publish_Date: get("Publish_Date"),
    Title: title,
    Copy: copy,
    Copy_ZH: get("Copy_ZH"),
    Hashtags: get("Hashtags"),
    Platforms: platformsRaw,
    Template_ID: "",
    WorkingSet_Folder_ID: "",
    WorkingSet_Path: "",
    Hero_File: get("Hero_File"),
    Bg_File: bg,
    Status: statusRaw,
    Preview_URL: previewUrl,
    Render_Error: "",
    _idSynthesized: idSynthesized,
    _warnings: warnings,
  };
}

/** One Hotel row → N Content_DB rows (one per selected ratio). one row = one variant. */
function forkHotelRowToVariantRows(base) {
  if (!base) return [];
  var ratios = base.ratios || [];
  if (!ratios.length) {
    // No invent: one stub row with blank Ratios so gaps are visible
    return [
      Object.assign({}, base, {
        Content_ID: base.baseId,
        Content_Group_ID: base.baseId,
        Ratios: "",
      }),
    ];
  }
  return ratios.map(function (ratio) {
    var key = String(ratio).replace(":", "x");
    return Object.assign({}, base, {
      Content_ID: base.baseId + "_" + key,
      Content_Group_ID: base.baseId,
      Ratios: ratio, // single ratio only
    });
  });
}

/** Sheet.getRange(r,c,numRows,numCols) — always pass counts, not end indices. */
function contentRowRange_(sheet, row, numCols) {
  return sheet.getRange(row, 1, 1, numCols);
}

function contentIdColumnRange_(sheet, idCol1Based, firstDataRow, lastRow) {
  var n = Math.max(0, lastRow - firstDataRow + 1);
  if (n < 1) return null;
  return sheet.getRange(firstDataRow, idCol1Based, n, 1);
}

/**
 * Structured sync only — never scrapes merged decorative calendar cells.
 * Forks each Hotel 1 row into one Content_DB row per selected ratio (one row = one variant).
 */
function syncHotel1ToContentDb() {
  try {
    ensureMachineTabs();
    var hotel = findHotel1Sheet();
    if (!hotel) {
      SpreadsheetApp.getUi().alert(
        "Hotel 1 tab not found (gid " +
          HOTEL1_GID +
          " or name Hotel 1).\n\nOpen the Hotel 1 sheet tab and try again.",
      );
      return;
    }
    var content = getSheetOrThrow("Content_DB");
    var hotelValues = hotel.getDataRange().getValues();
    if (hotelValues.length < 2) {
      SpreadsheetApp.getUi().alert("Hotel 1 has no data rows");
      return;
    }

    var found = findHotel1HeaderRow(hotelValues, 8);
    var colIndex = found.colIndex;
    var headerRowIndex = found.headerRowIndex;

    if (!colIndex || colIndex.Title == null) {
      SpreadsheetApp.getUi().alert(
        "Hotel 1 needs a Title column (Copy is optional).\n\n" +
          "Looked in first " +
          Math.min(8, hotelValues.length) +
          " rows.\n" +
          "Best header row " +
          (headerRowIndex + 1) +
          " columns:\n" +
          hotel1HeaderPreview(hotelValues[headerRowIndex]) +
          "\n\nRename your text column to Title (or Headline / Hook / Post / Caption / Text),\n" +
          "or add a Title header. See docs/hotel1-column-map.md",
      );
      return;
    }

    var lastCol = Math.max(1, content.getLastColumn());
    var contentHeader = content.getRange(1, 1, 1, lastCol).getValues()[0];
    var idCol = contentHeader.indexOf("Content_ID");
    if (idCol < 0) {
      SpreadsheetApp.getUi().alert("Content_DB missing Content_ID");
      return;
    }

    var existing = {};
    var lastRow = content.getLastRow();
    if (lastRow >= 2) {
      var idRange = contentIdColumnRange_(content, idCol + 1, 2, lastRow);
      if (idRange) {
        var ids = idRange.getValues();
        for (var r = 0; r < ids.length; r++) {
          var cid = String(ids[r][0] || "").trim();
          if (cid) existing[cid] = r + 2;
        }
      }
    }

    var upserted = 0;
    var created = 0;
    var skipped = 0;
    var forked = 0;
    var missingRatios = 0;
    var missingPlatforms = 0;
    var missingBg = 0;
    var missingStatus = 0;
    var synthesizedIds = 0;
    var ratioSamples = [];
    var warningSamples = [];
    var now = new Date().toISOString();
    var headerRow = hotelValues[headerRowIndex];
    var numCols = contentHeader.length;
    var MACHINE_ONLY = {
      Preview_URL: true,
      Render_Error: true,
      WorkingSet_Folder_ID: true,
      WorkingSet_Path: true,
      Template_ID: true,
    };

    function upsertMappedRow(mapped) {
      if (!mapped.Platforms) missingPlatforms++;
      if (!mapped.Bg_File) missingBg++;
      if (!mapped.Status) missingStatus++;
      if (mapped._idSynthesized) synthesizedIds++;
      if (ratioSamples.length < 8 && mapped.Ratios) {
        ratioSamples.push(mapped.Content_ID + "=" + mapped.Ratios);
      }
      if (mapped._warnings && mapped._warnings.length && warningSamples.length < 8) {
        warningSamples.push(mapped.Content_ID + ": " + mapped._warnings.join("; "));
      }

      var rowVals = contentHeader.map(function (h) {
        if (!h || String(h).charAt(0) === "_") return "";
        return mapped[h] != null ? mapped[h] : "";
      });
      // Pad / trim to header width
      while (rowVals.length < numCols) rowVals.push("");
      if (rowVals.length > numCols) rowVals = rowVals.slice(0, numCols);

      var dest = existing[mapped.Content_ID];
      if (dest) {
        var cur = contentRowRange_(content, dest, numCols).getValues()[0];
        for (var c = 0; c < numCols; c++) {
          var key = contentHeader[c];
          if (
            MACHINE_ONLY[key] &&
            (rowVals[c] === "" || rowVals[c] == null) &&
            cur[c] !== "" &&
            cur[c] != null
          ) {
            rowVals[c] = cur[c];
          }
          if (key === "Status" && (mapped.Status === "" || mapped.Status == null)) {
            rowVals[c] = cur[c];
          }
          if (
            key === "Ratios" ||
            key === "Platforms" ||
            key === "Bg_File" ||
            key === "Title" ||
            key === "Copy" ||
            key === "Property" ||
            key === "Content_Group_ID"
          ) {
            rowVals[c] = mapped[key] != null ? mapped[key] : "";
          }
        }
        contentRowRange_(content, dest, numCols).setValues([rowVals]);
        upserted++;
      } else {
        content.appendRow(rowVals);
        existing[mapped.Content_ID] = content.getLastRow();
        created++;
      }
    }

    for (var i = headerRowIndex + 1; i < hotelValues.length; i++) {
      var base = hotel1RowToContent(hotelValues[i], headerRow, colIndex, i + 1);
      if (!base) {
        skipped++;
        continue;
      }
      if (!base.ratios.length) missingRatios++;

      var variants = forkHotelRowToVariantRows(base);
      if (variants.length > 1) forked += variants.length;
      for (var v = 0; v < variants.length; v++) {
        upsertMappedRow(variants[v]);
      }

      // Clear legacy un-forked row (same base id with multi-ratio cell) if present
      if (existing[base.baseId] && base.ratios.length) {
        var legacyRow = existing[base.baseId];
        var legacyVals = contentRowRange_(content, legacyRow, numCols).getValues()[0];
        var ratiosIdx = contentHeader.indexOf("Ratios");
        var legacyRatios = ratiosIdx >= 0 ? String(legacyVals[ratiosIdx] || "") : "";
        if (legacyRatios.indexOf(",") >= 0 || legacyRatios.indexOf(";") >= 0) {
          // Blank the legacy multi-ratio row so it doesn't expand to phantom variants
          if (ratiosIdx >= 0) legacyVals[ratiosIdx] = "";
          var titleIdx = contentHeader.indexOf("Title");
          if (titleIdx >= 0) {
            legacyVals[titleIdx] =
              String(legacyVals[titleIdx] || "") + " [legacy — use forked rows]";
          }
          contentRowRange_(content, legacyRow, numCols).setValues([legacyVals]);
        }
      }
    }

    PropertiesService.getDocumentProperties().setProperty("hotel1_last_sync", now);

    var msg =
      "Hotel 1 → Content_DB\n" +
      "one row = one variant (forked by selected ratios)\n" +
      "Updated: " +
      upserted +
      " | Created: " +
      created +
      " | Skipped empty: " +
      skipped +
      " | Forked cells: " +
      forked +
      "\nHeader row: " +
      (headerRowIndex + 1) +
      "\nMapped: Title=" +
      (colIndex.Title != null ? "yes" : "NO") +
      " Ratios/AssetDesc=" +
      (colIndex.Ratios != null ? String(headerRow[colIndex.Ratios]) : "no") +
      " Platforms=" +
      (colIndex.Platforms != null ? "yes" : "no") +
      " BG=" +
      (colIndex.Bg_File != null ? "yes" : "no") +
      "\nGaps — ratios:" +
      missingRatios +
      " platforms:" +
      missingPlatforms +
      " bg:" +
      missingBg +
      " status:" +
      missingStatus +
      " synth IDs:" +
      synthesizedIds +
      (ratioSamples.length ? "\nSamples: " + ratioSamples.join("; ") : "") +
      (warningSamples.length ? "\nWarnings:\n" + warningSamples.join("\n") : "") +
      "\nSynced at: " +
      now +
      "\n\nPolicy: never invent Ratios / Platforms / Status / Bg_File.";

    if (missingRatios > 0) {
      msg +=
        "\n\n⚠ " +
        missingRatios +
        " Hotel row(s) missing ratios → stub row with blank Ratios.";
    }

    SpreadsheetApp.getUi().alert(msg);
  } catch (err) {
    SpreadsheetApp.getUi().alert(
      "Sync failed:\n" + (err && err.message ? err.message : String(err)),
    );
  }
}

function getHotel1LastSync() {
  return PropertiesService.getDocumentProperties().getProperty("hotel1_last_sync") || "";
}
