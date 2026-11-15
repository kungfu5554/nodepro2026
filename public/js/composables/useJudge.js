// public/js/composables/useJudge.js
import { fetchAPI } from '../api.js';
import { getPerformanceGrade } from '../utils/formatters.js';
import {
  currentUser, allPeriods, selectedPeriodId, period, openIndividualReportModal,
  openConfirmDialog, showToast
} from './useAppState.js';

const { ref, computed } = window.Vue;

export const judgeViewMode = ref('list');
export const judgeCandidates = ref([]);
export const judgeSelectedIdx = ref(0);
export const candidateGradingMetrics = ref([]);
export const judgeScores = ref({});
export const judgeOverallFeedback = ref('');
export const judgeSignatureMode = ref('draw');
export const judgeSignatureData = ref('');
export const judgeProfileSignatureUrl = ref('');
export const candidateSearchQuery = ref('');
export const candidateFilterStatus = ref('ALL');

export const filteredJudgeCandidates = computed(() => {
  const q = candidateSearchQuery.value.trim().toLowerCase();
  return judgeCandidates.value.filter(c => {
    const matchStatus = candidateFilterStatus.value === 'ALL' || c.status === candidateFilterStatus.value;
    const matchQuery = !q ||
      (c.teacherName && c.teacherName.toLowerCase().includes(q)) ||
      (c.department && c.department.toLowerCase().includes(q));
    return matchStatus && matchQuery;
  });
});

export const judgeStats = computed(() => {
  const total = judgeCandidates.value.length;
  const available = judgeCandidates.value.filter(c => c.status === 'AVAILABLE').length;
  const claimed = judgeCandidates.value.filter(c => c.status === 'CLAIMED').length;
  const evaluated = judgeCandidates.value.filter(c => c.status === 'EVALUATED').length;
  return { total, available, claimed, evaluated };
});

export const claimedJudgeCandidates = computed(() =>
  judgeCandidates.value.filter(c => c.isClaimedByMe)
);

export const currentJudgeCandidate = computed(() =>
  judgeCandidates.value[judgeSelectedIdx.value] || null
);

export const judgeWorkspaceSummary = computed(() => {
  const list = candidateGradingMetrics.value || [];
  let totalWeight = 0;
  let weightedSum = 0;
  const rows = list.map(m => {
    const weight = Number(m.weight) || 0;
    const raw = parseFloat(judgeScores.value[m.metricId]);
    const score = isNaN(raw) ? 0 : Math.min(4, Math.max(0, raw));
    const weightedPoints = (score * weight) / 4;
    totalWeight += weight;
    weightedSum += score * weight;
    return {
      metricId: m.metricId,
      categoryName: m.categoryName || '',
      title: m.title,
      weight,
      evalType: m.evalType,
      score: score.toFixed(2),
      weightedPoints: weightedPoints.toFixed(2)
    };
  });
  const totalScoreNum = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const totalScore = totalScoreNum.toFixed(2);
  const percentage = ((totalScoreNum / 4) * 100).toFixed(1);
  const gradeInfo = getPerformanceGrade(totalScoreNum);
  return {
    rows,
    totalWeight,
    totalScore,
    percentage,
    grade: gradeInfo.grade,
    gradeColor: gradeInfo.color
  };
});

export async function loadJudgeCandidates(pId) {
  try {
    const res = await fetchAPI('/judge/assigned?periodId=' + pId);
    judgeCandidates.value = res.data || [];
    const activePeriod = allPeriods.value.find(p => Number(p.id) === Number(pId));
    if (activePeriod) {
      period.value = {
        id: activePeriod.id,
        name: activePeriod.name,
        startDate: activePeriod.startDate || '',
        endDate: activePeriod.endDate || '',
        isOpen: Boolean(activePeriod.isOpen)
      };
    }
  } catch (e) {
    console.warn('Error loading judge candidates:', e.message);
  }
}

