<template>
  <div class="hr-container">
    
    <!-- แถบหัวข้อด้านบน + ปุ่มเปลี่ยน Username & รหัสผ่าน -->
    <div class="page-header">
      <div>
        <span class="badge-system">🏢 ส่วนงานบริหารจัดการระบบ</span>
        <h2>🏢 ระบบงานบุคลากร (Personnel Management System)</h2>
        <p>จัดการรอบประเมิน หัวข้อ ตัวชี้วัด มอบหมายกรรมการ และติดตามผลการประเมินบุคลากร</p>
      </div>

      <div class="header-actions">
        <!-- ปุ่มเปลี่ยน Username & รหัสผ่านของตนเอง -->
        <button class="btn-account" @click="openAccountModal(user)">
          ⚙️ บัญชีของฉัน (เปลี่ยน Username & รหัสผ่าน)
        </button>
      </div>
    </div>

    <!-- แถบเมนู 5 แท็บ จัดการได้ครบจบในหน้าเดียว -->
    <div class="main-tabs mb-4">
      <button :class="{ active: currentTab === 'users' }" @click="currentTab = 'users'">
        👥 1. จัดการผู้ใช้ & สิทธิ์ระบบ
      </button>
      <button :class="{ active: currentTab === 'period' }" @click="currentTab = 'period'">
        ⏰ 2. รอบประเมิน & เปิด/ปิดระบบ
      </button>
      <button :class="{ active: currentTab === 'metrics' }" @click="currentTab = 'metrics'">
        🎯 3. ตัวชี้วัด & เกณฑ์คะแนน
      </button>
      <button :class="{ active: currentTab === 'assignments' }" @click="currentTab = 'assignments'">
        🤝 4. มอบหมายคณะกรรมการ
      </button>
      <button :class="{ active: currentTab === 'tracking' }" @click="currentTab = 'tracking'">
        📊 5. ติดตามสถานะ & สรุปผล PDF
      </button>
    </div>


    <!-- ============================================================== -->
    <!-- 1. จัดการผู้ใช้งาน (เพิ่ม ลบ แก้ไข ครู & กรรมการ) -->
    <!-- ============================================================== -->
    <div v-if="currentTab === 'users'" class="tab-content">
      <div class="toolbar">
        <div class="role-filter">
          <button :class="{ active: filterRole === 'ALL' }" @click="filterRole = 'ALL'">ทั้งหมด ({{ usersList.length }})</button>
          <button :class="{ active: filterRole === 'teacher' }" @click="filterRole = 'teacher'">ครูผู้รับการประเมิน ({{ countRole('teacher') }})</button>
          <button :class="{ active: filterRole === 'judge' }" @click="filterRole = 'judge'">กรรมการผู้ประเมิน ({{ countRole('judge') }})</button>
          <button :class="{ active: filterRole === 'hr' }" @click="filterRole = 'hr'">ฝ่ายบุคลากร ({{ countRole('hr') }})</button>
        </div>

        <div class="tool-actions">
          <input v-model="searchQuery" type="text" placeholder="🔍 ค้นหาชื่อ หรือ Username..." class="input-search" />
          <button class="btn-primary" @click="openUserModal('add')">➕ เพิ่มผู้ใช้งานใหม่</button>
        </div>
      </div>

      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th width="50">ลำดับ</th>
              <th width="160">Username (เลขบัตร ปชช.)</th>
              <th>ชื่อ - นามสกุล</th>
              <th width="150">บทบาทสิทธิ์ (Role)</th>
              <th>สังกัด / ตำแหน่ง</th>
              <th width="110">รหัสผ่าน</th>
              <th width="210" style="text-align: center;">จัดการข้อมูล</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(u, idx) in filteredUsers" :key="u.citizenId">
              <td>{{ idx + 1 }}</td>
              <td><strong>{{ u.citizenId }}</strong></td>
              <td>{{ u.name }}</td>
              <td><span :class="['role-pill', u.role]">{{ getRoleLabel(u.role) }}</span></td>
              <td>{{ u.department || '-' }} ({{ u.position || '-' }})</td>
              <td><code>{{ u.password }}</code></td>
              <td style="text-align: center;">
                <button class="btn-sm edit" @click="openUserModal('edit', u)" title="แก้ไขข้อมูลทั่วไป">✏️ แก้ไข</button>
                <button class="btn-sm key" @click="openAccountModal(u)" title="เปลี่ยน Username และ รหัสผ่าน">🔑 รหัส/ชื่อผู้ใช้</button>
                <button v-if="u.citizenId !== user.citizenId" class="btn-sm del" @click="deleteUser(u)" title="ลบ">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>


    <!-- ============================================================== -->
    <!-- 2. กำหนดรอบประเมิน และเปิด/ปิด ระบบ -->
    <!-- ============================================================== -->
    <div v-else-if="currentTab === 'period'" class="tab-content">
      <div class="panel-card">
        <h3>⏰ กำหนดช่วงเวลาเปิด/ปิดการประเมิน</h3>
        <p class="text-muted">กำหนดรอบเวลา วันที่เริ่มต้น - สิ้นสุด และเปิด-ปิด สิทธิ์การส่งแบบประเมินของครู</p>

        <div class="form-row mt-3">
          <div class="form-group col-6">
            <label>ชื่อรอบการประเมิน *</label>
            <input v-model="periodData.name" placeholder="เช่น การประเมินผลการปฏิบัติงานบุคลากร รอบที่ 1/2568" />
          </div>
          <div class="form-group col-3">
            <label>วันที่เริ่มต้น *</label>
            <input v-model="periodData.startDate" type="date" />
          </div>
          <div class="form-group col-3">
            <label>วันที่สิ้นสุด *</label>
            <input v-model="periodData.endDate" type="date" />
          </div>
        </div>

        <div class="period-status-box mt-3">
          <div>
            <span>สถานะระบบประเมินปัจจุบัน: </span>
            <strong :class="periodData.isOpen ? 'text-success' : 'text-danger'">
              {{ periodData.isOpen ? '🟢 เปิดให้บุคลากรเข้าประเมินได้' : '🔴 ปิดระบบ (ไม่อนุญาตให้ส่งงาน)' }}
            </strong>
          </div>
          <button 
            :class="['btn-toggle', periodData.isOpen ? 'btn-danger' : 'btn-success']"
            @click="togglePeriodStatus"
          >
            {{ periodData.isOpen ? '🛑 คลิกเพื่อปิดระบบทันที' : '✅ คลิกเพื่อเปิดระบบประเมิน' }}
          </button>
        </div>
      </div>
    </div>


    <!-- ============================================================== -->
    <!-- 3. เพิ่มตัวชี้วัด (ชื่อ, รายละเอียด, น้ำหนัก, สเกล 1-4, หลักฐาน) -->
    <!-- ============================================================== -->
    <div v-else-if="currentTab === 'metrics'" class="tab-content">
      <div class="panel-card mb-4">
        <h3>🎯 เพิ่มตัวชี้วัดในแต่ละหัวข้อ</h3>
        
        <div class="form-row mt-3">
          <div class="form-group col-4">
            <label>หัวข้อการประเมินหลัก *</label>
            <select v-model="newMetric.category">
              <option value="ด้านการจัดการเรียนรู้">1. ด้านการจัดการเรียนรู้</option>
              <option value="ด้านการพัฒนาตนเองและวิชาชีพ">2. ด้านการพัฒนาตนเองและวิชาชีพ</option>
              <option value="ด้านการมีส่วนร่วมในกิจกรรม">3. ด้านการมีส่วนร่วมในกิจกรรม</option>
            </select>
          </div>
          <div class="form-group col-5">
            <label>ชื่อตัวชี้วัด *</label>
            <input v-model="newMetric.title" placeholder="เช่น การจัดทำแผนการจัดการเรียนรู้" />
          </div>
          <div class="form-group col-3">
            <label>น้ำหนักคะแนน (%) *</label>
            <input v-model.number="newMetric.weight" type="number" placeholder="25" />
          </div>
        </div>

        <div class="form-group">
          <label>รายละเอียดของตัวชี้วัด *</label>
          <textarea v-model="newMetric.description" rows="2" placeholder="อธิบายเกณฑ์และรายละเอียดผลการปฏิบัติงานที่คาดหวัง..."></textarea>
        </div>

        <div class="form-row">
          <div class="form-group col-6">
            <label>กำหนดรูปแบบการประเมิน:</label>
            <div class="radio-choices">
              <label>
                <input type="radio" value="SCALE" v-model="newMetric.evalType" />
                <strong>แบบสเกลคะแนน 1 - 4</strong> (ระดับ 1=ต่ำกว่าคาดหวังมาก, 2=ต่ำกว่าคาดหวัง, 3=ตามคาดหวัง, 4=สูงกว่าคาดหวัง)
              </label>
              <label class="mt-2">
                <input type="radio" value="BOOLEAN" v-model="newMetric.evalType" />
                <strong>แบบตัวเลือก “มี / ไม่มี”</strong>
              </label>
            </div>
          </div>

          <div class="form-group col-6">
            <label>หลักฐานประกอบที่ต้องใช้แนบ:</label>
            <select v-model="newMetric.evidenceType">
              <option value="PDF">ไฟล์เอกสาร PDF (เช่น แผนการสอน/รายงาน)</option>
              <option value="IMAGE">ไฟล์รูปภาพ (เช่น ภาพถ่ายกิจกรรม/เกียรติบัตร)</option>
              <option value="URL">ที่อยู่ URL (เช่น Google Drive/เว็บไซต์)</option>
            </select>
          </div>
        </div>

        <button class="btn-primary mt-2" @click="saveNewMetric">➕ บันทึกตัวชี้วัดลงระบบ</button>
      </div>

      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th width="60">ข้อที่</th>
              <th width="160">หัวข้อหลัก</th>
              <th>ชื่อตัวชี้วัดและรายละเอียด</th>
              <th width="110">น้ำหนัก</th>
              <th width="160">รูปแบบคะแนน</th>
              <th width="150">หลักฐานที่กำหนด</th>
              <th width="80" style="text-align: center;">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(m, idx) in metricsList" :key="m.id">
              <td><strong>{{ idx + 1 }}</strong></td>
              <td><span class="badge gray">{{ m.category || 'ด้านวิชาชีพ' }}</span></td>
              <td>
                <strong>{{ m.title }}</strong>
                <p class="desc-text">{{ m.description || 'ปฏิบัติการสอนและพัฒนาสื่อการเรียนรู้' }}</p>
              </td>
              <td><strong>{{ m.weight }}%</strong></td>
              <td><span class="badge blue">{{ m.evalType === 'SCALE' ? 'สเกล 1-4 มีคำอธิบาย' : 'มี / ไม่มี' }}</span></td>
              <td>📁 {{ m.evidenceType }}</td>
              <td style="text-align: center;">
                <button class="btn-sm del" @click="deleteMetric(idx)">ลบ</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>


    <!-- ============================================================== -->
    <!-- 4. มอบหมายกรรมการ และกำหนดบทบาท -->
    <!-- ============================================================== -->
    <div v-else-if="currentTab === 'assignments'" class="tab-content">
      <div class="panel-card mb-4">
        <h3>🤝 มอบหมายกรรมการให้ประเมินครูแต่ละคน</h3>
        
        <div class="form-row mt-3">
          <div class="form-group col-4">
            <label>เลือกผู้รับการประเมิน (ครู) *</label>
            <select v-model="assignForm.teacherCitizenId">
              <option v-for="t in teachersList" :key="t.citizenId" :value="t.citizenId">
                {{ t.name }} ({{ t.department }})
              </option>
            </select>
          </div>

          <div class="form-group col-4">
            <label>เลือกกรรมการผู้ประเมิน *</label>
            <select v-model="assignForm.judgeCitizenId">
              <option v-for="j in judgesList" :key="j.citizenId" :value="j.citizenId">
                {{ j.name }} (กรรมการ)
              </option>
            </select>
          </div>

          <div class="form-group col-4">
            <label>กำหนดบทบาทของกรรมการ *</label>
            <select v-model="assignForm.roleInBoard">
              <option value="ประธานกรรมการ">ประธานกรรมการ</option>
              <option value="กรรมการร่วม">กรรมการร่วม</option>
            </select>
          </div>
        </div>

        <button class="btn-primary mt-2" @click="saveAssignment">➕ บันทึกการมอบหมายคู่ตรวจ</button>
      </div>

      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th width="60">ลำดับ</th>
              <th>ผู้รับการประเมิน (ครู)</th>
              <th>แผนกวิชา</th>
              <th>กรรมการผู้ประเมินที่ได้รับมอบหมาย</th>
              <th width="160">บทบาทของกรรมการ</th>
              <th width="100" style="text-align: center;">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(a, idx) in assignmentsList" :key="a.id">
              <td>{{ idx + 1 }}</td>
              <td><strong>{{ a.teacherName }}</strong></td>
              <td>{{ a.department }}</td>
              <td>{{ a.judgeName }}</td>
              <td><span :class="['badge-role', a.roleInBoard === 'ประธานกรรมการ' ? 'lead' : 'member']">{{ a.roleInBoard }}</span></td>
              <td style="text-align: center;">
                <button class="btn-sm del" @click="assignmentsList.splice(idx, 1)">ยกเลิก</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>


    <!-- ============================================================== -->
    <!-- 5. ติดตามสถานะทุกคน, สรุปผลรายกรรมการ & Export PDF -->
    <!-- ============================================================== -->
    <div v-else-if="currentTab === 'tracking'" class="tab-content">
      <div class="stats-row mb-4">
        <div class="stat-box blue">
          <span>ผู้รับการประเมินทั้งหมดในระบบ</span>
          <strong>{{ allTeachersTracking.length }} คน</strong>
          <small>นับรวมครูทุกท่านที่ลงทะเบียน</small>
        </div>
        <div class="stat-box green">
          <span>ประเมินเสร็จสิ้นแล้ว</span>
          <strong>{{ countTrackingStatus('DONE') }} คน</strong>
          <small>มีคะแนนและลงนามรับรองแล้ว</small>
        </div>
        <div class="stat-box orange">
          <span>อยู่ระหว่างตรวจ / รอตรวจ</span>
          <strong>{{ countTrackingStatus('PENDING_JUDGE') }} คน</strong>
          <small>ครูส่งงานแล้ว รอกรรมการลงคะแนน</small>
        </div>
        <div class="stat-box red">
          <span>ยังไม่เริ่มประเมิน (ยังไม่ส่ง)</span>
          <strong>{{ countTrackingStatus('NOT_STARTED') }} คน</strong>
          <small>ยังไม่ได้กรอกแบบประเมินตนเอง</small>
        </div>
      </div>

      <div class="toolbar">
        <div class="role-filter">
          <button :class="{ active: filterTrackStatus === 'ALL' }" @click="filterTrackStatus = 'ALL'">
            ครูทั้งหมด ({{ allTeachersTracking.length }})
          </button>
          <button :class="{ active: filterTrackStatus === 'DONE' }" @click="filterTrackStatus = 'DONE'">
            🟢 ประเมินเสร็จสิ้น ({{ countTrackingStatus('DONE') }})
          </button>
          <button :class="{ active: filterTrackStatus === 'PENDING_JUDGE' }" @click="filterTrackStatus = 'PENDING_JUDGE'">
            🟡 รอตรวจประเมิน ({{ countTrackingStatus('PENDING_JUDGE') }})
          </button>
          <button :class="{ active: filterTrackStatus === 'NOT_STARTED' }" @click="filterTrackStatus = 'NOT_STARTED'">
            🔴 ยังไม่เริ่มประเมิน ({{ countTrackingStatus('NOT_STARTED') }})
          </button>
        </div>

        <input 
          v-model="searchTrackQuery" 
          type="text" 
          placeholder="🔍 ค้นหาชื่อครู หรือ Username..." 
          class="input-search"
        />
      </div>

      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th width="50">ลำดับ</th>
              <th>ผู้รับการประเมิน (ครู)</th>
              <th>แผนกวิชา / ตำแหน่ง</th>
              <th width="160">สถานะผู้รับการประเมิน</th>
              <th>กรรมการผู้ตรวจ</th>
              <th width="120">คะแนนสุทธิ</th>
              <th width="140">สถานะภาพรวม</th>
              <th width="160" style="text-align: center;">รายงานผล</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(t, idx) in filteredTrackingList" :key="t.citizenId">
              <td>{{ idx + 1 }}</td>
              <td><strong>{{ t.name }}</strong><br/><small class="text-muted">Username: {{ t.citizenId }}</small></td>
              <td>{{ t.department }}<br/><small class="text-muted">{{ t.position }}</small></td>
              <td>
                <span v-if="t.trackStatus === 'DONE' || t.trackStatus === 'PENDING_JUDGE'" class="status-tag green">✅ ส่งผลงานแล้ว (100%)</span>
                <span v-else class="status-tag red">⚠️ ยังไม่ส่งแบบประเมิน (0%)</span>
              </td>
              <td>
                <div v-if="t.judgeName">
                  <strong>{{ t.judgeName }}</strong><br/><small class="role-sub">({{ t.roleInBoard }})</small>
                </div>
                <div v-else class="text-muted">- ยังไม่ได้มอบหมาย -</div>
              </td>
              <td>
                <strong v-if="t.finalScore" class="score-text">{{ t.finalScore }} / 4.00</strong>
                <span v-else class="text-muted">- รอผลคะแนน -</span>
              </td>
              <td>
                <span v-if="t.trackStatus === 'DONE'" class="badge-status done">🟢 ประเมินเสร็จสิ้น</span>
                <span v-else-if="t.trackStatus === 'PENDING_JUDGE'" class="badge-status waiting">🟡 รอกรรมการตรวจ</span>
                <span v-else class="badge-status not-started">🔴 ยังไม่เริ่มประเมิน</span>
              </td>
              <td style="text-align: center;">
                <button v-if="t.trackStatus === 'DONE'" class="btn-report" @click="openReportModal(t)">📄 ดูรายงาน & PDF</button>
                <button v-else class="btn-report disabled" @click="alertNotReady(t)">⏳ ยังไม่มีผลประเมิน</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>


    <!-- ============================================================== -->
    <!-- ป๊อปอัป: เปลี่ยน USERNAME & รหัสผ่าน (แก้ไขได้ทั้งสองอย่าง) -->
    <!-- ============================================================== -->
    <div v-if="showAccountModal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-head">
          <h3>🔑 เปลี่ยน Username และ รหัสผ่าน</h3>
          <button class="btn-close" @click="showAccountModal = false">✕</button>
        </div>

        <form @submit.prevent="saveAccountChanges" class="modal-body">
          <p class="text-muted">กำลังแก้ไขบัญชีของ: <strong>{{ targetUser.name }}</strong></p>
          
          <div class="form-group">
            <label>Username / เลขบัตรประชาชน (ใช้ล็อกอินเข้าสู่ระบบ) *</label>
            <input v-model="newUsername" placeholder="ระบุ Username ใหม่" required />
            <small class="hint-small">⚠️ ต้องใช้ค่าใหม่นี้ในการล็อกอินครั้งถัดไป</small>
          </div>

          <div class="form-group">
            <label>รหัสผ่านใหม่ (New Password) *</label>
            <input v-model="newPassword" placeholder="กรอกรหัสผ่านใหม่" required />
          </div>

          <div class="form-group">
            <label>ยืนยันรหัสผ่านใหม่อีกครั้ง *</label>
            <input v-model="confirmNewPassword" placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง" required />
          </div>

          <div class="modal-foot">
            <button type="button" class="btn-cancel" @click="showAccountModal = false">ยกเลิก</button>
            <button type="submit" class="btn-primary">💾 บันทึก Username & รหัสผ่านใหม่</button>
          </div>
        </form>
      </div>
    </div>


    <!-- ============================================================== -->
    <!-- ป๊อปอัป: เพิ่ม / แก้ไข ผู้ใช้งาน (User Modal) -->
    <!-- ============================================================== -->
    <div v-if="showUserModal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-head">
          <h3>{{ modalMode === 'add' ? '➕ เพิ่มผู้ใช้งานใหม่' : '✏️ แก้ไขข้อมูลผู้ใช้งาน' }}</h3>
          <button class="btn-close" @click="showUserModal = false">✕</button>
        </div>

        <form @submit.prevent="saveUser" class="modal-body">
          <div class="form-group">
            <label>เลือกบทบาทหน้าที่ (Role) *</label>
            <select v-model="userForm.role" required>
              <option value="teacher">ครูผู้รับการประเมิน (บุคลากร)</option>
              <option value="judge">กรรมการผู้ประเมิน</option>
              <option value="hr">ฝ่ายบุคลากร (HR)</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group col-4">
              <label>คำนำหน้า</label>
              <select v-model="userForm.prefix"><option>นาย</option><option>นาง</option><option>นางสาว</option><option>ดร.</option></select>
            </div>
            <div class="form-group col-8">
              <label>ชื่อ - นามสกุล *</label>
              <input v-model="userForm.fullname" placeholder="ระบุชื่อจริง-นามสกุล" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-6">
              <label>Username / เลขบัตร ปชช. *</label>
              <input v-model="userForm.citizenId" placeholder="เช่น เลข 13 หลัก" required />
            </div>
            <div class="form-group col-6">
              <label>รหัสผ่านเข้าสู่ระบบ *</label>
              <input v-model="userForm.password" placeholder="ตั้งรหัสผ่าน" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-6">
              <label>แผนกวิชา / ฝ่ายสังกัด</label>
              <select v-model="userForm.department">
                <option value="แผนกวิชาเทคโนโลยีสารสนเทศ">แผนกวิชาเทคโนโลยีสารสนเทศ</option>
                <option value="แผนกวิชาคอมพิวเตอร์ธุรกิจ">แผนกวิชาคอมพิวเตอร์ธุรกิจ</option>
                <option value="แผนกวิชาช่างไฟฟ้ากำลัง">แผนกวิชาช่างไฟฟ้ากำลัง</option>
                <option value="แผนกวิชาสามัญสัมพันธ์">แผนกวิชาสามัญสัมพันธ์</option>
                <option value="งานบุคลากร">งานบุคลากร</option>
                <option value="คณะกรรมการประเมิน">คณะกรรมการประเมิน</option>
              </select>
            </div>
            <div class="form-group col-6">
              <label>ตำแหน่งงาน</label>
              <select v-model="userForm.position">
                <option value="ครูผู้ช่วย">ครูผู้ช่วย</option>
                <option value="ครู คศ.1">ครู คศ.1</option>
                <option value="ครู คศ.2">ครู คศ.2</option>
                <option value="หัวหน้าแผนกวิชา">หัวหน้าแผนกวิชา</option>
                <option value="กรรมการผู้ทรงคุณวุฒิ">กรรมการผู้ทรงคุณวุฒิ</option>
              </select>
            </div>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn-cancel" @click="showUserModal = false">ยกเลิก</button>
            <button type="submit" class="btn-primary">บันทึกข้อมูล</button>
          </div>
        </form>
      </div>
    </div>


    <!-- ============================================================== -->
    <!-- ป๊อปอัป: รายงานผลรายบุคคล & Export PDF -->
    <!-- ============================================================== -->
    <div v-if="showReportModal" class="modal-overlay">
      <div class="report-modal-content">
        <div class="report-modal-actions no-print">
          <span>แบบรายงานผลการประเมินรายบุคคล</span>
          <div class="action-buttons">
            <button class="btn-pdf-print" @click="printReportPDF">🖨️ Export ออกมาเป็นไฟล์ PDF</button>
            <button class="btn-close" @click="showReportModal = false">✕ ปิด</button>
          </div>
        </div>

        <div class="printable-report" id="printArea">
          <div class="report-header">
            <div class="report-badge">เอกสารทางการ • ทักษะการพัฒนาระบบประเมินบุคลากร ปวช.</div>
            <h2>แบบรายงานสรุปผลการประเมินการปฏิบัติงานรายบุคคล</h2>
            <p>รอบการประเมิน: {{ periodData.name }} | วันที่พิมพ์: 3 พฤศจิกายน 2568</p>
          </div>

          <div class="report-meta-grid">
            <div class="meta-box">
              <h4>ข้อมูลผู้รับการประเมิน (ครู):</h4>
              <p><strong>ชื่อ-สกุล:</strong> {{ selectedReport.name }}</p>
              <p><strong>Username/เลขบัตร:</strong> {{ selectedReport.citizenId }}</p>
              <p><strong>ตำแหน่ง/สังกัด:</strong> {{ selectedReport.position }} ({{ selectedReport.department }})</p>
            </div>
            <div class="meta-box">
              <h4>ข้อมูลคณะกรรมการผู้ประเมิน:</h4>
              <p><strong>กรรมการผู้ประเมิน:</strong> {{ selectedReport.judgeName }}</p>
              <p><strong>บทบาทในคณะกรรมการ:</strong> {{ selectedReport.roleInBoard }}</p>
              <p><strong>สถานะผลการตรวจ:</strong> ตรวจประเมินเสร็จสิ้นสมบูรณ์</p>
            </div>
          </div>

          <table class="report-score-table">
            <thead>
              <tr>
                <th width="50">ลำดับ</th>
                <th>หัวข้อและตัวชี้วัดการประเมิน</th>
                <th width="90">น้ำหนัก</th>
                <th width="120">คะแนนประเมินตนเอง</th>
                <th width="130">คะแนนที่กรรมการให้</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, i) in metricsList" :key="m.id">
                <td style="text-align: center;">{{ i + 1 }}</td>
                <td>{{ m.title }}</td>
                <td style="text-align: center;">{{ m.weight }}%</td>
                <td style="text-align: center;">ระดับ 4</td>
                <td style="text-align: center;"><strong>ระดับ 4</strong></td>
              </tr>
              <tr class="total-row">
                <td colspan="4" style="text-align: right;"><strong>สรุปคะแนนเฉลี่ยสุทธิ:</strong></td>
                <td style="text-align: center;"><strong>{{ selectedReport.finalScore }} / 4.00</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="feedback-section">
            <strong>ความคิดเห็นและข้อเสนอแนะสรุปโดยภาพรวมของกรรมการ:</strong>
            <p>"{{ selectedReport.feedback || 'มีผลการปฏิบัติงานเป็นไปตามเกณฑ์มาตรฐานวิชาชีพ มีความรับผิดชอบในการปฏิบัติงานอย่างดียิ่ง' }}"</p>
          </div>

          <div class="signatures-row">
            <div class="sig-col">
              <div class="sig-space"><span class="digital-sig">✍️ (ลงนามดิจิทัล)</span></div>
              <p>ลงชื่อ..........................................................</p>
              <p>({{ selectedReport.name }})</p>
              <small>ผู้รับการประเมิน</small>
            </div>
            <div class="sig-col">
              <div class="sig-space"><span class="digital-sig">✍️ (ลงนามดิจิทัล)</span></div>
              <p>ลงชื่อ..........................................................</p>
              <p>({{ selectedReport.judgeName }})</p>
              <small>{{ selectedReport.roleInBoard }}</small>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps(['user', 'sharedData'])

