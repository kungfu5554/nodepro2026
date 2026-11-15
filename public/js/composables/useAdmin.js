import { fetchAPI } from '../api.js';
import { stripKnownPrefix } from '../utils/formatters.js';
import { executeOfficialPrint } from '../utils/print-reports.js';
import {
  currentUser, publicDepartments, selectedAdminPeriodId, period, metrics, metricCategories,
  printMode, printCandidateData, loadPeriods, loadPublicDepartments, getPrintContext,
  openConfirmDialog, showToast
} from './useAppState.js';

const { ref, computed } = window.Vue;

export const adminTab = ref('users');
export const usersList = ref([]);
export const userFilterRole = ref('ALL');
export const userSearchQuery = ref('');

export const showUserModal = ref(false);
export const userModalMode = ref('add');
export const userModalForm = ref({
  id: null, role: 'teacher', prefix: 'นาย', name: '', citizenId: '',
  departmentSelect: '', customDepartment: '', department: '',
  deptStatus: 'APPROVED', position: '', requiredJudges: 3, password: ''
});

export const showAccountModal = ref(false);
export const accountTargetUser = ref(null);
export const accountForm = ref({ password: '', confirmPassword: '' });

export const showEditMetricModal = ref(false);
export const editMetricForm = ref({ id: null, categoryId: '', title: '', description: '', weight: 0, evalType: 'SCALE', evidenceType: 'PDF' });
export const newCategory = ref({ name: '', description: '', sortOrder: 1 });
export const showEditCategoryModal = ref(false);
export const editCategoryForm = ref({ id: null, name: '', description: '', sortOrder: 1 });

export const assignments = ref([]);
export const hrStats = ref({});
export const newMetric = ref({ categoryId: '', title: '', weight: 30, evalType: 'SCALE', evidenceType: 'PDF' });

export const trackingSubTab = ref('pipeline');
export const trackingEvaluatees = ref([]);
export const trackingJudges = ref([]);
export const trackingSearchQuery = ref('');
export const trackingStageFilter = ref('ALL');
export const showTrackingDetailModal = ref(false);
export const trackingDetailLoading = ref(false);
export const selectedTrackingDetail = ref(null);

export const departmentsList = ref([]);
export const departmentJudgesList = ref([]);
export const newDept = ref({ name: '', code: '' });
export const newDeptJudge = ref({ departmentName: '', judgeCitizenId: '', roleInBoard: 'กรรมการ' });

export const departmentRequests = ref([]);
export const approveDeptCodes = ref({});
export const showRejectDeptModal = ref(false);
export const rejectDeptTarget = ref(null);
export const rejectDeptReason = ref('');

export const pendingDepartmentRequests = computed(() => (departmentRequests.value || []).filter(r => r.deptStatus === 'PENDING'));

export const adminUserDepartmentOptions = computed(() => {
  const set = new Set();
  (departmentsList.value || []).forEach(d => { if (d.name) set.add(d.name); });
  (publicDepartments.value || []).forEach(d => { if (d.name) set.add(d.name); });
  ['ศูนย์เทคโนโลยีสารสนเทศ', 'งานบุคลากร', 'คณะกรรมการประเมินภายนอก', 'ส่วนกลาง'].forEach(s => set.add(s));
  return Array.from(set);
});

export const filteredUsers = computed(() => {
  const q = userSearchQuery.value.trim().toLowerCase();
  return usersList.value.filter(u => {
    const matchRole = userFilterRole.value === 'ALL' || u.role === userFilterRole.value;
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.citizenId?.includes(q) || u.department?.toLowerCase().includes(q) || u.requestedDepartment?.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });
});

export const judges = computed(() => usersList.value.filter(u => u.role === 'judge'));

export const filteredTrackingEvaluatees = computed(() => {
  const q = trackingSearchQuery.value.trim().toLowerCase();
  return (trackingEvaluatees.value || []).filter(e => {
    const matchStage = trackingStageFilter.value === 'ALL' || e.workflowStage === trackingStageFilter.value;
    const matchQ = !q || e.name?.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q) || e.citizenId?.includes(q);
    return matchStage && matchQ;
  });
});

