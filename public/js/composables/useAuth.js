// public/js/composables/useAuth.js
import { fetchAPI } from '../api.js';
import { stripKnownPrefix } from '../utils/formatters.js';
import { currentUser, token, publicDepartments, selectedPeriodId, loadPublicDepartments, showToast } from './useAppState.js';

const { ref, computed } = window.Vue;

export const authMode = ref('login');
export const isAuthLoading = ref(false);
export const authError = ref('');
export const authSuccess = ref('');
export const showPassword = ref(false);

export const loginForm = ref({ citizenId: '', password: '' });
export const regForm = ref({
  prefix: 'นาย',
  name: '',
  citizenId: '',
  employeeId: '',
  departmentSelect: '',
  customDepartment: '',
  position: 'ครูผู้ช่วย',
  requiredJudges: 3,
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  signature: ''
});
export const regSigMode = ref('upload');
export const regConsent = ref(false);

export const showProfileModal = ref(false);
export const profileForm = ref({
  prefix: 'นาย',
  name: '',
  departmentSelect: '',
  customDepartment: '',
  department: '',
  position: '',
  requiredJudges: 3,
  phone: '',
  email: '',
  employeeId: '',
  password: ''
});
export const reselectDeptForm = ref({ departmentSelect: '', customDepartment: '' });

export const profileDepartmentOptions = computed(() => {
  const set = new Set();
  (publicDepartments.value || []).forEach(d => { if (d.name) set.add(d.name); });
  if (currentUser.value && currentUser.value.role !== 'teacher') {
    ['ศูนย์เทคโนโลยีสารสนเทศ', 'งานบุคลากร', 'คณะกรรมการประเมินภายนอก', 'ส่วนกลาง'].forEach(s => set.add(s));
  }
  return Array.from(set);
});

