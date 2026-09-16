/**
 * P10 Templater — Photoshop UXP panel
 * Auto-cycle apply, layer scan/props, font controls, multi-ratio.
 */
const { app, core, action } = require("photoshop");
const uxp = require("uxp");
const fs = uxp.storage.localFileSystem;
const { entrypoints } = require("uxp");

let projectFolder = null;
let pluginDataFolder = null;
let panelHandlersBound = false;

const PLUGIN_SHEET_LINK = "sheet-link.json";
const PLUGIN_PROJECT_TOKEN = "project-folder-token.txt";
const PLUGIN_DATASET = "dataset-cache.json";
let dataset = null;
let rowIndex = 0;
let busy = false;
let scannedLayers = [];
/** @type {Record<string, any>} */
let layerSchema = { layers: [], updatedAt: "" };
/** @type {Record<string, any> | null} */
let ratioLayout = null;
/** @type {Record<string, any> | null} */
let variantLayout = null;
/** Merged ratio ← variant for apply */
let mergedLayout = null;
let selectedLayerName = "";
/** @type {Set<string>} */
let selectedLayerNames = new Set();
let layerListExpanded = false;
let boundPropExtras = {}; // layerName → string[] extra props bound in UI

/** Fallback list so Layers isn't a dead empty box before first scan */
const DEFAULT_P10_LAYERS = [
  { name: "txt/headline", kind: "text", editable: true, visible: true, opacity: 100 },
  { name: "txt/sub", kind: "text", editable: true, visible: false, opacity: 100 },
  { name: "lock/accent_dot", kind: "lock", editable: true, visible: true, opacity: 100 },
  { name: "lock/accent_rule", kind: "lock", editable: true, visible: true, opacity: 100 },
  { name: "slot/ten", kind: "slot", editable: true, visible: true, opacity: 100, smart: true },
  { name: "9", kind: "bg", editable: true, visible: true, opacity: 100 },
  { name: "10", kind: "bg", editable: true, visible: true, opacity: 100 },
  { name: "11", kind: "bg", editable: true, visible: true, opacity: 100 },
  { name: "12", kind: "bg", editable: true, visible: true, opacity: 100 },
];

let globalFont = { postScript: "Poppins-Medium", sizePx: 86 };

function $(id) {
  return document.getElementById(id);
}

function say(msg) {
  const el = $("status");
  if (!el) return;
  el.textContent = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
}

function currentRow() {
  if (!dataset?.rows?.length) return null;
  return dataset.rows[rowIndex] || null;
}

function autoLoadOn() {
  return !!$("autoLoadChk")?.checked;
}

function autoTextOn() {
  return !!$("autoTextChk")?.checked;
}

async function ensurePluginDataFolder() {
  if (!pluginDataFolder) pluginDataFolder = await fs.getDataFolder();
  return pluginDataFolder;
}

async function readPluginFile(name) {
  try {
    const df = await ensurePluginDataFolder();
    const entries = await df.getEntries();
    const file = entries.find((e) => e.isFile && e.name === name);
    if (!file) return null;
    return await file.read();
  } catch {
    return null;
  }
}

async function writePluginFile(name, text) {
  const df = await ensurePluginDataFolder();
  const file = await df.createFile(name, { overwrite: true });
  await file.write(text);
  return file;
}

/** Resolve a path under the repo folder by walking entries (reliable vs file: URLs on Windows). */
async function entryFromRel(rel) {
  if (!projectFolder) throw new Error("Set Repo folder for templates / layouts / export");
  const parts = String(rel || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  let cur = projectFolder;
  for (let i = 0; i < parts.length; i++) {
    const entries = await cur.getEntries();
    const next = entries.find((e) => e.name === parts[i]);
    if (!next) {
      throw new Error(`Missing ${parts.slice(0, i + 1).join("/")} under repo`);
    }
    cur = next;
  }
  return cur;
}

async function writeRel(rel, text) {
  const parts = rel.replace(/\\/g, "/").split("/");
  const fileName = parts.pop();
  let folder = projectFolder;
  for (const part of parts) {
    const entries = await folder.getEntries();
    let next = entries.find((e) => e.name === part && e.isFolder);
    if (!next) next = await folder.createFolder(part);
    folder = next;
  }
  const file = await folder.createFile(fileName, { overwrite: true });
  await file.write(text);
  return file;
}

function fontScope() {
  const checked = document.querySelector('input[name="fontScope"]:checked');
  return checked ? checked.value : "row";
}

function readFontForm() {
  const postScript = $("fontSelect").value || "Poppins-Medium";
  let sizePx = parseInt($("fontSizeInput").value, 10);
  if (!Number.isFinite(sizePx) || sizePx < 24) sizePx = 24;
  if (sizePx > 200) sizePx = 200;
  $("fontSizeInput").value = String(sizePx);
  return { postScript, sizePx };
}

function rowFont(row) {
  return {
    postScript: row.fontPostScript || globalFont.postScript,
    sizePx: row.fontSizePx || globalFont.sizePx,
  };
}

function syncFontFormFromRow(row) {
  if (!row) return;
  const f = rowFont(row);
  const sel = $("fontSelect");
  if (![...sel.options].some((o) => o.value === f.postScript)) {
    const o = document.createElement("option");
    o.value = f.postScript;
    o.textContent = f.postScript;
    sel.appendChild(o);
  }
  sel.value = f.postScript;
  $("fontSizeInput").value = String(f.sizePx);
}

function saveFontSettings() {
  const form = readFontForm();
  const scope = fontScope();
  if (!dataset?.rows?.length) {
    globalFont = form;
    say(`Saved defaults: ${form.postScript} ${form.sizePx}px`);
    return form;
  }
  if (scope === "all") {
    globalFont = form;
    for (const row of dataset.rows) {
      row.fontPostScript = form.postScript;
      row.fontSizePx = form.sizePx;
    }
    say(`Font → ALL ${dataset.rows.length} rows · ${form.postScript} @ ${form.sizePx}px`);
  } else {
    const row = currentRow();
    if (!row) return form;
    row.fontPostScript = form.postScript;
    row.fontSizePx = form.sizePx;
    say(`Font → ${row.id} · ${form.postScript} @ ${form.sizePx}px`);
  }
  renderFields(currentRow());
  return form;
}

function layoutForRow(row) {
  const font = rowFont(row);
  const canvasW = row.canvasWidth || (row.ratio === "16:9" ? 1920 : 1080);
  const canvasH =
    row.canvasHeight ||
    (row.ratio === "9:16" ? 1920 : row.ratio === "1:1" ? 1080 : row.ratio === "16:9" ? 1080 : 1350);

  const L = window.P10Layout;
  const safe = L
    ? L.canvasSafeBounds(canvasW, canvasH)
    : {
        typeLeft: Math.round((108 / 1080) * canvasW),
        typeMaxWidth: Math.round(canvasW - (108 / 1080) * canvasW - (64 / 1080) * canvasW),
        typeBaselineY: Math.round((990 / 1350) * canvasH),
        typeBottomMax: Math.round(canvasH - (120 / 1350) * canvasH),
        accentRuleRight: canvasW - 2,
        marginPx: Math.max(16, Math.round((28 / 1080) * canvasW)),
        fontTargetPx: Math.round(86 * Math.sqrt((canvasW / 1080) * (canvasH / 1350))),
        fontMinPx: Math.round(72 * Math.sqrt((canvasW / 1080) * (canvasH / 1350))),
        leadingRatio: 1.08,
        ten: null,
        allowTenOverlap: false,
      };

  // Locked type box from merged layout overrides safe defaults when present
  let textLeft = row.textLeft || safe.typeLeft;
  let maxWidthPx = safe.typeMaxWidth;
  let line1Y = safe.typeBaselineY;
  const hlLock = mergedLayout?.layers?.["txt/headline"];
  if (hlLock && L) {
    const box = L.boxFromEntry(hlLock, canvasW, canvasH);
    if (box) {
      textLeft = Math.round(box.left);
      maxWidthPx = Math.max(120, Math.round(box.width));
      line1Y = Math.round(box.top + (hlLock.props?.sizePx || font.sizePx || safe.fontTargetPx));
    }
  }

  // Manual size is the target; still allow modest shrink so wraps don't orphan "The"
  const rawWant = font.sizePx || safe.fontTargetPx;
  const wantSize = row.fontSizeManual
    ? Math.max(24, Math.min(200, rawWant))
    : Math.min(Math.max(rawWant, safe.fontMinPx), Math.round(safe.fontTargetPx * 1.16));
  const minSize = row.fontSizeManual
    ? Math.max(safe.fontMinPx, Math.round(wantSize * 0.82))
    : autoTextOn()
      ? safe.fontMinPx
      : wantSize;

  let fit;
  if (L && window.P10TextFit) {
    fit = L.fitAgainstSafeBounds(window.P10TextFit, {
      title: row.title || "",
      copy: row.copy || "",
      safe: Object.assign({}, safe, {
        typeLeft: textLeft,
        typeMaxWidth: maxWidthPx,
        typeBaselineY: line1Y,
      }),
      fontSizePx: wantSize,
      minFontSizePx: minSize,
      maxWidthPx,
    });
  } else {
    fit = window.P10TextFit.fitTypeBlock({
      title: row.title || "",
      copy: row.copy || "",
      maxWidthPx,
      fontSizePx: wantSize,
      minFontSizePx: minSize,
      maxLines: 3,
    });
  }

  const lines = (fit.lines || []).filter(Boolean);
  const size = fit.fontSizePx || wantSize;
  const leadingRatio = safe.leadingRatio || 1.08;
  const text = lines.join("\r");
  return {
    lines,
    fontSizePx: size,
    text,
    headline: text,
    sub: "",
    postScript: font.postScript,
    textLeft,
    maxWidthPx,
    accentRuleRight: safe.accentRuleRight != null ? safe.accentRuleRight : canvasW - 2,
    marginPx: safe.marginPx,
    canvasW,
    canvasH,
    line1Y,
    leadingPx: Math.round(size * leadingRatio),
    safe,
    allowTenOverlap: !!fit.allowTenOverlap,
    typeBlockHeight: fit.typeBlockHeight,
  };
}

function ensureRowOverrides(row) {
  if (!row.props) row.props = {};
  return row.props;
}

function renderFields(row) {
  if (!row) {
    $("rowCounter").textContent = "0/0";
    $("rowId").textContent = "—";
    if ($("summary")) $("summary").textContent = "—";
    renderLayerList(null);
    return;
  }
  const laid = layoutForRow(row);
  $("rowCounter").textContent = `${rowIndex + 1}/${dataset.rows.length}`;
  $("rowId").textContent = row.id;
  $("jumpInput").value = String(rowIndex + 1);
  syncFontFormFromRow(row);
  if ($("summary")) {
    const head = String(laid.text || laid.headline || "").replace(/\r/g, " | ");
    $("summary").textContent =
      `${row.ratio} · BG ${row.bg} · ${laid.postScript} ${laid.fontSizePx}px\n` +
      `${head || "—"}`;
  }
  renderLayerList(row);
  renderPropsFromScan(row);
}

function setBusy(on) {
  busy = on;
  [
    "prevBtn",
    "nextBtn",
    "applyBtn",
    "applyNextBtn",
    "exportBtn",
    "renderAllBtn",
    "reloadBtn",
    "jumpBtn",
    "setProjectBtn",
    "applyFontBtn",
    "applyFontNowBtn",
    "sizeUpBtn",
    "sizeDownBtn",
    "scanBtn",
    "nudgeLeftBtn",
    "nudgeRightBtn",
    "nudgeUpBtn",
    "nudgeDownBtn",
    "laySizeDownBtn",
    "laySizeUpBtn",
    "lockLayerBtn",
    "saveLayoutBtn",
    "usePsSelBtn",
    "openHotel1Btn",
    "addPropBtn",
    "expandAllBtn",
  ].forEach((id) => {
    const el = $(id);
    if (el) el.disabled = on;
  });
}

async function saveProjectToken(folder) {
  try {
    const token = await fs.createPersistentToken(folder);
    await writePluginFile(PLUGIN_PROJECT_TOKEN, token);
  } catch (err) {
    console.error("saveProjectToken", err);
  }
}

async function tryRestoreProject() {
  try {
    const token = await readPluginFile(PLUGIN_PROJECT_TOKEN);
    if (!token) return false;
    projectFolder = await fs.getEntryForPersistentToken(token);
    const pathEl = $("projectPath");
    if (pathEl) pathEl.textContent = projectFolder.nativePath || projectFolder.name;
    return true;
  } catch (err) {
    console.error("tryRestoreProject", err);
    projectFolder = null;
    return false;
  }
}

async function setProject() {
  try {
    say("Opening folder picker…");
    const opts = {};
    try {
      const domains = uxp.storage && uxp.storage.domains;
      if (domains && domains.userDocuments) opts.initialDomain = domains.userDocuments;
    } catch {
      /* domains optional */
    }
    const folder = await fs.getFolder(opts);
    if (!folder) {
      say("No folder selected");
      return;
    }
    projectFolder = folder;
    const pathEl = $("projectPath");
    if (pathEl) pathEl.textContent = folder.nativePath || folder.name;
    await saveProjectToken(folder);
    await refreshSheetUi();
    await loadLayerSchema();
    // Dataset from sheet is preferred; local dataset.json is only a cache
    try {
      await loadDataset({ quiet: true });
    } catch {
      /* ok */
    }
    say(
      `Repo: ${folder.nativePath || folder.name}\n` +
        `Content still comes from Pull Content_DB — repo is for templates / layouts / export.`,
    );
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (/cancel/i.test(msg)) say("Folder picker cancelled");
    else say(`Repo folder failed: ${msg}`);
  }
}

async function loadDataset({ quiet = false } = {}) {
  if (!projectFolder) {
    if (!quiet) say("No local dataset — Pull Content_DB from the sheet");
    return;
  }
  try {
    const file = await entryFromRel("fixtures/templater/dataset.json");
    dataset = JSON.parse(await file.read());
    if (dataset.defaultFont) {
      globalFont.postScript = dataset.defaultFont.postScript || globalFont.postScript;
      globalFont.sizePx = dataset.defaultFont.sizePx || globalFont.sizePx;
    }
    rowIndex = 0;
    renderFields(currentRow());
    await refreshSheetUi();
    if (!quiet) {
      say(`Loaded ${dataset.rows.length} local variants. Auto=${autoLoadOn() ? "ON" : "OFF"}`);
    }
    if (autoLoadOn()) await applyCurrent({ openTemplate: true, quiet: true });
  } catch (err) {
    if (!quiet) {
      dataset = dataset || null;
      if (!dataset) renderFields(null);
      say(`No local dataset.json — Pull Content_DB\n${err.message || err}`);
    }
  }
}

const DEFAULT_SHEET_ID = "1OqyooDCwGJfvtC6QIW18Q2rSvmvfzF_jSWVncoh7dMQ";
const HOTEL1_GID = "690745977";
const SHEET_LINK_REL = "fixtures/templater/sheet-link.json";
const MACHINE_TABS_FALLBACK_ID = "1t3BEqm3hnGz2qOqrdqwLUOiwP97NDRxhPOXIM_mMzAs";

const RATIO_TEMPLATES = {
  "4:5": {
    key: "4x5",
    template: "fixtures/templater/templates/tpl_4x5.psd",
    w: 1080,
    h: 1350,
  },
  "1:1": {
    key: "1x1",
    template: "fixtures/templater/templates/tpl_1x1.psd",
    w: 1080,
    h: 1080,
  },
  "9:16": {
    key: "9x16",
    template: "fixtures/templater/templates/tpl_9x16.psd",
    w: 1080,
    h: 1920,
  },
  "16:9": {
    key: "16x9",
    template: "fixtures/templater/templates/tpl_16x9.psd",
    w: 1920,
    h: 1080,
  },
};

function parseSheetId(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  return "";
}

function sheetEditUrl(id) {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

function sheetCsvUrl(id, tab) {
  const sheet = encodeURIComponent(tab || "Content_DB");
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${sheet}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQ) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQ = true;
      continue;
    }
    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      if (row.some((c) => String(c).trim() !== "")) rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur);
    if (row.some((c) => String(c).trim() !== "")) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || "").trim());
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] != null ? String(cells[idx]) : "";
    });
    return obj;
  });
}

