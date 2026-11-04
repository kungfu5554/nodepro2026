<template>
  <div class="admin-container">
    
    <!-- Header -->
    <div class="page-header">
      <div>
        <h2>👥 ระบบจัดการผู้ใช้งาน (User Management)</h2>
        <p>เพิ่ม ลบ แก้ไข ข้อมูลครูผู้รับการประเมิน และคณะกรรมการผู้ตรวจประเมิน</p>
      </div>
      <button class="btn-add" @click="openModal('add')">
        ➕ เพิ่มผู้ใช้งานใหม่
      </button>
    </div>

    <!-- Filter and Search Bar -->
    <div class="filter-bar">
      <div class="role-tabs">
        <button :class="{ active: filterRole === 'ALL' }" @click="filterRole = 'ALL'">
          ทั้งหมด ({{ usersList.length }})
        </button>
        <button :class="{ active: filterRole === 'teacher' }" @click="filterRole = 'teacher'">
          ครูผู้รับการประเมิน ({{ countRole('teacher') }})
        </button>
        <button :class="{ active: filterRole === 'judge' }" @click="filterRole = 'judge'">
          กรรมการผู้ประเมิน ({{ countRole('judge') }})
        </button>
        <button :class="{ active: filterRole === 'hr' }" @click="filterRole = 'hr'">
          ฝ่ายบุคลากร ({{ countRole('hr') }})
        </button>
      </div>

      <div class="search-box">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="🔍 ค้นหาชื่อ หรือ เลขบัตร 13 หลัก..." 
        />
      </div>
    </div>

    <!-- User Table -->
    <div class="table-card">
      <table class="user-table">
        <thead>
          <tr>
            <th width="70">ลำดับ</th>
            <th width="160">เลขบัตรประชาชน (13 หลัก)</th>
            <th>ชื่อ - นามสกุล</th>
            <th width="180">บทบาทสิทธิ์ (Role)</th>
            <th>สังกัด / ตำแหน่ง</th>
            <th width="120">รหัสผ่าน</th>
            <th width="150" style="text-align: center;">จัดการข้อมูล</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(u, idx) in filteredUsers" :key="u.citizenId">
            <td>{{ idx + 1 }}</td>
            <td><strong>{{ u.citizenId }}</strong></td>
            <td>{{ u.name }}</td>
            <td>
              <span :class="['role-badge', u.role]">
                {{ getRoleTitle(u.role) }}
              </span>
            </td>
            <td>{{ u.department || '-' }} ({{ u.position || '-' }})</td>
            <td><code>{{ u.password || '••••••••' }}</code></td>
            <td style="text-align: center;">
              <button class="btn-edit" @click="openModal('edit', u)" title="แก้ไข">✏️ แก้ไข</button>
              <button 
                v-if="u.citizenId !== user.citizenId" 
                class="btn-delete" 
                @click="deleteUser(u)" 
                title="ลบ"
              >
                🗑️ ลบ
              </button>
            </td>
          </tr>
          <tr v-if="filteredUsers.length === 0">
            <td colspan="7" class="empty-row">ไม่พบข้อมูลผู้ใช้งานที่ค้นหา</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal for Add / Edit User -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ modalMode === 'add' ? '➕ เพิ่มผู้ใช้งานใหม่' : '✏️ แก้ไขข้อมูลผู้ใช้งาน' }}</h3>
          <button class="btn-close" @click="closeModal">✕</button>
        </div>

        <form @submit.prevent="saveUser" class="modal-body">
          <div class="form-group">
            <label>เลือกบทบาทหน้าที่ (Role) *</label>
            <select v-model="formData.role" required>
              <option value="teacher">ครูผู้รับการประเมิน (บุคลากร)</option>
              <option value="judge">กรรมการผู้ประเมิน</option>
              <option value="hr">ฝ่ายบุคลากร (HR)</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group col-4">
              <label>คำนำหน้า</label>
              <select v-model="formData.prefix">
                <option>นาย</option><option>นาง</option><option>นางสาว</option><option>ดร.</option>
              </select>
            </div>
            <div class="form-group col-8">
              <label>ชื่อ - นามสกุล *</label>
              <input v-model="formData.fullname" type="text" placeholder="ระบุชื่อและนามสกุล" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-6">
              <label>เลขบัตรประชาชน (13 หลัก) *</label>
              <input 
                v-model="formData.citizenId" 
                type="text" 
                maxlength="13" 
                placeholder="13 หลัก" 
                :disabled="modalMode === 'edit'"
                required 
              />
            </div>
            <div class="form-group col-6">
              <label>รหัสผ่านเข้าสู่ระบบ *</label>
              <input v-model="formData.password" type="text" placeholder="ตั้งรหัสผ่าน" :required="modalMode === 'add'" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-6">
              <label>แผนกวิชา / ฝ่ายสังกัด</label>
              <select v-model="formData.department">
                <option value="แผนกวิชาเทคโนโลยีสารสนเทศ">แผนกวิชาเทคโนโลยีสารสนเทศ</option>
                <option value="แผนกวิชาคอมพิวเตอร์ธุรกิจ">แผนกวิชาคอมพิวเตอร์ธุรกิจ</option>
                <option value="แผนกวิชาช่างไฟฟ้ากำลัง">แผนกวิชาช่างไฟฟ้ากำลัง</option>
                <option value="แผนกวิชาสามัญสัมพันธ์">แผนกวิชาสามัญสัมพันธ์</option>
                <option value="งานบุคลากร">งานบุคลากร</option>
                <option value="คณะกรรมการประเมินภายนอก">คณะกรรมการประเมินภายนอก</option>
              </select>
            </div>
            <div class="form-group col-6">
              <label>ตำแหน่งงาน</label>
              <select v-model="formData.position">
                <option value="ครูผู้ช่วย">ครูผู้ช่วย</option>
                <option value="ครู คศ.1">ครู คศ.1</option>
                <option value="ครู คศ.2">ครู คศ.2</option>
                <option value="หัวหน้าแผนกวิชา">หัวหน้าแผนกวิชา</option>
                <option value="กรรมการผู้ทรงคุณวุฒิ">กรรมการผู้ทรงคุณวุฒิ</option>
              </select>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-cancel" @click="closeModal">ยกเลิก</button>
            <button type="submit" class="btn-save">
              {{ modalMode === 'add' ? 'บันทึกผู้ใช้ใหม่' : 'อัปเดตข้อมูล' }}
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'