const currentTab = ref('users')
const filterRole = ref('ALL')
const searchQuery = ref('')
const showUserModal = ref(false)
const modalMode = ref('add')

// ==========================================
// ระบบเปลี่ยน USERNAME & รหัสผ่าน (Account Modal)
// ==========================================
const showAccountModal = ref(false)
const targetUser = ref({})
const newUsername = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')

const openAccountModal = (userObj) => {
  targetUser.value = userObj
  newUsername.value = userObj.citizenId
  newPassword.value = userObj.password
  confirmNewPassword.value = userObj.password
  showAccountModal.value = true
}

const saveAccountChanges = () => {
  const cleanUsername = newUsername.value.trim()
  if (!cleanUsername) return alert('กรุณาระบุ Username!')
  if (newPassword.value !== confirmNewPassword.value) return alert('รหัสผ่านและการยืนยันไม่ตรงกัน!')
  if (newPassword.value.trim().length < 4) return alert('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร!')

  const originalId = targetUser.value.citizenId
  const isDuplicate = props.sharedData.users.some(
    u => u.citizenId === cleanUsername && u.citizenId !== originalId
  )
  if (isDuplicate) return alert(`Username "${cleanUsername}" มีผู้อื่นใช้แล้ว!`)

  const userInDB = props.sharedData.users.find(u => u.citizenId === originalId)
  if (userInDB) {
    userInDB.citizenId = cleanUsername
    userInDB.password = newPassword.value

    if (props.user.citizenId === originalId) {
      props.user.citizenId = cleanUsername
      props.user.password = newPassword.value
    }

    if (props.sharedData.assignments) {
      props.sharedData.assignments.forEach(a => {
        if (a.teacherCitizenId === originalId) a.teacherCitizenId = cleanUsername
      })
    }

    localStorage.setItem('shared_users', JSON.stringify(props.sharedData.users))
    const token = localStorage.getItem('auth_token')
    if (token) {
      fetch('/api/users/' + originalId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ newCitizenId: cleanUsername, password: newPassword.value })
      }).catch(() => {})
    }

    alert('อัปเดตบัญชีสำเร็จ!\nUsername ใหม่: ' + cleanUsername + '\nรหัสผ่านใหม่: ' + newPassword.value)
    showAccountModal.value = false
  }
}