function parseRatioList(raw) {
  const parts = String(raw || "")
    .split(/[,;/|]+/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => r.replace(/[x×]/gi, ":").replace(/\s+/g, ""))
    .filter((r) => /^(4:5|1:1|9:16|16:9)$/.test(r));
  // INTEGRITY: never invent ratios — empty means no variants from this row
  return parts;
}

function contentDbToDatasetRows(contentRows) {
  const out = [];
  let n = 0;
  for (const c of contentRows) {
    const title = (c.Title || c.title || "").trim();
    const copy = (c.Copy || c.copy || "").trim();
    if (!title && !copy) continue;
    // Prefer Content_Group_ID (Hotel base) when sync forked one-row-per-variant
    const groupId = (c.Content_Group_ID || c.contentGroupId || "").trim();
    const idRaw = (c.Content_ID || c.id || `ROW${n + 1}`).trim();
    const bgRaw = String(c.Bg_File || c.bg || "").replace(/\D/g, "");
    const bg = ["9", "10", "11", "12"].includes(bgRaw) ? bgRaw : bgRaw || "";
    const ratios = parseRatioList(c.Ratios || c.ratios);
    for (const ratio of ratios) {
      const meta = RATIO_TEMPLATES[ratio];
      if (!meta) continue;
      n += 1;
      // Avoid double suffix when Content_ID is already base_4x5
      const alreadySuffixed = new RegExp(`_${meta.key}$`, "i").test(idRaw);
      const contentId = groupId || (alreadySuffixed ? idRaw.replace(new RegExp(`_${meta.key}$`, "i"), "") : idRaw);
      const rowId = alreadySuffixed ? idRaw : `${contentId}_${meta.key}`;
      out.push({
        id: rowId,
        index: n,
        contentId,
        ratio,
        ratioKey: meta.key,
        template: meta.template,
        bg,
        title,
        copy,
        fontPostScript: globalFont.postScript,
        fontSizePx: globalFont.sizePx,
        canvasWidth: meta.w,
        canvasHeight: meta.h,
        textLeft: Math.round((108 / 1080) * Math.min(meta.w, 1080)),
        exportFile: `${rowId}.jpg`,
        notes: `Sheet · ${contentId} · ${ratio}`,
        source: "google-sheet",
      });
    }
  }
  return out;
}