const props = defineProps(['user', 'sharedData'])

const filterRole = ref('ALL')
const searchQuery = ref('')
const showModal = ref(false)
const modalMode = ref('add') // 'add' | 'edit'
const localUsers = ref([])

// Synchronize users from API with fallback to sharedData
const usersList = computed(() => {
  return localUsers.value.length > 0 ? localUsers.value : (props.sharedData?.users || [])
})

// Form data model
const formData = ref({
  prefix: 'นาย',
  fullname: '',
  citizenId: '',
  password: '',
  role: 'teacher',
  department: 'แผนกวิชาเทคโนโลยีสารสนเทศ',
  position: 'ครู คศ.1'
})

// Fetch all users from backend API
const loadUsers = async () => {
  try {
    const res = await api.users.getAll()
    if (res.data && res.data.length > 0) {
      localUsers.value = res.data
      if (props.sharedData) {
        props.sharedData.users = res.data
      }
    }
  } catch (err) {
    // Retain fallback list
  }
}

onMounted(() => {
  loadUsers()
})

// Filter users by role and search query
const filteredUsers = computed(() => {
  return usersList.value.filter(u => {
    const matchRole = filterRole.value === 'ALL' || u.role === filterRole.value
    const matchSearch = (u.name || '').toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                        (u.citizenId || '').includes(searchQuery.value.trim())
    return matchRole && matchSearch
  })
})

const countRole = (role) => usersList.value.filter(u => u.role === role).length

const getRoleTitle = (role) => {
  if (role === 'admin') return 'ผู้ดูแลระบบ'
  if (role === 'hr') return 'ฝ่ายบุคลากร'
  if (role === 'teacher') return 'ครูผู้รับการประเมิน'
  if (role === 'judge') return 'กรรมการผู้ประเมิน'
  return role
}

// Open modal for add or edit
const openModal = (mode, userObj = null) => {
  modalMode.value = mode
  if (mode === 'add') {
    formData.value = {
      prefix: 'นาย',
      fullname: '',
      citizenId: '',
      password: '',
      role: 'teacher',
      department: 'แผนกวิชาเทคโนโลยีสารสนเทศ',
      position: 'ครู คศ.1'
    }
  } else if (mode === 'edit' && userObj) {
    formData.value = {
      prefix: userObj.prefix || '',
      fullname: userObj.name,
      citizenId: userObj.citizenId,
      password: '',
      role: userObj.role,
      department: userObj.department || 'แผนกวิชาเทคโนโลยีสารสนเทศ',
      position: userObj.position || 'ครู คศ.1'
    }
  }
  showModal.value = true
}

const closeModal = () => { showModal.value = false }

