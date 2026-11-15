// public/js/utils/formatters.js

const KNOWN_PREFIXES = ['ผศ.ดร.', 'รศ.ดร.', 'ศ.ดร.', 'ว่าที่ ร.ต.', 'นางสาว', 'ดร.', 'นาย', 'นาง'];

export function stripKnownPrefix(rawName) {
  let clean = String(rawName || '').trim();
  for (const p of KNOWN_PREFIXES) {
    if (clean.startsWith(p)) {
      clean = clean.slice(p.length).trim();
      break;
    }
  }
  return clean;
}

export function formatUserDisplayName(u) {
  if (!u) return '-';
  const name = String(u.name || '').trim();
  const prefix = String(u.prefix || '').trim();
  if (!prefix || name.startsWith(prefix)) return name || '-';
  return `${prefix}${name}`;
}

export function formatSelfScoreDisplay(evalType, selfScore) {
  if (selfScore === undefined || selfScore === null || selfScore === '') return '-';
  const s = String(selfScore).trim();
  if (evalType === 'BOOLEAN') {
    return (s === 'มี' || s === '4') ? 'มี (4.00)' : 'ไม่มี (0.00)';
  }
  const num = parseFloat(s);
  return isNaN(num) ? s : `ระดับ ${s} (${num.toFixed(2)})`;
}

export function formatJudgeScoreDisplay(scoreVal) {
  if (scoreVal === undefined || scoreVal === null || scoreVal === '') return '-';
  const num = parseFloat(scoreVal);
  return isNaN(num) ? String(scoreVal) : `${num.toFixed(2)} / 4.00`;
}

export function getPerformanceGrade(scoreVal) {
  const score = parseFloat(scoreVal);
  if (isNaN(score) || score === 0) return { grade: 'รอตรวจ', percent: '0%' };
  const pct = ((score / 4) * 100).toFixed(1) + '%';
  if (score >= 3.5) return { grade: 'ดีเด่น', percent: pct };
  if (score >= 3.0) return { grade: 'ดีมาก', percent: pct };
  if (score >= 2.5) return { grade: 'ดี', percent: pct };
  if (score >= 2.0) return { grade: 'พอใช้', percent: pct };
  return { grade: 'ปรับปรุง', percent: pct };
}

export function escapeHtml(val) {
  return String(val === null || val === undefined ? '' : val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getThaiPrintDateStr(dateInput = null) {
  const parsed = dateInput ? new Date(dateInput) : new Date();
  const d = isNaN(parsed.getTime()) ? new Date() : parsed;
  return `${d.getDate()} / ${d.getMonth() + 1} / ${d.getFullYear() + 543}`;
}