export const filteredTrackingJudges = computed(() => {
  const q = trackingSearchQuery.value.trim().toLowerCase();
  return (trackingJudges.value || []).filter(j => !q || j.name?.toLowerCase().includes(q) || j.citizenId?.includes(q) || (j.assignedDepartments || []).some(d => d.departmentName.toLowerCase().includes(q)));
});

export async function loadAdminDashboard() {
  const pId = selectedAdminPeriodId.value;
  const [usersRes, periodRes, categoriesRes, metricsRes, assignRes, statsRes, trackingRes, deptRes, deptJudgesRes, deptReqRes] = await Promise.all([
    fetchAPI('/users'),
    fetchAPI('/hr/period?periodId=' + pId),
    fetchAPI('/hr/metric-categories?periodId=' + pId),
    fetchAPI('/hr/metrics?periodId=' + pId),
    fetchAPI('/hr/assignments?periodId=' + pId),
    fetchAPI('/hr/statistics?periodId=' + pId),
    fetchAPI('/hr/tracking-overview?periodId=' + pId),
    fetchAPI('/hr/departments'),
    fetchAPI('/hr/department-judges?periodId=' + pId),
    fetchAPI('/hr/department-requests')
  ]);
  usersList.value = usersRes.data || usersRes.users || [];
  departmentsList.value = deptRes.data || [];
  departmentJudgesList.value = deptJudgesRes.data || [];
  departmentRequests.value = deptReqRes.data || [];
  if (periodRes.data) period.value = { id: periodRes.data.id, name: periodRes.data.name, startDate: periodRes.data.startDate || '', endDate: periodRes.data.endDate || '', isOpen: Boolean(periodRes.data.isOpen) };
  metricCategories.value = categoriesRes.data || [];
  metrics.value = metricsRes.data || [];
  assignments.value = assignRes.data || [];
  hrStats.value = statsRes.data || {};
  trackingEvaluatees.value = trackingRes.data?.evaluatees || [];
  trackingJudges.value = trackingRes.data?.judges || [];
}