// Save user (Create or Update via REST API)
const saveUser = async () => {
  if (formData.value.citizenId.trim().length !== 13) {
    alert('เลขบัตรประจำตัวประชาชนต้องครบ 13 หลัก!')
    return
  }

  const roleName = getRoleTitle(formData.value.role)

  if (modalMode.value === 'add') {
    try {
      await api.users.create({
        citizenId: formData.value.citizenId.trim(),
        password: formData.value.password,
        prefix: formData.value.prefix,
        fullname: formData.value.fullname,
        role: formData.value.role,
        department: formData.value.department,
        position: formData.value.position
      })
      await loadUsers()
      alert(`เพิ่มผู้ใช้งาน "${formData.value.fullname}" สำเร็จ!`)
    } catch (err) {
      if (props.sharedData?.users) {
        props.sharedData.users.push({
          citizenId: formData.value.citizenId.trim(),
          password: formData.value.password,
          name: formData.value.prefix ? `${formData.value.prefix} ${formData.value.fullname}` : formData.value.fullname,
          role: formData.value.role,
          roleTitle: roleName,
          department: formData.value.department,
          position: formData.value.position
        })
      }
      alert(`เพิ่มผู้ใช้งาน "${formData.value.fullname}" สำเร็จ! (โหมดสำรอง)`)
    }
  } else {
    try {
      await api.users.update(formData.value.citizenId, {
        fullname: formData.value.fullname,
        prefix: formData.value.prefix,
        role: formData.value.role,
        department: formData.value.department,
        position: formData.value.position,
        password: formData.value.password
      })
      await loadUsers()
      alert('อัปเดตข้อมูลผู้ใช้งานเรียบร้อยแล้ว!')
    } catch (err) {
      const target = props.sharedData?.users?.find(u => u.citizenId === formData.value.citizenId)
      if (target) {
        target.name = formData.value.fullname
        target.role = formData.value.role
        target.roleTitle = roleName
        target.department = formData.value.department
        target.position = formData.value.position
      }
      alert('อัปเดตข้อมูลผู้ใช้งานเรียบร้อยแล้ว! (โหมดสำรอง)')
    }
  }

  closeModal()
}

// Delete user via REST API
const deleteUser = async (u) => {
  if (!confirm(`คุณต้องการลบผู้ใช้งาน "${u.name}" (เลขบัตร: ${u.citizenId}) ใช่หรือไม่?`)) return

  try {
    await api.users.delete(u.citizenId)
    await loadUsers()
    alert('ลบผู้ใช้งานเรียบร้อยแล้ว')
  } catch (err) {
    if (props.sharedData?.users) {
      const index = props.sharedData.users.findIndex(x => x.citizenId === u.citizenId)
      if (index !== -1) {
        props.sharedData.users.splice(index, 1)
      }
    }
    alert('ลบผู้ใช้งานเรียบร้อยแล้ว (โหมดสำรอง)')
  }
}
</script>

<style scoped>
.admin-container {
  max-width: 1100px;
  margin: 30px auto;
  padding: 0 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.page-header h2 { margin: 0 0 4px 0; font-size: 22px; color: #0f172a; }
.page-header p { margin: 0; font-size: 13px; color: #64748b; }

.btn-add {
  background-color: #2563eb;
  color: #ffffff;
  border: none;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
  transition: all 0.2s;
}
.btn-add:hover { background-color: #1d4ed8; }

/* Filter Bar */
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.role-tabs {
  display: flex;
  background-color: #e2e8f0;
  padding: 4px;
  border-radius: 10px;
  gap: 4px;
}
.role-tabs button {
  background: transparent;
  border: none;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
}
.role-tabs button.active {
  background-color: #ffffff;
  color: #0f172a;
  box-shadow: 0 2px 4px rgba(0,0,0,0.06);
}
.search-box input {
  padding: 8px 14px;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  width: 250px;
  outline: none;
}
.search-box input:focus { border-color: #2563eb; }

/* Table */
.table-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.user-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.user-table th {
  background-color: #f8fafc;
  padding: 12px 14px;
  text-align: left;
  color: #475569;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
}
.user-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}
.empty-row { text-align: center; color: #94a3b8; padding: 24px !important; }

/* Badges */
.role-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}
.role-badge.teacher { background-color: #dcfce7; color: #15803d; }
.role-badge.judge { background-color: #fef3c7; color: #b45309; }
.role-badge.hr { background-color: #e0e7ff; color: #4338ca; }
.role-badge.admin { background-color: #fee2e2; color: #dc2626; }

/* Action Buttons */
.btn-edit {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-right: 6px;
}
.btn-delete {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn-edit:hover { background: #e2e8f0; }
.btn-delete:hover { background: #fca5a5; }

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}
.modal-content {
  background: #ffffff;
  width: 100%;
  max-width: 520px;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
}
.modal-header {
  padding: 16px 20px;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 { margin: 0; font-size: 16px; color: #0f172a; }
.btn-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #64748b; }

.modal-body { padding: 20px; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 12.5px; font-weight: 700; color: #334155; margin-bottom: 6px; }
.form-group input, .form-group select {
  width: 100%; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13px; box-sizing: border-box; outline: none;
}
.form-group input:focus, .form-group select:focus { border-color: #2563eb; }
.form-row { display: flex; gap: 12px; }
.col-4 { flex: 4; } .col-6 { flex: 6; } .col-8 { flex: 8; }

.modal-footer {
  display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;
}
.btn-cancel {
  background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
}
.btn-save {
  background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;
}
.btn-save:hover { background: #1d4ed8; }
</style>
