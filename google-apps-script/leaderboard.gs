const SHEET_NAME = "Scores";
const HEADERS = ["savedAt", "modeKey", "initials", "timeMs", "incorrectAttempts"];
const VALID_MODE_KEYS = new Set([
  "binary_decimal_4bit",
  "binary_decimal_8bit",
  "binary_hex_1byte",
  "decimal_hex_1byte",
  "all_conversions"
]);

function doGet(event) {
  const action = String(event.parameter.action || "");
  if (action === "save") {
    const payload = JSON.parse(event.parameter.score || "{}");
    const score = saveScore(payload);

    return jsonResponse({
      ok: true,
      scores: getTopScores(score.modeKey)
    }, event.parameter.callback);
  }

  const modeKey = String(event.parameter.modeKey || "");
  return jsonResponse({
    scores: getTopScores(modeKey)
  }, event.parameter.callback);
}

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || "{}");
  const score = saveScore(payload);

  return jsonResponse({
    ok: true,
    scores: getTopScores(score.modeKey)
  });
}

function saveScore(payload) {
  const score = normalizeScore(payload);

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = getScoresSheet();
    sheet.appendRow([
      score.savedAt,
      score.modeKey,
      score.initials,
      score.timeMs,
      score.incorrectAttempts
    ]);
  } finally {
    lock.releaseLock();
  }

  return score;
}

function getTopScores(modeKey) {
  if (!VALID_MODE_KEYS.has(modeKey)) {
    return [];
  }

  const sheet = getScoresSheet();
  const rows = sheet.getDataRange().getValues().slice(1);

  return rows
    .map(rowToScore)
    .filter((score) => score.modeKey === modeKey)
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, 10);
}

function rowToScore(row) {
  return {
    savedAt: String(row[0] || ""),
    modeKey: String(row[1] || ""),
    initials: String(row[2] || ""),
    timeMs: Number(row[3]),
    incorrectAttempts: Number(row[4])
  };
}

function normalizeScore(payload) {
  const modeKey = String(payload.modeKey || "");
  const initials = String(payload.initials || "").replace(/[^a-z]/gi, "").toUpperCase().slice(0, 3);
  const timeMs = Number(payload.timeMs);
  const incorrectAttempts = Number(payload.incorrectAttempts);

  if (!VALID_MODE_KEYS.has(modeKey)) {
    throw new Error("Invalid modeKey");
  }

  if (initials.length !== 3) {
    throw new Error("Initials must contain exactly 3 letters");
  }

  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new Error("Invalid timeMs");
  }

  if (!Number.isInteger(incorrectAttempts) || incorrectAttempts < 0) {
    throw new Error("Invalid incorrectAttempts");
  }

  return {
    savedAt: payload.savedAt || new Date().toISOString(),
    modeKey,
    initials,
    timeMs,
    incorrectAttempts
  };
}

function getScoresSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = HEADERS.every((header, index) => firstRow[index] === header);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  return sheet;
}

function jsonResponse(payload, callback) {
  const json = JSON.stringify(payload);
  const safeCallback = String(callback || "").match(/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/);

  if (safeCallback) {
    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