async function readSheetLink() {
  try {
    const raw = await readPluginFile(PLUGIN_SHEET_LINK);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  if (!projectFolder) return null;
  try {
    const file = await entryFromRel(SHEET_LINK_REL);
    return JSON.parse(await file.read());
  } catch {
    return null;
  }
}

async function writeSheetLink(link) {
  await writePluginFile(PLUGIN_SHEET_LINK, JSON.stringify(link, null, 2));
  if (projectFolder) {
    try {
      await writeRel(SHEET_LINK_REL, JSON.stringify(link, null, 2));
    } catch (err) {
      console.error("writeSheetLink repo copy", err);
    }
  }
}

function hotel1Url(sheetId) {
  const id = sheetId || DEFAULT_SHEET_ID;
  return `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${HOTEL1_GID}`;
}

function propagateScope() {
  const el = $("propagateScope");
  return el?.value || "ratio";
}

async function refreshSheetUi() {
  const link = await readSheetLink();
  const input = $("sheetUrlInput");
  const st = $("sheetStatus");
  const syncEl = $("hotel1SyncStatus");
  if (!input || !st) return;
  if (link?.sheetId) {
    input.value = link.url || sheetEditUrl(link.sheetId);
    st.textContent = `Linked · ${link.sheetId.slice(0, 8)}… · Pull = Content_DB (post–Hotel 1 sync)`;
    if (syncEl) {
      syncEl.textContent = link.lastHotel1Sync
        ? `Last Hotel 1 sync noted: ${link.lastHotel1Sync}`
        : "Run PSD Automation → Sync Hotel 1 → Content_DB in Sheets, then Pull";
    }
  } else {
    if (!input.value) input.value = sheetEditUrl(DEFAULT_SHEET_ID);
    st.textContent = "Live calendar default · Link + Pull Content_DB after Hotel 1 sync";
    if (syncEl) {
      syncEl.textContent = `Hotel 1 gid ${HOTEL1_GID} · fallback machine-tabs ${MACHINE_TABS_FALLBACK_ID.slice(0, 8)}…`;
    }
  }
}

async function onOpenHotel1() {
  const link = await readSheetLink();
  const id = parseSheetId($("sheetUrlInput")?.value) || link?.sheetId || DEFAULT_SHEET_ID;
  const url = link?.hotel1Url || hotel1Url(id);
  try {
    const { shell } = require("uxp");
    if (shell?.openExternal) await shell.openExternal(url);
    else say(`Open Hotel 1:\n${url}`);
  } catch {
    say(`Open Hotel 1:\n${url}`);
  }
}

async function onLinkSheet() {
  const id = parseSheetId($("sheetUrlInput")?.value);
  if (!id) return say("Paste a Google Sheet URL or ID");
  const link = {
    sheetId: id,
    url: sheetEditUrl(id),
    tab: "Content_DB",
    hotel1Gid: HOTEL1_GID,
    hotel1Url: hotel1Url(id),
    linkedAt: new Date().toISOString(),
  };
  await writeSheetLink(link);
  await refreshSheetUi();
  say(
    `Linked sheet ${id}\nShare Viewer link for Pull.\nEdit Hotel 1 → Sync Hotel 1 → Content_DB → Pull rows.`,
  );
}

async function onPullSheet() {
  setBusy(true);
  try {
    let link = await readSheetLink();
    const id = parseSheetId($("sheetUrlInput")?.value) || link?.sheetId || DEFAULT_SHEET_ID;
    const tab = link?.tab || "Content_DB";
    if (!link || link.sheetId !== id) {
      link = { sheetId: id, url: sheetEditUrl(id), tab, linkedAt: new Date().toISOString() };
      await writeSheetLink(link);
    }
    const url = sheetCsvUrl(id, tab);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} — share sheet as Anyone with the link`);
    const csv = await res.text();
    if (/<!DOCTYPE html>/i.test(csv) || /Sign in/i.test(csv.slice(0, 200))) {
      throw new Error("Sheet not readable. Share → Anyone with the link → Viewer");
    }
    const contentRows = parseCsv(csv);
    const rows = contentDbToDatasetRows(contentRows);
    if (!rows.length) {
      throw new Error(
        "No variants after Pull — Content_DB needs Title plus Ratios from Hotel 1 sync (e.g. 4:5,1:1). Empty Ratios = no rows (by design).",
      );
    }
    dataset = {
      version: 3,
      name: "Perfect Ten — live Google Sheet",
      source: "google-sheet",
      sheetId: id,
      sheetTab: tab,
      pulledAt: new Date().toISOString(),
      defaultFont: { ...globalFont },
      rowCount: rows.length,
      rows,
    };
    await writePluginFile(PLUGIN_DATASET, JSON.stringify(dataset, null, 2));
    if (projectFolder) {
      try {
        await writeRel("fixtures/templater/dataset.json", JSON.stringify(dataset, null, 2));
      } catch (err) {
        console.error("dataset repo cache", err);
      }
    }
    link.lastPullAt = dataset.pulledAt;
    link.hotel1Gid = HOTEL1_GID;
    link.hotel1Url = hotel1Url(id);
    await writeSheetLink(link);
    rowIndex = 0;
    if (currentRow()) await loadMergedLayout(currentRow());
    renderFields(currentRow());
    await refreshSheetUi();
    say(
      `Pulled ${contentRows.length} Content_DB rows → ${rows.length} variants\n` +
        `Sheet ${id}\n(If titles look stale, Sync Hotel 1 → Content_DB in Sheets first)`,
    );
    if (autoLoadOn()) await applyCurrent({ openTemplate: !!projectFolder, quiet: true });
  } catch (err) {
    say(`Sheet pull failed: ${err.message || err}`);
  } finally {
    setBusy(false);
  }
}

function onOpenSheet() {
  const id = parseSheetId($("sheetUrlInput")?.value) || DEFAULT_SHEET_ID;
  const url = sheetEditUrl(id);
  try {
    if (typeof require === "function") {
      const uxp = require("uxp");
      if (uxp?.shell?.openExternal) {
        uxp.shell.openExternal(url);
        return;
      }
    }
  } catch {
    /* */
  }
  say(`Open in browser:\n${url}`);
}

async function loadLayerSchema() {
  try {
    const file = await entryFromRel("fixtures/templater/layer-schema.json");
    layerSchema = JSON.parse(await file.read());
    scannedLayers = layerSchema.layers || [];
    renderPropsFromScan(currentRow());
    renderLayerList(currentRow());
  } catch {
    layerSchema = { layers: [], updatedAt: "" };
  }
}

async function findLayerByName(layers, name) {
  for (const layer of layers) {
    if (layer.name === name) return layer;
    if (layer.layers?.length) {
      const found = await findLayerByName(layer.layers, name);
      if (found) return found;
    }
  }
  return null;
}

async function selectOnlyLayer(layer) {
  await action.batchPlay(
    [
      {
        _obj: "select",
        _target: [{ _ref: "layer", _id: layer.id }],
        makeVisible: false,
        layerID: [layer.id],
        _options: { dialogOptions: "dontDisplay" },
      },
    ],
    {},
  );
}

async function scaleLayerCover(doc, layer) {
  if (!layer) return;
  const b = layer.bounds;
  const lw = b.right - b.left;
  const lh = b.bottom - b.top;
  if (lw <= 0 || lh <= 0) return;
  const scale = Math.max(doc.width / lw, doc.height / lh) * 100;
  await selectOnlyLayer(layer);
  await action.batchPlay(
    [
      {
        _obj: "transform",
        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        freeTransformCenterState: {
          _enum: "quadCenterState",
          _value: "QCSAverage",
        },
        width: { _unit: "percentUnit", _value: scale },
        height: { _unit: "percentUnit", _value: scale },
        interfaceIconFrameDimmed: {
          _enum: "interpolationType",
          _value: "bicubic",
        },
        _options: { dialogOptions: "dontDisplay" },
      },
    ],
    {},
  );
}

async function showOnlyBgCover(doc, bgName) {
  const group = await findLayerByName(doc.layers, "BG IMAGES");
  if (!group?.layers) throw new Error('Missing "BG IMAGES"');
  const want = String(bgName || "").trim();
  if (!want) {
    // INTEGRITY: no invented BG — leave all covers off rather than guessing "9"
    for (const layer of group.layers) layer.visible = false;
    return;
  }
  let active = null;
  for (const layer of group.layers) {
    const on = layer.name === want;
    layer.visible = on;
    if (on) active = layer;
  }
  for (const name of ["P10 COLORS", "BG GRAPHICS"]) {
    const g = await findLayerByName(doc.layers, name);
    if (g?.layers) for (const layer of g.layers) layer.visible = false;
    else if (g) g.visible = false;
  }
  if (active) await scaleLayerCover(doc, active);
}

async function setTextStyled(doc, layerName, value, postScript, sizePx, leadingPx) {
  const layer = await findLayerByName(doc.layers, layerName);
  if (!layer?.textItem) throw new Error(`Missing ${layerName}`);
  layer.visible = true;
  // Photoshop point-text uses \r for hard line breaks inside one layer
  layer.textItem.contents = value == null ? "" : String(value).replace(/\n/g, "\r");
  const style = layer.textItem.characterStyle;
  try {
    style.font = postScript;
  } catch {
    try {
      style.font = "ArialMT";
    } catch {
      /* */
    }
  }
  // UXP characterStyle.size is document pixels (Options bar then shows pt = px*72/dpi).
  // Do NOT pre-convert with *72/dpi — that was crushing ~120px down to ~8pt in the UI.
  const size = Math.max(12, Number(sizePx) || 120);
  style.size = size;
  const lead = Math.max(size, Number(leadingPx) || Math.round(size * 1.18));
  try {
    style.autoLeading = false;
    style.leading = lead;
  } catch {
    /* */
  }
  try {
    layer.textItem.paragraphStyle.align = "left";
  } catch {
    /* */
  }
  return layer;
}

/** Preview-locked type + accents — single text block with hard line breaks. */
async function positionTypeAndAccents(doc, laid) {
  const W = doc.width;
  const H = doc.height;
  const sx = W / 1080;
  const sy = H / 1350;
  const textLeft = laid.textLeft || Math.round(108 * sx);
  const line1Y = laid.line1Y || Math.round(990 * sy);
  const ruleGap = Math.max(12, Math.round(14 * sy));
  const ruleH = Math.max(4, Math.round(5 * sy));
  const dotSize = Math.max(18, Math.round(22 * Math.sqrt(sx * sy)));

  const headline = await findLayerByName(doc.layers, "txt/headline");
  const sub = await findLayerByName(doc.layers, "txt/sub");
  const rule = await findLayerByName(doc.layers, "lock/accent_rule");
  const dot = await findLayerByName(doc.layers, "lock/accent_dot");

  if (sub) {
    try {
      sub.textItem.contents = " ";
    } catch {
      /* */
    }
    sub.visible = false;
  }

  const headlineLocked = !!mergedLayout?.layers?.["txt/headline"]?.locked;
  if (!laid.skipHeadlineMove && !headlineLocked && headline?.visible && (laid.text || laid.headline)) {
    try {
      headline.textItem.position = { x: textLeft, y: line1Y };
    } catch {
      const hb = headline.bounds;
      headline.translate(textLeft - hb.left, line1Y - hb.bottom);
    }
  }

  const ruleLocked = !!mergedLayout?.layers?.["lock/accent_rule"]?.locked;
  const dotLocked = !!mergedLayout?.layers?.["lock/accent_dot"]?.locked;

  const anchor = headline;
  if (rule && !ruleLocked && anchor) {
    const ab = anchor.bounds;
    const targetLeft = textLeft;
    const targetTop = ab.bottom + ruleGap;
    const targetRight = laid.accentRuleRight != null ? laid.accentRuleRight : W - Math.round(16 * sx);
    const curW = Math.max(1, rule.bounds.right - rule.bounds.left);
    const curH = Math.max(1, rule.bounds.bottom - rule.bounds.top);
    await selectOnlyLayer(rule);
    try {
      if (typeof rule.scale === "function") {
        rule.scale(((targetRight - targetLeft) / curW) * 100, (ruleH / curH) * 100);
      }
    } catch {
      /* */
    }
    const rb = rule.bounds;
    rule.translate(targetLeft - rb.left, targetTop - rb.top);
    rule.visible = true;
  }

  if (dot && !dotLocked && headline) {
    const hb = headline.bounds;
    const db = dot.bounds;
    const curD = Math.max(1, Math.max(db.right - db.left, db.bottom - db.top));
    await selectOnlyLayer(dot);
    try {
      if (typeof dot.scale === "function") {
        const s = (dotSize / curD) * 100;
        dot.scale(s, s);
      }
    } catch {
      /* */
    }
    const db2 = dot.bounds;
    const dw = db2.right - db2.left;
    const dh = db2.bottom - db2.top;
    const destLeft = Math.max(Math.round(12 * sx), textLeft - dw - Math.round(18 * sx));
    const firstLineH = Math.min(hb.bottom - hb.top, laid.fontSizePx || 120);
    const destTop = hb.top + firstLineH / 2 - dh / 2;
    dot.translate(destLeft - db2.left, destTop - db2.top);
    dot.visible = true;
  }
}

async function clearOrHideText(doc, layerName) {
  const layer = await findLayerByName(doc.layers, layerName);
  if (!layer?.textItem) return;
  layer.textItem.contents = " ";
  layer.visible = false;
}

async function applySolidColor(layer, hex) {
  const h = hex.replace("#", "");
  const rgb = {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
  await selectOnlyLayer(layer);
  await action.batchPlay(
    [
      {
        _obj: "set",
        _target: [
          { _ref: "property", _property: "adjustment" },
          { _ref: "layer", _enum: "ordinal", _value: "targetEnum" },
        ],
        to: {
          _obj: "solidColorLayer",
          color: { _obj: "RGBColor", red: rgb.r, green: rgb.g, blue: rgb.b },
        },
        _options: { dialogOptions: "dontDisplay" },
      },
    ],
    {},
  );
}

async function openRowTemplate(row) {
  if (!projectFolder) {
    if (app.activeDocument) return;
    throw new Error(
      "Open a ratio template PSD first, or set Repo folder so Apply can open templates",
    );
  }
  const entry = await entryFromRel(row.template);
  await app.open(entry);
  if (!app.activeDocument) throw new Error("Failed to open template");
}

async function applyRowProps(doc, row) {
  const props = row.props || {};
  for (const [layerName, values] of Object.entries(props)) {
    // Engine owns type block sizing/contents
    if (layerName === "txt/headline" || layerName === "txt/sub") continue;
    const layer = await findLayerByName(doc.layers, layerName);
    if (!layer) continue;
    if (typeof values.visible === "boolean") layer.visible = values.visible;
    if (values.contents != null && layer.textItem) {
      layer.textItem.contents = String(values.contents);
    }
    if (values.hex && (layerName.startsWith("clr/") || values.kind === "color")) {
      try {
        await applySolidColor(layer, values.hex);
      } catch (err) {
        console.error("color fail", layerName, err);
      }
    }
    if (values.opacity != null) {
      const o = Number(values.opacity);
      if (Number.isFinite(o)) layer.opacity = Math.max(0, Math.min(100, o));
    }
    if (values.fxScale != null) {
      const s = Number(values.fxScale);
      if (Number.isFinite(s)) {
        try {
          await applyFxScale(layer, Math.max(0, Math.min(100, s)));
        } catch (err) {
          console.error("fxScale fail", layerName, err);
        }
      }
    }
  }
}

async function applyFxScale(layer, scalePct) {
  await selectOnlyLayer(layer);
  await action.batchPlay(
    [
      {
        _obj: "set",
        _target: [
          { _ref: "property", _property: "layerEffects" },
          { _ref: "layer", _enum: "ordinal", _value: "targetEnum" },
        ],
        to: {
          _obj: "layerEffects",
          scale: { _unit: "percentUnit", _value: scalePct },
        },
        _options: { dialogOptions: "dontDisplay" },
      },
    ],
    {},
  );
}

async function applyCurrent({ openTemplate = true, quiet = false } = {}) {
  const row = currentRow();
  if (!row) return;
  if (row.ratioKey) await loadMergedLayout(row);
  const laid = layoutForRow(row);
  row.headline = laid.text || laid.headline;
  row.sub = "";
  row.fittedSizePx = laid.fontSizePx;

  const shouldOpen = openTemplate && (!!projectFolder || !app.activeDocument);

  await core.executeAsModal(
    async () => {
      if (shouldOpen) await openRowTemplate(row);
      const doc = app.activeDocument;
      if (!doc) throw new Error("No active document");
      await showOnlyBgCover(doc, row.bg);
      await applyRowProps(doc, row);
      const body = laid.text || laid.headline || "";
      if (body) {
        await setTextStyled(
          doc,
          "txt/headline",
          body,
          laid.postScript,
          laid.fontSizePx,
          laid.leadingPx,
        );
      } else {
        await clearOrHideText(doc, "txt/headline");
      }
      await clearOrHideText(doc, "txt/sub");

      // Apply order: unlocked type/accents first, then locked boxes via fracs
      const unlockedType = !mergedLayout?.layers?.["txt/headline"]?.locked;
      if (unlockedType) {
        await positionTypeAndAccents(doc, laid);
      } else {
        // Still place accents if not locked
        await positionTypeAndAccents(doc, {
          ...laid,
          skipHeadlineMove: true,
        });
      }

      if (mergedLayout?.layers) {
        await applyLockedLayout(doc, mergedLayout);
      }

      // If headline was locked, still ensure contents/size from fit
      if (!unlockedType && body) {
        await setTextStyled(
          doc,
          "txt/headline",
          body,
          laid.postScript,
          laid.fontSizePx,
          laid.leadingPx,
        );
      }

      // Auto-refresh Layers panel from the live PSD (no separate Scan click)
      await scanLayersIntoState(doc, { persist: false });
    },
    { commandName: `Apply ${row.id}` },
  );

  populateLayerSelect();
  renderLayerList(row);
  renderFields(row);
  if (!quiet) {
    const warn = laid.allowTenOverlap ? "\n(note: type allowed to overlap ten)" : "";
    say(
      `Applied ${row.id}\nFont ${laid.postScript} @ ${laid.fontSizePx}px\n` +
        `Lines: ${(laid.lines || []).join(" / ")}\n` +
        `Layers: ${scannedLayers.length} · BG ${row.bg}${warn}`,
    );
  }
}

async function cycleTo(nextIndex) {
  if (!dataset?.rows?.length) return;
  rowIndex = nextIndex;
  const row = currentRow();
  if (row?.ratioKey) await loadMergedLayout(row);
  renderFields(row);
  say(`Row ${rowIndex + 1}: ${row?.id}`);
  if (autoLoadOn()) {
    setBusy(true);
    try {
      await applyCurrent({ openTemplate: true, quiet: true });
      say(`Auto-loaded ${currentRow().id}`);
    } catch (err) {
      say(`Auto-load failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }
}