// 1. จัดการผู้ใช้
const usersList = computed(() => props.sharedData?.users || [])
const userForm = ref({
  prefix: 'นาย', fullname: '', citizenId: '', password: '',
  role: 'teacher', department: 'แผนกวิชาเทคโนโลยีสารสนเทศ', position: 'ครู คศ.1'
})

const filteredUsers = computed(() => {
  return usersList.value.filter(u => {
    const matchRole = filterRole.value === 'ALL' || u.role === filterRole.value
    const matchSearch = u.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                        u.citizenId.includes(searchQuery.value.trim())
    return matchRole && matchSearch
  })
})

const countRole = (role) => usersList.value.filter(u => u.role === role).length
const getRoleLabel = (role) => {
  if (role === 'admin') return 'ผู้ดูแลระบบ'
  if (role === 'hr') return 'ฝ่ายบุคลากร'
  if (role === 'teacher') return 'ครูผู้รับการประเมิน'
  if (role === 'judge') return 'กรรมการผู้ประเมิน'
  return role
}

const openUserModal = (mode, userObj = null) => {
  modalMode.value = mode
  if (mode === 'add') {
    userForm.value = {
      prefix: 'นาย', fullname: '', citizenId: '', password: '',
      role: 'teacher', department: 'แผนกวิชาเทคโนโลยีสารสนเทศ', position: 'ครู คศ.1'
    }
  } else if (userObj) {
    userForm.value = {
      prefix: '', fullname: userObj.name, citizenId: userObj.citizenId,
      password: userObj.password, role: userObj.role,
      department: userObj.department || 'แผนกวิชาเทคโนโลยีสารสนเทศ',
      position: userObj.position || 'ครู คศ.1'
    }
  }
  showUserModal.value = true
}

