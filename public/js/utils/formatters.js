const KNOWN_PREFIXES = ['ผศ.ดร.', 'รศ.ดร.', 'ศ.ดร.', 'ว่าที่ ร.ต.', 'นางสาว', 'ดร.', 'นาย', 'นาง'];

export function stripKnownPrefix(raw) {
  let s = String(raw || '').trim();
  for (const p of KNOWN_PREFIXES) {
    if (s.startsWith(p)) {
      s = s.slice(p.length).trim();
      break;
    }
  }
  return s;
}

export function formatUserDisplayName(u) {
  if (!u) return '-';
  const name = String(u.name || '').trim();
  const prefix = String(u.prefix || '').trim();
  if (!prefix || name.startsWith(prefix)) {
    return name || '-';
  }
  return `${prefix}${name}`;
}

export function formatSelfScoreDisplay(type, val) {
  if (val === undefined || val === null || val === '') return '-';
  const s = String(val).trim();
  if (type === 'BOOLEAN') {
    return (s === 'มี' || s === '4') ? 'มี (4.00)' : 'ไม่มี (0.00)';
  }
  const n = parseFloat(s);
  return isNaN(n) ? s : `ระดับ ${s} (${n.toFixed(2)})`;
}

export function formatJudgeScoreDisplay(v) {
  if (v === undefined || v === null || v === '') return '-';
  const n = parseFloat(v);
  return isNaN(n) ? String(v) : `${n.toFixed(2)} / 4.00`;
}

export function getPerformanceGrade(v) {
  const n = parseFloat(v);
  if (isNaN(n) || n === 0) {
    return { grade: 'รอตรวจ', percent: '0%' };
  }
  const pct = ((n / 4) * 100).toFixed(1) + '%';
  let grade = 'ปรับปรุง';
  if (n >= 3.5) grade = 'ดีเด่น';
  else if (n >= 3.0) grade = 'ดีมาก';
  else if (n >= 2.5) grade = 'ดี';
  else if (n >= 2.0) grade = 'พอใช้';
  return { grade, percent: pct };
}

export function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

export function getThaiPrintDateStr(inp = null) {
  const p = inp ? new Date(inp) : new Date();
  const d = isNaN(p.getTime()) ? new Date() : p;
  return `${d.getDate()} / ${d.getMonth() + 1} / ${d.getFullYear() + 543}`;
}
