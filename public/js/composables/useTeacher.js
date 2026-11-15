// public/js/composables/useTeacher.js
import { fetchAPI } from '../api.js';
import { formatSelfScoreDisplay, formatJudgeScoreDisplay } from '../utils/formatters.js';
import { executeOfficialPrint } from '../utils/print-reports.js';
import {
  currentUser, selectedPeriodId, period, metrics,
  printMode, printCandidateData, loadPublicDepartments, getPrintContext,
  openConfirmDialog, showToast
} from './useAppState.js';

const { ref, computed } = window.Vue;

export const teacherTab = ref('self');
export const teacherScores = ref({});
export const teacherComments = ref({});
export const teacherEvidence = ref({});
export const teacherSubmissionStatus = ref('DRAFT');
export const teacherSubmittedAt = ref(null);
export const teacherRequiredJudges = ref(3);
export const teacherClaimedJudgesCount = ref(0);
export const isEditingSelfEval = ref(false);
export const showEditSelfWarningModal = ref(false);
export const teacherJudgeFeedback = ref(null);
export const teacherJudgeEvaluations = ref([]);
export const teacherConsolidatedSummary = ref(null);
export const selectedJudgeEvalIdx = ref(0);

export const currentSelectedJudgeEval = computed(() =>
  teacherJudgeEvaluations.value[selectedJudgeEvalIdx.value] || null
);

export const isTeacherDeptApproved = computed(() => {
  if (!currentUser.value) return false;
  return (currentUser.value.deptStatus || 'APPROVED') === 'APPROVED' && Boolean(currentUser.value.department);
});

export const isTeacherFormLocked = computed(() => {
  if (!period.value.isOpen || !isTeacherDeptApproved.value) return true;
  if (teacherSubmissionStatus.value === 'SUBMITTED' && !isEditingSelfEval.value) return true;
  return false;
});

export const teacherProgress = computed(() => {
  if (!metrics.value.length) return 0;
  const done = metrics.value.filter(m => {
    const v = teacherScores.value[m.id];
    return v !== undefined && v !== null && String(v).trim() !== '';
  }).length;
  return Math.min(100, Math.round((done / metrics.value.length) * 100));
});

export function getMetricJudgeProgress(metricId) {
  const fromSummary = teacherConsolidatedSummary.value?.metricJudgeProgress?.[metricId];
  const reqJudges = Math.max(1, Number(fromSummary?.requiredJudges ?? teacherRequiredJudges.value) || 3);
  const claimedCount = Number(fromSummary?.claimedCount ?? teacherClaimedJudgesCount.value) || 0;

  let evaluatedCount = 0;
  if (fromSummary && fromSummary.evaluatedCount !== undefined) {
    evaluatedCount = Number(fromSummary.evaluatedCount) || 0;
  } else if (teacherConsolidatedSummary.value?.metricJudgeCounts?.[metricId] !== undefined) {
    evaluatedCount = Number(teacherConsolidatedSummary.value.metricJudgeCounts[metricId]) || 0;
  } else {
    evaluatedCount = (teacherJudgeEvaluations.value || []).filter(
      j => j.metricScores && j.metricScores[metricId] !== undefined && j.metricScores[metricId] !== null
    ).length;
  }

  const percent = Math.min(100, Math.round((evaluatedCount / reqJudges) * 100));
  let statusLabel = 'รอกรรมการกดรับ';
  if (teacherSubmissionStatus.value !== 'SUBMITTED') {
    statusLabel = 'รอส่งแบบประเมิน';
  } else if (evaluatedCount >= reqJudges) {
    statusLabel = 'ตรวจครบทุกท่านแล้ว';
  } else if (evaluatedCount > 0) {
    statusLabel = `ตรวจแล้ว ${evaluatedCount}/${reqJudges} ท่าน`;
  } else if (claimedCount > 0) {
    statusLabel = 'กรรมการกดรับแล้ว รอตรวจ';
  }

  return { evaluatedCount, claimedCount, requiredJudges: reqJudges, percent, statusLabel };
}

