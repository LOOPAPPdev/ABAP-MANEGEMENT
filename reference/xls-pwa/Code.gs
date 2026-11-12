/**
 * Governance API — Google Apps Script ligado à planilha (Extensions > Apps Script).
 * Lê/escreve a aba DATA_Activities pelo ID da atividade. Token fica em Propriedades do script (TOKEN).
 */
const SHEET = 'DATA_Activities', HEADER_ROW = 4;
const READ = ['ID','Phase','Area','Activity','Objective','Tutorial','Knowledge','Tool','Deliverable','Dependency','Acceptance','Reference','Status','Priority','Owner','Due','Evidence','Notes'];
const WRITE = ['Status','Priority','Owner','Due','Evidence','Notes']; // só colunas de INPUT

function doGet(e) { return out(handle({ action: (e.parameter || {}).action || 'pull', token: (e.parameter || {}).token })); }
function doPost(e) {
  let b; try { b = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  return out(handle(b));
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function handle(b) {
  const tk = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!tk || b.token !== tk) return { ok: false, error: 'unauthorized' };
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET);
  if (!sh) return { ok: false, error: 'sheet not found: ' + SHEET };
  const last = sh.getLastRow(), vals = sh.getRange(HEADER_ROW, 1, last - HEADER_ROW + 1, sh.getLastColumn()).getValues();
  const head = vals[0].map(String), col = n => head.indexOf(n), tz = Session.getScriptTimeZone();
  const idc = col('ID'), fmt = v => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : (v === null ? '' : v);
  if (b.action === 'pull') {
    const rows = vals.slice(1).filter(r => r[idc]).map(r => { const o = {}; READ.forEach(n => o[n] = fmt(r[col(n)])); return o; });
    return { ok: true, rows: rows, at: new Date().toISOString() };
  }
  if (b.action === 'push') {
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      let n = 0, miss = [];
      (b.updates || []).forEach(u => {
        const i = vals.findIndex((r, k) => k > 0 && r[idc] === u.ID);
        if (i < 0) { miss.push(u.ID); return; }
        WRITE.forEach(f => { if (f in u) sh.getRange(HEADER_ROW + i, col(f) + 1).setValue(u[f]); });
        n++;
      });
      return { ok: true, updated: n, missing: miss };
    } finally { lock.releaseLock(); }
  }
  return { ok: false, error: 'unknown action' };
}