export function createAdminActions(reloadAll) {
  const onAdminPeriodSelectChange = async () => { try { await loadAdminDashboard(); } catch (e) { console.warn(e); } };

  function openUserModal(mode, user = null) {
    userModalMode.value = mode;
    if (mode === 'edit' && user) {
      const form = {
        id: user.id, role: user.role || 'teacher', prefix: user.prefix || 'นาย', name: stripKnownPrefix(user.name || ''),
        citizenId: user.citizenId || '', departmentSelect: '', customDepartment: '', department: user.department || '',
        deptStatus: user.deptStatus || 'APPROVED', position: user.position || '', requiredJudges: Number(user.requiredJudges) || 3, password: ''
      };
      const opts = adminUserDepartmentOptions.value;
      if (user.deptStatus === 'PENDING' && user.requestedDepartment) { form.departmentSelect = '__CUSTOM__'; form.customDepartment = user.requestedDepartment; }
      else if (user.department && opts.includes(user.department)) form.departmentSelect = user.department;
      else if (user.department) { form.departmentSelect = '__CUSTOM__'; form.customDepartment = user.department; }
      userModalForm.value = form;
    } else {
      userModalForm.value = { id: null, role: 'teacher', prefix: 'นาย', name: '', citizenId: '', departmentSelect: '', customDepartment: '', department: '', deptStatus: 'APPROVED', position: '', requiredJudges: 3, password: '' };
    }
    showUserModal.value = true;
  }

  async function saveUserModal() {
    try {
      const cid = String(userModalForm.value.citizenId || '').trim();
      if (!/^\d{13}$/.test(cid)) return showToast('เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลักเท่านั้น', 'error');
      if (userModalForm.value.phone) {
        const ph = String(userModalForm.value.phone || '').trim();
        if (!/^\d{10}$/.test(ph)) return showToast('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น', 'error');
      }
      if (!userModalForm.value.departmentSelect) return showToast('กรุณาเลือกสาขาวิชา / สังกัดหน่วยงาน', 'error');
      const isCustom = userModalForm.value.departmentSelect === '__CUSTOM__';
      const resolvedDept = isCustom ? String(userModalForm.value.customDepartment || '').trim() : userModalForm.value.departmentSelect;
      if (!resolvedDept) return showToast('กรุณาระบุชื่อสาขาวิชา / สังกัด', 'error');

      const payload = {
        ...userModalForm.value,
        citizenId: cid,
        requiredJudges: userModalForm.value.role === 'teacher' ? 3 : (Number(userModalForm.value.requiredJudges) || 3),
        department: resolvedDept
      };
      if (userModalMode.value === 'add') await fetchAPI('/users', { method: 'POST', body: JSON.stringify(payload) });
      else await fetchAPI('/users/' + (userModalForm.value.citizenId || userModalForm.value.id), { method: 'PUT', body: JSON.stringify(payload) });

      showUserModal.value = false;
      await reloadAll();
      showToast('บันทึกข้อมูลผู้ใช้งานเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function deleteUser(cid) {
    if (!(await openConfirmDialog('คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งานนี้ออกจากระบบ?', { title: 'ยืนยันการลบผู้ใช้งาน', confirmText: 'ลบผู้ใช้งาน', danger: true }))) return;
    try {
      await fetchAPI('/users/' + cid, { method: 'DELETE' });
      await reloadAll();
      showToast('ลบผู้ใช้งานสำเร็จ', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  function openAccountModal(user) {
    accountTargetUser.value = user;
    accountForm.value = { password: '', confirmPassword: '' };
    showAccountModal.value = true;
  }

  async function saveAccountModal() {
    if (accountForm.value.password !== accountForm.value.confirmPassword) return showToast('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน', 'error');
    try {
      await fetchAPI('/users/' + (accountTargetUser.value.citizenId || accountTargetUser.value.id) + '/reset-password', {
        method: 'PUT', body: JSON.stringify({ password: accountForm.value.password })
      });
      showAccountModal.value = false;
      showToast('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function approveDepartmentRequest(reqItem) {
    const deptName = reqItem.requestedDepartment;
    if (!(await openConfirmDialog(`ยืนยันการอนุมัติสาขาวิชา "${deptName}" ให้แก่ ${reqItem.name} และเพิ่มเข้าสู่รายชื่อสาขาวิชาในระบบใช่หรือไม่?`, { title: 'ยืนยันการอนุมัติสาขาวิชา', confirmText: 'อนุมัติ' }))) return;
    try {
      await fetchAPI(`/hr/department-requests/${reqItem.id}/approve`, { method: 'POST', body: JSON.stringify({ departmentName: deptName, code: approveDeptCodes.value[reqItem.id] || '' }) });
      approveDeptCodes.value[reqItem.id] = '';
      await loadPublicDepartments();
      await reloadAll();
      showToast(`อนุมัติสาขาวิชา "${deptName}" เรียบร้อยแล้ว บุคลากรสามารถส่งแบบประเมินได้ทันที`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  function openRejectDeptModal(reqItem) {
    rejectDeptTarget.value = reqItem;
    rejectDeptReason.value = '';
    showRejectDeptModal.value = true;
  }

  async function confirmRejectDepartmentRequest() {
    if (!rejectDeptTarget.value) return;
    const reason = String(rejectDeptReason.value || '').trim();
    if (!reason) return showToast('กรุณาระบุเหตุผลที่ไม่อนุมัติ เพื่อแจ้งให้บุคลากรทราบ', 'error');
    try {
      await fetchAPI(`/hr/department-requests/${rejectDeptTarget.value.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      showRejectDeptModal.value = false;
      rejectDeptTarget.value = null;
      rejectDeptReason.value = '';
      await reloadAll();
      showToast('บันทึกการไม่อนุมัติพร้อมส่งเหตุผลแจ้งบุคลากรเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  const openEditMetricModal = (metric) => { editMetricForm.value = { ...metric, categoryId: metric.categoryId || '' }; showEditMetricModal.value = true; };
  async function saveEditMetric() {
    try {
      await fetchAPI('/hr/metrics/' + editMetricForm.value.id, { method: 'PUT', body: JSON.stringify({ ...editMetricForm.value, categoryId: editMetricForm.value.categoryId || null }) });
      showEditMetricModal.value = false;
      await reloadAll();
      showToast('บันทึกการแก้ไขตัวชี้วัดเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function addMetricCategory() {
    if (!newCategory.value.name?.trim()) return showToast('กรุณากรอกชื่อหัวข้อการประเมิน / หมวดหมู่', 'error');
    try {
      await fetchAPI('/hr/metric-categories', { method: 'POST', body: JSON.stringify({ ...newCategory.value, periodId: selectedAdminPeriodId.value }) });
      newCategory.value = { name: '', description: '', sortOrder: (metricCategories.value?.length || 0) + 2 };
      await reloadAll();
      showToast('เพิ่มหัวข้อการประเมินเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  const openEditCategoryModal = (cat) => { editCategoryForm.value = { id: cat.id, name: cat.name, description: cat.description || '', sortOrder: Number(cat.sortOrder) || 1 }; showEditCategoryModal.value = true; };
  async function saveEditCategory() {
    try {
      await fetchAPI('/hr/metric-categories/' + editCategoryForm.value.id, { method: 'PUT', body: JSON.stringify(editCategoryForm.value) });
      showEditCategoryModal.value = false;
      await reloadAll();
      showToast('บันทึกการแก้ไขหัวข้อการประเมินเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function deleteMetricCategory(id) {
    if (!(await openConfirmDialog('ยืนยันการลบหัวข้อการประเมินนี้? (ตัวชี้วัดภายในหัวข้อนี้จะยังคงอยู่เป็นตัวชี้วัดทั่วไป)', { title: 'ยืนยันการลบหัวข้อการประเมิน', confirmText: 'ลบหัวข้อ', danger: true }))) return;
    try {
      await fetchAPI('/hr/metric-categories/' + id, { method: 'DELETE' });
      await reloadAll();
      showToast('ลบหัวข้อการประเมินเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function openIndividualTrackingModal(teacherCitizenId) {
    try {
      trackingDetailLoading.value = true;
      showTrackingDetailModal.value = true;
      selectedTrackingDetail.value = null;
      const res = await fetchAPI(`/hr/tracking-individual/${teacherCitizenId}?periodId=${selectedAdminPeriodId.value}`);
      selectedTrackingDetail.value = res.data || null;
    } catch (err) {
      showTrackingDetailModal.value = false;
      showToast('ไม่สามารถโหลดข้อมูลติดตามรายบุคคลได้: ' + err.message, 'error');
    } finally { trackingDetailLoading.value = false; }
  }

  async function savePeriod() {
    try {
      await fetchAPI('/hr/period/' + period.value.id, {
        method: 'PUT', body: JSON.stringify({ name: period.value.name, startDate: period.value.startDate, endDate: period.value.endDate, isOpen: period.value.isOpen ? 1 : 0 })
      });
      await loadPeriods();
      showToast('บันทึกการตั้งค่ารอบการประเมินเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function addMetric() {
    if (!newMetric.value.title || !newMetric.value.weight) return showToast('กรุณากรอกชื่อตัวชี้วัดและค่าน้ำหนัก', 'error');
    try {
      await fetchAPI('/hr/metrics', { method: 'POST', body: JSON.stringify({ ...newMetric.value, categoryId: newMetric.value.categoryId || null, periodId: selectedAdminPeriodId.value }) });
      newMetric.value = { categoryId: newMetric.value.categoryId || '', title: '', weight: 30, evalType: 'SCALE', evidenceType: 'PDF' };
      await reloadAll();
      showToast('เพิ่มตัวชี้วัดเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function deleteMetric(id) {
    if (!(await openConfirmDialog('ยืนยันการลบตัวชี้วัดนี้?', { title: 'ยืนยันการลบตัวชี้วัด', confirmText: 'ลบตัวชี้วัด', danger: true }))) return;
    try {
      await fetchAPI('/hr/metrics/' + id, { method: 'DELETE' });
      await reloadAll();
      showToast('ลบตัวชี้วัดเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function addDepartment() {
    if (!newDept.value.name?.trim()) return showToast('กรุณากรอกชื่อสาขาวิชา/แผนก', 'error');
    try {
      await fetchAPI('/hr/departments', { method: 'POST', body: JSON.stringify(newDept.value) });
      newDept.value = { name: '', code: '' };
      await loadPublicDepartments();
      await reloadAll();
      showToast('เพิ่มสาขาวิชาเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function removeDepartment(id) {
    if (!(await openConfirmDialog('คุณแน่ใจหรือไม่ว่าต้องการลบสาขาวิชานี้?', { title: 'ยืนยันการลบสาขาวิชา', confirmText: 'ลบสาขาวิชา', danger: true }))) return;
    try {
      await fetchAPI('/hr/departments/' + id, { method: 'DELETE' });
      await loadPublicDepartments();
      await reloadAll();
      showToast('ลบสาขาวิชาเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function assignJudgeToDepartment() {
    if (!newDeptJudge.value.departmentName || !newDeptJudge.value.judgeCitizenId) return showToast('กรุณาเลือกสาขาวิชาและกรรมการ', 'error');
    try {
      await fetchAPI('/hr/department-judges', {
        method: 'POST',
        body: JSON.stringify({ departmentName: newDeptJudge.value.departmentName, judgeCitizenId: newDeptJudge.value.judgeCitizenId, roleInBoard: newDeptJudge.value.roleInBoard, periodId: selectedAdminPeriodId.value || 1 })
      });
      newDeptJudge.value.judgeCitizenId = '';
      await reloadAll();
      showToast('แต่งตั้งกรรมการประจำสาขาวิชาเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function removeJudgeFromDepartment(id) {
    if (!(await openConfirmDialog('คุณแน่ใจหรือไม่ว่าต้องการถอดถอนกรรมการท่านนี้ออกจากสาขาวิชา?', { title: 'ยืนยันการถอดถอนกรรมการ', confirmText: 'ถอดถอน', danger: true }))) return;
    try {
      await fetchAPI('/hr/department-judges/' + id, { method: 'DELETE' });
      await reloadAll();
      showToast('ถอดถอนกรรมการเรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  function triggerPrintOverallReport() {
    const reportData = {
      periodName: period.value.name, totalTeachers: hrStats.value.totalTeachers || 0,
      completedAssignments: hrStats.value.completedAssignments || 0,
      pendingCount: (hrStats.value.pendingAssignments || 0) + (hrStats.value.claimedAssignments || 0) + (hrStats.value.submittedAssignments || 0),
      averageScore: hrStats.value.averageScore || '0.00', assignmentsRows: assignments.value || [],
      hrOfficerName: currentUser.value?.name || 'เจ้าหน้าที่งานบุคลากร'
    };
    printMode.value = 'overall';
    printCandidateData.value = reportData;
    executeOfficialPrint('overall', reportData, `รายงานสรุปภาพรวมสถานศึกษา_${period.value.name}`, false, getPrintContext());
  }

  return {
    onAdminPeriodSelectChange, openUserModal, saveUserModal, deleteUser, openAccountModal, saveAccountModal,
    approveDepartmentRequest, openRejectDeptModal, confirmRejectDepartmentRequest, openEditMetricModal, saveEditMetric,
    addMetricCategory, openEditCategoryModal, saveEditCategory, deleteMetricCategory, openIndividualTrackingModal,
    savePeriod, addMetric, deleteMetric, addDepartment, removeDepartment, assignJudgeToDepartment, removeJudgeFromDepartment,
    triggerPrintOverallReport
  };
}
