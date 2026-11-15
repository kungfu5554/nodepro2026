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
    const matchQuery = !q || c.teacherName?.toLowerCase().includes(q) || c.department?.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });
});

export const judgeStats = computed(() => ({
  total: judgeCandidates.value.length,
  available: judgeCandidates.value.filter(c => c.status === 'AVAILABLE').length,
  claimed: judgeCandidates.value.filter(c => c.status === 'CLAIMED').length,
  evaluated: judgeCandidates.value.filter(c => c.status === 'EVALUATED').length
}));

export const claimedJudgeCandidates = computed(() => judgeCandidates.value.filter(c => c.isClaimedByMe));
export const currentJudgeCandidate = computed(() => judgeCandidates.value[judgeSelectedIdx.value] || null);

export const judgeWorkspaceSummary = computed(() => {
  let totalWeight = 0, weightedSum = 0;
  const rows = (candidateGradingMetrics.value || []).map(m => {
    const weight = Number(m.weight) || 0;
    const raw = parseFloat(judgeScores.value[m.metricId]);
    const score = isNaN(raw) ? 0 : Math.min(4, Math.max(0, raw));
    totalWeight += weight;
    weightedSum += score * weight;
    return { metricId: m.metricId, categoryName: m.categoryName || '', title: m.title, weight, evalType: m.evalType, score: score.toFixed(2), weightedPoints: ((score * weight) / 4).toFixed(2) };
  });
  const totalScoreNum = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const gradeInfo = getPerformanceGrade(totalScoreNum);
  return { rows, totalWeight, totalScore: totalScoreNum.toFixed(2), percentage: ((totalScoreNum / 4) * 100).toFixed(1), grade: gradeInfo.grade, gradeColor: gradeInfo.color };
});

export async function loadJudgeCandidates(pId) {
  try {
    const res = await fetchAPI('/judge/assigned?periodId=' + pId);
    judgeCandidates.value = res.data || [];
    const active = allPeriods.value.find(p => Number(p.id) === Number(pId));
    if (active) period.value = { id: active.id, name: active.name, startDate: active.startDate || '', endDate: active.endDate || '', isOpen: Boolean(active.isOpen) };
  } catch (e) { console.warn(e.message); }
}

