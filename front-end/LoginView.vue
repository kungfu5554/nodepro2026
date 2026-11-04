<template>
  <div class="auth-wrapper">
    <!-- ========================================== -->
    <!-- 1. LOGIN VIEW -->
    <!-- ========================================== -->
    <div v-if="mode === 'login'" class="auth-card login-card">
      <div class="logo-box">
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      </div>

      <h1 class="title">ระบบประเมินบุคลากร</h1>
      <p class="subtitle">Personnel Evaluation System</p>

      <!-- Presentation Quick Access Bar -->
      <div class="presentation-box">
        <div class="presentation-header">
          <span>⚡ ทางลัดสำหรับการนำเสนอผลงาน (Presentation Quick Access)</span>
        </div>
        <div class="presentation-btns">
          <button type="button" class="btn-pres admin" @click="quickLogin('hr')">
            🏢 หน้าแอดมิน / HR
          </button>
          <button type="button" class="btn-pres teacher" @click="quickLogin('teacher')">
            👨‍🏫 หน้าการประเมิน (ครู)
          </button>
          <button type="button" class="btn-pres judge" @click="quickLogin('judge')">
            ⚖️ หน้ากรรมการผู้ประเมิน
          </button>
        </div>
      </div>

      <div v-if="errorMsg" class="alert error">⚠️ {{ errorMsg }}</div>
      <div v-if="successMsg" class="alert success">✅ {{ successMsg }}</div>

      <form @submit.prevent="submitLogin">
        <div class="input-group">
          <label>ชื่อผู้ใช้งาน หรือ เลขประจำตัวประชาชน (13 หลัก)</label>
          <div class="input-box">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <input 
              v-model="username" 
              type="text" 
              placeholder="กรอกชื่อผู้ใช้งาน หรือ เลขบัตร 13 หลัก" 
              required 
            />
          </div>
        </div>

        <div class="input-group">
          <div class="label-row">
            <label>รหัสผ่าน</label>
            <a href="#" class="forgot" @click.prevent="showForgotNotice">ลืมรหัสผ่าน?</a>
          </div>
          <div class="input-box">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <input 
              v-model="password" 
              :type="showPass ? 'text' : 'password'" 
              placeholder="กรอกรหัสผ่าน" 
              required 
            />
            <button type="button" class="eye-btn" @click="showPass = !showPass">
              {{ showPass ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <div class="remember-row">
          <label class="checkbox-label">
            <input type="checkbox" v-model="remember" />
            <span>จดจำการใช้งานในระบบนี้</span>
          </label>
        </div>

        <button type="submit" class="btn-submit" :disabled="isLoading">
          {{ isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ (Sign In) →' }}
        </button>
      </form>

      <div class="auth-switch">
        <span>ยังไม่มีบัญชีผู้รับการประเมิน? </span>
        <button type="button" class="link-btn" @click="mode = 'register'">ลงทะเบียนบุคลากรใหม่ที่นี่</button>
      </div>
    </div>


    <!-- ========================================== -->
    <!-- 2. REALISTIC REGISTER VIEW (FOR REAL PRESENTATIONS) -->
    <!-- ========================================== -->
    <div v-else class="auth-card register-card">
      <div class="reg-top-bar">
        <div class="logo-box-sm">
          <svg class="logo-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
        </div>
        <div>
          <h2 class="reg-title">ลงทะเบียนผู้รับการประเมินใหม่</h2>
          <p class="subtitle" style="margin-bottom:0;">กรอกข้อมูลประวัติการทำงาน สังกัด และแนบลายเซ็นดิจิทัลเพื่อใช้งานจริง</p>
        </div>
      </div>

      <!-- Presentation Quick Access Bar on Register View -->
      <div class="presentation-box">
        <div class="presentation-header">
          <span>⚡ ทางลัดสำหรับการนำเสนอผลงาน (Presentation Quick Access)</span>
        </div>
        <div class="presentation-btns">
          <button type="button" class="btn-pres admin" @click="quickLogin('hr')">
            🏢 หน้าแอดมิน / HR
          </button>
          <button type="button" class="btn-pres teacher" @click="quickLogin('teacher')">
            👨‍🏫 หน้าการประเมิน (ครู)
          </button>
          <button type="button" class="btn-pres judge" @click="quickLogin('judge')">
            ⚖️ หน้ากรรมการผู้ประเมิน
          </button>
        </div>
      </div>

      <div v-if="errorMsg" class="alert error">⚠️ {{ errorMsg }}</div>
      <div v-if="successMsg" class="alert success">✅ {{ successMsg }}</div>

      <form @submit.prevent="submitRegister">
        
        <!-- Section 1: Personal & Affiliation Details -->
        <div class="form-section-title">
          <span>📋 1. ข้อมูลส่วนตัวและสังกัดหน่วยงาน</span>
        </div>

        <div class="form-row">
          <div class="input-group col-4">
            <label>คำนำหน้า</label>
            <div class="input-box">
              <select v-model="reg.prefix">
                <option>นาย</option>
                <option>นาง</option>
                <option>นางสาว</option>
                <option>ดร.</option>
                <option>ผศ.</option>
                <option>รศ.</option>
              </select>
            </div>
          </div>
          <div class="input-group col-8">
            <label>ชื่อ - นามสกุลจริง *</label>
            <div class="input-box">
              <input v-model="reg.fullname" type="text" placeholder="ชื่อ-นามสกุล เช่น สมชาย ใจดี" required />
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="input-group col-6">
            <label>เลขประจำตัวประชาชน (13 หลัก) *</label>
            <div class="input-box">
              <input 
                v-model="reg.citizenId" 
                type="text" 
                maxlength="13" 
                placeholder="1100200000099" 
                required 
              />
            </div>
          </div>
          <div class="input-group col-6">
            <label>รหัสประจำตัวบุคลากร *</label>
            <div class="input-box">
              <input v-model="reg.employeeId" type="text" placeholder="เช่น T-68001" required />
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="input-group col-6">
            <label>อีเมลติดต่อทางการ (Email) *</label>
            <div class="input-box">
              <input v-model="reg.email" type="email" placeholder="somchai.j@vec.mail.go.th" required />
            </div>
          </div>
          <div class="input-group col-6">
            <label>เบอร์โทรศัพท์ติดต่อ</label>
            <div class="input-box">
              <input v-model="reg.phone" type="tel" placeholder="เช่น 081-234-5678" />
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="input-group col-6">
            <label>แผนกวิชา / ฝ่ายสังกัด *</label>
            <div class="input-box">
              <select v-model="reg.department">
                <option value="แผนกวิชาเทคโนโลยีสารสนเทศ">แผนกวิชาเทคโนโลยีสารสนเทศ</option>
                <option value="แผนกวิชาคอมพิวเตอร์ธุรกิจ">แผนกวิชาคอมพิวเตอร์ธุรกิจ</option>
                <option value="แผนกวิชาช่างไฟฟ้ากำลัง">แผนกวิชาช่างไฟฟ้ากำลัง</option>
                <option value="แผนกวิชาช่างยนต์">แผนกวิชาช่างยนต์</option>
                <option value="แผนกวิชาการบัญชี">แผนกวิชาการบัญชี</option>
                <option value="แผนกวิชาสามัญสัมพันธ์">แผนกวิชาสามัญสัมพันธ์</option>
              </select>
            </div>
          </div>
          <div class="input-group col-6">
            <label>ตำแหน่ง / วิทยฐานะ *</label>
            <div class="input-box">
              <select v-model="reg.position">
                <option value="ครูผู้ช่วย">ครูผู้ช่วย</option>
                <option value="ครู คศ.1">ครู คศ.1</option>
                <option value="ครู คศ.2 (ชำนาญการ)">ครู คศ.2 (ชำนาญการ)</option>
                <option value="ครู คศ.3 (ชำนาญการพิเศษ)">ครู คศ.3 (ชำนาญการพิเศษ)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Section 2: Security & Password -->
        <div class="form-section-title">
          <span>🔒 2. การกำหนดรหัสผ่านความปลอดภัย</span>
        </div>

        <div class="form-row">
          <div class="input-group col-6">
            <label>รหัสผ่านเข้าสู่ระบบ *</label>
            <div class="input-box">
              <input v-model="reg.password" type="password" placeholder="ตั้งรหัสผ่านเข้าสู่ระบบ" required />
            </div>
          </div>
          <div class="input-group col-6">
            <label>ยืนยันรหัสผ่านอีกครั้ง *</label>
            <div class="input-box">
              <input v-model="reg.confirmPassword" type="password" placeholder="กรอกรหัสผ่านซ้ำอีกครั้ง" required />
            </div>
          </div>
        </div>

        <!-- Section 3: Digital Signature -->
        <div class="form-section-title">
          <span>✍️ 3. ลายเซ็นดิจิทัลสำหรับประเมินผล (Digital Signature)</span>
        </div>

        <div class="sig-nav">
          <button 
            type="button" 
            :class="['sig-tab-btn', sigMode === 'upload' ? 'active' : '']" 
            @click="sigMode = 'upload'"
          >
            📁 อัปโหลดไฟล์ภาพลายเซ็น
          </button>
          <button 
            type="button" 
            :class="['sig-tab-btn', sigMode === 'draw' ? 'active' : '']" 
            @click="sigMode = 'draw'"
          >
            ✍️ วาดลายเซ็นสดบนหน้าจอ (Interactive Pad)
          </button>
        </div>

        <!-- Mode A: Upload File -->
        <div v-if="sigMode === 'upload'" class="sig-card">
          <input type="file" accept="image/*" @change="onSigFile" />
          <small class="text-muted d-block mt-1">แนะนำไฟล์ PNG หรือ JPG ที่มีความคมชัด</small>
          <div v-if="reg.signature" class="sig-preview-box">
            <img :src="reg.signature" alt="Signature preview" class="sig-img" />
            <button type="button" class="btn-clear-sig" @click="reg.signature = ''">✕ ลบลายเซ็น</button>
          </div>
        </div>

        <!-- Mode B: Draw Canvas Pad -->
        <div v-else class="sig-canvas-wrapper">
          <div class="canvas-tip">วาดลายเซ็นของคุณในกรอบสี่เหลี่ยมด้านล่าง:</div>
          <canvas 
            id="regCanvas"
            width="520" 
            height="130" 
            class="sig-canvas"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @touchstart="startTouch"
            @touchmove="moveTouch"
            @touchend="stopDrawing"
          ></canvas>
          <div class="canvas-btn-bar">
            <button type="button" class="btn-canvas-util" @click="clearSignaturePad">🧹 ล้างลายเซ็น</button>
            <button type="button" class="btn-canvas-util save" @click="captureCanvasSignature">💾 บันทึกลายเซ็นนี้</button>
            <span v-if="reg.signature" class="sig-ok-tag">✅ บันทึกลายเซ็นเรียบร้อย</span>
          </div>
        </div>

        <!-- Consent Checkbox -->
        <div class="remember-row" style="margin: 20px 0 24px 0;">
          <label class="checkbox-label">
            <input type="checkbox" v-model="agreeConsent" required />
            <span>ข้าพเจ้ารับรองว่าข้อมูลข้างต้นเป็นความจริงทุกประการและยินยอมให้ใช้ข้อมูลในระบบประเมินผล</span>
          </label>
        </div>

        <button type="submit" class="btn-submit" :disabled="isLoading">
          {{ isLoading ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันการลงทะเบียน (Register Account) →' }}
        </button>
      </form>

      <div class="auth-switch">
        <span>มีบัญชีผู้ใช้งานอยู่แล้ว? </span>
        <button type="button" class="link-btn" @click="mode = 'login'">← กลับไปหน้าเข้าสู่ระบบ</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['login-success', 'register-success'])
const props = defineProps(['usersDatabase'])

const mode = ref('login')
const username = ref('')
const password = ref('')
const showPass = ref(false)
const remember = ref(true)
const isLoading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const sigMode = ref('upload')
const agreeConsent = ref(true)

// Registration form data
const reg = ref({
  prefix: 'นาย',
  fullname: '',
  citizenId: '',
  employeeId: '',
  email: '',
  phone: '',
  department: 'แผนกวิชาเทคโนโลยีสารสนเทศ',
  position: 'ครู คศ.1',
  password: '',
  confirmPassword: '',
  signature: ''
})

// Handle signature image upload
const onSigFile = (e) => {
  const file = e.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (ev) => { reg.value.signature = ev.target.result }
    reader.readAsDataURL(file)
  }
}

// Canvas signature pad logic
let isDrawing = false
let canvasContext = null

const getCanvasContext = () => {
  const canvas = document.getElementById('regCanvas')
  if (canvas && !canvasContext) {
    canvasContext = canvas.getContext('2d')
    canvasContext.lineWidth = 2.5
    canvasContext.lineCap = 'round'
    canvasContext.lineJoin = 'round'
    canvasContext.strokeStyle = '#1e293b'
  }
  return canvasContext
}

const startDrawing = (e) => {
  const ctx = getCanvasContext()
  if (!ctx) return
  isDrawing = true
  const rect = e.target.getBoundingClientRect()
  ctx.beginPath()
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
}

const draw = (e) => {
  if (!isDrawing) return
  const ctx = getCanvasContext()
  if (!ctx) return
  const rect = e.target.getBoundingClientRect()
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
  ctx.stroke()
}

const stopDrawing = () => {
  if (isDrawing) {
    isDrawing = false
    captureCanvasSignature()
  }
}

const startTouch = (e) => {
  e.preventDefault()
  const touch = e.touches[0]
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  startDrawing(mouseEvent)
}

const moveTouch = (e) => {
  e.preventDefault()
  const touch = e.touches[0]
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  draw(mouseEvent)
}

const clearSignaturePad = () => {
  const canvas = document.getElementById('regCanvas')
  if (canvas) {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
  reg.value.signature = ''
}

const captureCanvasSignature = () => {
  const canvas = document.getElementById('regCanvas')
  if (canvas) {
    reg.value.signature = canvas.toDataURL('image/png')
  }
}

// Quick presentation login shortcut
const quickLogin = (role) => {
  errorMsg.value = ''
  successMsg.value = ''
  
  let target = null
  if (role === 'hr' || role === 'admin') {
    target = {
      citizenId: '1100100000001',
      name: 'นางสาวดวงใจ รัตนพร',
      role: 'hr',
      roleTitle: 'ฝ่ายบุคลากรและผู้ดูแลระบบ',
      department: 'งานบุคลากรและพัฒนาระบบ',
      position: 'เจ้าหน้าที่งานบุคลากร'
    }
  } else if (role === 'teacher') {
    target = {
      citizenId: '1100200000002',
      name: 'นายสมชาย ใจดี',
      role: 'teacher',
      roleTitle: 'ผู้รับการประเมิน',
      department: 'แผนกวิชาเทคโนโลยีสารสนเทศ',
      position: 'ครู คศ.1'
    }
  } else if (role === 'judge') {
    target = {
      citizenId: '1100300000003',
      name: 'ดร.สมศักดิ์ ทรงธรรม',
      role: 'judge',
      roleTitle: 'กรรมการผู้ประเมิน',
      department: 'คณะกรรมการประเมินวิทยฐานะ',
      position: 'ประธานกรรมการผู้ประเมิน'
    }
  }
  if (target) {
    localStorage.setItem('auth_user', JSON.stringify(target))
    emit('login-success', target)
  }
}

// Submit login form
const submitLogin = async () => {
  errorMsg.value = ''
  successMsg.value = ''
  const inputUser = username.value.trim()
  const inputPass = password.value

  isLoading.value = true

  // Try API login first
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ citizenId: inputUser, password: inputPass })
    })
    const data = await res.json()
    if (res.ok && data.data?.user) {
      if (data.data.token) localStorage.setItem('auth_token', data.data.token)
      localStorage.setItem('auth_user', JSON.stringify(data.data.user))
      emit('login-success', data.data.user)
      isLoading.value = false
      return
    }
  } catch (err) {
    // Fallback to local users list
  }

  // Local fallback check
  const users = props.usersDatabase || []
  const foundUser = users.find(
    u => (u.citizenId === inputUser || u.username === inputUser) && u.password === inputPass
  )

  isLoading.value = false

  if (foundUser) {
    localStorage.setItem('auth_user', JSON.stringify(foundUser))
    emit('login-success', foundUser)
  } else {
    errorMsg.value = 'ชื่อผู้ใช้งาน หรือ รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'
  }
}