const saveUser = async () => {
  const cleanId = userForm.value.citizenId.trim()
  if (!cleanId) return alert('กรุณากรอก Username!')
  const roleName = getRoleLabel(userForm.value.role)

  const payload = {
    citizenId: cleanId,
    password: userForm.value.password,
    name: userForm.value.prefix ? userForm.value.prefix + ' ' + userForm.value.fullname : userForm.value.fullname,
    fullname: userForm.value.fullname,
    prefix: userForm.value.prefix,
    role: userForm.value.role,
    roleTitle: roleName,
    department: userForm.value.department,
    position: userForm.value.position
  }

  if (modalMode.value === 'add') {
    const exists = usersList.value.some(u => u.citizenId === cleanId)
    if (exists) return alert('Username นี้มีอยู่ในระบบแล้ว!')
    props.sharedData.users.push(payload)
    localStorage.setItem('shared_users', JSON.stringify(props.sharedData.users))

    const token = localStorage.getItem('auth_token')
    if (token) {
      try {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify(payload)
        })
      } catch (e) {}
    }

    alert('เพิ่มผู้ใช้งานสำเร็จ! (Username: ' + cleanId + ')')
  } else {
    const target = props.sharedData.users.find(u => u.citizenId === cleanId)
    if (target) {
      target.name = payload.name
      target.password = userForm.value.password
      target.role = userForm.value.role
      target.roleTitle = roleName
      target.department = userForm.value.department
      target.position = userForm.value.position
      localStorage.setItem('shared_users', JSON.stringify(props.sharedData.users))

      const token = localStorage.getItem('auth_token')
      if (token) {
        try {
          await fetch('/api/users/' + cleanId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
          })
        } catch (e) {}
      }

      alert('อัปเดตข้อมูลผู้ใช้งานเรียบร้อยแล้ว!')
    }
  }
  showUserModal.value = false
}

