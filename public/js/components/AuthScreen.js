// public/js/components/AuthScreen.js
import { allowQuickLogin, publicDepartments } from '../composables/useAppState.js';
import {
  authMode, isAuthLoading, authError, authSuccess, showPassword,
  loginForm, regForm, regSigMode, regConsent
} from '../composables/useAuth.js';

export default {
  name: 'AuthScreen',
  props: {
    actions: { type: Object, required: true }
  },
  setup(props) {
    return {
      allowQuickLogin, publicDepartments,
      authMode, isAuthLoading, authError, authSuccess, showPassword,
      loginForm, regForm, regSigMode, regConsent,
      ...props.actions
    };
  },
  template: `
    <div class="auth-wrap">
      <!-- 1.1 LOGIN SCREEN -->
      <div v-if="authMode === 'login'" class="auth-card login">
        <div class="auth-brand">
          <div class="auth-brand-badge"><v-icon name="building" size="22"></v-icon></div>
          <h1 class="auth-title">ระบบประเมินผลการปฏิบัติงานบุคลากร</h1>
          <p class="auth-subtitle">Personnel Performance Evaluation System</p>
        </div>

        <div v-if="allowQuickLogin" class="pres-box">
          <div class="pres-header">
            <v-icon name="zap" size="12"></v-icon>
            <span>ทางลัดสำหรับการนำเสนอผลงาน (Quick Login)</span>
          </div>
          <div class="pres-btns">
            <button type="button" class="pres-btn" @click="quickLogin('admin')" :disabled="isAuthLoading">
              <v-icon name="shield" size="16"></v-icon><span>Admin & HR</span>
            </button>
            <button type="button" class="pres-btn" @click="quickLogin('teacher')" :disabled="isAuthLoading">
              <v-icon name="user" size="16"></v-icon><span>ครูผู้รับการประเมิน</span>
            </button>
            <button type="button" class="pres-btn" @click="quickLogin('judge')" :disabled="isAuthLoading">
              <v-icon name="award" size="16"></v-icon><span>กรรมการผู้ประเมิน</span>
            </button>
          </div>
        </div>

        <div v-if="authError" class="alert error"><v-icon name="alert" size="15"></v-icon><span>{{ authError }}</span></div>
        <div v-if="authSuccess" class="alert success"><v-icon name="check-circle" size="15"></v-icon><span>{{ authSuccess }}</span></div>

        <form @submit.prevent="login">
          <div style="margin-bottom: 12px;">
            <label>ชื่อผู้ใช้งาน หรือ เลขบัตรประชาชน</label>
            <div style="position: relative;">
              <input v-model="loginForm.citizenId" type="text" placeholder="ระบุเลขบัตรประชาชน หรือ Username" required style="padding-left: 32px;" />
              <v-icon name="user" size="14" style="position: absolute; left: 10px; top: 10px; color: var(--text-muted);"></v-icon>
            </div>
          </div>
          <div style="margin-bottom: 16px;">
            <label>รหัสผ่าน</label>
            <div style="position: relative;">
              <input v-model="loginForm.password" :type="showPassword ? 'text' : 'password'" placeholder="ระบุรหัสผ่าน" required style="padding-left: 32px; padding-right: 32px;" />
              <v-icon name="lock" size="14" style="position: absolute; left: 10px; top: 10px; color: var(--text-muted);"></v-icon>
              <button type="button" @click="showPassword = !showPassword" style="position: absolute; right: 8px; top: 8px; background: none; border: none; cursor: pointer; color: var(--text-muted);">
                <v-icon :name="showPassword ? 'eye-off' : 'eye'" size="14"></v-icon>
              </button>
            </div>
          </div>
          <button type="submit" class="btn-primary" style="width: 100%; height: 38px;" :disabled="isAuthLoading">
            <span v-if="!isAuthLoading">เข้าสู่ระบบ (Sign In)</span>
            <span v-else>กำลังตรวจสอบข้อมูล...</span>
            <v-icon name="arrow-right" size="14"></v-icon>
          </button>
        </form>

        <div style="text-align: center; margin-top: 14px; font-size: 12.5px; color: var(--text-muted);">
          <span>ยังไม่มีบัญชีผู้รับการประเมิน? </span>
          <button type="button" style="background:none; border:none; color:var(--primary); font-weight:600; cursor:pointer;" @click="switchToRegister">
            ลงทะเบียนบุคลากรใหม่
          </button>
        </div>
      </div>

      <!-- 1.2 REGISTRATION SCREEN -->
      <div v-else class="auth-card register">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
          <div>
            <h2 class="auth-title">ลงทะเบียนผู้รับการประเมินใหม่</h2>
            <p class="auth-subtitle">กรอกข้อมูลประวัติการทำงาน เลือกสาขาวิชา จำนวนกรรมการที่จะประเมิน และลายเซ็นดิจิทัล</p>
          </div>
          <button type="button" class="btn-outline btn-sm" @click="authMode = 'login'">
            <v-icon name="arrow-left" size="13"></v-icon> กลับสู่หน้าเข้าสู่ระบบ
          </button>
        </div>

        <div v-if="authError" class="alert error"><v-icon name="alert" size="15"></v-icon><span>{{ authError }}</span></div>
        <div v-if="authSuccess" class="alert success"><v-icon name="check-circle" size="15"></v-icon><span>{{ authSuccess }}</span></div>

        <form @submit.prevent="registerUser">
          <div style="font-weight: 700; font-size: 12px; color: var(--primary); margin-bottom: 8px; text-transform: uppercase;">1. ข้อมูลส่วนตัวและสังกัดสาขาวิชา</div>
          <div class="grid-3" style="margin-bottom: 10px;">
            <div>
              <label>คำนำหน้า *</label>
              <select v-model="regForm.prefix" required>
                <option value="นาย">นาย</option>
                <option value="นาง">นาง</option>
                <option value="นางสาว">นางสาว</option>
                <option value="ดร.">ดร.</option>
                <option value="ผศ.ดร.">ผศ.ดร.</option>
              </select>
            </div>
            <div>
              <label>ชื่อ-นามสกุล *</label>
              <input v-model="regForm.name" placeholder="เช่น สมชาย ใจดี" required />
            </div>
            <div>
              <label>เลขประจำตัวข้าราชการ/พนักงาน</label>
              <input v-model="regForm.employeeId" placeholder="เช่น T-6801" />
            </div>
          </div>

          <div class="grid-3" style="margin-bottom: 10px;">
            <div>
              <label>สาขาวิชา / แผนกวิชา *</label>
              <select v-model="regForm.departmentSelect" required>
                <option value="" disabled>-- เลือกสาขาวิชา / แผนกวิชา --</option>
                <option v-for="d in publicDepartments" :key="d.id" :value="d.name">{{ d.name }}</option>
                <option value="__CUSTOM__">+ เพิ่มสาขาวิชาเอง (ส่งคำขอให้ฝ่ายบุคลากร HR อนุมัติ)</option>
              </select>
            </div>
            <div>
              <label>ตำแหน่งปัจจุบัน *</label>
              <input v-model="regForm.position" placeholder="เช่น ครู คศ.1" required />
            </div>
            <div>
              <label>จำนวนกรรมการที่จะประเมิน (คน) *</label>
              <input v-model.number="regForm.requiredJudges" type="number" min="1" max="10" placeholder="เช่น 3 หรือ 4" required />
            </div>
          </div>

          <div v-if="regForm.departmentSelect === '__CUSTOM__'" style="margin-bottom: 12px; padding: 10px 12px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: var(--radius-sm);">
            <label style="color: #92400e; font-weight: 700;">ระบุชื่อสาขาวิชาใหม่ที่ต้องการขอเพิ่ม *</label>
            <input v-model="regForm.customDepartment" placeholder="เช่น แผนกวิชาอิเล็กทรอนิกส์" required style="margin-top: 4px; background: #fff;" />
            <div style="font-size: 11.5px; color: #b45309; margin-top: 5px; display: flex; align-items: center; gap: 5px;">
              <v-icon name="clock" size="13"></v-icon>
              <span>หมายเหตุ: การขอเพิ่มสาขาวิชาใหม่จะต้องรอฝ่ายบุคลากร (HR) อนุมัติก่อน จึงจะสามารถส่งข้อมูลแบบประเมินให้กรรมการได้</span>
            </div>
          </div>

          <div class="grid-2" style="margin-bottom: 12px;">
            <div><label>เบอร์โทรศัพท์มือถือ *</label><input v-model="regForm.phone" placeholder="เช่น 081-234-5678" required /></div>
            <div><label>อีเมลติดต่อ *</label><input v-model="regForm.email" type="email" placeholder="เช่น somchai@school.ac.th" required /></div>
          </div>

          <div style="font-weight: 700; font-size: 12px; color: var(--primary); margin-bottom: 8px; text-transform: uppercase;">2. ความปลอดภัยและการเข้าสู่ระบบ</div>
          <div class="grid-3" style="margin-bottom: 12px;">
            <div><label>เลขประจำตัวประชาชน (13 หลัก) *</label><input v-model="regForm.citizenId" placeholder="13 หลัก เช่น 1100400000004" required /></div>
            <div><label>รหัสผ่าน *</label><input v-model="regForm.password" type="password" placeholder="อย่างน้อย 4 ตัวอักษร" required /></div>
            <div><label>ยืนยันรหัสผ่าน *</label><input v-model="regForm.confirmPassword" type="password" placeholder="กรอกรหัสผ่านซ้ำ" required /></div>
          </div>

          <div style="font-weight: 700; font-size: 12px; color: var(--primary); margin-bottom: 8px; text-transform: uppercase;">3. ลายเซ็นดิจิทัล (Digital Signature)</div>
          <div style="display: flex; gap: 8px; margin-bottom: 10px;">
            <button type="button" :class="['btn-sm', regSigMode === 'upload' ? 'active' : '']" @click="regSigMode = 'upload'">
              <v-icon name="upload" size="13"></v-icon> อัปโหลดไฟล์ลายเซ็น
            </button>
            <button type="button" :class="['btn-sm', regSigMode === 'draw' ? 'active' : '']" @click="regSigMode = 'draw'">
              <v-icon name="pen" size="13"></v-icon> วาดลายเซ็นบนหน้าจอ
            </button>
          </div>

          <div v-if="regSigMode === 'upload'" style="margin-bottom: 12px;">
            <input type="file" accept="image/*" @change="onRegisterSigUpload" />
            <small style="color: var(--text-muted); display: block; margin-top: 3px;">รองรับไฟล์ PNG หรือ JPG พื้นหลังโปร่งใสหรือสีขาว</small>
            <span v-if="regForm.signature" style="color:var(--success); font-weight:600; font-size:12px; display:inline-flex; align-items:center; gap:4px; margin-top:4px;">
              <v-icon name="check-circle" size="13"></v-icon> บันทึกไฟล์ลายเซ็นเรียบร้อย
            </span>
          </div>

          <div v-else style="margin-bottom: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; background: #fafafa;">
            <canvas id="indexCanvas" width="460" height="90" style="background:#fff; border:1px solid #cbd5e1; border-radius:4px; display:block; margin:0 auto; cursor:crosshair;"
                    @mousedown="startDraw" @mousemove="drawing" @mouseup="stopDraw" @mouseleave="stopDraw"
                    @touchstart="touchStart" @touchmove="touchMove" @touchend="stopDraw"></canvas>
            <div style="margin-top: 6px; display:flex; gap:8px; justify-content:center;">
              <button type="button" class="btn-sm" @click="clearIndexCanvas"><v-icon name="eraser" size="12"></v-icon> ล้างลายเซ็น</button>
              <button type="button" class="btn-primary" style="height:26px; padding:2px 10px; font-size:11.5px;" @click="captureIndexCanvas">
                <v-icon name="check" size="12"></v-icon> บันทึกลายเซ็น
              </button>
              <span v-if="regForm.signature" style="color:var(--success); font-weight:600; font-size:12px; align-self:center; display:inline-flex; align-items:center; gap:4px;">
                <v-icon name="check-circle" size="13"></v-icon> พร้อมใช้งาน
              </span>
            </div>
          </div>

          <div style="margin: 12px 0;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12.5px;">
              <input type="checkbox" v-model="regConsent" required />
              <span>ข้าพเจ้ารับรองว่าข้อมูลข้างต้นเป็นความจริงทุกประการและยินยอมให้ประมวลผลข้อมูลในระบบ</span>
            </label>
          </div>

          <button type="submit" class="btn-primary" style="width: 100%; height: 38px;" :disabled="isAuthLoading">
            <span>ยืนยันการลงทะเบียน (Register Account)</span>
            <v-icon name="arrow-right" size="14"></v-icon>
          </button>
        </form>
      </div>
    </div>
  `
};