export function createJudgeActions() {
  let isJudgeDrawing = false, hasDrawnStroke = false, judgeCtx = null;

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
    const r = canvas.getBoundingClientRect();
    judgeCtx.moveTo(e.clientX - r.left, e.clientY - r.top);
  }

  function drawingJudge(e) {
    if (!isJudgeDrawing || !judgeCtx) return;
    const canvas = document.getElementById('judgeCanvas');
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    judgeCtx.lineTo(e.clientX - r.left, e.clientY - r.top);
    judgeCtx.stroke();
  }

  function stopJudgeDraw() {
    if (isJudgeDrawing) {
      isJudgeDrawing = false;
      if (hasDrawnStroke) captureJudgeCanvas(true);
    }
  }

  function judgeTouchStart(e) {
    if (!e.touches?.[0]) return;
    e.preventDefault();
    startJudgeDraw({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
  }

  function judgeTouchMove(e) {
    if (!e.touches?.[0]) return;
    e.preventDefault();
    drawingJudge({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
  }

  function clearJudgeCanvas() {
    const canvas = document.getElementById('judgeCanvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
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
    } catch {
      const reader = new FileReader();
      reader.onload = ev => { judgeSignatureData.value = ev.target?.result || ''; };
      reader.readAsDataURL(file);
    }
  }

  function useProfileJudgeSignature() {
    const saved = judgeProfileSignatureUrl.value || currentUser.value?.signatureUrl || '';
    if (!saved) return showToast('ยังไม่มีลายเซ็นในโปรไฟล์ของท่าน กรุณาวาดลายเซ็นหรืออัปโหลดไฟล์ลายเซ็นแทน', 'error');
    judgeSignatureMode.value = 'profile';
    judgeSignatureData.value = saved;
  }

  const onJudgePeriodChange = async () => { await loadJudgeCandidates(selectedPeriodId.value); judgeViewMode.value = 'list'; };

  async function claimJudgeCandidate(candidate) {
    if (!(await openConfirmDialog(`ยืนยันการกดรับ "${candidate.teacherName}" เพื่อเข้าตรวจประเมินใช่หรือไม่?`, { title: 'ยืนยันการกดรับผู้รับการประเมิน', confirmText: 'กดรับการประเมิน' }))) return;
    try {
      const res = await fetchAPI('/judge/claim', { method: 'POST', body: JSON.stringify({ teacherCitizenId: candidate.teacherCitizenId, periodId: selectedPeriodId.value }) });
      await loadJudgeCandidates(selectedPeriodId.value);
      showToast(res.message || 'กดรับผู้รับการประเมินเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast('ไม่สามารถกดรับได้: ' + err.message, 'error');
      await loadJudgeCandidates(selectedPeriodId.value);
    }
  }

  async function unclaimJudgeCandidate(candidate) {
    if (!candidate.assignmentId) return;
    if (!(await openConfirmDialog(`ยืนยันการยกเลิกการรับ "${candidate.teacherName}" และปล่อยสิทธิ์คืนให้กรรมการท่านอื่นใช่หรือไม่?`, { title: 'ยืนยันการยกเลิกการรับ', confirmText: 'ปล่อยสิทธิ์คืน', danger: true }))) return;
    try {
      const res = await fetchAPI(`/judge/claim/${candidate.assignmentId}`, { method: 'DELETE' });
      await loadJudgeCandidates(selectedPeriodId.value);
      if (judgeViewMode.value === 'workspace') judgeViewMode.value = 'list';
      showToast(res.message || 'ยกเลิกการรับเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast('ไม่สามารถยกเลิกการรับได้: ' + err.message, 'error'); }
  }

  async function selectJudgeCandidate(idx) {
    judgeSelectedIdx.value = idx;
    const cand = judgeCandidates.value[idx];
    if (!cand?.assignmentId) return;
    try {
      const res = await fetchAPI(`/judge/grading/${cand.assignmentId}`);
      if (res.data?.metrics) {
        candidateGradingMetrics.value = res.data.metrics;
        const newScores = {};
        res.data.metrics.forEach(m => {
          newScores[m.metricId] = m.existingJudgeScore != null ? String(Number(m.existingJudgeScore)) : (m.evalType === 'BOOLEAN' ? '4' : '3');
        });
        judgeScores.value = newScores;
        judgeOverallFeedback.value = res.data.summary?.overallFeedback || '';
        const profileSig = res.data.assignment?.judgeProfileSignatureUrl || currentUser.value?.signatureUrl || '';
        judgeProfileSignatureUrl.value = profileSig;
        const existingSig = res.data.summary?.judgeSignature || '';
        const looksLikeImage = existingSig.startsWith('data:image/') || existingSig.startsWith('/uploads/') || existingSig.startsWith('http');
        judgeSignatureData.value = looksLikeImage ? existingSig : (profileSig || '');
        judgeSignatureMode.value = (judgeSignatureData.value && judgeSignatureData.value === profileSig) ? 'profile' : (looksLikeImage ? 'upload' : 'draw');
        hasDrawnStroke = false;
      }
    } catch (err) { console.error(err); }
  }

  async function openCandidateGrading(candidate) {
    if (!candidate.isClaimedByMe || !candidate.assignmentId) return showToast('กรุณากดปุ่ม "กดรับการประเมิน" ก่อนเข้าตรวจให้คะแนน', 'error');
    const idx = judgeCandidates.value.findIndex(c => c.teacherCitizenId === candidate.teacherCitizenId);
    await selectJudgeCandidate(idx >= 0 ? idx : 0);
    judgeViewMode.value = 'workspace';
  }

  const onJudgeCandidateDropdownChange = (cid) => {
    const idx = judgeCandidates.value.findIndex(c => c.teacherCitizenId === cid);
    if (idx >= 0) selectJudgeCandidate(idx);
  };

  const backToCandidateList = () => { judgeViewMode.value = 'list'; };

  async function submitJudgeScore() {
    const cand = currentJudgeCandidate.value;
    if (!cand) return;
    if (!judgeSignatureData.value && hasDrawnStroke) captureJudgeCanvas(true);
    if (!judgeSignatureData.value) return showToast('กรุณาลงนามโดยแนบลายเซ็น (วาดลายเซ็น อัปโหลดไฟล์ หรือใช้ลายเซ็นจากโปรไฟล์) ก่อนบันทึกและส่งผลการประเมิน', 'error');

    try {
      const res = await fetchAPI('/judge/submit/' + cand.assignmentId, {
        method: 'POST',
        body: JSON.stringify({ scores: judgeScores.value, overallFeedback: judgeOverallFeedback.value, signature: judgeSignatureData.value })
      });
      showToast('บันทึกและส่งผลการประเมินสำเร็จ (คะแนนรวม: ' + res.data.totalScore + ')', 'success');
      await loadJudgeCandidates(selectedPeriodId.value);
      judgeViewMode.value = 'list';
    } catch (err) { showToast(err.message, 'error'); }
  }

  function openJudgeReportModal(candidate) {
    const isActive = judgeViewMode.value === 'workspace' && currentJudgeCandidate.value && Number(currentJudgeCandidate.value.assignmentId) === Number(candidate.assignmentId);
    return openIndividualReportModal(candidate, { isActive, scores: judgeScores.value, feedback: judgeOverallFeedback.value, signature: judgeSignatureData.value });
  }

  return {
    onJudgePeriodChange, claimJudgeCandidate, unclaimJudgeCandidate, openCandidateGrading, selectJudgeCandidate,
    onJudgeCandidateDropdownChange, backToCandidateList, submitJudgeScore, openJudgeReportModal, startJudgeDraw,
    drawingJudge, stopJudgeDraw, judgeTouchStart, judgeTouchMove, clearJudgeCanvas, captureJudgeCanvas, onJudgeSigUpload, useProfileJudgeSignature
  };
}