export function createAuthActions({ onLoginSuccess, onTeacherReload, onAdminReload, onResetSession }) {
  let isDrawing = false;
  let ctx = null;

  async function switchToRegister() {
    authError.value = '';
    authSuccess.value = '';
    await loadPublicDepartments();
    authMode.value = 'register';
  }

  async function login() {
    isAuthLoading.value = true;
    authError.value = '';
    authSuccess.value = '';
    try {
      const res = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm.value)
      });
      token.value = res.data.token;
      currentUser.value = res.data.user;
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      authSuccess.value = 'เข้าสู่ระบบสำเร็จ';
      await onLoginSuccess();
    } catch (err) {
      authError.value = err.message;
    } finally {
      isAuthLoading.value = false;
    }
  }

  async function quickLogin(role) {
    const creds = {
      admin: ['1100000000000', 'admin1234'],
      teacher: ['1100200000002', 'pass1234'],
      judge: ['1100300000003', 'judge1234']
    };
    const [cId, pass] = creds[role] || creds.admin;
    loginForm.value.citizenId = cId;
    loginForm.value.password = pass;
    await login();
  }

  async function registerUser() {
    if (regForm.value.password !== regForm.value.confirmPassword) {
      authError.value = 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน';
      return;
    }
    if (!regForm.value.departmentSelect) {
      authError.value = 'กรุณาเลือกสาขาวิชา / แผนกวิชา';
      return;
    }
    const reqJudgesNum = Number(regForm.value.requiredJudges);
    if (!Number.isInteger(reqJudgesNum) || reqJudgesNum < 1 || reqJudgesNum > 10) {
      authError.value = 'กรุณาระบุจำนวนกรรมการที่จะประเมินระหว่าง 1 ถึง 10 ท่าน';
      return;
    }
    const isCustom = regForm.value.departmentSelect === '__CUSTOM__';
    const customName = String(regForm.value.customDepartment || '').trim();
    if (isCustom && !customName) {
      authError.value = 'กรุณาระบุชื่อสาขาวิชาใหม่ที่ต้องการขอเพิ่มให้ฝ่ายบุคลากร (HR) อนุมัติ';
      return;
    }

    isAuthLoading.value = true;
    authError.value = '';
    try {
      const payload = {
        ...regForm.value,
        requiredJudges: reqJudgesNum,
        isCustomDepartment: isCustom,
        customDepartment: isCustom ? customName : '',
        department: isCustom ? '' : regForm.value.departmentSelect
      };
      const res = await fetchAPI('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
      authSuccess.value = res.message || 'ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ';
      authMode.value = 'login';
      loginForm.value.citizenId = regForm.value.citizenId;
      loginForm.value.password = '';
      regForm.value.departmentSelect = '';
      regForm.value.customDepartment = '';
      regForm.value.requiredJudges = 3;
    } catch (err) {
      authError.value = err.message;
    } finally {
      isAuthLoading.value = false;
    }
  }

  async function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    currentUser.value = null;
    token.value = '';
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    authMode.value = 'login';
    if (onResetSession) onResetSession();
  }

  async function openProfileModal() {
    if (!currentUser.value) return;
    await loadPublicDepartments();
    const u = currentUser.value;
    const opts = profileDepartmentOptions.value;
    let deptSel = '';
    let customDept = '';

    if (u.deptStatus === 'PENDING' && u.requestedDepartment) {
      deptSel = '__CUSTOM__';
      customDept = u.requestedDepartment;
    } else if (u.department && opts.includes(u.department)) {
      deptSel = u.department;
    } else if (u.department) {
      deptSel = '__CUSTOM__';
      customDept = u.department;
    }

    profileForm.value = {
      prefix: u.prefix || 'นาย',
      name: stripKnownPrefix(u.name || ''),
      departmentSelect: deptSel,
      customDepartment: customDept,
      department: u.department || '',
      position: u.position || '',
      requiredJudges: Number(u.requiredJudges) || 3,
      phone: u.phone || '',
      email: u.email || '',
      employeeId: u.employeeId || '',
      password: ''
    };
    showProfileModal.value = true;
  }

  async function saveOwnProfile() {
    try {
      if (!profileForm.value.departmentSelect) {
        showToast('กรุณาเลือกสาขาวิชา / สังกัดหน่วยงาน', 'error');
        return;
      }
      const isCustom = profileForm.value.departmentSelect === '__CUSTOM__';
      const customName = String(profileForm.value.customDepartment || '').trim();
      if (isCustom && !customName) {
        showToast('กรุณาระบุชื่อสาขาวิชา / สังกัดใหม่', 'error');
        return;
      }

      const payload = {
        prefix: profileForm.value.prefix,
        name: profileForm.value.name,
        position: profileForm.value.position,
        phone: profileForm.value.phone,
        email: profileForm.value.email,
        employeeId: profileForm.value.employeeId,
        password: profileForm.value.password,
        isCustomDepartment: isCustom,
        customDepartment: isCustom ? customName : '',
        department: isCustom ? '' : profileForm.value.departmentSelect
      };
      if (currentUser.value?.role === 'teacher') {
        payload.requiredJudges = Number(profileForm.value.requiredJudges);
      }

      const res = await fetchAPI('/auth/profile', { method: 'PUT', body: JSON.stringify(payload) });
      currentUser.value = res.data;
      localStorage.setItem('user', JSON.stringify(res.data));
      showProfileModal.value = false;
      await loadPublicDepartments();
      if (currentUser.value.role === 'teacher') {
        await onTeacherReload(selectedPeriodId.value);
      } else if (currentUser.value.role === 'admin' || currentUser.value.role === 'hr') {
        await onAdminReload();
      }
      showToast(res.data.deptStatus === 'PENDING'
        ? 'บันทึกข้อมูลเรียบร้อยแล้ว คำขอเพิ่มสาขาวิชาใหม่ของท่านถูกส่งให้ฝ่ายบุคลากร (HR) พิจารณาอนุมัติ'
        : 'บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  }

  async function submitReselectDepartment() {
    try {
      if (!reselectDeptForm.value.departmentSelect) {
        showToast('กรุณาเลือกสาขาวิชาใหม่', 'error');
        return;
      }
      const isCustom = reselectDeptForm.value.departmentSelect === '__CUSTOM__';
      const customName = String(reselectDeptForm.value.customDepartment || '').trim();
      if (isCustom && !customName) {
        showToast('กรุณาระบุชื่อสาขาวิชาใหม่ที่ต้องการขอเพิ่ม', 'error');
        return;
      }

      const res = await fetchAPI('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          isCustomDepartment: isCustom,
          customDepartment: isCustom ? customName : '',
          department: isCustom ? '' : reselectDeptForm.value.departmentSelect
        })
      });
      currentUser.value = res.data;
      localStorage.setItem('user', JSON.stringify(res.data));
      reselectDeptForm.value = { departmentSelect: '', customDepartment: '' };
      await onTeacherReload(selectedPeriodId.value);

      showToast(res.data.deptStatus === 'APPROVED'
        ? `เลือกสาขาวิชา "${res.data.department}" เรียบร้อยแล้ว ท่านสามารถส่งข้อมูลแบบประเมินตนเองได้ทันที`
        : `ส่งคำขอเพิ่มสาขาวิชา "${res.data.requestedDepartment}" ให้ฝ่ายบุคลากร (HR) พิจารณาใหม่เรียบร้อยแล้ว`, 'success');
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  }

  function initCanvas() {
    const cv = document.getElementById('indexCanvas');
    if (cv) {
      ctx = cv.getContext('2d');
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000';
    }
  }
  function startDraw(e) { isDrawing = true; if (!ctx) initCanvas(); ctx?.beginPath(); ctx?.moveTo(e.offsetX, e.offsetY); }
  function drawing(e) { if (isDrawing && ctx) { ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); } }
  function stopDraw() { isDrawing = false; }
  function touchStart(e) {
    isDrawing = true;
    if (!ctx) initCanvas();
    const r = e.target.getBoundingClientRect();
    ctx?.beginPath();
    ctx?.moveTo(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
  }
  function touchMove(e) {
    if (!isDrawing || !ctx) return;
    const r = e.target.getBoundingClientRect();
    ctx.lineTo(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
    ctx.stroke();
    e.preventDefault();
  }
  function clearIndexCanvas() {
    const cv = document.getElementById('indexCanvas');
    if (cv && ctx) { ctx.clearRect(0, 0, cv.width, cv.height); regForm.value.signature = ''; }
  }
  function captureIndexCanvas() {
    const cv = document.getElementById('indexCanvas');
    if (cv) { regForm.value.signature = cv.toDataURL('image/png'); showToast('บันทึกลายเซ็นเรียบร้อยแล้ว', 'success'); }
  }
  function onRegisterSigUpload(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => { regForm.value.signature = ev.target.result; };
    reader.readAsDataURL(f);
  }

  return {
    switchToRegister, login, quickLogin, registerUser, logout,
    openProfileModal, saveOwnProfile, submitReselectDepartment,
    startDraw, drawing, stopDraw, touchStart, touchMove,
    clearIndexCanvas, captureIndexCanvas, onRegisterSigUpload
  };
}