export function createJudgeActions() {
  let isJudgeDrawing = false;
  let hasDrawnStroke = false;
  let judgeCtx = null;

  function initJudgeCanvas() {
    const canvas = document.getElementById('judgeCanvas');
    if (!canvas) return null;
    judgeCtx = canvas.getContext('2d');
    judgeCtx.strokeStyle = '#0f172a';
    judgeCtx.lineWidth = 2.2;
    judgeCtx.lineCap = 'round';
    return canvas;
  }

  function startJudgeDraw(e) {
    const canvas = initJudgeCanvas();
    if (!canvas) return;
    isJudgeDrawing = true;
    hasDrawnStroke = true;
    judgeCtx.beginPath();
    const rect = canvas.getBoundingClientRect();
    judgeCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function drawingJudge(e) {
    if (!isJudgeDrawing || !judgeCtx) return;
    const canvas = document.getElementById('judgeCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    judgeCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    judgeCtx.stroke();
  }

  function stopJudgeDraw() {
    if (isJudgeDrawing) {
      isJudgeDrawing = false;
      if (hasDrawnStroke) captureJudgeCanvas(true);
    }
  }

  function judgeTouchStart(e) {
    if (!e.touches || !e.touches[0]) return;
    e.preventDefault();
    const t = e.touches[0];
    startJudgeDraw({ clientX: t.clientX, clientY: t.clientY });
  }

  function judgeTouchMove(e) {
    if (!e.touches || !e.touches[0]) return;
    e.preventDefault();
    const t = e.touches[0];
    drawingJudge({ clientX: t.clientX, clientY: t.clientY });
  }

  function clearJudgeCanvas() {
    const canvas = document.getElementById('judgeCanvas');
    if (canvas) {
      const c = canvas.getContext('2d');
      c.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasDrawnStroke = false;
    judgeSignatureData.value = '';
  }

  function captureJudgeCanvas(silent = false) {
    const canvas = document.getElementById('judgeCanvas');
    if (!canvas) return;
    judgeSignatureData.value = canvas.toDataURL('image/png');
    if (!silent) showToast('บันทึกลายเซ็นเรียบร้อยแล้ว', 'success');
  }

  async function onJudgeSigUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetchAPI('/upload', { method: 'POST', body: formData });
      judgeSignatureData.value = res.data.fileUrl;
    } catch (err) {
      const reader = new FileReader();
      reader.onload = ev => {
        judgeSignatureData.value = ev.target?.result || '';
      };
      reader.readAsDataURL(file);
    }
  }

  function useProfileJudgeSignature() {
    const saved = judgeProfileSignatureUrl.value || currentUser.value?.signatureUrl || '';
    if (!saved) {
      showToast('ยังไม่มีลายเซ็นในโปรไฟล์ของท่าน กรุณาวาดลายเซ็นหรืออัปโหลดไฟล์ลายเซ็นแทน', 'error');
      return;
    }
    judgeSignatureMode.value = 'profile';
    judgeSignatureData.value = saved;
  }

  async function onJudgePeriodChange() {
    await loadJudgeCandidates(selectedPeriodId.value);
    judgeViewMode.value = 'list';
  }

  async function claimJudgeCandidate(candidate) {
    const ok = await openConfirmDialog(`ยืนยันการกดรับ "${candidate.teacherName}" เพื่อเข้าตรวจประเมินใช่หรือไม่?`, {
      title: 'ยืนยันการกดรับผู้รับการประเมิน',
      confirmText: 'กดรับการประเมิน'
    });
    if (!ok) return;
    try {
      const res = await fetchAPI('/judge/claim', {
        method: 'POST',
        body: JSON.stringify({
          teacherCitizenId: candidate.teacherCitizenId,
          periodId: selectedPeriodId.value
        })
      });
      await loadJudgeCandidates(selectedPeriodId.value);
      showToast(res.message || 'กดรับผู้รับการประเมินเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast('ไม่สามารถกดรับได้: ' + err.message, 'error');
      await loadJudgeCandidates(selectedPeriodId.value);
    }
  }

  async function unclaimJudgeCandidate(candidate) {
    if (!candidate.assignmentId) return;
    const ok = await openConfirmDialog(`ยืนยันการยกเลิกการรับ "${candidate.teacherName}" และปล่อยสิทธิ์คืนให้กรรมการท่านอื่นใช่หรือไม่?`, {
      title: 'ยืนยันการยกเลิกการรับ',
      confirmText: 'ปล่อยสิทธิ์คืน',
      danger: true
    });
    if (!ok) return;
    try {
      const res = await fetchAPI(`/judge/claim/${candidate.assignmentId}`, { method: 'DELETE' });
      await loadJudgeCandidates(selectedPeriodId.value);
      if (judgeViewMode.value === 'workspace') {
        judgeViewMode.value = 'list';
      }
      showToast(res.message || 'ยกเลิกการรับเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast('ไม่สามารถยกเลิกการรับได้: ' + err.message, 'error');
    }
  }

  async function selectJudgeCandidate(idx) {
    judgeSelectedIdx.value = idx;
    const cand = judgeCandidates.value[idx];
    if (!cand || !cand.assignmentId) return;
    try {
      const res = await fetchAPI(`/judge/grading/${cand.assignmentId}`);
      if (res.data && res.data.metrics) {
        candidateGradingMetrics.value = res.data.metrics;
        const newScores = {};
        res.data.metrics.forEach(m => {
          if (m.existingJudgeScore !== null && m.existingJudgeScore !== undefined) {
            newScores[m.metricId] = String(Number(m.existingJudgeScore));
          } else {
            newScores[m.metricId] = m.evalType === 'BOOLEAN' ? '4' : '3';
          }
        });
        judgeScores.value = newScores;
        judgeOverallFeedback.value = res.data.summary?.overallFeedback || '';
        const profileSig = res.data.assignment?.judgeProfileSignatureUrl || currentUser.value?.signatureUrl || '';
        judgeProfileSignatureUrl.value = profileSig;
        const existingSig = res.data.summary?.judgeSignature || '';
        const looksLikeImage = existingSig.startsWith('data:image/') || existingSig.startsWith('/uploads/') || existingSig.startsWith('http');
        judgeSignatureData.value = looksLikeImage ? existingSig : (profileSig || '');
        if (judgeSignatureData.value && judgeSignatureData.value === profileSig) {
          judgeSignatureMode.value = 'profile';
        } else if (looksLikeImage) {
          judgeSignatureMode.value = 'upload';
        } else {
          judgeSignatureMode.value = 'draw';
        }
        hasDrawnStroke = false;
      }
    } catch (err) {
      console.error('Failed to load candidate grading details:', err);
    }
  }

  async function openCandidateGrading(candidate) {
    if (!candidate.isClaimedByMe || !candidate.assignmentId) {
      showToast('กรุณากดปุ่ม "กดรับการประเมิน" ก่อนเข้าตรวจให้คะแนน', 'error');
      return;
    }
    const idx = judgeCandidates.value.findIndex(c => c.teacherCitizenId === candidate.teacherCitizenId);
    await selectJudgeCandidate(idx >= 0 ? idx : 0);
    judgeViewMode.value = 'workspace';
  }

  function onJudgeCandidateDropdownChange(teacherCitizenId) {
    const idx = judgeCandidates.value.findIndex(c => c.teacherCitizenId === teacherCitizenId);
    if (idx >= 0) selectJudgeCandidate(idx);
  }

  function backToCandidateList() {
    judgeViewMode.value = 'list';
  }

  async function submitJudgeScore() {
    const cand = currentJudgeCandidate.value;
    if (!cand) return;
    if (!judgeSignatureData.value && hasDrawnStroke) {
      captureJudgeCanvas(true);
    }
    if (!judgeSignatureData.value) {
      showToast('กรุณาลงนามโดยแนบลายเซ็น (วาดลายเซ็น อัปโหลดไฟล์ หรือใช้ลายเซ็นจากโปรไฟล์) ก่อนบันทึกและส่งผลการประเมิน', 'error');
      return;
    }
    try {
      const res = await fetchAPI('/judge/submit/' + cand.assignmentId, {
        method: 'POST',
        body: JSON.stringify({
          scores: judgeScores.value,
          overallFeedback: judgeOverallFeedback.value,
          signature: judgeSignatureData.value
        })
      });
      showToast('บันทึกและส่งผลการประเมินสำเร็จ (คะแนนรวม: ' + res.data.totalScore + ')', 'success');
      await loadJudgeCandidates(selectedPeriodId.value);
      judgeViewMode.value = 'list';
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function openJudgeReportModal(candidate) {
    const isActive = judgeViewMode.value === 'workspace' &&
      currentJudgeCandidate.value &&
      Number(currentJudgeCandidate.value.assignmentId) === Number(candidate.assignmentId);
    return openIndividualReportModal(candidate, {
      isActive,
      scores: judgeScores.value,
      feedback: judgeOverallFeedback.value,
      signature: judgeSignatureData.value
    });
  }

  return {
    onJudgePeriodChange,
    claimJudgeCandidate,
    unclaimJudgeCandidate,
    openCandidateGrading,
    selectJudgeCandidate,
    onJudgeCandidateDropdownChange,
    backToCandidateList,
    submitJudgeScore,
    openJudgeReportModal,
    startJudgeDraw,
    drawingJudge,
    stopJudgeDraw,
    judgeTouchStart,
    judgeTouchMove,
    clearJudgeCanvas,
    captureJudgeCanvas,
    onJudgeSigUpload,
    useProfileJudgeSignature
  };
}
