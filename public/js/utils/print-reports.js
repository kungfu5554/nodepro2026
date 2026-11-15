import { escapeHtml, getPerformanceGrade, getThaiPrintDateStr } from './formatters.js';

const isImageSig = (s) => typeof s === 'string' && /^(data:image\/|\/uploads\/|https?:\/\/)/.test(s.trim());

function renderSignatureBox(name, roleLabel, dateStr, sigUrl = '', compact = false) {
  const dots = compact ? '(ลงชื่อ) ........................................' : '(ลงชื่อ)....................................................................';
  const imgStyle = compact ? 'max-height:40pt; max-width:125pt; object-fit:contain;' : 'max-height:46pt; max-width:160pt; object-fit:contain;';
  const sigVisual = isImageSig(sigUrl)
    ? `<div style="min-height:${compact ? '42pt' : '48pt'}; display:flex; align-items:flex-end; justify-content:center; margin-bottom:2pt;"><img src="${escapeHtml(sigUrl)}" alt="ลายเซ็น" class="print-sig-img" style="${imgStyle}" /></div>`
    : `<div style="padding-top:${compact ? '20pt' : '24pt'}; white-space:nowrap;">${dots}</div>`;
  return `
    <div class="${compact ? 'print-sign-box print-sign-box-judge' : 'print-sign-box'}">
      ${sigVisual}
      <div style="margin-top:4pt;">${name ? `( ${escapeHtml(name)} )` : '( ................................................ )'}</div>
      <div>${escapeHtml(roleLabel)}</div>
      <div>วันที่ ${escapeHtml(dateStr)}</div>
    </div>`;
}

function resolveConsolidatedJudgeSigners(d) {
  const list = Array.isArray(d.judges) ? d.judges : [];
  const count = Math.max(list.length, Number(d.requiredJudges) || 0, Number(d.judgeCount) || 0, 1);
  return Array.from({ length: count }, (_, i) => {
    const j = list[i];
    return j ? {
      name: j.name || j.judgeName || '', roleInBoard: j.roleInBoard || `กรรมการผู้ประเมินคนที่ ${i + 1}`,
      judgeSignature: j.judgeSignature || '', dateStr: j.submittedAt ? getThaiPrintDateStr(new Date(j.submittedAt)) : null
    } : { name: i === 0 && d.chairJudgeName ? d.chairJudgeName : '', roleInBoard: `กรรมการผู้ประเมินคนที่ ${i + 1}`, judgeSignature: '', dateStr: null };
  });
}

function renderIndividualMetricsRows(rows, scoreField) {
  if (!rows?.length) return '<tr><td colspan="6" style="text-align:center; padding:14pt;">ยังไม่มีรายการตัวชี้วัดในรอบการประเมินนี้</td></tr>';
  return rows.map((m, i) => `
    <tr>
      <td style="text-align:center;">${i + 1}</td>
      <td>${m.categoryName ? `<div style="font-size:9pt; color:#475569;">หมวดหมู่: ${escapeHtml(m.categoryName)}</div>` : ''}<strong>${escapeHtml(m.title || '-')}</strong>${m.description ? `<div style="font-size:9.5pt; color:#333; margin-top:2pt;">${escapeHtml(m.description)}</div>` : ''}</td>
      <td style="text-align:center;">${escapeHtml(m.weight)}%</td>
      <td style="font-size:10pt; white-space:pre-line;">${escapeHtml(m.teacherComment || '-')}</td>
      <td style="text-align:center;">${escapeHtml(m.selfScoreDisplay || '-')}</td>
      <td style="text-align:center; font-weight:bold;">${escapeHtml(m[scoreField] || '-')}</td>
    </tr>`).join('');
}