function goPrev() {
  if (!dataset?.rows?.length || busy) return;
  cycleTo((rowIndex - 1 + dataset.rows.length) % dataset.rows.length);
}

function goNext() {
  if (!dataset?.rows?.length || busy) return;
  cycleTo((rowIndex + 1) % dataset.rows.length);
}

function jumpTo() {
  if (!dataset?.rows?.length || busy) return;
  const n = parseInt($("jumpInput").value, 10);
  if (!Number.isFinite(n) || n < 1 || n > dataset.rows.length) {
    say(`Jump 1–${dataset.rows.length}`);
    return;
  }
  cycleTo(n - 1);
}

function bumpSize(delta) {
  const cur = parseInt($("fontSizeInput").value, 10) || 90;
  $("fontSizeInput").value = String(Math.max(24, Math.min(200, cur + delta)));
  applyFontLive({ quiet: true });
}

/**
 * Live font size/face on the open document — does not re-run autofit shrink.
 * Saves to the current row (or all rows if scope=all) and sets characterStyle.size immediately.
 */
async function applyFontLive({ quiet = false } = {}) {
  const form = readFontForm();
  const scope = fontScope();
  const leadingRatio = 1.08;

  if (scope === "all" && dataset?.rows?.length) {
    globalFont = form;
    for (const row of dataset.rows) {
      row.fontPostScript = form.postScript;
      row.fontSizePx = form.sizePx;
      row.fontSizeManual = true; // user-driven size — don't let autofit crush it on next Apply
    }
  } else {
    const row = currentRow();
    if (row) {
      row.fontPostScript = form.postScript;
      row.fontSizePx = form.sizePx;
      row.fontSizeManual = true;
    } else {
      globalFont = form;
    }
  }

  if (!app.activeDocument) {
    if (!quiet) say(`Font ${form.postScript} @ ${form.sizePx}px saved (no open doc — Apply to see)`);
    else if ($("summary") && currentRow()) {
      $("summary").textContent = `${currentRow().ratio} · BG ${currentRow().bg} · ${form.postScript} ${form.sizePx}px (live pending Apply)`;
    }
    return form;
  }

  try {
    await core.executeAsModal(
      async () => {
        const doc = app.activeDocument;
        if (!doc) throw new Error("No active document");
        const layer = await findLayerByName(doc.layers, "txt/headline");
        if (!layer?.textItem) throw new Error("Missing txt/headline");
        const style = layer.textItem.characterStyle;
        try {
          style.font = form.postScript;
        } catch {
          try {
            style.font = "ArialMT";
          } catch {
            /* */
          }
        }
        const size = Math.max(12, form.sizePx);
        style.size = size;
        try {
          style.autoLeading = false;
          style.leading = Math.round(size * leadingRatio);
        } catch {
          /* */
        }
      },
      { commandName: "Live font size" },
    );
    if ($("summary") && currentRow()) {
      const row = currentRow();
      $("summary").textContent =
        `${row.ratio} · BG ${row.bg} · ${form.postScript} ${form.sizePx}px (live)\n` +
        String(row.headline || row.title || "").replace(/\r/g, " | ");
    }
    if (!quiet) say(`Live type · ${form.postScript} @ ${form.sizePx}px`);
  } catch (err) {
    say(`Live font failed: ${err.message || err}`);
  }
  return form;
}

