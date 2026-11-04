<template>
  <div class="app-root">
    <!-- 1. Authentication View -->
    <LoginView 
      v-if="!currentUser" 
      :usersDatabase="sharedData.users"
      @login-success="onLoginSuccess"
      @register-success="onRegisterSuccess"
    />

    <!-- 2. Role-based Dashboard Layout -->
    <div v-else class="main-layout">
      <header class="navbar">
        <div class="brand">
          <strong>ระบบประเมินบุคลากรด้วยระบบเทคโนโลยีสารสนเทศ</strong>
        </div>
        <div class="user-meta">
          <span>{{ currentUser.name }} ({{ currentUser.roleTitle }})</span>
          <button @click="logout" class="btn-logout">ออกจากระบบ</button>
        </div>
      </header>

      <main>
        <!-- Unified Admin & HR Dashboard -->
        <HrDashboard v-if="currentUser.role === 'hr' || currentUser.role === 'admin'" :user="currentUser" :sharedData="sharedData" />
        
        <!-- Evaluatee (Teacher) Dashboard -->
        <TeacherDashboard v-else-if="currentUser.role === 'teacher'" :user="currentUser" :sharedData="sharedData" />
        
        <!-- Evaluator (Judge) Dashboard -->
        <JudgeDashboard v-else-if="currentUser.role === 'judge'" :user="currentUser" :sharedData="sharedData" />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import LoginView from './views/LoginView.vue'
import HrDashboard from './views/HrDashboard.vue'
import TeacherDashboard from './views/TeacherDashboard.vue'
import JudgeDashboard from './views/JudgeDashboard.vue'

// Restore session from localStorage to prevent logout on page refresh (F5)
const savedUserStr = localStorage.getItem('auth_user')
let initialUser = null
if (savedUserStr) {
  try { initialUser = JSON.parse(savedUserStr) } catch (e) {}
}

const currentUser = ref(initialUser)

// Restore users list from localStorage or fallback to defaults
const defaultUsers = [
  { citizenId: '1100000000000', password: 'admin1234', name: 'นายพัฒนพงษ์ เทคโนแอดมิน', role: 'admin', roleTitle: 'ผู้ดูแลระบบ (Admin)', department: 'ศูนย์เทคโนโลยีสารสนเทศ', position: 'ผู้ดูแลระบบ' },
  { citizenId: '1100100000001', password: 'hr1234', name: 'นางสาวดวงใจ รัตนพร', role: 'hr', roleTitle: 'ฝ่ายบุคลากร (HR)', department: 'งานบุคลากร', position: 'เจ้าหน้าที่งานบุคลากร' },
  { citizenId: '1100200000002', password: 'pass1234', name: 'นายสมชาย ใจดี', role: 'teacher', roleTitle: 'ผู้รับการประเมิน', department: 'แผนกวิชาเทคโนโลยีสารสนเทศ', position: 'ครู คศ.1' },
  { citizenId: '1100300000003', password: 'judge1234', name: 'ดร.สมศักดิ์ ทรงธรรม', role: 'judge', roleTitle: 'กรรมการผู้ประเมิน', department: 'คณะกรรมการประเมินภายนอก', position: 'ประธานกรรมการประเมิน' }
]

const savedUsersStr = localStorage.getItem('shared_users')
let initialUsers = defaultUsers
if (savedUsersStr) {
  try { initialUsers = JSON.parse(savedUsersStr) } catch (e) {}
}

const sharedData = reactive({
  users: initialUsers,
  period: { name: 'รอบการประเมินผลการปฏิบัติงานบุคลากร ประจำปีงบประมาณ', startDate: '2026-10-01', endDate: '2026-11-30', isOpen: true },
  metrics: [
    { id: 1, category: 'ด้านการจัดการเรียนรู้', title: 'การจัดทำและพัฒนาแผนการจัดการเรียนรู้', description: 'วิเคราะห์หลักสูตร จัดทำแผนการสอน และบันทึกหลังสอน', weight: 40, evalType: 'SCALE', evidenceType: 'PDF' },
    { id: 2, category: 'ด้านการพัฒนาตนเองและวิชาชีพ', title: 'การพัฒนาตนเองและการอบรมทางวิชาชีพ', description: 'เข้าร่วมการอบรมและพัฒนาสมรรถนะครูไม่น้อยกว่า 20 ชม.', weight: 30, evalType: 'SCALE', evidenceType: 'URL' },
    { id: 3, category: 'ด้านการมีส่วนร่วมในกิจกรรม', title: 'การปฏิบัติหน้าที่พิเศษที่ได้รับมอบหมาย', description: 'มีส่วนร่วมในงานกิจกรรมและโครงการพัฒนาสถานศึกษา', weight: 30, evalType: 'BOOLEAN', evidenceType: 'IMAGE' }
  ]
})

// Persist sharedData.users when modified
watch(() => sharedData.users, (newUsers) => {
  localStorage.setItem('shared_users', JSON.stringify(newUsers))
}, { deep: true })

// Persist currentUser on login / logout
const onLoginSuccess = (user) => {
  currentUser.value = user
  localStorage.setItem('auth_user', JSON.stringify(user))
}

const onRegisterSuccess = (newUser) => {
  const registeredUser = {
    ...newUser,
    role: 'teacher',
    roleTitle: 'ผู้รับการประเมิน'
  }
  sharedData.users.push(registeredUser)
  localStorage.setItem('shared_users', JSON.stringify(sharedData.users))
  // Automatically login as the registered user
  currentUser.value = registeredUser
  localStorage.setItem('auth_user', JSON.stringify(registeredUser))
}

const logout = () => {
  currentUser.value = null
  localStorage.removeItem('auth_user')
  localStorage.removeItem('auth_token')
}
</script>

<style>
body { margin: 0; background: #f8fafc; font-family: -apple-system, sans-serif; }
.navbar { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 14px 28px; display: flex; justify-content: space-between; align-items: center; }
.user-meta { display: flex; align-items: center; gap: 14px; font-size: 13.5px; font-weight: 600; }
.btn-logout { background: #fee2e2; color: #dc2626; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: 0.2s; }
.btn-logout:hover { background: #fca5a5; }
</style>