function renderConsolidatedAverageRows(rows) {
  if (!rows?.length) return '<tr><td colspan="6" style="text-align:center; padding:14pt;">ยังไม่มีรายการตัวชี้วัดในรอบการประเมินนี้</td></tr>';
  return rows.map((m, i) => {
    const raw = parseFloat(m.avgRawScore);
    return `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td>${m.categoryName ? `<div style="font-size:9pt; color:#475569;">หมวดหมู่: ${escapeHtml(m.categoryName)}</div>` : ''}<strong>${escapeHtml(m.title || '-')}</strong>${m.description ? `<div style="font-size:9.5pt; color:#333; margin-top:2pt;">${escapeHtml(m.description)}</div>` : ''}</td>
        <td style="text-align:center;">${escapeHtml(m.weight)}%</td>
        <td style="text-align:center;">${escapeHtml(m.selfScoreDisplay || '-')}</td>
        <td style="text-align:center; font-weight:bold;">${escapeHtml(m.avgScoreDisplay || '-')}</td>
        <td style="text-align:center;">${escapeHtml(!isNaN(raw) ? getPerformanceGrade(raw).grade : '-')}</td>
      </tr>`;
  }).join('');
}

export function buildOfficialInnerHTML(mode, data = {}, context = {}) {
  const dateStr = getThaiPrintDateStr();
  const periodName = data.periodName || context.periodName || '';
  const totalWeight = data.totalWeight || context.totalWeight || 100;

  if (mode === 'consolidated') {
    const totalScoreText = (data.totalScore && data.totalScore !== '-') ? `${escapeHtml(data.totalScore)} / 4.00` : '- / 4.00';
    const pctText = (data.totalScore && data.totalScore !== '-' && !isNaN(parseFloat(data.totalScore))) ? `${((parseFloat(data.totalScore) / 4) * 100).toFixed(2)}%` : '-';
    const gradeText = getPerformanceGrade(data.totalScore).grade;

    return `
      <div class="print-doc-wrap">
        <div class="print-doc-header">
          <h1>แบบสรุปผลการประเมินผลการปฏิบัติงานเฉลี่ยรวม (ฉบับสรุปคะแนน)</h1>
          <h2>(คำนวณค่าเฉลี่ยรวมจากคณะกรรมการผู้ประเมินทุกท่าน)</h2>
          <div style="font-size: 11pt; margin-top: 4pt;">รอบการประเมิน: ${escapeHtml(periodName)}</div>
        </div>
        <table class="print-meta-table">
          <tr><td width="55%"><strong>ชื่อผู้รับการประเมิน:</strong> ${escapeHtml(data.teacherName || '-')}</td><td width="45%"><strong>ตำแหน่ง:</strong> ${escapeHtml(data.position || 'ครู')}</td></tr>
          <tr><td><strong>สังกัด / แผนกวิชา:</strong> ${escapeHtml(data.department || data.teacherDepartment || '-')}</td><td><strong>เลขประจำตัวประชาชน:</strong> ${escapeHtml(data.teacherCitizenId || '-')}</td></tr>
          <tr><td><strong>จำนวนกรรมการที่ร่วมประเมิน:</strong> ${escapeHtml(data.judgeCount || 0)} ท่าน</td><td><strong>ร้อยละคะแนนเฉลี่ยรวม:</strong> ${escapeHtml(pctText)} (${escapeHtml(gradeText)})</td></tr>
        </table>
        <table class="print-table">
          <thead><tr><th width="6%">ลำดับ</th><th width="42%">หมวดหมู่ / ตัวชี้วัดการประเมิน</th><th width="10%">น้ำหนัก (%)</th><th width="14%">คะแนนตนเอง</th><th width="14%">คะแนนเฉลี่ยรวม</th><th width="14%">ระดับผล</th></tr></thead>
          <tbody>${renderConsolidatedAverageRows(data.metricsRows)}</tbody>
          <tfoot><tr style="background:#f9f9f9; font-weight:bold;"><td colspan="2" style="text-align:right;">คะแนนประเมินเฉลี่ยสุทธิจากกรรมการทุกท่าน:</td><td style="text-align:center;">${escapeHtml(totalWeight)}%</td><td colspan="2" style="text-align:center; font-size:11pt;">คะแนนเฉลี่ยรวม: ${totalScoreText} (${pctText})</td><td style="text-align:center; font-size:11pt;">${escapeHtml(gradeText)}</td></tr></tfoot>
        </table>
        <div class="print-signatures-section" style="margin-top:24px; page-break-inside:avoid;">
          <div style="text-align:center; font-weight:bold; font-size:11pt; margin-bottom:6px;">ลงนามรับรองผลการประเมินโดยคณะกรรมการผู้ประเมิน (${resolveConsolidatedJudgeSigners(data).length} ท่าน)</div>
          <div class="print-signatures print-signatures-judges">${resolveConsolidatedJudgeSigners(data).map(j => renderSignatureBox(j.name, j.roleInBoard, j.dateStr || dateStr, j.judgeSignature, true)).join('')}</div>
          <div class="print-signatures print-signatures-evaluatee">${renderSignatureBox(data.teacherName, 'ผู้รับการประเมิน (รับทราบผลการประเมิน)', dateStr)}</div>
        </div>
      </div>`;
  }

  if (mode === 'individual') {
    const totalScoreText = (data.totalScore && data.totalScore !== '-') ? `${escapeHtml(data.totalScore)} / 4.00` : '- / 4.00';
    const judgeDisplay = data.judgeName || context.currentUserName || '-';
    return `
      <div class="print-doc-wrap">
        <div class="print-doc-header">
          <h1>แบบสรุปรายงานผลการประเมินผลการปฏิบัติงานของข้าราชการครูและบุคลากรทางการศึกษา</h1>
          <h2>(สายงานการสอน และสนับสนุนการจัดการเรียนรู้)</h2>
          <div style="font-size: 11pt; margin-top: 4pt;">รอบการประเมิน: ${escapeHtml(periodName)}</div>
        </div>
        <table class="print-meta-table">
          <tr><td width="55%"><strong>ชื่อผู้รับการประเมิน:</strong> ${escapeHtml(data.teacherName || '-')}</td><td width="45%"><strong>ตำแหน่ง:</strong> ${escapeHtml(data.position || 'ครู')}</td></tr>
          <tr><td><strong>สังกัด / แผนกวิชา:</strong> ${escapeHtml(data.department || data.teacherDepartment || '-')}</td><td><strong>เลขประจำตัวประชาชน:</strong> ${escapeHtml(data.teacherCitizenId || '-')}</td></tr>
          <tr><td><strong>กรรมการผู้ประเมิน:</strong> ${escapeHtml(judgeDisplay)}</td><td><strong>บทบาทในคณะกรรมการ:</strong> ${escapeHtml(data.roleInBoard || 'กรรมการผู้ประเมิน')}</td></tr>
        </table>
        <table class="print-table">
          <thead><tr><th width="6%">ลำดับ</th><th width="34%">หมวดหมู่ / ตัวชี้วัดการประเมิน</th><th width="10%">น้ำหนัก (%)</th><th width="25%">ความคิดเห็นของผู้รับการประเมิน</th><th width="12%">คะแนนตนเอง</th><th width="13%">คะแนนกรรมการ</th></tr></thead>
          <tbody>${renderIndividualMetricsRows(data.metricsRows, 'judgeScoreDisplay')}</tbody>
          <tfoot><tr style="background:#f9f9f9; font-weight:bold;"><td colspan="2" style="text-align:right;">ผลรวมคะแนนสุทธิ / ระดับการประเมิน:</td><td style="text-align:center;">${escapeHtml(totalWeight)}%</td><td colspan="2" style="text-align:center; font-size:11pt;">คะแนนรวม: ${totalScoreText}</td><td style="text-align:center; font-size:11pt;">${escapeHtml(getPerformanceGrade(data.totalScore).grade)}</td></tr></tfoot>
        </table>
        <div class="print-feedback-box">
          <strong>ข้อคิดเห็นและข้อเสนอแนะในการพัฒนาของคณะกรรมการผู้ประเมิน:</strong>
          <p style="margin-top:4pt; white-space:pre-line;">${escapeHtml(data.overallFeedback || 'ผลการปฏิบัติงานเป็นไปตามเกณฑ์มาตรฐานที่สถานศึกษากำหนด มีความมุ่งมั่นในการจัดการเรียนรู้และพัฒนาผู้เรียนอย่างต่อเนื่อง')}</p>
        </div>
        <div class="print-signatures" style="margin-top:28px;">
          ${renderSignatureBox(data.teacherName, 'ผู้รับการประเมิน', dateStr)}
          ${renderSignatureBox(judgeDisplay, 'กรรมการผู้ประเมิน', dateStr, data.judgeSignature || '')}
        </div>
      </div>`;
  }

  const asnRows = Array.isArray(data.assignmentsRows) ? data.assignmentsRows : [];
  const asnHtml = asnRows.length > 0 ? asnRows.map((a, i) => `
    <tr>
      <td style="text-align:center;">${i + 1}</td><td><strong>${escapeHtml(a.teacherName || '-')}</strong></td>
      <td>${escapeHtml(a.teacherDepartment || a.department || '-')}</td><td>${escapeHtml(a.judgeName || '-')}</td>
      <td style="text-align:center; font-weight:bold;">${escapeHtml(a.totalScore || '-')}</td>
      <td style="text-align:center;">${escapeHtml(a.totalScore ? getPerformanceGrade(a.totalScore).grade : 'รอตรวจ')}</td>
    </tr>`).join('') : '<tr><td colspan="6" style="text-align:center; padding:14pt;">ยังไม่มีรายการประเมินในรอบนี้</td></tr>';

  return `
    <div class="print-doc-wrap">
      <div class="print-doc-header">
        <h1>รายงานสรุปภาพรวมผลการประเมินผลการปฏิบัติงานบุคลากรทั้งสถานศึกษา</h1>
        <h2>${escapeHtml(periodName)}</h2>
        <div style="font-size: 11pt; margin-top: 4pt;">พิมพ์รายงานข้อมูล ณ วันที่ ${dateStr}</div>
      </div>
      <table class="print-meta-table" style="background:#f9f9f9; border:1px solid #000 !important; margin-bottom:14px;">
        <tr>
          <td width="25%"><strong>จำนวนบุคลากรทั้งหมด:</strong> ${escapeHtml(data.totalTeachers || 0)} คน</td>
          <td width="25%"><strong>ประเมินเสร็จสิ้นแล้ว:</strong> ${escapeHtml(data.completedAssignments || 0)} รายการ</td>
          <td width="25%"><strong>รอการประเมิน:</strong> ${escapeHtml(data.pendingCount || 0)} รายการ</td>
          <td width="25%"><strong>คะแนนเฉลี่ยรวม:</strong> ${escapeHtml(data.averageScore || '0.00')} / 4.00</td>
        </tr>
      </table>
      <table class="print-table">
        <thead><tr><th width="6%">ลำดับ</th><th width="28%">ชื่อ - นามสกุล ผู้รับการประเมิน</th><th width="24%">สังกัด / แผนกวิชา</th><th width="20%">กรรมการผู้ประเมิน</th><th width="11%">คะแนนรวม</th><th width="11%">ระดับผล</th></tr></thead>
        <tbody>${asnHtml}</tbody>
      </table>
      <div class="print-signatures" style="margin-top:40px;">
        ${renderSignatureBox(data.hrOfficerName || context.currentUserName || 'เจ้าหน้าที่งานบุคลากร', 'เจ้าหน้าที่งานบุคลากร', dateStr)}
        ${renderSignatureBox('ผู้อำนวยการสถานศึกษา', 'ผู้อำนวยการสถานศึกษา / ประธาน อ.ก.ค.ศ.', dateStr)}
      </div>
    </div>`;
}