export const teacherJudgeProgressSummary = computed(() => {
  const list = metrics.value || [];
  const reqJudges = Math.max(1, Number(teacherRequiredJudges.value) || 3);
  const claimedCount = Number(teacherClaimedJudgesCount.value) || 0;
  const evaluatedJudgesCount = (teacherJudgeEvaluations.value || []).length;

  let fullyCheckedCount = 0;
  let partialCheckedCount = 0;
  let waitingCount = 0;
  let sumPercent = 0;

  list.forEach(m => {
    const p = getMetricJudgeProgress(m.id);
    sumPercent += p.percent;
    if (p.evaluatedCount >= p.requiredJudges) fullyCheckedCount += 1;
    else if (p.evaluatedCount > 0) partialCheckedCount += 1;
    else waitingCount += 1;
  });

  const overallPercent = list.length > 0 ? Math.round(sumPercent / list.length) : 0;

  return {
    totalMetrics: list.length,
    fullyCheckedCount,
    partialCheckedCount,
    waitingCount,
    evaluatedJudgesCount,
    claimedCount,
    requiredJudges: reqJudges,
    overallPercent
  };
});

export async function loadTeacherEvaluationSheet(pId) {
  try {
    await loadPublicDepartments();
    const res = await fetchAPI('/evaluatee/sheet?periodId=' + pId);
    if (!res.data) return;

    if (res.data.userProfile) {
      currentUser.value = { ...currentUser.value, ...res.data.userProfile };
      localStorage.setItem('user', JSON.stringify(currentUser.value));
    }
    metrics.value = res.data.metrics || [];
    if (res.data.period) {
      period.value = {
        id: res.data.period.id,
        name: res.data.period.name,
        isOpen: Boolean(res.data.period.is_open !== undefined ? res.data.period.is_open : res.data.period.isOpen)
      };
    }

    teacherSubmissionStatus.value = res.data.submissionStatus || 'DRAFT';
    teacherSubmittedAt.value = res.data.submittedAt || null;
    teacherRequiredJudges.value = Number(res.data.requiredJudges) || Number(currentUser.value?.requiredJudges) || 3;
    teacherClaimedJudgesCount.value = Number(res.data.claimedJudgesCount) || 0;
    isEditingSelfEval.value = false;

    const sMap = {};
    const cMap = {};
    const eMap = {};
    (res.data.metrics || []).forEach(m => { sMap[m.id] = ''; });
    (res.data.selfScores || []).forEach(s => {
      if (s.selfScore !== null && s.selfScore !== undefined) sMap[s.metricId] = String(s.selfScore);
      if (s.teacherComment) cMap[s.metricId] = s.teacherComment;
      if (s.evidenceUrl && !s.evidenceUrl.includes('example.com')) eMap[s.metricId] = s.evidenceUrl;
    });
    teacherScores.value = sMap;
    teacherComments.value = cMap;
    teacherEvidence.value = eMap;

    teacherJudgeFeedback.value = res.data.judgeFeedback || null;
    teacherJudgeEvaluations.value = res.data.judgeEvaluations || [];
    teacherConsolidatedSummary.value = res.data.consolidatedSummary || null;
    if (selectedJudgeEvalIdx.value >= teacherJudgeEvaluations.value.length) {
      selectedJudgeEvalIdx.value = 0;
    }
  } catch (e) {
    console.warn('Error loading teacher sheet:', e.message);
  }
}