async function onSaveFontAndApply() {
  const form = await applyFontLive({ quiet: true });
  // Full apply still needed for wrap/position; honor manual size (see layoutForRow)
  await onApply();
  say(`Applied font ${form.postScript} @ ${form.sizePx}px`);
}

function classifyLayer(name, isText, isGroup) {
  if (isGroup) return "group";
  if (name.startsWith("txt/") || isText) return "text";
  if (name.startsWith("clr/") || /color|accent/i.test(name)) return "color";
  if (name.startsWith("slot/")) return "slot";
  if (name.startsWith("lock/")) return "lock";
  if (/^\d+$/.test(name)) return "bg";
  return "other";
}

async function walkLayers(layers, path, out) {
  for (const layer of layers) {
    const isGroup = !!(layer.layers && layer.layers.length);
    const isText = !!layer.textItem;
    const kind = classifyLayer(layer.name, isText, isGroup);
    const item = {
      name: layer.name,
      path: path.concat(layer.name).join(" / "),
      kind,
      visible: !!layer.visible,
      opacity: typeof layer.opacity === "number" ? Math.round(layer.opacity) : 100,
      isText,
      isGroup,
      editable: ["text", "color", "slot", "lock", "bg", "other"].includes(kind) && !isGroup,
      props: {},
    };
    if (isText) {
      try {
        item.props.contents = layer.textItem.contents || "";
      } catch {
        item.props.contents = "";
      }
    }
    out.push(item);
    if (isGroup) await walkLayers(layer.layers, path.concat(layer.name), out);
  }
}

function layerFilterMode() {
  return $("layerFilter")?.value || "all";
}

function layersForUi() {
  if (scannedLayers.length) return scannedLayers;
  if (layerSchema.layers?.length) return layerSchema.layers;
  // Seed from locked layout names + known P10 layers so the panel isn't empty
  const fromLayout = Object.keys(mergedLayout?.layers || ratioLayout?.layers || {}).map((name) => ({
    name,
    kind: classifyLayer(name, name.startsWith("txt/"), false),
    editable: true,
    visible: true,
    opacity: 100,
    props: {},
  }));
  if (fromLayout.length) return fromLayout;
  return DEFAULT_P10_LAYERS.map((l) => ({ ...l, props: {} }));
}

function filteredLayers(row) {
  const list = layersForUi().filter((l) => l.kind !== "group");
  const mode = layerFilterMode();
  const overrides = row ? ensureRowOverrides(row) : {};
  const locks = mergedLayout?.layers || ratioLayout?.layers || {};
  return list.filter((l) => {
    if (mode === "editable") return !!l.editable || l.kind === "text" || l.kind === "color";
    if (mode === "bound") return !!overrides[l.name] || !!l.includeInSheet;
    if (mode === "locked") return !!locks[l.name]?.locked;
    return true;
  });
}

function defaultPropsForLayer(layer) {
  const L = window.P10Layout;
  const base = L ? L.propsForKind(layer.kind || "any") : ["opacity", "visible"];
  const extras = boundPropExtras[layer.name] || [];
  return [...new Set([...base.slice(0, 4), ...extras])];
}

function renderLayerList(row) {
  const box = $("layerList");
  if (!box) return;
  const list = filteredLayers(row);
  if (!list.length) {
    box.textContent = "No layers match filter.";
    return;
  }
  const overrides = row ? ensureRowOverrides(row) : {};
  const locks = mergedLayout?.layers || ratioLayout?.layers || {};
  const live = scannedLayers.length > 0;
  box.innerHTML = "";
  if (!live) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Showing defaults — Apply or Scan for live PSD layers";
    box.appendChild(hint);
  }
  for (const layer of list) {
    const ov = overrides[layer.name] || {};
    const locked = !!locks[layer.name]?.locked;
    const div = document.createElement("div");
    div.className = "layer-row" + (selectedLayerName === layer.name ? " selected" : "");

    const head = document.createElement("div");
    head.className = "layer-row-head";

    const selChk = document.createElement("input");
    selChk.type = "checkbox";
    selChk.checked = selectedLayerNames.has(layer.name);
    selChk.title = "Save only these layers";
    selChk.onchange = () => {
      if (selChk.checked) selectedLayerNames.add(layer.name);
      else selectedLayerNames.delete(layer.name);
    };
    head.appendChild(selChk);

    const nameEl = document.createElement("span");
    nameEl.className = "name";
    nameEl.textContent = layer.name;
    nameEl.onclick = () => {
      selectedLayerName = layer.name;
      const sel = $("layerSelect");
      if (sel) {
        if (![...sel.options].some((o) => o.value === layer.name)) {
          const opt = document.createElement("option");
          opt.value = layer.name;
          opt.textContent = layer.name;
          sel.appendChild(opt);
        }
        sel.value = layer.name;
      }
      fillAddPropSelect(layer);
      renderLayerList(row);
    };
    head.appendChild(nameEl);

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = layer.kind || "?";
    head.appendChild(badge);

    if (locked) {
      const lb = document.createElement("span");
      lb.className = "badge lock";
      lb.textContent = "locked";
      head.appendChild(lb);
    }
    if (layer.includeInSheet || overrides[layer.name]) {
      const sb = document.createElement("span");
      sb.className = "badge sheet";
      sb.textContent = "sheet";
      head.appendChild(sb);
    }

    const vis = document.createElement("label");
    vis.className = "inc";
    const vchk = document.createElement("input");
    vchk.type = "checkbox";
    vchk.dataset.layer = layer.name;
    vchk.dataset.prop = "visible";
    vchk.checked = ov.visible != null ? !!ov.visible : !!layer.visible;
    vis.appendChild(vchk);
    vis.appendChild(document.createTextNode("vis"));
    head.appendChild(vis);

    const ratioLock = document.createElement("label");
    ratioLock.className = "inc";
    ratioLock.title = "Locked across ratio (inherits baseline)";
    const rchk = document.createElement("input");
    rchk.type = "checkbox";
    rchk.checked = locked;
    rchk.onchange = async () => {
      selectedLayerName = layer.name;
      const sel = $("layerSelect");
      if (sel) sel.value = layer.name;
      await onLockSelected();
    };
    ratioLock.appendChild(rchk);
    ratioLock.appendChild(document.createTextNode("ratio-lock"));
    head.appendChild(ratioLock);

    div.appendChild(head);

    const showProps = layerListExpanded || selectedLayerName === layer.name;
    if (showProps) {
      const propsWrap = document.createElement("div");
      propsWrap.className = "layer-props";
      const propNames = defaultPropsForLayer(layer);
      for (const prop of propNames) {
        if (prop === "visible" || prop === "bounds") continue;
        const lab = document.createElement("span");
        lab.className = "prop-label";
        lab.textContent = prop;
        propsWrap.appendChild(lab);
        if (prop === "hex" || prop === "color") {
          const color = document.createElement("input");
          color.type = "color";
          color.dataset.layer = layer.name;
          color.dataset.prop = prop === "color" ? "hex" : "hex";
          color.value = ov.hex || "#B6F25C";
          propsWrap.appendChild(color);
        } else {
          const inp = document.createElement("input");
          inp.type = "text";
          inp.dataset.layer = layer.name;
          inp.dataset.prop = prop;
          if (prop === "contents") {
            inp.value = ov.contents != null ? ov.contents : layer.props?.contents || "";
          } else if (prop === "opacity") {
            inp.value = ov.opacity != null ? String(ov.opacity) : String(layer.opacity ?? 100);
          } else if (prop === "fxScale") {
            inp.value = ov.fxScale != null ? String(ov.fxScale) : "100";
          } else if (prop === "sizePx") {
            inp.value = ov.sizePx != null ? String(ov.sizePx) : "";
          } else {
            inp.value = ov[prop] != null ? String(ov[prop]) : "";
          }
          propsWrap.appendChild(inp);
        }
      }
      const sheetInc = document.createElement("label");
      sheetInc.className = "inc";
      const schk = document.createElement("input");
      schk.type = "checkbox";
      schk.dataset.layer = layer.name;
      schk.dataset.role = "include";
      schk.checked = !!layer.includeInSheet;
      schk.title = "Include when Save pushes bindings";
      sheetInc.appendChild(schk);
      sheetInc.appendChild(document.createTextNode(" push binding"));
      propsWrap.appendChild(sheetInc);
      div.appendChild(propsWrap);
    }

    box.appendChild(div);
  }
  populateLayerSelect();
}

function fillAddPropSelect(layer) {
  const sel = $("addPropSelect");
  if (!sel) return;
  const L = window.P10Layout;
  const props = L ? L.propsForKind(layer?.kind || "any") : [];
  sel.innerHTML = '<option value="">— bind prop —</option>';
  for (const p of props) {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    sel.appendChild(o);
  }
}

