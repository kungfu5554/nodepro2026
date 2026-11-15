// public/js/components/AdminDashboard.js
import { formatUserDisplayName } from '../utils/formatters.js';
import {
  allPeriods, selectedAdminPeriodId, period, metrics, metricCategories, totalMetricWeight, openIndividualReportModal
} from '../composables/useAppState.js';
import {
  adminTab, userFilterRole, userSearchQuery, filteredUsers,
  assignments, hrStats, newMetric, newCategory,
  trackingSubTab, trackingSearchQuery, trackingStageFilter,
  filteredTrackingEvaluatees, filteredTrackingJudges,
  departmentsList, departmentJudgesList,
  newDept, newDeptJudge, pendingDepartmentRequests, approveDeptCodes, judges
} from '../composables/useAdmin.js';

export default {
  name: 'AdminDashboard',
  props: {
    actions: { type: Object, required: true }
  },
  setup(props) {
    return {
      allPeriods, selectedAdminPeriodId, period, metrics, metricCategories, totalMetricWeight,
      adminTab, userFilterRole, userSearchQuery, filteredUsers,
      assignments, hrStats, newMetric, newCategory,
      trackingSubTab, trackingSearchQuery, trackingStageFilter,
      filteredTrackingEvaluatees, filteredTrackingJudges,
      departmentsList, departmentJudgesList,
      newDept, newDeptJudge, pendingDepartmentRequests, approveDeptCodes, judges,
      formatUserDisplayName, openIndividualReportModal,
      ...props.actions
    };
  },
  template: `
    <div class="container">
      <div v-if="pendingDepartmentRequests.length > 0" style="background: #fffbeb; border: 1px solid #f59e0b; border-left: 4px solid #d97706; border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; color: #92400e;">
          <v-icon name="alert" size="18"></v-icon>
          <span><strong>แจ้งเตือนฝ่ายบุคลากร (HR):</strong> มีคำขอเพิ่มสาขาวิชาใหม่จากผู้รับการประเมินรอการอนุมัติ จำนวน <strong>{{ pendingDepartmentRequests.length }} รายการ</strong></span>
        </div>
        <button type="button" class="btn-primary btn-sm" style="background: #d97706;" @click="adminTab = 'assign'">
          <v-icon name="check-circle" size="12"></v-icon><span>ไปที่หน้าพิจารณาอนุมัติ</span>
        </button>
      </div>

      <div class="sub-nav">
        <button :class="{ active: adminTab === 'users' }" @click="adminTab = 'users'"><v-icon name="users" size="14"></v-icon><span>1. บุคลากร & สิทธิ์การใช้งาน</span></button>
        <button :class="{ active: adminTab === 'period' }" @click="adminTab = 'period'"><v-icon name="calendar" size="14"></v-icon><span>2. รอบการประเมิน</span></button>
        <button :class="{ active: adminTab === 'metrics' }" @click="adminTab = 'metrics'"><v-icon name="target" size="14"></v-icon><span>3. ตัวชี้วัด & เกณฑ์คะแนน</span></button>
        <button :class="{ active: adminTab === 'assign' }" @click="adminTab = 'assign'">
          <v-icon name="target" size="14"></v-icon><span>4. สาขาวิชาและกรรมการประจำสาขา</span>
          <span v-if="pendingDepartmentRequests.length > 0" style="background:#dc2626; color:#fff; border-radius:999px; padding:1px 7px; font-size:11px; font-weight:700; margin-left:4px;">{{ pendingDepartmentRequests.length }}</span>
        </button>
        <button :class="{ active: adminTab === 'track' }" @click="adminTab = 'track'"><v-icon name="bar-chart" size="14"></v-icon><span>5. สรุปผล & รายงานคะแนน</span></button>
      </div>

      <!-- Tab 1: Users -->
      <div v-if="adminTab === 'users'">
        <div class="page-header">
          <div>
            <h2><v-icon name="users" size="18"></v-icon> จัดการข้อมูลผู้ใช้งานและสิทธิ์ในระบบ</h2>
            <p>จัดการรายชื่อครูผู้รับการประเมิน กรรมการ ฝ่ายบุคลากร และผู้ดูแลระบบ</p>
          </div>
          <button class="btn-primary" @click="openUserModal('add')"><v-icon name="plus" size="14"></v-icon><span>เพิ่มผู้ใช้งานใหม่</span></button>
        </div>

        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 5px;">
              <button v-for="r in ['ALL', 'teacher', 'judge', 'hr', 'admin']" :key="r" :class="['btn-sm', userFilterRole === r ? 'active' : '']" @click="userFilterRole = r">
                {{ r === 'ALL' ? 'ทั้งหมด' : (r === 'teacher' ? 'ผู้รับการประเมิน' : (r === 'judge' ? 'กรรมการ' : (r === 'hr' ? 'ฝ่ายบุคลากร' : 'ผู้ดูแลระบบ'))) }}
              </button>
            </div>
            <div style="position: relative; width: 240px;">
              <input v-model="userSearchQuery" placeholder="ค้นหาชื่อ หรือเลขบัตร..." style="padding-left: 28px;" />
              <v-icon name="search" size="13" style="position: absolute; left: 9px; top: 9px; color: var(--text-muted);"></v-icon>
            </div>
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th width="40">ลำดับ</th>
                  <th width="140">เลขประจำตัวประชาชน</th>
                  <th>ชื่อ - นามสกุล</th>
                  <th>สังกัด / สาขาวิชา</th>
                  <th width="110">บทบาท</th>
                  <th width="110">จำนวนกรรมการ</th>
                  <th width="140" style="text-align: right;">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(u, idx) in filteredUsers" :key="u.id">
                  <td>{{ idx + 1 }}</td>
                  <td><strong>{{ u.citizenId }}</strong></td>
                  <td>{{ formatUserDisplayName(u) }}</td>
                  <td>
                    <div v-if="u.deptStatus === 'PENDING'" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <span class="tag yellow"><v-icon name="clock" size="11"></v-icon> รออนุมัติ: {{ u.requestedDepartment }}</span>
                      <button type="button" class="btn-sm" style="height:22px; font-size:11px; padding:0 7px;" @click="adminTab = 'assign'">พิจารณา</button>
                    </div>
                    <div v-else-if="u.deptStatus === 'REJECTED'">
                      <span class="tag red"><v-icon name="alert" size="11"></v-icon> ไม่อนุมัติ: {{ u.requestedDepartment }}</span>
                    </div>
                    <span v-else>{{ u.department || '-' }}</span>
                  </td>
                  <td><span :class="['tag', u.role === 'admin' ? 'red' : (u.role === 'hr' ? 'yellow' : (u.role === 'judge' ? 'blue' : 'green'))]">{{ u.roleTitle }}</span></td>
                  <td>
                    <span v-if="u.role === 'teacher'" class="tag blue">{{ u.requiredJudges || 3 }} ท่าน</span>
                    <span v-else style="color:var(--text-muted);">-</span>
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <button class="btn-sm" @click="openUserModal('edit', u)" title="แก้ไขข้อมูล"><v-icon name="edit" size="12"></v-icon></button>
                    <button class="btn-sm btn-key" @click="openAccountModal(u)" title="เปลี่ยนรหัสผ่าน"><v-icon name="key" size="12"></v-icon></button>
                    <button class="btn-sm btn-del" @click="deleteUser(u.citizenId)" title="ลบผู้ใช้"><v-icon name="trash" size="12"></v-icon></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab 2: Period -->
      <div v-if="adminTab === 'period'">
        <div class="page-header">
          <div>
            <h2><v-icon name="calendar" size="18"></v-icon> กำหนดรอบการประเมินและเปิด/ปิดระบบ</h2>
            <p>ควบคุมช่วงเวลาส่งแบบประเมินตนเองและช่วงเวลาให้คะแนนของกรรมการ</p>
          </div>
        </div>
        <div class="card" style="max-width: 680px;">
          <div style="margin-bottom: 12px;">
            <label>เลือกรอบการประเมินที่จะตั้งค่า</label>
            <select v-model="selectedAdminPeriodId" @change="onAdminPeriodSelectChange" style="font-weight: 600;">
              <option v-for="p in allPeriods" :key="p.id" :value="p.id">{{ p.name }} ({{ p.isOpen ? 'เปิดรับการประเมิน' : 'ปิดระบบแล้ว' }})</option>
            </select>
          </div>
          <div style="margin-bottom: 12px;"><label>ชื่อรอบการประเมิน *</label><input v-model="period.name" required /></div>
          <div class="grid-2" style="margin-bottom: 14px;">
            <div><label>วันที่เริ่มต้น *</label><input v-model="period.startDate" type="date" required /></div>
            <div><label>วันที่สิ้นสุด *</label><input v-model="period.endDate" type="date" required /></div>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);">
              <input type="checkbox" v-model="period.isOpen" style="width: 16px; height: 16px;" />
              <div>
                <strong style="display: block;">เปิดรับการประเมินในระบบ (Open for Evaluation)</strong>
                <span style="font-size: 12px; color: var(--text-muted);">เมื่อเปิด ครูจะสามารถส่งผลประเมินตนเอง และกรรมการจะสามารถกดรับและตรวจให้คะแนนได้</span>
              </div>
            </label>
          </div>
          <button @click="savePeriod" class="btn-primary"><v-icon name="save" size="14"></v-icon><span>บันทึกการตั้งค่ารอบการประเมิน</span></button>
        </div>
      </div>

      <!-- Tab 3: Metrics -->
      <div v-if="adminTab === 'metrics'">
        <div class="page-header">
          <div>
            <h2><v-icon name="target" size="18"></v-icon> ตัวชี้วัดและเกณฑ์คะแนนประเมิน (Evaluation Metrics)</h2>
            <p>กำหนดตัวชี้วัดสำหรับรอบ: <strong>{{ period.name }}</strong></p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <select v-model="selectedAdminPeriodId" @change="onAdminPeriodSelectChange" style="width: auto; min-width: 240px; height: 32px; font-size: 12px;">
              <option v-for="p in allPeriods" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <span :class="['tag', totalMetricWeight === 100 ? 'green' : 'red']" style="font-size: 12px; padding: 4px 10px;">
              <v-icon :name="totalMetricWeight === 100 ? 'check-circle' : 'alert'" size="13"></v-icon> ผลรวมค่าน้ำหนัก: {{ totalMetricWeight }} / 100%
            </span>
          </div>
        </div>

        <!-- Category / Topic Management Card -->
        <div class="card" style="margin-bottom: 16px;">
          <div class="card-title"><v-icon name="file-text" size="14"></v-icon> จัดการหมวดหมู่ / หัวข้อการประเมิน</div>
          <div class="grid-4" style="margin-bottom: 12px;">
            <div style="grid-column: span 2;">
              <label>ชื่อหมวดหมู่ / หัวข้อการประเมิน *</label>
              <input v-model="newCategory.name" placeholder="เช่น ด้านการจัดการเรียนรู้" />
            </div>
            <div>
              <label>คำอธิบายหัวข้อ (ถ้ามี)</label>
              <input v-model="newCategory.description" placeholder="รายละเอียดโดยย่อ..." />
            </div>
            <div style="display: flex; gap: 6px; align-items: flex-end;">
              <div style="width: 70px;">
                <label>ลำดับ</label>
                <input v-model.number="newCategory.sortOrder" type="number" min="1" />
              </div>
              <button @click="addMetricCategory" class="btn-primary" style="flex: 1;">
                <v-icon name="plus" size="14"></v-icon><span>เพิ่มหัวข้อ</span>
              </button>
            </div>
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th width="60">ลำดับ</th>
                  <th>ชื่อหมวดหมู่ / หัวข้อการประเมิน</th>
                  <th>คำอธิบาย</th>
                  <th width="130" style="text-align:center;">จำนวนตัวชี้วัด</th>
                  <th width="100" style="text-align:right;">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="cat in metricCategories" :key="cat.id">
                  <td><span class="tag blue">#{{ cat.sortOrder }}</span></td>
                  <td><strong>{{ cat.name }}</strong></td>
                  <td style="font-size: 12px; color: var(--text-muted);">{{ cat.description || '-' }}</td>
                  <td style="text-align:center;"><span class="tag gray">{{ cat.metricCount || 0 }} ข้อ</span></td>
                  <td style="text-align:right; white-space: nowrap;">
                    <button class="btn-sm" @click="openEditCategoryModal(cat)" title="แก้ไขหัวข้อ"><v-icon name="edit" size="12"></v-icon></button>
                    <button class="btn-sm btn-del" @click="deleteMetricCategory(cat.id)" title="ลบหัวข้อ"><v-icon name="trash" size="12"></v-icon></button>
                  </td>
                </tr>
                <tr v-if="metricCategories.length === 0">
                  <td colspan="5" style="text-align:center; padding:12px; color:var(--text-muted);">ยังไม่มีหมวดหมู่ / หัวข้อการประเมิน</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-title"><v-icon name="plus" size="14"></v-icon> เพิ่มตัวชี้วัดใหม่</div>
          <div class="grid-4" style="margin-bottom: 10px;">
            <div>
              <label>เลือกหัวข้อการประเมิน / หมวดหมู่</label>
              <select v-model="newMetric.categoryId">
                <option value="">-- ไม่ระบุหมวดหมู่ (ทั่วไป) --</option>
                <option v-for="cat in metricCategories" :key="cat.id" :value="cat.id">
                  #{{ cat.sortOrder }} {{ cat.name }}
                </option>
              </select>
            </div>
            <div style="grid-column: span 2;"><label>ชื่อตัวชี้วัด *</label><input v-model="newMetric.title" placeholder="เช่น ด้านการจัดการเรียนรู้และการพัฒนาผู้เรียน" /></div>
            <div><label>ค่าน้ำหนัก (%) *</label><input v-model="newMetric.weight" type="number" min="1" max="100" placeholder="เช่น 40" /></div>
          </div>
          <div class="grid-3" style="margin-bottom: 12px;">
            <div>
              <label>ประเภทการประเมิน</label>
              <select v-model="newMetric.evalType">
                <option value="SCALE">ระดับคะแนน (Scale 1-4)</option>
                <option value="BOOLEAN">มี / ไม่มี (0 หรือ 4 คะแนน)</option>
              </select>
            </div>
            <div>
              <label>ประเภทหลักฐานที่ต้องแนบ</label>
              <select v-model="newMetric.evidenceType">
                <option value="PDF">เอกสาร PDF</option><option value="URL">ลิงก์เว็บไซต์ / Cloud Link</option><option value="IMAGE">ไฟล์รูปภาพ (JPG/PNG)</option>
              </select>
            </div>
            <div style="display: flex; align-items: flex-end;">
              <button @click="addMetric" class="btn-primary" style="width: 100%;"><v-icon name="plus" size="14"></v-icon><span>บันทึกตัวชี้วัด</span></button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th width="50">ข้อที่</th><th width="200">หัวข้อการประเมิน</th><th>ชื่อตัวชี้วัดและคำอธิบาย</th><th width="120">รูปแบบประเมิน</th><th width="100">หลักฐาน</th><th width="90">ค่าน้ำหนัก</th><th width="100" style="text-align: right;">จัดการ</th></tr></thead>
              <tbody>
                <tr v-for="(m, idx) in metrics" :key="m.id">
                  <td>{{ idx + 1 }}</td>
                  <td>
                    <span v-if="m.categoryName" class="tag blue">{{ m.categoryName }}</span>
                    <span v-else class="tag gray">ทั่วไป</span>
                  </td>
                  <td><strong>{{ m.title }}</strong><div v-if="m.description" style="color: var(--text-muted); font-size: 11.5px;">{{ m.description }}</div></td>
                  <td><span class="tag blue">{{ m.evalType === 'SCALE' ? 'ระดับ 1-4' : 'มี / ไม่มี' }}</span></td>
                  <td><span class="tag gray">{{ m.evidenceType }}</span></td>
                  <td><strong>{{ m.weight }}%</strong></td>
                  <td style="text-align: right; white-space: nowrap;">
                    <button class="btn-sm" @click="openEditMetricModal(m)" title="แก้ไขตัวชี้วัด"><v-icon name="edit" size="12"></v-icon></button>
                    <button class="btn-sm btn-del" @click="deleteMetric(m.id)" title="ลบตัวชี้วัด"><v-icon name="trash" size="12"></v-icon></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab 4: Departments & Department Judges -->
      <div v-if="adminTab === 'assign'">
        <div class="page-header">
          <div>
            <h2><v-icon name="target" size="18"></v-icon> สาขาวิชา คำขออนุมัติสาขาวิชา และคณะกรรมการประจำสาขา</h2>
            <p>พิจารณาคำขอเพิ่มสาขาวิชาใหม่จากบุคลากร กำหนดสาขาวิชา และแต่งตั้งกรรมการประจำสาขาวิชา</p>
          </div>
        </div>

        <div class="card" style="margin-bottom: 16px; border: 1px solid #fcd34d;">
          <div class="card-title" style="color: #b45309; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 6px;"><v-icon name="clock" size="15"></v-icon><span>คำขอเพิ่มสาขาวิชาใหม่จากบุคลากร (รอฝ่ายบุคลากร HR พิจารณาอนุมัติ)</span></div>
            <span :class="['tag', pendingDepartmentRequests.length > 0 ? 'yellow' : 'green']">รออนุมัติ {{ pendingDepartmentRequests.length }} รายการ</span>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th width="40">ลำดับ</th><th>ชื่อ - นามสกุล ผู้ขอ</th><th>ข้อมูลติดต่อ</th><th>สาขาวิชาที่ขอเพิ่มใหม่</th><th width="130">รหัสสาขา (ถ้ามี)</th><th width="210" style="text-align: right;">การพิจารณาของ HR</th></tr></thead>
              <tbody>
                <tr v-for="(reqItem, idx) in pendingDepartmentRequests" :key="reqItem.id">
                  <td>{{ idx + 1 }}</td>
                  <td><strong>{{ reqItem.name }}</strong><div style="font-size: 11px; color: var(--text-muted);">เลขบัตร: {{ reqItem.citizenId }} | {{ reqItem.position || 'ครูผู้ช่วย' }}</div></td>
                  <td style="font-size: 11.5px;"><div>{{ reqItem.phone || '-' }}</div><div style="color: var(--text-muted);">{{ reqItem.email || '' }}</div></td>
                  <td><span class="tag yellow" style="font-size: 12.5px; padding: 4px 10px;">{{ reqItem.requestedDepartment }}</span></td>
                  <td><input v-model="approveDeptCodes[reqItem.id]" placeholder="เช่น ELEC" style="height: 28px; font-size: 12px;" /></td>
                  <td style="text-align: right; white-space: nowrap;">
                    <button type="button" class="btn-success btn-sm" style="margin-right: 6px;" @click="approveDepartmentRequest(reqItem)"><v-icon name="check" size="12"></v-icon><span>อนุมัติสาขา</span></button>
                    <button type="button" class="btn-sm btn-del" @click="openRejectDeptModal(reqItem)"><v-icon name="close" size="12"></v-icon><span>ไม่อนุมัติ</span></button>
                  </td>
                </tr>
                <tr v-if="pendingDepartmentRequests.length === 0"><td colspan="6" style="text-align: center; padding: 14px; color: var(--text-muted);">ไม่มีคำขอเพิ่มสาขาวิชาใหม่ที่รอการอนุมัติในขณะนี้</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" style="margin-bottom: 16px;">
          <div class="card-title"><v-icon name="plus" size="14"></v-icon> จัดการสาขาวิชา / แผนกการเรียนรู้</div>
          <div class="grid-3" style="margin-bottom: 12px;">
            <div><label>ชื่อสาขาวิชา / แผนก *</label><input v-model="newDept.name" placeholder="เช่น แผนกวิชาเทคโนโลยีสารสนเทศ" /></div>
            <div><label>รหัสสาขาวิชา (Code)</label><input v-model="newDept.code" placeholder="เช่น IT" /></div>
            <div style="display: flex; align-items: flex-end;"><button @click="addDepartment" class="btn-primary" style="width: 100%;"><v-icon name="plus" size="14"></v-icon><span>เพิ่มสาขาวิชา</span></button></div>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th width="40">ลำดับ</th><th width="100">รหัสสาขา</th><th>ชื่อสาขาวิชา / แผนก</th><th width="120" style="text-align: center;">ครูในสังกัด</th><th width="150" style="text-align: center;">กรรมการประจำสาขา</th><th width="80" style="text-align: right;">จัดการ</th></tr></thead>
              <tbody>
                <tr v-for="(d, idx) in departmentsList" :key="d.id">
                  <td>{{ idx + 1 }}</td><td><span class="tag gray">{{ d.code || '-' }}</span></td><td><strong>{{ d.name }}</strong></td>
                  <td style="text-align: center;"><span class="tag blue">{{ d.teacherCount || 0 }} คน</span></td>
                  <td style="text-align: center;"><span class="tag green">{{ d.judgeCount || 0 }} ท่าน</span></td>
                  <td style="text-align: right;"><button class="btn-sm btn-del" @click="removeDepartment(d.id)" title="ลบสาขาวิชา"><v-icon name="trash" size="12"></v-icon></button></td>
                </tr>
                <tr v-if="departmentsList.length === 0"><td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">ยังไม่มีข้อมูลสาขาวิชา</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-title"><v-icon name="user" size="14"></v-icon> แต่งตั้งคณะกรรมการประจำสาขาวิชา</div>
          <div class="grid-4" style="margin-bottom: 12px;">
            <div>
              <label>เลือกสาขาวิชา / แผนก *</label>
              <select v-model="newDeptJudge.departmentName">
                <option value="" disabled>-- เลือกสาขาวิชา --</option>
                <option v-for="d in departmentsList" :key="d.id" :value="d.name">{{ d.name }}</option>
              </select>
            </div>
            <div>
              <label>เลือกกรรมการผู้ประเมิน *</label>
              <select v-model="newDeptJudge.judgeCitizenId">
                <option value="" disabled>-- เลือกกรรมการ --</option>
                <option v-for="j in judges" :key="j.citizenId" :value="j.citizenId">{{ j.name }} ({{ j.position || 'กรรมการ' }})</option>
              </select>
            </div>
            <div>
              <label>บทบาทในคณะกรรมการ</label>
              <select v-model="newDeptJudge.roleInBoard">
                <option value="ประธานกรรมการ">ประธานกรรมการ</option><option value="กรรมการผู้ทรงคุณวุฒิ">กรรมการผู้ทรงคุณวุฒิ</option>
                <option value="กรรมการและเลขานุการ">กรรมการและเลขานุการ</option><option value="กรรมการ">กรรมการ</option>
              </select>
            </div>
            <div style="display: flex; align-items: flex-end;">
              <button @click="assignJudgeToDepartment" class="btn-primary" style="width: 100%;"><v-icon name="check-circle" size="14"></v-icon><span>แต่งตั้งกรรมการ</span></button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th width="40">ลำดับ</th><th>สาขาวิชา / แผนก</th><th>กรรมการผู้ประเมิน</th><th>ตำแหน่ง</th><th>บทบาทหน้าที่</th><th width="90" style="text-align: right;">จัดการ</th></tr></thead>
              <tbody>
                <tr v-for="(dj, idx) in departmentJudgesList" :key="dj.id">
                  <td>{{ idx + 1 }}</td><td><strong>{{ dj.departmentName }}</strong></td><td><strong>{{ dj.judgeName }}</strong></td>
                  <td><small style="color:var(--text-muted);">{{ dj.judgePosition || 'กรรมการ' }}</small></td>
                  <td><span class="tag blue">{{ dj.roleInBoard }}</span></td>
                  <td style="text-align: right;"><button class="btn-sm btn-del" @click="removeJudgeFromDepartment(dj.id)" title="ถอดถอนกรรมการ"><v-icon name="trash" size="12"></v-icon></button></td>
                </tr>
                <tr v-if="departmentJudgesList.length === 0"><td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">ยังไม่ได้แต่งตั้งกรรมการประจำสาขาวิชา</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab 5: Tracking & Reports -->
      <div v-if="adminTab === 'track'">
        <div class="page-header">
          <div>
            <h2><v-icon name="bar-chart" size="18"></v-icon> ติดตามสถานะแบบละเอียด & สรุปผลคะแนน</h2>
            <p>รอบการประเมิน: <strong>{{ period.name }}</strong> — ติดตามสถานะการส่งงาน การกดรับของกรรมการ สถิติภาพรวม และรายงานรายบุคคล</p>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <select v-model="selectedAdminPeriodId" @change="onAdminPeriodSelectChange" style="width: auto; min-width: 240px; height: 32px; font-size: 12px;">
              <option v-for="p in allPeriods" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <button @click="triggerPrintOverallReport" class="btn-primary"><v-icon name="printer" size="14"></v-icon><span>พิมพ์รายงานสรุปภาพรวมสถานศึกษา (PDF)</span></button>
          </div>
        </div>

        <!-- Overview KPI Cards -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-card-icon blue"><v-icon name="users" size="18"></v-icon></div>
            <div class="stat-card-info">
              <span>ผู้รับการประเมิน (ส่งแล้ว / ทั้งหมด)</span>
              <strong>{{ hrStats.submittedTeachers || 0 }} / {{ hrStats.totalTeachers || 0 }} คน</strong>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card-icon amber"><v-icon name="clock" size="18"></v-icon></div>
            <div class="stat-card-info">
              <span>รับงานครบโควตา / ตรวจเสร็จสมบูรณ์</span>
              <strong>{{ hrStats.fullyClaimedTeachers || 0 }} / {{ hrStats.fullyEvaluatedTeachers || 0 }} คน</strong>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card-icon green"><v-icon name="check-circle" size="18"></v-icon></div>
            <div class="stat-card-info">
              <span>ความสำเร็จภาพรวม / งานกรรมการเสร็จสิ้น</span>
              <strong>{{ hrStats.completionRate || 0 }}% ({{ hrStats.completedAssignments || 0 }}/{{ hrStats.totalAssignments || 0 }})</strong>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card-icon sky"><v-icon name="award" size="18"></v-icon></div>
            <div class="stat-card-info">
              <span>คะแนนเฉลี่ยรวม (ต่ำสุด–สูงสุด)</span>
              <strong>{{ hrStats.averageScore ? hrStats.averageScore + ' / 4.00' : '- / 4.00' }}</strong>
              <div v-if="hrStats.minScore !== null && hrStats.maxScore !== null" style="font-size:11px; color:var(--text-muted);">
                ช่วงคะแนน: {{ hrStats.minScore }} – {{ hrStats.maxScore }}
              </div>
            </div>
          </div>
        </div>

        <!-- Grade Distribution & Department Breakdown -->
        <div class="grid-2" style="margin-bottom: 16px;">
          <div class="card" style="margin-bottom: 0;">
            <div class="card-title"><v-icon name="award" size="14"></v-icon> สถิติการกระจายระดับผลการประเมิน</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
              <div v-for="(cnt, gradeName) in (hrStats.gradeDistribution || {})" :key="gradeName"
                   style="flex:1; min-width:86px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px; text-align:center;">
                <div style="font-size:11.5px; color:var(--text-muted);">{{ gradeName }}</div>
                <strong style="font-size:17px; color:var(--primary);">{{ cnt }}</strong>
                <div style="font-size:10.5px; color:var(--text-muted);">คน</div>
              </div>
            </div>
          </div>

          <div class="card" style="margin-bottom: 0;">
            <div class="card-title"><v-icon name="building" size="14"></v-icon> สรุปสถิติภาพรวมแยกตามแผนก / สาขาวิชา</div>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>สาขาวิชา</th>
                    <th width="70" style="text-align:center;">ครู</th>
                    <th width="70" style="text-align:center;">ส่งแล้ว</th>
                    <th width="80" style="text-align:center;">ตรวจครบ</th>
                    <th width="90" style="text-align:right;">เฉลี่ย</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ds in (hrStats.departmentStats || [])" :key="ds.department">
                    <td><strong>{{ ds.department }}</strong></td>
                    <td style="text-align:center;">{{ ds.teacherCount }}</td>
                    <td style="text-align:center;">{{ ds.submittedCount }}</td>
                    <td style="text-align:center;">{{ ds.evaluatedTeacherCount }}</td>
                    <td style="text-align:right;"><strong>{{ ds.avgScore ? ds.avgScore + '/4' : '-' }}</strong></td>
                  </tr>
                  <tr v-if="!hrStats.departmentStats || hrStats.departmentStats.length === 0">
                    <td colspan="5" style="text-align:center; padding:12px; color:var(--text-muted);">ยังไม่มีข้อมูลสถิติรายสาขา</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Detailed Tracking Sub-Navigation -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid var(--border);">
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button :class="['btn-sm', trackingSubTab === 'pipeline' ? 'active' : '']" @click="trackingSubTab = 'pipeline'">
                <v-icon name="user" size="12"></v-icon><span>1. ติดตามผู้รับการประเมินรายบุคคล ({{ filteredTrackingEvaluatees.length }})</span>
              </button>
              <button :class="['btn-sm', trackingSubTab === 'judges' ? 'active' : '']" @click="trackingSubTab = 'judges'">
                <v-icon name="users" size="12"></v-icon><span>2. ติดตามสถานะกรรมการแต่ละคน ({{ filteredTrackingJudges.length }})</span>
              </button>
              <button :class="['btn-sm', trackingSubTab === 'assignments' ? 'active' : '']" @click="trackingSubTab = 'assignments'">
                <v-icon name="file-text" size="12"></v-icon><span>3. ประวัติการรับงานและผลคะแนนทั้งหมด ({{ assignments.length }})</span>
              </button>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <select v-if="trackingSubTab === 'pipeline'" v-model="trackingStageFilter" style="width:auto; height:30px; font-size:12px;">
                <option value="ALL">ทุกขั้นตอนสถานะ</option>
                <option value="SELF_DRAFT">ยังไม่ส่งแบบประเมิน</option>
                <option value="WAITING_CLAIM">ส่งแล้ว รอกรรมการกดรับ</option>
                <option value="PARTIAL_CLAIM">กรรมการรับบางส่วน</option>
                <option value="CLAIMED_FULL">กรรมการรับครบ รอตรวจ</option>
                <option value="PARTIAL_EVALUATED">ตรวจแล้วบางส่วน</option>
                <option value="COMPLETED">ประเมินเสร็จสมบูรณ์</option>
              </select>
              <div style="position: relative; width: 220px;">
                <input v-model="trackingSearchQuery" placeholder="ค้นหาชื่อ, เลขบัตร, สาขา..." style="padding-left: 28px; height: 30px; font-size: 12px;" />
                <v-icon name="search" size="13" style="position: absolute; left: 9px; top: 8px; color: var(--text-muted);"></v-icon>
              </div>
            </div>
          </div>

          <!-- Sub-tab 1: Detailed Evaluatee Pipeline Tracking -->
          <div v-if="trackingSubTab === 'pipeline'" class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th width="40">ลำดับ</th>
                  <th>ผู้รับการประเมิน</th>
                  <th width="140">ความคืบหน้าตนเอง</th>
                  <th width="170">ความคืบหน้ากรรมการ (รับ/ตรวจ)</th>
                  <th width="160">สถานะขั้นตอนปัจจุบัน</th>
                  <th>รายชื่อกรรมการที่กดรับแล้ว</th>
                  <th width="90">คะแนนเฉลี่ย</th>
                  <th width="130" style="text-align:right;">ติดตามรายบุคคล</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(ev, idx) in filteredTrackingEvaluatees" :key="ev.citizenId">
                  <td>{{ idx + 1 }}</td>
                  <td>
                    <strong>{{ ev.name }}</strong>
                    <div style="font-size:11.5px; color:var(--text-muted);">{{ ev.department || ev.requestedDepartment || '-' }}</div>
                  </td>
                  <td>
                    <div style="font-size:11.5px; margin-bottom:2px;">
                      <span :class="['tag', ev.submissionStatus === 'SUBMITTED' ? 'green' : 'yellow']">
                        {{ ev.submissionStatus === 'SUBMITTED' ? 'ส่งแล้ว' : 'ยังไม่ส่ง' }}
                      </span>
                      <span style="margin-left:4px; font-weight:600;">{{ ev.selfProgress }}%</span>
                    </div>
                    <div style="font-size:10.5px; color:var(--text-muted);">กรอกแล้ว {{ ev.selfMetricDoneCount }}/{{ ev.totalMetricsCount }} ข้อ</div>
                  </td>
                  <td>
                    <div style="font-size:12px;">
                      รับแล้ว <strong>{{ ev.claimedJudgesCount }}/{{ ev.requiredJudges }}</strong> ท่าน
                    </div>
                    <div style="font-size:11px; color:var(--text-muted);">
                      ตรวจเสร็จ {{ ev.evaluatedJudgesCount }} ท่าน (ขาดอีก {{ ev.remainingSlots }})
                    </div>
                  </td>
                  <td>
                    <span :class="['tag', ev.workflowStage === 'COMPLETED' ? 'green' : (ev.workflowStage === 'SELF_DRAFT' || ev.workflowStage === 'DEPT_PENDING' || ev.workflowStage === 'DEPT_REJECTED' ? 'yellow' : 'blue')]">
                      {{ ev.workflowLabel }}
                    </span>
                  </td>
                  <td>
                    <div v-if="ev.judges && ev.judges.length > 0" style="display:flex; flex-direction:column; gap:3px;">
                      <div v-for="j in ev.judges" :key="j.assignmentId" style="font-size:11.5px; display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                        <span>• {{ j.judgeName }}</span>
                        <span :class="['tag', j.status === 'EVALUATED' ? 'green' : 'sky']" style="font-size:10px; padding:1px 6px;">
                          {{ j.status === 'EVALUATED' ? ('ตรวจแล้ว ' + j.totalScore) : 'รับแล้วรอตรวจ' }}
                        </span>
                      </div>
                    </div>
                    <span v-else style="font-size:11.5px; color:var(--text-muted);">ยังไม่มีกรรมการกดรับ</span>
                  </td>
                  <td>
                    <strong style="color:var(--primary);">{{ ev.averageScore ? ev.averageScore + ' / 4.00' : '-' }}</strong>
                    <div v-if="ev.grade" style="font-size:11px; color:var(--success); font-weight:600;">{{ ev.grade }}</div>
                  </td>
                  <td style="text-align:right;">
                    <button class="btn-primary btn-sm" @click="openIndividualTrackingModal(ev.citizenId)">
                      <v-icon name="eye" size="12"></v-icon><span>ดูรายละเอียด</span>
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredTrackingEvaluatees.length === 0">
                  <td colspan="8" style="text-align:center; padding:16px; color:var(--text-muted);">ไม่พบข้อมูลผู้รับการประเมินตามเงื่อนไขที่ค้นหา</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Sub-tab 2: Individual Judge Status Tracking -->
          <div v-else-if="trackingSubTab === 'judges'" class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th width="40">ลำดับ</th>
                  <th>กรรมการผู้ประเมิน</th>
                  <th>สาขาวิชาที่ได้รับแต่งตั้งในรอบนี้</th>
                  <th width="140" style="text-align:center;">กดรับแล้ว (รอตรวจ / ตรวจแล้ว)</th>
                  <th width="90" style="text-align:center;">คะแนนเฉลี่ยที่ให้</th>
                  <th>รายชื่อผู้รับการประเมินที่รับดูแลอยู่</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(jg, idx) in filteredTrackingJudges" :key="jg.citizenId">
                  <td>{{ idx + 1 }}</td>
                  <td>
                    <strong>{{ jg.name }}</strong>
                    <div style="font-size:11px; color:var(--text-muted);">{{ jg.position || 'กรรมการ' }} | {{ jg.citizenId }}</div>
                  </td>
                  <td>
                    <div v-if="jg.assignedDepartments && jg.assignedDepartments.length > 0" style="display:flex; gap:4px; flex-wrap:wrap;">
                      <span v-for="(d, dIdx) in jg.assignedDepartments" :key="dIdx" class="tag blue">
                        {{ d.departmentName }} ({{ d.roleInBoard }})
                      </span>
                    </div>
                    <span v-else style="font-size:11.5px; color:var(--text-muted);">ยังไม่ได้แต่งตั้งประจำสาขา</span>
                  </td>
                  <td style="text-align:center;">
                    <span class="tag sky">รอตรวจ {{ jg.claimedPendingCount }}</span>
                    <span class="tag green" style="margin-left:4px;">เสร็จ {{ jg.evaluatedCount }}</span>
                  </td>
                  <td style="text-align:center;"><strong>{{ jg.averageGivenScore ? jg.averageGivenScore + ' / 4' : '-' }}</strong></td>
                  <td>
                    <div v-if="jg.assignments && jg.assignments.length > 0" style="display:flex; flex-direction:column; gap:3px;">
                      <div v-for="a in jg.assignments" :key="a.assignmentId" style="font-size:11.5px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span>• <strong>{{ a.teacherName }}</strong> ({{ a.teacherDepartment || '-' }})</span>
                        <span :class="['tag', a.status === 'EVALUATED' ? 'green' : 'yellow']" style="font-size:10px; padding:1px 6px;">
                          {{ a.status === 'EVALUATED' ? ('ตรวจแล้ว ' + a.totalScore + '/4') : 'รับแล้วรอตรวจ' }}
                        </span>
                        <button type="button" class="btn-sm" style="height:20px; font-size:10.5px; padding:0 6px;" @click="openIndividualTrackingModal(a.teacherCitizenId)">
                          ติดตาม
                        </button>
                      </div>
                    </div>
                    <span v-else style="font-size:11.5px; color:var(--text-muted);">ยังไม่ได้กดรับผู้รับการประเมิน</span>
                  </td>
                </tr>
                <tr v-if="filteredTrackingJudges.length === 0">
                  <td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">ไม่พบข้อมูลกรรมการตามเงื่อนไขที่ค้นหา</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Sub-tab 3: Raw Assignment Timeline & PDF -->
          <div v-else class="table-wrap">
            <table class="table">
              <thead><tr><th width="40">ลำดับ</th><th>ผู้รับการประเมิน</th><th>สังกัด / แผนกวิชา</th><th>กรรมการตรวจประเมิน</th><th width="130">เวลาที่กดรับ</th><th width="110">สถานะ</th><th width="90">คะแนนรวม</th><th width="150" style="text-align: right;">จัดการ / รายงาน</th></tr></thead>
              <tbody>
                <tr v-for="(a, idx) in assignments" :key="a.id">
                  <td>{{ idx + 1 }}</td>
                  <td><strong>{{ a.teacherName }}</strong></td>
                  <td>{{ a.teacherDepartment }}</td>
                  <td>{{ a.judgeName }}</td>
                  <td style="font-size:11px; color:var(--text-muted);">{{ a.claimedAt ? new Date(a.claimedAt).toLocaleString('th-TH') : '-' }}</td>
                  <td>
                    <span v-if="a.status === 'EVALUATED'" class="tag green"><v-icon name="check-circle" size="11"></v-icon> ตรวจแล้ว</span>
                    <span v-else-if="a.status === 'CLAIMED' || a.status === 'SUBMITTED'" class="tag blue"><v-icon name="clock" size="11"></v-icon> กดรับแล้วรอตรวจ</span>
                    <span v-else class="tag yellow"><v-icon name="clock" size="11"></v-icon> รอส่ง</span>
                  </td>
                  <td><strong>{{ a.totalScore ? a.totalScore + ' / 4.00' : '-' }}</strong></td>
                  <td style="text-align: right; white-space:nowrap;">
                    <button class="btn-sm" style="margin-right:4px;" @click="openIndividualTrackingModal(a.teacherCitizenId)" title="ดูติดตามรายบุคคล"><v-icon name="eye" size="12"></v-icon></button>
                    <button class="btn-sm" @click="openIndividualReportModal(a)"><v-icon name="file-text" size="12"></v-icon><span>PDF</span></button>
                  </td>
                </tr>
                <tr v-if="assignments.length === 0">
                  <td colspan="8" style="text-align:center; padding:16px; color:var(--text-muted);">ยังไม่มีรายการกดรับการประเมินในรอบนี้</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
};