export function createTeacherActions() {
  async function onTeacherPeriodChange() {
    isEditingSelfEval.value = false;
    showEditSelfWarningModal.value = false;
    await loadTeacherEvaluationSheet(selectedPeriodId.value);
  }

  async function uploadTeacherFile(event, metricId) {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('evidence', file);
    try {
      const res = await fetchAPI('/upload/evidence', { method: 'POST', body: formData });
      teacherEvidence.value[metricId] = res.data.fileUrl;
      showToast('อัปโหลดหลักฐานสำเร็จ: ' + (res.data.originalName || file.name), 'success');
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการอัปโหลด: ' + err.message, 'error');
    }
  }

  function requestEditSelfEval() {
    if (!period.value.isOpen) {
      showToast('รอบการประเมินนี้ปิดการรับข้อมูลแล้ว ไม่สามารถแก้ไขได้', 'error');
      return;
    }
    showEditSelfWarningModal.value = true;
  }

  function confirmUnlockSelfEval() {
    showEditSelfWarningModal.value = false;
    isEditingSelfEval.value = true;
  }

  async function cancelEditSelfEval() {
    isEditingSelfEval.value = false;
    await loadTeacherEvaluationSheet(selectedPeriodId.value);
  }

  async function saveTeacherSelf(isEditConfirm = false) {
    if (!isTeacherDeptApproved.value) {
      showToast('ยังไม่สามารถส่งข้อมูลให้กรรมการได้ เนื่องจากสาขาวิชาของท่านยังไม่ได้รับการอนุมัติจากฝ่ายบุคลากร (HR)', 'error');
      return;
    }
    if (!metrics.value || metrics.value.length === 0) {
      showToast('ยังไม่มีตัวชี้วัดในรอบการประเมินนี้', 'error');
      return;
    }
    const missingMetric = metrics.value.find(
      m => teacherScores.value[m.id] === undefined || teacherScores.value[m.id] === null || String(teacherScores.value[m.id]).trim() === ''
    );
    if (missingMetric) {
      showToast(`กรุณาเลือกระดับคะแนนประเมินตนเองให้ครบทุกตัวชี้วัดก่อนส่งข้อมูล (ยังไม่ได้เลือกข้อ: "${missingMetric.title}")`, 'error');
      return;
    }

    if (isEditConfirm && teacherSubmissionStatus.value === 'SUBMITTED') {
      const judgeCnt = teacherJudgeEvaluations.value.length;
      const confirmMsg = judgeCnt > 0
        ? `คำเตือนยืนยันครั้งสุดท้าย:\nขณะนี้มีกรรมการประเมินผลให้ท่านแล้ว ${judgeCnt} ท่าน\nเมื่อยืนยันการแก้ไข ผลคะแนนและข้อคิดเห็นเดิมทั้งหมดจะถูกลบออกทันที และกรรมการจะต้องประเมินใหม่\n\nท่านยืนยันที่จะบันทึกการแก้ไขข้อมูลใช่หรือไม่?`
        : 'ยืนยันการบันทึกแก้ไขข้อมูลแบบประเมินตนเองและส่งให้คณะกรรมการใหม่ใช่หรือไม่?';
      const ok = await openConfirmDialog(confirmMsg, {
        title: 'ยืนยันการแก้ไขแบบประเมิน',
        confirmText: 'ยืนยันส่งข้อมูลใหม่',
        danger: judgeCnt > 0
      });
      if (!ok) return;
    }

    try {
      const scoresPayload = metrics.value.map(m => ({
        metricId: m.id,
        selfScore: String(teacherScores.value[m.id]),
        teacherComment: teacherComments.value[m.id] || '',
        evidenceUrl: teacherEvidence.value[m.id] || null
      }));
      const res = await fetchAPI('/evaluatee/self-submit', {
        method: 'POST',
        body: JSON.stringify({
          periodId: selectedPeriodId.value,
          scores: scoresPayload,
          isEditConfirm: Boolean(isEditConfirm)
        })
      });
      isEditingSelfEval.value = false;
      teacherSubmissionStatus.value = 'SUBMITTED';
      teacherSubmittedAt.value = res.data?.submittedAt || new Date().toISOString();
      await loadTeacherEvaluationSheet(selectedPeriodId.value);
      showToast(isEditConfirm
        ? 'บันทึกการแก้ไขและส่งข้อมูลใหม่เรียบร้อยแล้ว สถานะปัจจุบัน: รอผลการตรวจประเมินใหม่จากคณะกรรมการ'
        : 'บันทึกและส่งผลการประเมินตนเองเรียบร้อยแล้ว ขณะนี้พร้อมให้กรรมการกดรับเพื่อเข้าตรวจประเมินแล้ว', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function buildTeacherMetricsRows(scoreLookup, isAverage = false) {
    return (metrics.value || []).map(m => ({
      id: m.id,
      categoryName: m.categoryName || '',
      title: m.title,
      description: m.description || '',
      weight: Number(m.weight) || 0,
      teacherComment: isAverage ? '' : (teacherComments.value[m.id] || '-'),
      selfScoreDisplay: formatSelfScoreDisplay(m.evalType, teacherScores.value[m.id]),
      avgRawScore: isAverage ? scoreLookup[m.id] : null,
      [isAverage ? 'avgScoreDisplay' : 'judgeScoreDisplay']: formatJudgeScoreDisplay(scoreLookup[m.id])
    }));
  }

  function triggerPrintIndividualForTeacher() {
    const currentJudge = teacherJudgeEvaluations.value[selectedJudgeEvalIdx.value] || teacherJudgeFeedback.value;
    const metricsRows = buildTeacherMetricsRows(currentJudge?.metricScores || {}, false);
    const reportData = {
      teacherName: currentUser.value.name,
      position: currentUser.value.position || 'ครู',
      department: currentUser.value.department || '-',
      teacherCitizenId: currentUser.value.citizenId,
      judgeName: currentJudge ? currentJudge.judgeName : 'คณะกรรมการผู้ประเมิน',
      roleInBoard: currentJudge ? currentJudge.roleInBoard : 'กรรมการผู้ประเมิน',
      judgeSignature: currentJudge ? (currentJudge.judgeSignature || '') : '',
      periodName: period.value.name,
      totalScore: currentJudge ? currentJudge.totalScore : '-',
      overallFeedback: currentJudge ? currentJudge.overallFeedback : '',
      metricsRows,
      totalWeight: metricsRows.reduce((acc, r) => acc + (Number(r.weight) || 0), 0)
    };
    printMode.value = 'individual';
    printCandidateData.value = reportData;
    executeOfficialPrint('individual', reportData, `ผลการประเมินรายกรรมการ_${currentUser.value.name}_${reportData.judgeName}`, false, getPrintContext());
  }

  function triggerPrintConsolidated() {
    const avgMap = teacherConsolidatedSummary.value?.metricAverages || {};
    const metricsRows = buildTeacherMetricsRows(avgMap, true);
    const judgesRows = teacherJudgeEvaluations.value || [];
    const judges = judgesRows.map((j, idx) => ({
      name: j.judgeName || `กรรมการผู้ประเมินคนที่ ${idx + 1}`,
      roleInBoard: j.roleInBoard || `กรรมการผู้ประเมินคนที่ ${idx + 1}`,
      judgeSignature: j.judgeSignature || '',
      submittedAt: j.submittedAt || null
    }));
    const reportData = {
      teacherName: currentUser.value.name,
      position: currentUser.value.position || 'ครู',
      department: currentUser.value.department || '-',
      teacherCitizenId: currentUser.value.citizenId,
      periodName: period.value.name,
      totalScore: teacherConsolidatedSummary.value ? teacherConsolidatedSummary.value.averageTotalScore : '-',
      judgeCount: judgesRows.length,
      requiredJudges: Number(teacherRequiredJudges.value) || Math.max(3, judgesRows.length),
      chairJudgeName: judgesRows.length > 0 ? judgesRows[0].judgeName : 'ประธานกรรมการ',
      judges,
      metricsRows,
      totalWeight: metricsRows.reduce((acc, r) => acc + (Number(r.weight) || 0), 0)
    };
    printMode.value = 'consolidated';
    printCandidateData.value = reportData;
    executeOfficialPrint('consolidated', reportData, `ผลการประเมินเฉลี่ยรวม_${currentUser.value.name}`, false, getPrintContext());
  }

  return {
    onTeacherPeriodChange,
    uploadTeacherFile,
    requestEditSelfEval,
    confirmUnlockSelfEval,
    cancelEditSelfEval,
    saveTeacherSelf,
    triggerPrintIndividualForTeacher,
    triggerPrintConsolidated
  };
}
