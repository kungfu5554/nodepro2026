// public/js/composables/useAppState.js
import { fetchAPI } from '../api.js';
import { formatSelfScoreDisplay, formatJudgeScoreDisplay } from '../utils/formatters.js';
import { buildOfficialInnerHTML, executeOfficialPrint } from '../utils/print-reports.js';

const { ref, computed } = window.Vue;

export const currentUser = ref(null);
export const token = ref(localStorage.getItem('token') || '');
export const allowQuickLogin = ref(true);

export const publicDepartments = ref([]);
export const allPeriods = ref([]);
export const selectedPeriodId = ref(1);
export const selectedAdminPeriodId = ref(1);
export const period = ref({
  id: 1,
  name: 'รอบการประเมินที่ 1 ประจำปีการศึกษา 2568',
  startDate: '2026-10-01',
  endDate: '2026-11-30',
  isOpen: true
});
export const metrics = ref([]);
export const metricCategories = ref([]);

export const showReportModal = ref(false);
export const selectedReportItem = ref(null);
export const printMode = ref('individual');
export const printCandidateData = ref(null);

// Global in-app confirmation modal & toast notifications (works cleanly in all browsers and webviews)
export const confirmModalState = ref({
  visible: false,
  title: 'ยืนยันการดำเนินการ',
  message: '',
  confirmText: 'ยืนยัน',
  cancelText: 'ยกเลิก',
  danger: false
});
let pendingConfirmResolve = null;

export function openConfirmDialog(message, options = {}) {
  if (pendingConfirmResolve) {
    pendingConfirmResolve(false);
    pendingConfirmResolve = null;
  }
  return new Promise((resolve) => {
    pendingConfirmResolve = resolve;
    confirmModalState.value = {
      visible: true,
      title: options.title || 'ยืนยันการดำเนินการ',
      message: String(message || ''),
      confirmText: options.confirmText || 'ยืนยัน',
      cancelText: options.cancelText || 'ยกเลิก',
      danger: !!options.danger
    };
  });
}

export function resolveConfirmDialog(confirmed) {
  confirmModalState.value.visible = false;
  if (pendingConfirmResolve) {
    const fn = pendingConfirmResolve;
    pendingConfirmResolve = null;
    fn(Boolean(confirmed));
  }
}

export const toastList = ref([]);
let nextToastId = 1;

export function showToast(message, type = 'info', durationMs = 4500) {
  const id = nextToastId++;
  toastList.value.push({ id, message: String(message || ''), type });
  if (durationMs > 0) {
    setTimeout(() => dismissToast(id), durationMs);
  }
}

export function dismissToast(id) {
  toastList.value = toastList.value.filter(t => t.id !== id);
}

export const totalMetricWeight = computed(() =>
  metrics.value.reduce((sum, m) => sum + (Number(m.weight) || 0), 0)
);

export async function loadAppConfig() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json().catch(() => ({}));
    if (typeof data.allowQuickLogin === 'boolean') {
      allowQuickLogin.value = data.allowQuickLogin;
    }
  } catch (e) {}
}

export async function loadPublicDepartments() {
  try {
    const res = await fetchAPI('/auth/departments');
    if (res && Array.isArray(res.data)) {
      publicDepartments.value = res.data;
    }
  } catch (e) {
    console.warn('Could not load public departments:', e.message);
  }
}

export async function loadPeriods() {
  try {
    const pRes = await fetchAPI('/hr/periods');
    if (pRes.data && pRes.data.length > 0) {
      allPeriods.value = pRes.data;
      if (!selectedPeriodId.value) {
        selectedPeriodId.value = pRes.data[0].id;
      }
    }
  } catch (e) {
    console.warn('Could not load all periods:', e);
  }
}

export function getPrintContext() {
  return {
    periodName: period.value.name,
    totalWeight: totalMetricWeight.value,
    currentUserName: currentUser.value ? currentUser.value.name : ''
  };
}