function onBindProp() {
  const name = selectedLayerName || $("layerSelect")?.value;
  const prop = $("addPropSelect")?.value;
  if (!name || !prop) return say("Select a layer and a property");
  if (!boundPropExtras[name]) boundPropExtras[name] = [];
  if (!boundPropExtras[name].includes(prop)) boundPropExtras[name].push(prop);
  layerListExpanded = true;
  renderLayerList(currentRow());
  say(`Bound prop ${prop} on ${name}`);
}

function renderPropsFromScan(row) {
  // Keep legacy propsBox in sync for collectPropsFromUi when present
  const box = $("propsBox");
  if (!box) return;
  // Prefer layer list as source of truth — mirror inputs into propsBox for collect
  box.innerHTML = "";
  const listEl = $("layerList");
  if (!listEl) return;
  for (const el of listEl.querySelectorAll("[data-layer][data-prop]")) {
    const clone = el.cloneNode(true);
    box.appendChild(clone);
  }
  for (const el of listEl.querySelectorAll('[data-role="include"]')) {
    const clone = el.cloneNode(true);
    box.appendChild(clone);
  }
}

function collectPropsFromUi(row) {
  const props = ensureRowOverrides(row);
  const roots = [$("layerList"), $("propsBox")].filter(Boolean);
  for (const box of roots) {
    const nodes = box.querySelectorAll("[data-layer][data-prop]");
    for (const el of nodes) {
      const name = el.dataset.layer;
      const prop = el.dataset.prop;
      if (!props[name]) props[name] = {};
      if (el.type === "checkbox") props[name][prop] = el.checked;
      else props[name][prop] = el.value;
      if (prop === "hex") props[name].kind = "color";
    }
    for (const el of box.querySelectorAll('[data-role="include"]')) {
      const layer = scannedLayers.find((l) => l.name === el.dataset.layer);
      if (layer) layer.includeInSheet = el.checked;
    }
  }
  return props;
}

/**
 * Walk active document layers into scannedLayers.
 * Call from inside an existing executeAsModal, or pass { ownModal: true }.
 */
async function scanLayersIntoState(doc, { persist = false } = {}) {
  const out = [];
  await walkLayers(doc.layers, [], out);
  scannedLayers = out;
  layerSchema = {
    layers: out,
    updatedAt: new Date().toISOString(),
    source: currentRow()?.template || "activeDocument",
  };
  if (persist && projectFolder) {
    try {
      await writeRel(
        "fixtures/templater/layer-schema.json",
        JSON.stringify(layerSchema, null, 2),
      );
    } catch {
      /* non-fatal */
    }
  }
  return out;
}

async function onScanLayers() {
  setBusy(true);
  say("Scanning layers…");
  try {
    let count = 0;
    await core.executeAsModal(
      async () => {
        const doc = app.activeDocument;
        if (!doc) throw new Error("Open a template first — Apply a row");
        const out = await scanLayersIntoState(doc, { persist: true });
        count = out.length;
      },
      { commandName: "Scan layers" },
    );
    renderPropsFromScan(currentRow());
    populateLayerSelect();
    renderLayerList(currentRow());
    say(`Layers: ${count} from open PSD`);
  } catch (err) {
    say(`Scan failed: ${err.message || err}`);
    renderLayerList(currentRow());
  } finally {
    setBusy(false);
  }
}

async function pushSheetBindings(chosen) {
  const header = "Template_ID,layer_name,kind,field,editable_props\n";
  const lines = chosen.map((l) => {
    const field =
      l.kind === "text"
        ? l.name === "txt/sub"
          ? "Copy"
          : "Title"
        : l.kind === "color"
          ? "color.accent"
          : l.name;
    const props =
      l.kind === "text"
        ? "contents;font;size;visible;opacity;fxScale"
        : l.kind === "color"
          ? "hex;visible;opacity;fxScale"
          : "visible;opacity;fxScale";
    return `tpl_ig_4x5,${l.name},${l.kind},${field},"${props}"`;
  });
  const extra = ["tpl_ig_1x1", "tpl_story_9x16", "tpl_cover_16x9"]
    .map((tpl) =>
      chosen
        .map((l) => {
          const field =
            l.kind === "text"
              ? l.name === "txt/sub"
                ? "Copy"
                : "Title"
              : l.kind === "color"
                ? "color.accent"
                : l.name;
          const props =
            l.kind === "text"
              ? "contents;font;size;visible;opacity;fxScale"
              : l.kind === "color"
                ? "hex;visible;opacity;fxScale"
                : "visible;opacity;fxScale";
          return `${tpl},${l.name},${l.kind},${field},"${props}"`;
        })
        .join("\n"),
    )
    .join("\n");

  const csv = header + lines.join("\n") + "\n" + extra + "\n";
  await writeRel("fixtures/templater/Editable_Layers.csv", csv);
  try {
    const existing = await (await entryFromRel("fixtures/sheets/Layer_Bindings.csv")).read();
    const have = new Set(
      existing
        .split(/\r?\n/)
        .slice(1)
        .filter(Boolean)
        .map((l) => l.split(",").slice(0, 3).join(",")),
    );
    const add = [];
    for (const line of (lines.join("\n") + "\n" + extra).split("\n")) {
      if (!line) continue;
      const key = line.split(",").slice(0, 3).join(",");
      if (!have.has(key)) add.push(line.split(",").slice(0, 4).join(","));
    }
    if (add.length) {
      const merged = existing.replace(/\s*$/, "") + "\n" + add.join("\n") + "\n";
      await writeRel("fixtures/sheets/Layer_Bindings.csv", merged);
    }
  } catch (err) {
    console.error(err);
  }

  layerSchema.layers = scannedLayers;
  await writeRel("fixtures/templater/layer-schema.json", JSON.stringify(layerSchema, null, 2));
}

async function onApply() {
  if (!currentRow()) return say("No row");
  setBusy(true);
  try {
    collectPropsFromUi(currentRow());
    await applyCurrent({ openTemplate: true, quiet: false });
  } catch (err) {
    say(`Apply failed: ${err.message || err}`);
  } finally {
    setBusy(false);
  }
}

async function onApplyNext() {
  if (!currentRow()) return;
  setBusy(true);
  try {
    collectPropsFromUi(currentRow());
    await applyCurrent({ openTemplate: true, quiet: true });
    rowIndex = (rowIndex + 1) % dataset.rows.length;
    renderFields(currentRow());
    if (autoLoadOn()) {
      await applyCurrent({ openTemplate: true, quiet: true });
    }
    say(`Now ${currentRow().id}`);
  } catch (err) {
    say(`Apply+Next failed: ${err.message || err}`);
  } finally {
    setBusy(false);
  }
}

async function getOrCreateFolder(parent, name) {
  const entries = await parent.getEntries();
  return entries.find((e) => e.name === name && e.isFolder) || parent.createFolder(name);
}

async function ensureExportFolder(ratioKey) {
  if (!projectFolder) throw new Error("Set Repo folder to export JPGs");
  let cur = projectFolder;
  for (const part of ["fixtures", "templater", "exports", ratioKey || "out"]) {
    cur = await getOrCreateFolder(cur, part);
  }
  return cur;
}

async function exportJpg(row) {
  return core.executeAsModal(
    async () => {
      const doc = app.activeDocument;
      if (!doc) throw new Error("No active document");
      const folder = await ensureExportFolder(row.ratioKey || "out");
      const file = await folder.createFile(row.exportFile || `${row.id}.jpg`, {
        overwrite: true,
      });
      await doc.saveAs.jpg(file, { quality: 12 }, true);
      return file.nativePath || row.exportFile;
    },
    { commandName: `Export ${row.id}` },
  );
}

async function onExport() {
  const row = currentRow();
  if (!row) return;
  setBusy(true);
  try {
    collectPropsFromUi(row);
    await applyCurrent({ openTemplate: true, quiet: true });
    await exportJpg(row);
    say(`Exported ${row.ratioKey}/${row.exportFile}`);
  } catch (err) {
    say(`Export failed: ${err.message || err}`);
  } finally {
    setBusy(false);
  }
}

async function onRenderAll() {
  if (!dataset?.rows?.length) return;
  const n = dataset.rows.length;
  if (!confirm(`Export all ${n} variants? This can take several minutes.`)) return;
  setBusy(true);
  const errors = [];
  for (let i = 0; i < dataset.rows.length; i++) {
    rowIndex = i;
    const row = currentRow();
    if (row?.ratioKey) await loadMergedLayout(row);
    renderFields(row);
    say(`Rendering ${i + 1}/${n}`);
    try {
      await applyCurrent({ openTemplate: true, quiet: true });
      await exportJpg(currentRow());
    } catch (err) {
      errors.push(`${currentRow().id}: ${err.message || err}`);
    }
  }
  setBusy(false);
  say(errors.length ? `Done with errors:\n${errors.slice(0, 8).join("\n")}` : "Rendered all");
}

function nudgeStep() {
  const el = document.querySelector('input[name="nudgeStep"]:checked');
  return el ? parseInt(el.value, 10) || 1 : 1;
}

function populateLayerSelect() {
  const sel = $("layerSelect");
  if (!sel) return;
  const prev = sel.value || selectedLayerName;
  const names = (scannedLayers.length ? scannedLayers : ratioLayout?.layers ? Object.keys(ratioLayout.layers) : [])
    .map((l) => (typeof l === "string" ? l : l.name))
    .filter(Boolean);
  const unique = [...new Set(names)];
  sel.innerHTML = '<option value="">— layer —</option>';
  for (const name of unique) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (ratioLayout?.layers?.[name]?.locked) opt.textContent += " 🔒";
    sel.appendChild(opt);
  }
  if (prev && unique.includes(prev)) sel.value = prev;
  selectedLayerName = sel.value || "";
}

async function loadRatioLayout(ratioKey) {
  if (!ratioKey || !projectFolder) {
    ratioLayout = null;
    return;
  }
  try {
    const file = await entryFromRel(`fixtures/templater/layouts/${ratioKey}.json`);
    ratioLayout = JSON.parse(await file.read());
  } catch {
    ratioLayout = null;
  }
}

