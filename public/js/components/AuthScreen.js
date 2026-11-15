import { allowQuickLogin, publicDepartments } from '../composables/useAppState.js';
import {
  authMode, isAuthLoading, authError, authSuccess, showPassword,
  loginForm, regForm, regSigMode, regConsent
} from '../composables/useAuth.js';

export default {
  name: 'AuthScreen',
  props: { actions: { type: Object, required: true } },
  setup(props) {
    return {
      allowQuickLogin,
      publicDepartments,
      authMode,
      isAuthLoading,
      authError,
      authSuccess,
      showPassword,
      loginForm,
      regForm,
      regSigMode,
      regConsent,
      ...props.actions
    };
  },
  template: `
    <div class="auth-wrap">
      <!-- Login Card -->
      <div v-if="authMode === 'login'" class="auth-card login">
        <div class="auth-brand">
          <h1 class="auth-title">ระบบประเมินผลการปฏิบัติงานบุคลากร</h1>
          <p class="auth-subtitle">Personnel Performance Evaluation System</p>
        </div>

        <div v-if="allowQuickLogin" class="pres-box">
          <div class="pres-header">ทางลัดสำหรับการนำเสนอผลงาน (Quick Login)</div>
          <div class="pres-btns">
            <button type="button" class="pres-btn" @click="quickLogin('admin')" :disabled="isAuthLoading">Admin & HR</button>
            <button type="button" class="pres-btn" @click="quickLogin('teacher')" :disabled="isAuthLoading">ครูผู้รับการประเมิน</button>
            <button type="button" class="pres-btn" @click="quickLogin('judge')" :disabled="isAuthLoading">กรรมการผู้ประเมิน</button>
          </div>
        </div>

        <div v-if="authError" class="alert error">{{ authError }}</div>
        <div v-if="authSuccess" class="alert success">{{ authSuccess }}</div>

        <form @submit.prevent="login">
          <div style="margin-bottom: 12px;">
            <label>เลขบัตรประชาชน</label>
            <input
              v-model="loginForm.citizenId"
              type="text"
              placeholder="ระบุเลขบัตรประชาชน"
              required />
          </div>

          <div style="margin-bottom: 16px;">
            <label>รหัสผ่าน</label>
            <div style="position: relative;">
              <input
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="ระบุรหัสผ่าน"
                required
                style="padding-right: 40px;" />
              <button
                type="button"
                @click="showPassword = !showPassword"
                style="position: absolute; right: 8px; top: 7px; background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 11px;">
                {{ showPassword ? 'ซ่อน' : 'แสดง' }}
              </button>
            </div>
          </div>

          <button type="submit" class="btn-primary" style="width: 100%; height: 38px;" :disabled="isAuthLoading">
            <span v-if="!isAuthLoading">เข้าสู่ระบบ (Sign In)</span>
            <span v-else>กำลังตรวจสอบข้อมูล...</span>
          </button>
        </form>

        <div style="text-align: center; margin-top: 14px; font-size: 12.5px; color: var(--text-muted);">
          <span>ยังไม่มีบัญชีผู้รับการประเมิน? </span>
          <button type="button" class="btn-link" @click="switchToRegister">ลงทะเบียนบุคลากรใหม่</button>
        </div>
      </div>

      <!-- Register Card -->
      <div v-else class="auth-card register">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
          <div>
            <h2 class="auth-title">ลงทะเบียนผู้รับการประเมินใหม่</h2>
            <p class="auth-subtitle">กรอกข้อมูลประวัติการทำงาน เลือกสาขาวิชา จำนวนกรรมการ และลายเซ็นดิจิทัล</p>
          </div>
          <button type="button" class="btn-outline btn-sm" @click="authMode = 'login'">กลับสู่หน้าเข้าสู่ระบบ</button>
        </div>

        <div v-if="authError" class="alert error">{{ authError }}</div>
        <div v-if="authSuccess" class="alert success">{{ authSuccess }}</div>

        <form @submit.prevent="registerUser">
          <div style="font-weight: 700; font-size: 12px; color: var(--primary); margin-bottom: 8px; text-transform: uppercase;">
            1. ข้อมูลส่วนตัวและสังกัดสาขาวิชา
          </div>
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

          <div class="grid-2" style="margin-bottom: 10px;">
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
          </div>

          <div v-if="regForm.departmentSelect === '__CUSTOM__'" style="margin-bottom: 12px; padding: 10px 12px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: var(--radius-sm);">
            <label style="color: #92400e; font-weight: 700;">ระบุชื่อสาขาวิชาใหม่ที่ต้องการขอเพิ่ม *</label>
            <input v-model="regForm.customDepartment" placeholder="เช่น แผนกวิชาอิเล็กทรอนิกส์" required style="margin-top: 4px; background: #fff;" />
            <div style="font-size: 11.5px; color: #b45309; margin-top: 5px;">
              หมายเหตุ: การขอเพิ่มสาขาวิชาใหม่จะต้องรอฝ่ายบุคลากร (HR) อนุมัติก่อน จึงจะสามารถส่งข้อมูลแบบประเมินให้กรรมการได้
            </div>
          </div>

          <div class="grid-2" style="margin-bottom: 12px;">
            <div>
              <label>เบอร์โทรศัพท์มือถือ (10 หลัก) *</label>
              <input
                v-model="regForm.phone"
                @input="regForm.phone = regForm.phone.replace(/\D/g, '').slice(0, 10)"
                maxlength="10"
                inputmode="numeric"
                placeholder="ตัวเลข 10 หลัก เช่น 0812345678"
                required />
            </div>
            <div>
              <label>อีเมลติดต่อ *</label>
              <input v-model="regForm.email" type="email" placeholder="เช่น somchai@school.ac.th" required />
            </div>
          </div>

          <div style="font-weight: 700; font-size: 12px; color: var(--primary); margin-bottom: 8px; text-transform: uppercase;">
            2. ความปลอดภัยและการเข้าสู่ระบบ
          </div>
          <div class="grid-3" style="margin-bottom: 12px;">
            <div>
              <label>เลขประจำตัวประชาชน (13 หลัก) *</label>
              <input
                v-model="regForm.citizenId"
                @input="regForm.citizenId = regForm.citizenId.replace(/\D/g, '').slice(0, 13)"
                maxlength="13"
                inputmode="numeric"
                placeholder="ตัวเลข 13 หลัก เช่น 1100400000004"
                required />
            </div>
            <div>
              <label>รหัสผ่าน *</label>
              <input v-model="regForm.password" type="password" placeholder="อย่างน้อย 4 ตัวอักษร" required />
            </div>
            <div>
              <label>ยืนยันรหัสผ่าน *</label>
              <input v-model="regForm.confirmPassword" type="password" placeholder="กรอกรหัสผ่านซ้ำ" required />
            </div>
          </div>

          <div style="font-weight: 700; font-size: 12px; color: var(--primary); margin-bottom: 8px; text-transform: uppercase;">
            3. ลายเซ็นดิจิทัล (Digital Signature)
          </div>
          <div style="display: flex; gap: 8px; margin-bottom: 10px;">
            <button type="button" :class="['btn-sm', regSigMode === 'upload' ? 'active' : '']" @click="regSigMode = 'upload'">
              อัปโหลดไฟล์ลายเซ็น
            </button>
            <button type="button" :class="['btn-sm', regSigMode === 'draw' ? 'active' : '']" @click="regSigMode = 'draw'">
              วาดลายเซ็นบนหน้าจอ
            </button>
          </div>

          <div v-if="regSigMode === 'upload'" style="margin-bottom: 12px;">
            <input type="file" accept="image/*" @change="onRegisterSigUpload" />
            <small style="color: var(--text-muted); display: block; margin-top: 3px;">รองรับไฟล์ PNG หรือ JPG</small>
            <span v-if="regForm.signature" style="color: var(--success); font-weight: 600; font-size: 12px; margin-top: 4px; display: block;">
              ✓ บันทึกไฟล์ลายเซ็นเรียบร้อย
            </span>
          </div>

          <div v-else style="margin-bottom: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; background: #fafafa;">
            <canvas
              id="indexCanvas"
              width="460"
              height="90"
              style="background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; display: block; margin: 0 auto; cursor: crosshair;"
              @mousedown="startDraw"
              @mousemove="drawing"
              @mouseup="stopDraw"
              @mouseleave="stopDraw"
              @touchstart="touchStart"
              @touchmove="touchMove"
              @touchend="stopDraw">
            </canvas>
            <div style="margin-top: 6px; display: flex; gap: 8px; justify-content: center; align-items: center;">
              <button type="button" class="btn-sm" @click="clearIndexCanvas">ล้างลายเซ็น</button>
              <button type="button" class="btn-primary btn-sm" @click="captureIndexCanvas">บันทึกลายเซ็น</button>
              <span v-if="regForm.signature" style="color: var(--success); font-weight: 600; font-size: 12px;">
                ✓ พร้อมใช้งาน
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
          </button>
        </form>
      </div>
    </div>
  `
};