export async function openIndividualReportModal(candidate, activeWorkspaceInfo = null) {
  try {
    const assignmentId = candidate.assignmentId || candidate.id;
    if (!assignmentId) {
      showToast('ยังไม่พบข้อมูลการประเมินสำหรับจัดทำรายงาน', 'error');
      return;
    }

    const res = await fetchAPI(`/judge/grading/${assignmentId}`);
    const asn = res.data?.assignment || {};
    const mList = res.data?.metrics || [];
    const sum = res.data?.summary || null;

    let draftWeightedSum = 0;
    let draftWeightTotal = 0;
    let hasDraftScore = false;

    const metricsRows = mList.map(m => {
      let jScore = m.existingJudgeScore;
      if ((jScore === null || jScore === undefined) && activeWorkspaceInfo?.isActive && activeWorkspaceInfo.scores[m.metricId] !== undefined) {
        jScore = activeWorkspaceInfo.scores[m.metricId];
      }
      if (jScore !== null && jScore !== undefined && jScore !== '') {
        const numericScore = parseFloat(jScore);
        const w = Number(m.weight) || 0;
        if (!isNaN(numericScore)) {
          draftWeightedSum += numericScore * w;
          draftWeightTotal += w;
          hasDraftScore = true;
        }
      }
      return {
        id: m.metricId || m.id,
        title: m.title,
        description: m.description || '',
        weight: Number(m.weight) || 0,
        teacherComment: m.teacherComment || '-',
        selfScoreDisplay: formatSelfScoreDisplay(m.evalType, m.selfScore),
        judgeScoreDisplay: formatJudgeScoreDisplay(jScore)
      };
    });

    const totalWeight = metricsRows.reduce((acc, r) => acc + (Number(r.weight) || 0), 0);
    let computedTotalScore = '-';
    if (sum && sum.totalScore !== null && sum.totalScore !== undefined) {
      computedTotalScore = Number(sum.totalScore).toFixed(2);
    } else if (candidate.totalScore) {
      computedTotalScore = Number(candidate.totalScore).toFixed(2);
    } else if (hasDraftScore && draftWeightTotal > 0) {
      computedTotalScore = (draftWeightedSum / draftWeightTotal).toFixed(2);
    }

    const reportData = {
      assignmentId,
      periodName: asn.periodName || period.value.name,
      teacherName: asn.teacherName || candidate.teacherName || '-',
      teacherCitizenId: asn.teacherCitizenId || candidate.teacherCitizenId || '-',
      department: asn.department || candidate.department || candidate.teacherDepartment || '-',
      teacherDepartment: asn.department || candidate.teacherDepartment || candidate.department || '-',
      position: asn.position || candidate.position || 'ครู',
      judgeName: asn.judgeName || candidate.judgeName || (currentUser.value ? currentUser.value.name : '-'),
      roleInBoard: asn.roleInBoard || candidate.roleInBoard || 'กรรมการผู้ประเมิน',
      judgeSignature: (sum && sum.judgeSignature) || candidate.judgeSignature || (activeWorkspaceInfo?.signature) || '',
      totalScore: computedTotalScore,
      overallFeedback: (sum && sum.overallFeedback) || candidate.overallFeedback || (activeWorkspaceInfo?.isActive ? activeWorkspaceInfo.feedback : '') || '',
      metricsRows,
      totalWeight
    };

    selectedReportItem.value = reportData;
    printCandidateData.value = reportData;
    const printEl = document.getElementById('print-document');
    if (printEl) {
      printEl.innerHTML = buildOfficialInnerHTML('individual', reportData, getPrintContext());
    }
    showReportModal.value = true;
  } catch (err) {
    showToast('ไม่สามารถโหลดข้อมูลรายงานได้: ' + err.message, 'error');
  }
}

export function triggerPrintFromModal(preferInPage = false) {
  if (!selectedReportItem.value) return;
  printMode.value = 'individual';
  printCandidateData.value = selectedReportItem.value;
  const docTitle = `แบบสรุปผลการประเมิน_${selectedReportItem.value.teacherName || 'รายบุคคล'}`;
  executeOfficialPrint('individual', selectedReportItem.value, docTitle, preferInPage, getPrintContext());
}