async function loadVariantLayout(contentId, ratioKey) {
  variantLayout = null;
  if (!contentId || !ratioKey || !projectFolder || !window.P10Layout) return;
  try {
    const rel = window.P10Layout.variantRelPath(contentId, ratioKey);
    const file = await entryFromRel(rel);
    variantLayout = JSON.parse(await file.read());
  } catch {
    variantLayout = null;
  }
}

async function loadMergedLayout(row) {
  const ratioKey = row?.ratioKey;
  const contentId = row?.contentId || String(row?.id || "").replace(/_4x5$|_1x1$|_9x16$|_16x9$/, "");
  await loadRatioLayout(ratioKey);
  await loadVariantLayout(contentId, ratioKey);
  if (window.P10Layout) {
    mergedLayout = {
      ratioKey,
      canvas: ratioLayout?.canvas || { w: row.canvasWidth, h: row.canvasHeight },
      layers: window.P10Layout.mergeLayoutLayers(ratioLayout?.layers || {}, variantLayout?.layers || {}),
    };
  } else {
    mergedLayout = ratioLayout;
  }
  populateLayerSelect();
  renderLayerList(currentRow());
}

async function applyLockedLayout(doc, layout) {
  if (!layout?.layers) return;
  const W = doc.width;
  const H = doc.height;
  const L = window.P10Layout;
  for (const [name, spec] of Object.entries(layout.layers)) {
    if (!spec?.locked) continue;
    const layer = await findLayerByName(doc.layers, name);
    if (!layer) continue;

    let target = L ? L.boxFromEntry(spec, W, H) : null;
    if (!target && spec.left != null && spec.top != null && spec.width != null && spec.height != null) {
      target = {
        left: spec.left,
        top: spec.top,
        width: spec.width,
        height: spec.height,
        right: spec.left + spec.width,
        bottom: spec.top + spec.height,
      };
    }
    if (!target) continue;

    // Text layers: translate only (scaling text via layer.scale crushes displayed pt)
    const isText = !!layer.textItem || String(name).startsWith("txt/");
    const b = layer.bounds;
    const dx = target.left - b.left;
    const dy = target.top - b.top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) layer.translate(dx, dy);

    if (isText) {
      if (spec.fontSize != null || spec.props?.sizePx != null) {
        try {
          const sz = Number(spec.props?.sizePx || spec.fontSize);
          if (Number.isFinite(sz) && layer.textItem?.characterStyle) {
            layer.textItem.characterStyle.size = sz;
          }
        } catch {
          /* */
        }
      }
      continue;
    }

    const cw = b.right - b.left;
    const ch = b.bottom - b.top;
    if (cw > 1 && ch > 1 && target.width > 1 && target.height > 1) {
      const sx = (target.width / cw) * 100;
      const sy = (target.height / ch) * 100;
      if (Math.abs(sx - 100) > 0.5 || Math.abs(sy - 100) > 0.5) {
        await selectOnlyLayer(layer);
        if (typeof layer.scale === "function") layer.scale(sx, sy);
      }
    }
  }
}

async function resolveTargetLayer(doc) {
  const fromSelect = $("layerSelect")?.value || selectedLayerName;
  if (fromSelect) {
    const layer = await findLayerByName(doc.layers, fromSelect);
    if (layer) return layer;
  }
  // Fall back to Photoshop active layer
  try {
    if (doc.activeLayers?.length) return doc.activeLayers[0];
    if (doc.activeLayer) return doc.activeLayer;
  } catch {
    /* ignore */
  }
  throw new Error("Select a layer in the panel or in Photoshop");
}

async function onUsePsSelection() {
  try {
    await core.executeAsModal(
      async () => {
        const doc = app.activeDocument;
        if (!doc) throw new Error("No document");
        const layer = doc.activeLayers?.[0] || doc.activeLayer;
        if (!layer) throw new Error("Nothing selected in Photoshop");
        selectedLayerName = layer.name;
        const sel = $("layerSelect");
        if (sel) {
          if (![...sel.options].some((o) => o.value === layer.name)) {
            const opt = document.createElement("option");
            opt.value = layer.name;
            opt.textContent = layer.name;
            sel.appendChild(opt);
          }
          sel.value = layer.name;
        }
        say(`Target: ${layer.name}`);
      },
      { commandName: "Read PS selection" },
    );
  } catch (err) {
    say(`PS sel: ${err.message || err}`);
  }
}

async function nudgeLayer(dx, dy) {
  setBusy(true);
  try {
    await core.executeAsModal(
      async () => {
        const doc = app.activeDocument;
        if (!doc) throw new Error("No document");
        const layer = await resolveTargetLayer(doc);
        const lock = ratioLayout?.layers?.[layer.name];
        if (lock?.locked) throw new Error(`${layer.name} is locked — tap Lock sel to unlock`);
        await selectOnlyLayer(layer);
        layer.translate(dx, dy);
        selectedLayerName = layer.name;
        say(`Nudge ${layer.name} ${dx >= 0 ? "+" : ""}${dx},${dy >= 0 ? "+" : ""}${dy}`);
      },
      { commandName: "Nudge layer" },
    );
  } catch (err) {
    say(`Nudge failed: ${err.message || err}`);
  } finally {
    setBusy(false);
  }
}

async function nudgeLayerSize(pctDelta) {
  setBusy(true);
  try {
    await core.executeAsModal(
      async () => {
        const doc = app.activeDocument;
        if (!doc) throw new Error("No document");
        const layer = await resolveTargetLayer(doc);
        if (ratioLayout?.layers?.[layer.name]?.locked) {
          throw new Error(`${layer.name} is locked`);
        }
        await selectOnlyLayer(layer);
        const scale = 100 + pctDelta;
        // Prefer layer.scale if available; else batchPlay transform
        if (typeof layer.scale === "function") {
          layer.scale(scale, scale);
        } else {
          await action.batchPlay(
            [
              {
                _obj: "transform",
                _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
                freeTransformCenterState: {
                  _enum: "quadCenterState",
                  _value: "QCSAverage",
                },
                width: { _unit: "percentUnit", _value: scale },
                height: { _unit: "percentUnit", _value: scale },
                interfaceIconFrameDimmed: {
                  _enum: "interpolationType",
                  _value: "bicubic",
                },
                _options: { dialogOptions: "dontDisplay" },
              },
            ],
            {},
          );
        }
        say(`Size ${layer.name} ${pctDelta >= 0 ? "+" : ""}${pctDelta}%`);
      },
      { commandName: "Scale layer" },
    );
  } catch (err) {
    say(`Size failed: ${err.message || err}`);
  } finally {
    setBusy(false);
  }
}

async function captureDocLayout(doc, ratioKey) {
  const W = doc.width;
  const H = doc.height;
  const layers = {};

  async function walk(list) {
    for (const layer of list) {
      if (layer.layers?.length) {
        await walk(layer.layers);
        continue;
      }
      const b = layer.bounds;
      const left = b.left;
      const top = b.top;
      const right = b.right;
      const bottom = b.bottom;
      const width = right - left;
      const height = bottom - top;
      if (width < 1 || height < 1) continue;
      const prev = ratioLayout?.layers?.[layer.name];
      layers[layer.name] = {
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(width),
        height: Math.round(height),
        leftFrac: left / W,
        topFrac: top / H,
        rightFrac: (W - right) / W,
        bottomFrac: (H - bottom) / H,
        locked: prev?.locked || false,
        smart: prev?.smart || false,
        visible: !!layer.visible,
        fontSize: prev?.fontSize ?? null,
      };
    }
  }

  await walk(doc.layers);
  return {
    ratioKey,
    canvas: { w: Math.round(W), h: Math.round(H) },
    source: ratioLayout?.source || { ratioKey: "4x5", w: 1080, h: 1350 },
    updatedAt: new Date().toISOString(),
    layers,
  };
}

async function writeLayoutForScope(scope, row, payload, layerFilter) {
  const ratioKey = row?.ratioKey || payload.ratioKey || "custom";
  const contentId =
    row?.contentId || String(row?.id || "").replace(/_4x5$|_1x1$|_9x16$|_16x9$/, "");
  const L = window.P10Layout;

  function filterLayers(layers) {
    if (!layerFilter || !layerFilter.size) return layers;
    const out = {};
    for (const [n, e] of Object.entries(layers)) {
      if (layerFilter.has(n)) out[n] = e;
    }
    return out;
  }

  if (scope === "ratio") {
    // Merge into baseline; keep unlock flags for layers not in capture
    const base = ratioLayout?.layers ? { ...ratioLayout.layers } : {};
    const captured = filterLayers(payload.layers);
    for (const [n, e] of Object.entries(captured)) {
      base[n] = { ...(base[n] || {}), ...e, locked: e.locked || base[n]?.locked || false };
    }
    // Default: newly saved layout layers are locked across ratio unless marked unlocked
    for (const n of Object.keys(captured)) {
      if (base[n].locked == null) base[n].locked = true;
    }
    const file = {
      ...payload,
      layers: base,
      updatedAt: new Date().toISOString(),
    };
    await writeRel(`fixtures/templater/layouts/${ratioKey}.json`, JSON.stringify(file, null, 2));
    ratioLayout = file;
    return `ratio ${ratioKey}.json`;
  }

  if (scope === "variant") {
    const layers = filterLayers(payload.layers);
    // Sparse: only store selected (or all captured) as overrides; mark locked false by default for variant
    const sparse = {};
    for (const [n, e] of Object.entries(layers)) {
      sparse[n] = { ...e, locked: e.locked != null ? e.locked : false };
    }
    const file = {
      contentId,
      ratioKey,
      updatedAt: new Date().toISOString(),
      layers: sparse,
    };
    const rel = L ? L.variantRelPath(contentId, ratioKey) : `fixtures/templater/layouts/variants/${contentId}_${ratioKey}.json`;
    await writeRel(rel, JSON.stringify(file, null, 2));
    variantLayout = file;
    return rel;
  }

  if (scope === "content") {
    if (!dataset?.rows?.length) throw new Error("No dataset");
    const ratios = [
      ...new Set(
        dataset.rows.filter((r) => r.contentId === contentId || String(r.id).startsWith(contentId)).map((r) => r.ratioKey),
      ),
    ];
    const wrote = [];
    for (const rk of ratios) {
      const layers = filterLayers(payload.layers);
      const file = {
        contentId,
        ratioKey: rk,
        updatedAt: new Date().toISOString(),
        layers,
      };
      const rel = L ? L.variantRelPath(contentId, rk) : `fixtures/templater/layouts/variants/${contentId}_${rk}.json`;
      await writeRel(rel, JSON.stringify(file, null, 2));
      wrote.push(rel);
    }
    return `content ${contentId} (${wrote.length} files)`;
  }

  if (scope === "all") {
    // Update current ratio baseline + note
    await writeLayoutForScope("ratio", row, payload, layerFilter);
    return `all linked → updated ratio ${ratioKey} (use Content_ID scope for per-variant)`;
  }

  throw new Error(`Unknown scope ${scope}`);
}