const deleteUser = async (u) => {
  if (confirm('คุณต้องการลบ "' + u.name + '" ใช่หรือไม่?')) {
    const idx = props.sharedData.users.findIndex(x => x.citizenId === u.citizenId)
    if (idx !== -1) {
      props.sharedData.users.splice(idx, 1)
      localStorage.setItem('shared_users', JSON.stringify(props.sharedData.users))

      const token = localStorage.getItem('auth_token')
      if (token) {
        try {
          await fetch('/api/users/' + u.citizenId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
          })
        } catch (e) {}
      }
      alert('ลบผู้ใช้งานสำเร็จ!')
    }
  }
}

// 2. ข้อมูลรอบการประเมิน
const periodData = computed(() => props.sharedData.period)
const togglePeriodStatus = () => {
  periodData.value.isOpen = !periodData.value.isOpen
  alert(`ระบบเปลี่ยนสถานะเป็น: ${periodData.value.isOpen ? 'เปิดให้ประเมิน' : 'ปิดระบบเรียบร้อย'}`)
}

// 3. จัดการตัวชี้วัด
const metricsList = computed(() => props.sharedData?.metrics || [])
const newMetric = ref({
  category: 'ด้านการจัดการเรียนรู้',
  title: '',
  description: '',
  weight: 25,
  evalType: 'SCALE',
  evidenceType: 'PDF'
})