export function buildStandaloneOfficialPageHTML(docTitle, innerHtml) {
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${escapeHtml(docTitle || 'เอกสารราชการสรุปผลการประเมิน')}</title><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #cbd5e1; color: #000; font-family: 'Sarabun', 'TH Sarabun New', 'Garuda', 'Noto Sans Thai', sans-serif; font-size: 12pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-toolbar { position: sticky; top: 0; z-index: 100; background: #0f172a; color: #f8fafc; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .toolbar-btn { height: 34px; padding: 0 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
    .toolbar-btn-primary { background: #4f46e5; color: #fff; }
    .toolbar-btn-close { background: transparent; color: #e2e8f0; border-color: #475569; }
    .a4-sheet { width: 210mm; min-height: 297mm; margin: 22px auto 40px; padding: 14mm 15mm; background: #fff; color: #000; box-shadow: 0 10px 30px rgba(15,23,42,.22); }
    .print-doc-header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .print-doc-header h1 { font-size: 14.5pt; font-weight: bold; margin-bottom: 3pt; }
    .print-doc-header h2 { font-size: 12.5pt; font-weight: bold; margin-bottom: 2pt; }
    .print-meta-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .print-meta-table td { padding: 4px 6px; font-size: 11pt; }
    .print-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .print-table th, .print-table td { border: 1px solid #000; padding: 6px 8px; font-size: 10.5pt; vertical-align: top; }
    .print-table th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
    .print-feedback-box { border: 1px solid #000; padding: 10px 12px; margin-bottom: 18px; font-size: 11pt; page-break-inside: avoid; }
    .print-signatures { display: flex; justify-content: space-between; margin-top: 28px; page-break-inside: avoid; }
    .print-sign-box { width: 45%; text-align: center; font-size: 11pt; line-height: 1.65; }
    .print-signatures-judges { justify-content: center; flex-wrap: wrap; gap: 18px 14px; margin-top: 8px; }
    .print-sign-box-judge { width: 31%; min-width: 145pt; font-size: 10.5pt; line-height: 1.55; }
    .print-signatures-evaluatee { justify-content: center; margin-top: 20px; }
    @media print {
      @page { size: A4 portrait; margin: 14mm 15mm; }
      html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .a4-sheet { width: 100% !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
    }
  </style></head><body>
  <div class="print-toolbar no-print">
    <div style="font-size: 13.5px; font-weight: 600;"><span>${escapeHtml(docTitle || 'เอกสารราชการสรุปผลการประเมิน')}</span> <span style="font-size: 11.5px; color: #94a3b8; font-weight: 400;">(ขนาดมาตรฐาน A4)</span></div>
    <div><button type="button" class="toolbar-btn toolbar-btn-primary" onclick="window.focus(); window.print();">สั่งพิมพ์ / บันทึก PDF</button> <button type="button" class="toolbar-btn toolbar-btn-close" onclick="window.close();">ปิด</button></div>
  </div>
  <div class="a4-sheet">${innerHtml}</div>
</body></html>`;
}

export function executeOfficialPrint(mode, data, docTitle, preferInPage = false, context = {}) {
  const innerHtml = buildOfficialInnerHTML(mode, data, context);
  const printEl = document.getElementById('print-document');
  if (printEl) printEl.innerHTML = innerHtml;

  const printCurrent = () => {
    const prev = document.title;
    if (docTitle) document.title = docTitle;
    window.print();
    setTimeout(() => { document.title = prev; }, 500);
  };
  if (preferInPage) return printCurrent();

  let win = null;
  try { win = window.open('', '_blank'); } catch {}
  if (win?.document) {
    win.document.open();
    win.document.write(buildStandaloneOfficialPageHTML(docTitle, innerHtml));
    win.document.close();
    win.focus();
    setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 120);
    return;
  }
  printCurrent();
}