// Submit register form
const submitRegister = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  if (!reg.value.fullname.trim()) {
    errorMsg.value = 'กรุณาระบุชื่อ-นามสกุลจริง'
    return
  }

  const cleanCitizenId = reg.value.citizenId.trim()
  if (!cleanCitizenId) {
    errorMsg.value = 'กรุณาระบุเลขประจำตัวประชาชน 13 หลัก หรือ Username'
    return
  }

  if (reg.value.password !== reg.value.confirmPassword) {
    errorMsg.value = 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน'
    return
  }

  isLoading.value = true

  const payload = {
    citizenId: cleanCitizenId,
    username: cleanCitizenId,
    employeeId: reg.value.employeeId,
    email: reg.value.email,
    phone: reg.value.phone,
    prefix: reg.value.prefix,
    name: reg.value.fullname,
    fullname: reg.value.fullname,
    department: reg.value.department,
    position: reg.value.position,
    password: reg.value.password,
    signatureUrl: reg.value.signature || null
  }

  const registeredUser = {
    ...payload,
    role: 'teacher',
    roleTitle: 'ผู้รับการประเมิน'
  }

  // Attempt API registration
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (res.ok && data.data?.user) {
      if (data.data.token) localStorage.setItem('auth_token', data.data.token)
      localStorage.setItem('auth_user', JSON.stringify(data.data.user))
      emit('register-success', data.data.user)
      emit('login-success', data.data.user)
      isLoading.value = false
      return
    }
  } catch (e) {
    // Continue with client registration
  }

  // Client registration fallback: log in as the newly registered user immediately!
  localStorage.setItem('auth_user', JSON.stringify(registeredUser))
  emit('register-success', registeredUser)
  emit('login-success', registeredUser)

  isLoading.value = false
  username.value = cleanCitizenId
  password.value = reg.value.password
  }, 1200)
}