const saveNewMetric = () => {
  if (!newMetric.value.title.trim() || !newMetric.value.description.trim()) {
    return alert('กรุณากรอกชื่อและรายละเอียดตัวชี้วัด!')
  }
  props.sharedData.metrics.push({
    id: Date.now(),
    category: newMetric.value.category,
    title: newMetric.value.title.trim(),
    description: newMetric.value.description.trim(),
    weight: newMetric.value.weight,
    evalType: newMetric.value.evalType,
    evidenceType: newMetric.value.evidenceType
  })
  alert('บันทึกตัวชี้วัดใหม่เรียบร้อยแล้ว!')
  newMetric.value.title = ''
  newMetric.value.description = ''
}

const deleteMetric = (idx) => {
  if (confirm('ยืนยันการลบตัวชี้วัดนี้?')) props.sharedData.metrics.splice(idx, 1)
}

// 4. มอบหมายกรรมการ
const teachersList = computed(() => usersList.value.filter(u => u.role === 'teacher'))
const judgesList = computed(() => usersList.value.filter(u => u.role === 'judge'))
const assignmentsList = ref([
  { id: 1, teacherName: 'นายสมชาย ใจดี', teacherCitizenId: '1100200000002', department: 'แผนกวิชาเทคโนโลยีสารสนเทศ', judgeName: 'ดร.สมศักดิ์ ทรงธรรม', roleInBoard: 'ประธานกรรมการ' }
])