async function saveLayoutCore({ filter = null, savePsd = true } = {}) {
  const row = currentRow();
  const ratioKey = row?.ratioKey || "custom";
  const scope = propagateScope();
  const payload = await core.executeAsModal(
    async () => {
      const doc = app.activeDocument;
      if (!doc) throw new Error("Open a template first");
      return captureDocLayout(doc, ratioKey);
    },
    { commandName: "Capture layout" },
  );
  const prior = mergedLayout?.layers || ratioLayout?.layers || {};
  for (const [name, prev] of Object.entries(prior)) {
    if (payload.layers[name] && prev.locked) payload.layers[name].locked = true;
  }
  const where = await writeLayoutForScope(scope, row, payload, filter);
  if (savePsd) {
    await core.executeAsModal(
      async () => {
        const doc = app.activeDocument;
        if (doc) await doc.save();
      },
      { commandName: "Save template PSD" },
    );
  }
  if (row) await loadMergedLayout(row);
  else {
    populateLayerSelect();
    renderLayerList(currentRow());
  }
  return { where, scope, filter };
}

/** One Save: apply props → write layout (checked layers or all) → push sheet ticks → save PSD. */
async function onSave() {
  setBusy(true);
  try {
    const row = currentRow();
    if (row) collectPropsFromUi(row);

    const parts = [];
    if (row) {
      await applyCurrent({ openTemplate: false, quiet: true });
      parts.push("props");
    }

    const filter = selectedLayerNames.size ? new Set(selectedLayerNames) : null;
    const { where, scope } = await saveLayoutCore({ filter, savePsd: true });
    parts.push(filter ? `layout [${[...filter].join(", ")}]` : "layout");

    const chosen = scannedLayers.filter((l) => l.includeInSheet);
    if (chosen.length) {
      await pushSheetBindings(chosen);
      parts.push(`bindings×${chosen.length}`);
    }

    say(`Saved ${parts.join(" · ")} · ${scope} → ${where}`);
  } catch (err) {
    say(`Save failed: ${err.message || err}`);
  } finally {
    setBusy(false);
  }
}

/** Used by lock bootstrap when no ratio layout exists yet. */
async function onSaveLayout() {
  setBusy(true);
  try {
    const { where, scope } = await saveLayoutCore({ filter: null, savePsd: true });
    say(`Saved layout (${scope}) → ${where}`);
  } catch (err) {
    say(`Save failed: ${err.message || err}`);
  } finally {
    setBusy(false);
  }
}

async function onLockSelected() {
  const name = $("layerSelect")?.value || selectedLayerName;
  if (!name) return say("Pick a layer to lock");
  const row = currentRow();
  const ratioKey = row?.ratioKey || "custom";
  if (!ratioLayout) await loadRatioLayout(ratioKey);
  if (!ratioLayout) {
    // Create baseline from capture
    const oldScope = $("propagateScope")?.value;
    if ($("propagateScope")) $("propagateScope").value = "ratio";
    await onSaveLayout();
    if ($("propagateScope") && oldScope) $("propagateScope").value = oldScope;
  }
  if (!ratioLayout?.layers) return say("No layout file yet — Save first");

  const entry = ratioLayout.layers[name] || {};
  const locking = !entry.locked;
  if (locking) {
    try {
      await core.executeAsModal(
        async () => {
          const doc = app.activeDocument;
          if (!doc) return;
          const layer = await findLayerByName(doc.layers, name);
          if (!layer) return;
          const b = layer.bounds;
          const W = doc.width;
          const H = doc.height;
          entry.left = Math.round(b.left);
          entry.top = Math.round(b.top);
          entry.width = Math.round(b.right - b.left);
          entry.height = Math.round(b.bottom - b.top);
          entry.leftFrac = b.left / W;
          entry.topFrac = b.top / H;
          entry.rightFrac = (W - b.right) / W;
          entry.bottomFrac = (H - b.bottom) / H;
          entry.widthFrac = (b.right - b.left) / W;
          entry.heightFrac = (b.bottom - b.top) / H;
        },
        { commandName: "Snapshot layer for lock" },
      );
    } catch {
      /* keep prior metrics */
    }
  }
  entry.locked = locking;
  ratioLayout.layers[name] = entry;
  ratioLayout.updatedAt = new Date().toISOString();
  await writeRel(
    `fixtures/templater/layouts/${ratioKey}.json`,
    JSON.stringify(ratioLayout, null, 2),
  );
  if (row) await loadMergedLayout(row);
  else {
    populateLayerSelect();
    renderLayerList(currentRow());
  }
  say(`${locking ? "Locked across ratio" : "Unlocked (editable per variant)"} ${name}`);
}

function on(id, event, handler) {
  const el = $(id);
  if (!el) return;
  el[event] = handler;
}

function bindPanelHandlers() {
  if (panelHandlersBound) return;
  if (!$("setProjectBtn") || !$("pullSheetBtn")) return;
  panelHandlersBound = true;

  on("setProjectBtn", "onclick", () => {
    void setProject();
  });
  on("reloadBtn", "onclick", () => {
    void loadDataset();
  });
  on("linkSheetBtn", "onclick", () => {
    void onLinkSheet();
  });
  on("pullSheetBtn", "onclick", () => {
    void onPullSheet();
  });
  on("openSheetBtn", "onclick", onOpenSheet);
  on("openHotel1Btn", "onclick", () => {
    void onOpenHotel1();
  });
  on("prevBtn", "onclick", goPrev);
  on("nextBtn", "onclick", goNext);
  on("jumpBtn", "onclick", jumpTo);
  on("jumpInput", "onkeydown", (e) => {
    if (e.key === "Enter") jumpTo();
  });
  on("sizeUpBtn", "onclick", () => bumpSize(4));
  on("sizeDownBtn", "onclick", () => bumpSize(-4));
  on("applyFontBtn", "onclick", () => applyFontLive({ quiet: false }));
  on("applyFontNowBtn", "onclick", onSaveFontAndApply);
  if ($("fontSizeInput")) {
    $("fontSizeInput").onchange = () => applyFontLive({ quiet: true });
    $("fontSizeInput").onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyFontLive({ quiet: false });
      }
    };
  }
  if ($("fontSelect")) {
    $("fontSelect").onchange = () => applyFontLive({ quiet: true });
  }
  on("applyBtn", "onclick", onApply);
  on("applyNextBtn", "onclick", onApplyNext);
  on("exportBtn", "onclick", onExport);
  on("renderAllBtn", "onclick", onRenderAll);
  on("scanBtn", "onclick", onScanLayers);
  on("usePsSelBtn", "onclick", onUsePsSelection);
  on("nudgeLeftBtn", "onclick", () => nudgeLayer(-nudgeStep(), 0));
  on("nudgeRightBtn", "onclick", () => nudgeLayer(nudgeStep(), 0));
  on("nudgeUpBtn", "onclick", () => nudgeLayer(0, -nudgeStep()));
  on("nudgeDownBtn", "onclick", () => nudgeLayer(0, nudgeStep()));
  on("laySizeDownBtn", "onclick", () => nudgeLayerSize(-2));
  on("laySizeUpBtn", "onclick", () => nudgeLayerSize(2));
  on("lockLayerBtn", "onclick", onLockSelected);
  on("saveLayoutBtn", "onclick", onSave);
  if ($("layerFilter")) $("layerFilter").onchange = () => renderLayerList(currentRow());
  if ($("expandAllBtn")) {
    $("expandAllBtn").onclick = async () => {
      if (!scannedLayers.length && app.activeDocument) {
        await onScanLayers();
      }
      layerListExpanded = !layerListExpanded;
      renderLayerList(currentRow());
    };
  }
  if ($("addPropBtn")) $("addPropBtn").onclick = onBindProp;
  if ($("layerSelect")) {
    $("layerSelect").onchange = (e) => {
      selectedLayerName = e.target.value || "";
    };
  }
}

async function bootPanel() {
  bindPanelHandlers();
  scannedLayers = scannedLayers.length ? scannedLayers : DEFAULT_P10_LAYERS.map((l) => ({ ...l }));
  renderLayerList(currentRow());
  const restored = await tryRestoreProject();
  if (restored) {
    try {
      await loadLayerSchema();
    } catch {
      /* ok */
    }
  }
  // Restore last pulled dataset from plugin storage (no repo needed)
  if (!dataset) {
    try {
      const raw = await readPluginFile(PLUGIN_DATASET);
      if (raw) {
        dataset = JSON.parse(raw);
        rowIndex = 0;
        renderFields(currentRow());
      }
    } catch {
      /* ok */
    }
  }
  await refreshSheetUi();
  say(
    restored
      ? "Repo restored. Pull Content_DB → Apply."
      : "Pull Content_DB for rows. Repo folder only if you need templates / Save / export.",
  );
}

entrypoints.setup({
  panels: {
    "com.psdautomation.renderer.panel": {
      create() {
        bindPanelHandlers();
      },
      show() {
        void bootPanel();
      },
    },
  },
});

// Fallback if create/show timing is weird in UDT reload
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bindPanelHandlers());
  } else {
    bindPanelHandlers();
  }
}