const showForgotNotice = () => {
  alert('หากลืมรหัสผ่าน กรุณาติดต่อฝ่ายบุคลากร (HR) หรือผู้ดูแลระบบประจำหน่วยงานเพื่อทำการรีเซ็ตรหัสผ่าน')
}
</script>

<style scoped>
.auth-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f1f5f9;
  padding: 30px 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.auth-card {
  background: #ffffff;
  width: 100%;
  border-radius: 28px;
  box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
  border: 1px solid #e2e8f0;
}

.login-card { max-width: 480px; padding: 40px 36px; }
.register-card { max-width: 720px; padding: 36px 40px; }

.logo-box {
  width: 56px;
  height: 56px;
  background-color: #eef2ff;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px auto;
  color: #4f46e5;
}
.logo-icon { width: 28px; height: 28px; }

.reg-top-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.logo-box-sm {
  width: 46px;
  height: 46px;
  background-color: #eef2ff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4f46e5;
  flex-shrink: 0;
}
.logo-icon-sm { width: 24px; height: 24px; }

.title { font-size: 24px; font-weight: 800; color: #0f172a; text-align: center; margin: 0 0 6px 0; }
.reg-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; }
.subtitle { font-size: 14px; color: #64748b; text-align: center; margin: 0 0 20px 0; }

/* Presentation Quick Buttons */
.presentation-box {
  background: #f8fafc;
  border: 1.5px dashed #cbd5e1;
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 22px;
}
.presentation-header {
  font-size: 12.5px;
  font-weight: 700;
  color: #4338ca;
  text-align: center;
  margin-bottom: 8px;
}
.presentation-btns {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}
.btn-pres {
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}
.btn-pres.admin { background: #eef2ff; color: #4338ca; border-color: #c7d2fe; }
.btn-pres.admin:hover { background: #4338ca; color: #ffffff; }

.btn-pres.teacher { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
.btn-pres.teacher:hover { background: #059669; color: #ffffff; }

.btn-pres.judge { background: #fffbeb; color: #92400e; border-color: #fde68a; }
.btn-pres.judge:hover { background: #d97706; color: #ffffff; }

/* Form Elements */
.form-section-title {
  font-size: 13.5px;
  font-weight: 800;
  color: #1e293b;
  margin: 18px 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1.5px solid #f1f5f9;
}

.input-group { margin-bottom: 16px; }
.input-group label { display: block; font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
.label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.forgot { font-size: 12.5px; color: #4f46e5; text-decoration: none; font-weight: 700; }

.input-box {
  display: flex;
  align-items: center;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 0 12px;
  height: 44px;
  background: #ffffff;
  transition: border-color 0.2s;
}
.input-box:focus-within { border-color: #4f46e5; }
.input-box input, .input-box select {
  border: none;
  outline: none;
  width: 100%;
  font-size: 13.5px;
  color: #0f172a;
  background: transparent !important;
}

.icon { width: 18px; height: 18px; color: #94a3b8; margin-right: 10px; flex-shrink: 0; }
.eye-btn { background: none; border: none; cursor: pointer; font-size: 16px; padding: 0 4px; }

.form-row { display: flex; gap: 12px; }
.col-4 { flex: 4; }
.col-6 { flex: 6; }
.col-8 { flex: 8; }

/* Signature Area */
.sig-nav { display: flex; gap: 8px; margin-bottom: 10px; }
.sig-tab-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  color: #475569;
}
.sig-tab-btn.active {
  background: #eef2ff;
  border-color: #6366f1;
  color: #4338ca;
}

.sig-card {
  border: 1.5px dashed #cbd5e1;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  background: #f8fafc;
}
.sig-preview-box { margin-top: 10px; }
.sig-img { max-height: 55px; display: block; margin: 0 auto; }
.btn-clear-sig {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11.5px;
  cursor: pointer;
  margin-top: 6px;
  font-weight: 700;
}

.sig-canvas-wrapper {
  background: #f8fafc;
  border: 1.5px dashed #cbd5e1;
  border-radius: 12px;
  padding: 14px;
  text-align: center;
}
.canvas-tip { font-size: 12px; color: #64748b; margin-bottom: 8px; }
.sig-canvas {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  cursor: crosshair;
  max-width: 100%;
}
.canvas-btn-bar {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  margin-top: 10px;
}
.btn-canvas-util {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.btn-canvas-util.save { background: #4f46e5; color: #fff; border-color: #4f46e5; }
.sig-ok-tag { font-size: 12px; color: #16a34a; font-weight: 700; }

.remember-row { margin: 16px 0; }
.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 13px;
  color: #334155;
  font-weight: 600;
  gap: 8px;
}
.checkbox-label input { width: 16px; height: 16px; accent-color: #4f46e5; }

.btn-submit {
  width: 100%;
  height: 46px;
  background-color: #4f46e5;
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-submit:hover:not(:disabled) { background-color: #4338ca; }
.btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

.auth-switch { text-align: center; margin-top: 18px; font-size: 13px; color: #64748b; }
.link-btn { background: none; border: none; color: #4f46e5; font-weight: 700; cursor: pointer; }
.link-btn:hover { text-decoration: underline; }

.alert { padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; font-weight: 600; }
.alert.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.alert.success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
</style>