const assignForm = ref({
  teacherCitizenId: '1100200000002',
  judgeCitizenId: '1100300000003',
  roleInBoard: 'ประธานกรรมการ'
})

const saveAssignment = () => {
  const teacher = teachersList.value.find(t => t.citizenId === assignForm.value.teacherCitizenId)
  const judge = judgesList.value.find(j => j.citizenId === assignForm.value.judgeCitizenId)
  if (!teacher || !judge) return

  assignmentsList.value.push({
    id: Date.now(),
    teacherName: teacher.name,
    teacherCitizenId: teacher.citizenId,
    department: teacher.department,
    judgeName: judge.name,
    roleInBoard: assignForm.value.roleInBoard
  })
  alert(`มอบหมายให้ ${judge.name} (${assignForm.value.roleInBoard}) ตรวจประเมิน ${teacher.name} เรียบร้อยแล้ว!`)
}

// 5. ติดตามสถานะทุกคน
const filterTrackStatus = ref('ALL')
const searchTrackQuery = ref('')

const knownResults = {
  '1100200000002': {
    judgeName: 'ดร.สมศักดิ์ ทรงธรรม',
    roleInBoard: 'ประธานกรรมการ',
    finalScore: '3.85',
    trackStatus: 'DONE',
    feedback: 'มีแผนการจัดการเรียนรู้ที่สอดคล้องกับมาตรฐานอาชีพ นำสื่อเทคโนโลยีดิจิทัลมาใช้ในการสอนได้ดีเยี่ยม สมควรได้รับการยกย่อง'
  }
}

const allTeachersTracking = computed(() => {
  return teachersList.value.map(t => {
    const evaluatedInfo = knownResults[t.citizenId]
    const assigned = assignmentsList.value.find(a => a.teacherCitizenId === t.citizenId)
    
    if (evaluatedInfo) {
      return {
        ...t,
        judgeName: evaluatedInfo.judgeName,
        roleInBoard: evaluatedInfo.roleInBoard,
        finalScore: evaluatedInfo.finalScore,
        trackStatus: evaluatedInfo.trackStatus,
        feedback: evaluatedInfo.feedback
      }
    } else if (assigned) {
      return {
        ...t,
        judgeName: assigned.judgeName,
        roleInBoard: assigned.roleInBoard,
        finalScore: null,
        trackStatus: 'PENDING_JUDGE',
        feedback: ''
      }
    } else {
      return {
        ...t,
        judgeName: '',
        roleInBoard: '',
        finalScore: null,
        trackStatus: 'NOT_STARTED',
        feedback: ''
      }
    }
  })
})

const countTrackingStatus = (status) => allTeachersTracking.value.filter(t => t.trackStatus === status).length

const filteredTrackingList = computed(() => {
  return allTeachersTracking.value.filter(t => {
    const matchStatus = filterTrackStatus.value === 'ALL' || t.trackStatus === filterTrackStatus.value
    const matchSearch = t.name.toLowerCase().includes(searchTrackQuery.value.toLowerCase()) || 
                        t.citizenId.includes(searchTrackQuery.value.trim())
    return matchStatus && matchSearch
  })
})

const showReportModal = ref(false)
const selectedReport = ref({})

const openReportModal = (teacher) => {
  selectedReport.value = teacher
  showReportModal.value = true
}

const alertNotReady = (teacher) => {
  alert(`แจ้งเตือน:\n"${teacher.name}" ยังไม่ได้ส่งแบบประเมินตนเอง จึงยังไม่มีผลคะแนนจากกรรมการ`)
}

const printReportPDF = () => {
  window.print()
}
</script>

<style scoped>
.hr-container {
  max-width: 1200px;
  margin: 24px auto;
  padding: 0 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1e293b;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 14px;
}
.page-header h2 { margin: 4px 0; font-size: 22px; color: #0f172a; }
.page-header p { margin: 0; font-size: 13px; color: #64748b; }
.badge-criteria {
  background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px;
}

.btn-account {
  background-color: #0f172a;
  color: #ffffff;
  border: none;
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-account:hover { background-color: #1e293b; }

.main-tabs {
  display: flex;
  background-color: #e2e8f0;
  padding: 4px;
  border-radius: 12px;
  gap: 4px;
  overflow-x: auto;
}
.main-tabs button {
  background: transparent;
  border: none;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.main-tabs button.active {
  background-color: #2563eb;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 14px;
  flex-wrap: wrap;
}
.role-filter {
  display: flex;
  background-color: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 3px;
  border-radius: 8px;
  gap: 3px;
}
.role-filter button {
  background: transparent;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
}
.role-filter button.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 2px 4px rgba(0,0,0,0.06);
}
.tool-actions { display: flex; gap: 10px; }
.input-search {
  padding: 8px 14px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13px; width: 240px; outline: none;
}
.input-search:focus { border-color: #2563eb; }

.table-card, .panel-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.panel-card { padding: 22px; }

.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th {
  background-color: #f8fafc; padding: 12px 14px; text-align: left; color: #475569; font-weight: 700; border-bottom: 1px solid #e2e8f0;
}
.data-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; }
.text-muted { color: #64748b; font-size: 11.5px; }
.role-sub { color: #4338ca; font-size: 11px; }
.desc-text { font-size: 11.5px; color: #64748b; margin: 2px 0 0; }

.role-pill { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
.role-pill.teacher { background-color: #dcfce7; color: #15803d; }
.role-pill.judge { background-color: #fef3c7; color: #b45309; }
.role-pill.hr { background-color: #e0e7ff; color: #4338ca; }
.role-pill.admin { background-color: #fee2e2; color: #dc2626; }

.badge-role { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
.badge-role.lead { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
.badge-role.member { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

.badge-status { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 700; }
.badge-status.done { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
.badge-status.waiting { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
.badge-status.not-started { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }

.status-tag.green { background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; }
.status-tag.red { background: #fee2e2; color: #dc2626; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; }
.badge.blue { background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
.badge.gray { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
.score-text { color: #2563eb; font-size: 14px; font-weight: 800; }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-box {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column;
}
.stat-box.blue { border-left: 5px solid #2563eb; }
.stat-box.green { border-left: 5px solid #10b981; }
.stat-box.orange { border-left: 5px solid #f59e0b; }
.stat-box.red { border-left: 5px solid #ef4444; }
.stat-box span { font-size: 11.5px; color: #64748b; font-weight: 600; }
.stat-box strong { font-size: 18px; color: #0f172a; margin: 4px 0; }
.stat-box small { font-size: 11px; color: #94a3b8; }

.period-status-box {
  background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px 20px;
  display: flex; justify-content: space-between; align-items: center;
}

.btn-primary {
  background-color: #2563eb; color: #ffffff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;
}
.btn-toggle {
  border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; color: #fff;
}
.btn-toggle.btn-danger { background-color: #dc2626; }
.btn-toggle.btn-success { background-color: #16a34a; }

.btn-report {
  background-color: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;
}
.btn-report:hover { background-color: #2563eb; color: #fff; }
.btn-report.disabled { background-color: #f1f5f9; color: #94a3b8; border-color: #cbd5e1; cursor: not-allowed; }
.btn-pdf-print { background-color: #dc2626; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }

.btn-sm { padding: 4px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
.btn-sm.edit { background: #f1f5f9; border-color: #cbd5e1; color: #334155; margin-right: 4px; }
.btn-sm.key { background: #fef3c7; border-color: #fde68a; color: #b45309; margin-right: 4px; }
.btn-sm.del { background: #fee2e2; border-color: #fecaca; color: #dc2626; }

.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 12.5px; font-weight: 700; color: #334155; margin-bottom: 6px; }
.form-group input, .form-group select, .form-group textarea {
  width: 100%; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13px; box-sizing: border-box; outline: none;
}
.hint-small { display: block; font-size: 11px; color: #ea580c; margin-top: 4px; }
.form-row { display: flex; gap: 12px; }
.col-3 { flex: 3; } .col-4 { flex: 4; } .col-5 { flex: 5; } .col-6 { flex: 6; } .col-8 { flex: 8; }
.radio-choices { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; font-size: 13px; }

/* Modals */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(15, 23, 42, 0.65);
  display: flex; align-items: center; justify-content: center; z-index: 999; padding: 20px;
}
.modal-card {
  background: #ffffff; width: 100%; max-width: 520px; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 25px rgba(0,0,0,0.2);
}
.modal-head {
  padding: 16px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;
}
.modal-head h3 { margin: 0; font-size: 16px; color: #0f172a; }
.btn-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #64748b; }
.modal-body { padding: 20px; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.btn-cancel { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; }

/* PDF Report Modal */
.report-modal-content {
  background: #ffffff; width: 100%; max-width: 820px; max-height: 90vh; overflow-y: auto;
  border-radius: 16px; box-shadow: 0 25px 50px rgba(0,0,0,0.25);
}
.report-modal-actions {
  position: sticky; top: 0; background: #1e293b; color: #fff; padding: 12px 24px;
  display: flex; justify-content: space-between; align-items: center; z-index: 10;
}
.action-buttons { display: flex; gap: 10px; }
.printable-report {
  padding: 36px 44px; background: #ffffff; color: #000; font-family: 'Sarabun', sans-serif;
}
.report-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 20px; }
.report-badge { font-size: 11px; font-weight: bold; margin-bottom: 4px; color: #333; }
.report-header h2 { margin: 0 0 6px 0; font-size: 20px; }
.report-header p { margin: 0; font-size: 12px; color: #444; }

.report-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.meta-box { background: #fdfdfd; border: 1px solid #ccc; padding: 12px; border-radius: 6px; font-size: 12px; }
.meta-box h4 { margin: 0 0 8px 0; font-size: 13px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
.meta-box p { margin: 4px 0; }

.report-score-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
.report-score-table th, .report-score-table td { border: 1px solid #333; padding: 8px 10px; }
.report-score-table th { background: #f0f0f0; }
.total-row { background: #fbfbfb; font-size: 13px; }

.feedback-section { border: 1px solid #333; padding: 12px; border-radius: 6px; font-size: 12px; margin-bottom: 30px; }
.feedback-section p { margin: 6px 0 0 0; font-style: italic; }

.signatures-row { display: flex; justify-content: space-around; text-align: center; font-size: 12px; margin-top: 30px; }
.sig-col { width: 240px; }
.sig-space { height: 45px; display: flex; align-items: center; justify-content: center; }
.digital-sig { color: #1e3a8a; font-weight: bold; }
.sig-col p { margin: 4px 0; }

.mb-4 { margin-bottom: 18px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 14px; }

@media print {
  body * { visibility: hidden; }
  .no-print { display: none !important; }
  #printArea, #printArea * { visibility: visible; }
  #printArea { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
}
</style>