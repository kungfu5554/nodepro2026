import { getPerformanceGrade } from '../utils/formatters.js';
import {
  currentUser, period, metricCategories, showReportModal, selectedReportItem,
  openIndividualReportModal, triggerPrintFromModal
} from '../composables/useAppState.js';
import {
  showProfileModal, profileForm, profileDepartmentOptions
} from '../composables/useAuth.js';
import {
  showUserModal, userModalMode, userModalForm, adminUserDepartmentOptions,
  showAccountModal, accountTargetUser, accountForm, showEditMetricModal,
  editMetricForm, showEditCategoryModal, editCategoryForm,
  showTrackingDetailModal, trackingDetailLoading, selectedTrackingDetail,
  showRejectDeptModal, rejectDeptTarget, rejectDeptReason
} from '../composables/useAdmin.js';
import {
  showEditSelfWarningModal, teacherJudgeEvaluations
} from '../composables/useTeacher.js';

export default {
  name: 'AppModals',
  props: {
    authActions: Object,
    adminActions: Object,
    teacherActions: Object
  },
  setup(props) {
    return {
      currentUser,
      period,
      metricCategories,
      showReportModal,
      selectedReportItem,
      openIndividualReportModal,
      triggerPrintFromModal,
      showProfileModal,
      profileForm,
      profileDepartmentOptions,
      showUserModal,
      userModalMode,
      userModalForm,
      adminUserDepartmentOptions,
      showAccountModal,
      accountTargetUser,
      accountForm,
      showEditMetricModal,
      editMetricForm,
      showEditCategoryModal,
      editCategoryForm,
      showTrackingDetailModal,
      trackingDetailLoading,
      selectedTrackingDetail,
      showRejectDeptModal,
      rejectDeptTarget,
      rejectDeptReason,
      showEditSelfWarningModal,
      teacherJudgeEvaluations,
      getPerformanceGrade,
      saveOwnProfile: props.authActions.saveOwnProfile,
      saveUserModal: props.adminActions.saveUserModal,
      saveAccountModal: props.adminActions.saveAccountModal,
      saveEditMetric: props.adminActions.saveEditMetric,
      saveEditCategory: props.adminActions.saveEditCategory,
      confirmRejectDepartmentRequest: props.adminActions.confirmRejectDepartmentRequest,
      confirmUnlockSelfEval: props.teacherActions.confirmUnlockSelfEval
    };
  },
  template: `
    <div>
      <!-- 1. Profile Modal -->
      <div v-if="showProfileModal" class="modal-overlay">
        <div class="modal-content wide">
          <div class="modal-header">
            <h3>แก้ไขข้อมูลส่วนตัว (Edit Profile)</h3>
            <button @click="showProfileModal = false" class="btn-sm" title="ปิด">✕</button>
          </div>
          <form @submit.prevent="saveOwnProfile" class="modal-body">
            <div class="grid-3" style="margin-bottom: 10px;">
              <div>
                <label>คำนำหน้า *</label>
                <select v-model="profileForm.prefix" required>
                  <option value="นาย">นาย</option>
                  <option value="นาง">นาง</option>
                  <option value="นางสาว">นางสาว</option>
                  <option value="ดร.">ดร.</option>
                  <option value="ผศ.ดร.">ผศ.ดร.</option>
                </select>
              </div>
              <div style="grid-column: span 2;">
                <label>ชื่อ-นามสกุล *</label>
                <input v-model="profileForm.name" required />
              </div>
            </div>

            <div class="grid-2" style="margin-bottom: 10px;">
              <div>
                <label>เลขประจำตัวประชาชน (แก้ไขไม่ได้)</label>
                <input :value="currentUser ? currentUser.citizenId : ''" disabled style="background: #f1f5f9; color: #64748b;" />
              </div>
              <div>
                <label>เลขประจำตัวข้าราชการ/พนักงาน</label>
                <input v-model="profileForm.employeeId" placeholder="เช่น T-6801" />
              </div>
            </div>

            <div class="grid-2" style="margin-bottom: 10px;">
              <div>
                <label>สาขาวิชา / สังกัดหน่วยงาน *</label>
                <select v-model="profileForm.departmentSelect" required>
                  <option value="" disabled>-- เลือกสาขาวิชา / สังกัด --</option>
                  <option v-for="dept in profileDepartmentOptions" :key="dept" :value="dept">{{ dept }}</option>
                  <option value="__CUSTOM__">
                    {{ currentUser && currentUser.role === 'teacher' ? '+ ขอเพิ่มสาขาวิชาใหม่ (ส่งให้ HR อนุมัติ)' : '+ ระบุสังกัดใหม่' }}
                  </option>
                </select>
              </div>
              <div>
                <label>ตำแหน่งปัจจุบัน</label>
                <input v-model="profileForm.position" />
              </div>
            </div>

            <div v-if="profileForm.departmentSelect === '__CUSTOM__'" style="margin-bottom: 10px; padding: 10px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: var(--radius-sm);">
              <label style="color: #92400e; font-weight: 700;">ระบุชื่อสาขาวิชาใหม่ *</label>
              <input v-model="profileForm.customDepartment" placeholder="เช่น แผนกวิชาอิเล็กทรอนิกส์" required style="margin-top: 4px;" />
              <div v-if="currentUser && currentUser.role === 'teacher'" style="font-size: 11.5px; color: #b45309; margin-top: 4px;">
                หมายเหตุ: การขอเพิ่มสาขาวิชาใหม่จะต้องรอฝ่ายบุคลากร (HR) อนุมัติก่อน
              </div>
            </div>

            <div class="grid-2" style="margin-bottom: 12px;">
              <div>
                <label>เบอร์โทรศัพท์มือถือ (10 หลัก)</label>
                <input
                  v-model="profileForm.phone"
                  @input="profileForm.phone = profileForm.phone.replace(/\D/g, '').slice(0, 10)"
                  maxlength="10"
                  inputmode="numeric"
                  placeholder="ตัวเลข 10 หลัก เช่น 0812345678" />
              </div>
              <div>
                <label>อีเมลติดต่อ</label>
                <input v-model="profileForm.email" type="email" placeholder="เช่น somchai@school.ac.th" />
              </div>
            </div>

            <div style="border-top: 1px solid var(--border); padding-top: 10px; margin-bottom: 10px;">
              <label>เปลี่ยนรหัสผ่านใหม่ (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)</label>
              <input v-model="profileForm.password" type="password" placeholder="ระบุรหัสผ่านใหม่อย่างน้อย 4 ตัวอักษร" />
            </div>

            <div class="modal-footer" style="margin: 10px -18px -16px -18px;">
              <button type="button" @click="showProfileModal = false" class="btn-outline">ยกเลิก</button>
              <button type="submit" class="btn-primary">บันทึกข้อมูลส่วนตัว</button>
            </div>
          </form>
        </div>
      </div>

      <!-- 2. User Add / Edit Modal -->
      <div v-if="showUserModal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>{{ userModalMode === 'add' ? 'เพิ่มผู้ใช้งานใหม่' : 'แก้ไขข้อมูลบุคลากร' }}</h3>
            <button @click="showUserModal = false" class="btn-sm" title="ปิด">✕</button>
          </div>
          <form @submit.prevent="saveUserModal" class="modal-body">
            <div style="margin-bottom: 10px;">
              <label>บทบาทหน้าที่ (Role) *</label>
              <select v-model="userModalForm.role" required>
                <option value="teacher">ผู้รับการประเมิน (ครู / Evaluatee)</option>
                <option value="judge">กรรมการผู้ประเมิน (Judge)</option>
                <option value="hr">เจ้าหน้าที่ฝ่ายบุคลากร (HR)</option>
                <option value="admin">ผู้ดูแลระบบ (Admin)</option>
              </select>
            </div>

            <div class="grid-2" style="margin-bottom: 10px;">
              <div>
                <label>คำนำหน้า</label>
                <select v-model="userModalForm.prefix">
                  <option value="นาย">นาย</option>
                  <option value="นาง">นาง</option>
                  <option value="นางสาว">นางสาว</option>
                  <option value="ดร.">ดร.</option>
                  <option value="ผศ.ดร.">ผศ.ดร.</option>
                </select>
              </div>
              <div>
                <label>ชื่อ-นามสกุล *</label>
                <input v-model="userModalForm.name" required />
              </div>
            </div>

            <div style="margin-bottom: 10px;">
              <label>เลขประจำตัวประชาชน (13 หลัก) *</label>
              <input
                v-model="userModalForm.citizenId"
                @input="userModalForm.citizenId = userModalForm.citizenId.replace(/\D/g, '').slice(0, 13)"
                maxlength="13"
                inputmode="numeric"
                placeholder="ตัวเลข 13 หลัก"
                :disabled="userModalMode === 'edit'"
                required />
            </div>

            <div class="grid-2" style="margin-bottom: 10px;">
              <div>
                <label>สาขาวิชา / สังกัดหน่วยงาน *</label>
                <select v-model="userModalForm.departmentSelect" required>
                  <option value="" disabled>-- เลือกสาขาวิชา / สังกัด --</option>
                  <option v-for="d in adminUserDepartmentOptions" :key="d" :value="d">{{ d }}</option>
                  <option value="__CUSTOM__">+ เพิ่มสาขาวิชาใหม่</option>
                </select>
              </div>
              <div>
                <label>ตำแหน่ง</label>
                <input v-model="userModalForm.position" />
              </div>
            </div>

            <div v-if="userModalForm.departmentSelect === '__CUSTOM__'" style="margin-bottom: 10px;">
              <label>ระบุชื่อสาขาวิชาใหม่ (อนุมัติทันที) *</label>
              <input v-model="userModalForm.customDepartment" placeholder="เช่น แผนกวิชาอิเล็กทรอนิกส์" required />
            </div>

            <div v-if="userModalMode === 'add'" style="margin-bottom: 10px;">
              <label>รหัสผ่านเริ่มต้น *</label>
              <input v-model="userModalForm.password" type="password" required />
            </div>

            <div class="modal-footer" style="margin: 10px -18px -16px -18px;">
              <button type="button" @click="showUserModal = false" class="btn-outline">ยกเลิก</button>
              <button type="submit" class="btn-primary">บันทึกข้อมูล</button>
            </div>
          </form>
        </div>
      </div>

      <!-- 3. Reset Password Modal -->
      <div v-if="showAccountModal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>เปลี่ยนรหัสผ่าน: {{ accountTargetUser ? accountTargetUser.name : '' }}</h3>
            <button @click="showAccountModal = false" class="btn-sm" title="ปิด">✕</button>
          </div>
          <form @submit.prevent="saveAccountModal" class="modal-body">
            <div style="margin-bottom: 10px;">
              <label>รหัสผ่านใหม่ *</label>
              <input v-model="accountForm.password" type="password" required placeholder="อย่างน้อย 4 ตัวอักษร" />
            </div>
            <div style="margin-bottom: 10px;">
              <label>ยืนยันรหัสผ่านใหม่ *</label>
              <input v-model="accountForm.confirmPassword" type="password" required placeholder="กรอกรหัสผ่านซ้ำ" />
            </div>
            <div class="modal-footer" style="margin: 10px -18px -16px -18px;">
              <button type="button" @click="showAccountModal = false" class="btn-outline">ยกเลิก</button>
              <button type="submit" class="btn-primary">บันทึกรหัสผ่าน</button>
            </div>
          </form>
        </div>
      </div>

      <!-- 4. Edit Metric Modal -->
      <div v-if="showEditMetricModal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>แก้ไขตัวชี้วัดการประเมิน</h3>
            <button @click="showEditMetricModal = false" class="btn-sm" title="ปิด">✕</button>
          </div>
          <form @submit.prevent="saveEditMetric" class="modal-body">
            <div style="margin-bottom: 10px;">
              <label>หัวข้อการประเมิน / หมวดหมู่</label>
              <select v-model="editMetricForm.categoryId">
                <option value="">-- ไม่ระบุหมวดหมู่ (ทั่วไป) --</option>
                <option v-for="cat in metricCategories" :key="cat.id" :value="cat.id">
                  #{{ cat.sortOrder }} {{ cat.name }}
                </option>
              </select>
            </div>
            <div style="margin-bottom: 10px;">
              <label>ชื่อตัวชี้วัด *</label>
              <input v-model="editMetricForm.title" required />
            </div>
            <div style="margin-bottom: 10px;">
              <label>คำอธิบายเพิ่มเติม</label>
              <textarea v-model="editMetricForm.description" rows="2"></textarea>
            </div>
            <div class="grid-3" style="margin-bottom: 10px;">
              <div>
                <label>ค่าน้ำหนัก (%) *</label>
                <input v-model="editMetricForm.weight" type="number" min="1" max="100" required />
              </div>
              <div>
                <label>รูปแบบประเมิน</label>
                <select v-model="editMetricForm.evalType">
                  <option value="SCALE">ระดับ 1-4</option>
                  <option value="BOOLEAN">มี / ไม่มี</option>
                </select>
              </div>
              <div>
                <label>ประเภทหลักฐาน</label>
                <select v-model="editMetricForm.evidenceType">
                  <option value="PDF">PDF</option>
                  <option value="URL">URL</option>
                  <option value="IMAGE">IMAGE</option>
                </select>
              </div>
            </div>
            <div class="modal-footer" style="margin: 10px -18px -16px -18px;">
              <button type="button" @click="showEditMetricModal = false" class="btn-outline">ยกเลิก</button>
              <button type="submit" class="btn-primary">บันทึกการแก้ไข</button>
            </div>
          </form>
        </div>
      </div>

      <!-- 5. Report Preview Modal -->
      <div v-if="showReportModal" class="modal-overlay">
        <div class="modal-content wide">
          <div class="modal-header">
            <h3>รายงานสรุปผลการประเมินผลการปฏิบัติงานรายบุคคล</h3>
            <button @click="showReportModal = false" class="btn-sm" title="ปิด">✕</button>
          </div>
          <div class="modal-body">
            <div style="text-align: center; margin-bottom: 16px;">
              <h4 style="font-size: 15px; font-weight: 700;">แบบสรุปรายงานผลการประเมินผลการปฏิบัติงาน</h4>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                {{ selectedReportItem ? selectedReportItem.periodName || period.name : period.name }}
              </div>
            </div>

            <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 14px;">
              <div class="grid-2" style="font-size: 12.5px;">
                <div>ผู้รับการประเมิน: <strong>{{ selectedReportItem ? selectedReportItem.teacherName : '-' }}</strong></div>
                <div>สังกัด / แผนก: <strong>{{ selectedReportItem ? (selectedReportItem.department || selectedReportItem.teacherDepartment) : '-' }}</strong></div>
                <div>กรรมการผู้ประเมิน: <strong>{{ selectedReportItem ? selectedReportItem.judgeName : '-' }}</strong></div>
                <div>บทบาท: <strong>{{ selectedReportItem ? selectedReportItem.roleInBoard : '-' }}</strong></div>
              </div>
            </div>

            <div class="table-wrap" style="margin-bottom: 14px;">
              <table class="table">
                <thead>
                  <tr>
                    <th width="40">ข้อ</th>
                    <th>ตัวชี้วัดการประเมิน</th>
                    <th width="80">น้ำหนัก</th>
                    <th>ความคิดเห็นครู</th>
                    <th width="95">คะแนนตนเอง</th>
                    <th width="105">คะแนนกรรมการ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(m, idx) in (selectedReportItem && selectedReportItem.metricsRows ? selectedReportItem.metricsRows : [])" :key="m.id">
                    <td>{{ idx + 1 }}</td>
                    <td>
                      <strong>{{ m.title }}</strong>
                      <div v-if="m.description" style="font-size: 11px; color: var(--text-muted);">{{ m.description }}</div>
                    </td>
                    <td>{{ m.weight }}%</td>
                    <td style="font-size: 12px;">{{ m.teacherComment || '-' }}</td>
                    <td>{{ m.selfScoreDisplay || '-' }}</td>
                    <td><strong>{{ m.judgeScoreDisplay || '-' }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; margin-bottom: 14px;">
              <div style="font-weight: 700; font-size: 12px; margin-bottom: 4px;">สรุปผลการประเมิน:</div>
              <div style="font-size: 13px;">
                คะแนนรวม: <strong>{{ selectedReportItem && selectedReportItem.totalScore ? selectedReportItem.totalScore : '-' }} / 4.00</strong> | ระดับ: <strong>{{ getPerformanceGrade(selectedReportItem ? selectedReportItem.totalScore : 0).grade }}</strong>
              </div>
              <div v-if="selectedReportItem && selectedReportItem.overallFeedback" style="font-size: 12.5px; color: #334155; margin-top: 6px;">
                <strong>ข้อเสนอแนะ:</strong> {{ selectedReportItem.overallFeedback }}
              </div>
              <div v-if="selectedReportItem && selectedReportItem.judgeSignature && (selectedReportItem.judgeSignature.startsWith('data:image/') || selectedReportItem.judgeSignature.startsWith('/uploads/') || selectedReportItem.judgeSignature.startsWith('http'))" style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; color: var(--text-muted);">ลายเซ็นกรรมการ:</span>
                <img :src="selectedReportItem.judgeSignature" alt="ลายเซ็น" style="max-height: 42px; max-width: 160px; background: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px;" />
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" @click="showReportModal = false" class="btn-outline">ปิดหน้าต่าง</button>
            <button type="button" @click="triggerPrintFromModal(false)" class="btn-primary">พิมพ์เอกสารราชการ (PDF)</button>
          </div>
        </div>
      </div>

      <!-- 6. Edit Self Warning Modal -->
      <div v-if="showEditSelfWarningModal" class="modal-overlay">
        <div class="modal-content" style="border: 2px solid #dc2626;">
          <div class="modal-header" style="background: #fef2f2; border-bottom: 1px solid #fecaca;">
            <h3 style="color: #dc2626;">คำเตือนสำคัญก่อนขอแก้ไขข้อมูลแบบประเมิน</h3>
            <button @click="showEditSelfWarningModal = false" class="btn-sm" title="ปิด">✕</button>
          </div>
          <div class="modal-body">
            <div style="background: #fef2f2; border: 1px solid #fca5a5; border-left: 4px solid #dc2626; border-radius: var(--radius-sm); padding: 12px 14px; color: #991b1b; margin-bottom: 12px;">
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px;">
                ผลคะแนนที่กรรมการประเมินให้จะถูกรีเซ็ต!
              </div>
              <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.6;">
                <li>เมื่อท่านแก้ไขข้อมูลและกดบันทึกส่งใหม่ <strong>คะแนนและข้อเสนอแนะเดิมทั้งหมดจะถูกลบออก</strong> เพื่อให้คณะกรรมการตรวจข้อมูลชุดใหม่</li>
                <li v-if="teacherJudgeEvaluations.length > 0" style="font-weight: 700; margin-top: 4px;">
                  ขณะนี้มีกรรมการประเมินให้ท่านแล้ว {{ teacherJudgeEvaluations.length }} ท่าน
                </li>
              </ul>
            </div>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0;">ท่านต้องการปลดล็อกแบบฟอร์มเพื่อดำเนินการแก้ไขข้อมูลใช่หรือไม่?</p>
          </div>
          <div class="modal-footer">
            <button type="button" @click="showEditSelfWarningModal = false" class="btn-outline">ยกเลิก</button>
            <button type="button" @click="confirmUnlockSelfEval" class="btn-danger">รับทราบคำเตือน และขอแก้ไข</button>
          </div>
        </div>
      </div>

      <!-- 7. Reject Custom Department Modal -->
      <div v-if="showRejectDeptModal" class="modal-overlay">
        <div class="modal-content" style="border: 1px solid #fca5a5;">
          <div class="modal-header" style="background: #fef2f2; border-bottom: 1px solid #fecaca;">
            <h3 style="color: #b91c1c;">ไม่อนุมัติคำขอเพิ่มสาขาวิชาใหม่</h3>
            <button @click="showRejectDeptModal = false" class="btn-sm" title="ปิด">✕</button>
          </div>
          <form @submit.prevent="confirmRejectDepartmentRequest" class="modal-body">
            <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 12px; font-size: 12.5px;">
              <div>ผู้ส่งคำขอ: <strong>{{ rejectDeptTarget ? rejectDeptTarget.name : '-' }}</strong></div>
              <div style="margin-top: 3px;">สาขาวิชาที่ขอเพิ่ม: <strong style="color: #b91c1c;">{{ rejectDeptTarget ? rejectDeptTarget.requestedDepartment : '-' }}</strong></div>
            </div>
            <div style="margin-bottom: 12px;">
              <label style="color: #991b1b; font-weight: 700;">ระบุเหตุผลที่ไม่อนุมัติ *</label>
              <textarea v-model="rejectDeptReason" rows="3" required placeholder="ระบุเหตุผล..."></textarea>
            </div>
            <div class="modal-footer" style="margin: 10px -18px -16px -18px;">
              <button type="button" @click="showRejectDeptModal = false" class="btn-outline">ยกเลิก</button>
              <button type="submit" class="btn-danger">ยืนยันไม่อนุมัติ</button>
            </div>
          </form>
        </div>
      </div>

      <!-- 8. Edit Metric Category Modal -->
      <div v-if="showEditCategoryModal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>แก้ไขหมวดหมู่ / หัวข้อการประเมิน</h3>
            <button @click="showEditCategoryModal = false" class="btn-sm" title="ปิด">✕</button>
          </div>
          <form @submit.prevent="saveEditCategory" class="modal-body">
            <div class="grid-3" style="margin-bottom: 10px;">
              <div style="grid-column: span 2;">
                <label>ชื่อหัวข้อการประเมิน *</label>
                <input v-model="editCategoryForm.name" required />
              </div>
              <div>
                <label>ลำดับแสดงผล</label>
                <input v-model.number="editCategoryForm.sortOrder" type="number" min="1" required />
              </div>
            </div>
            <div style="margin-bottom: 10px;">
              <label>คำอธิบายหัวข้อ</label>
              <textarea v-model="editCategoryForm.description" rows="2"></textarea>
            </div>
            <div class="modal-footer" style="margin: 10px -18px -16px -18px;">
              <button type="button" @click="showEditCategoryModal = false" class="btn-outline">ยกเลิก</button>
              <button type="submit" class="btn-primary">บันทึกการแก้ไข</button>
            </div>
          </form>
        </div>
      </div>

      <!-- 9. Individual Detailed Tracking Modal -->
      <div v-if="showTrackingDetailModal" class="modal-overlay">
        <div class="modal-content wide" style="max-width: 960px;">
          <div class="modal-header">
            <h3>ติดตามผลการประเมินรายบุคคลอย่างละเอียด</h3>
            <button @click="showTrackingDetailModal = false" class="btn-sm" title="ปิด">✕</button>
          </div>
          <div class="modal-body" style="max-height: 78vh; overflow-y: auto;">
            <div v-if="trackingDetailLoading" style="text-align: center; padding: 30px; color: var(--text-muted);">
              กำลังโหลดข้อมูล...
            </div>
            <div v-else-if="selectedTrackingDetail">
              <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                  <div>
                    <h4 style="margin: 0; font-size: 15.5px; color: var(--text);">{{ selectedTrackingDetail.teacher.name }}</h4>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                      สังกัด: {{ selectedTrackingDetail.teacher.department || selectedTrackingDetail.teacher.requestedDepartment || '-' }} |
                      ตำแหน่ง: {{ selectedTrackingDetail.teacher.position || 'ครู' }} |
                      เลขบัตร: {{ selectedTrackingDetail.teacher.citizenId }}
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <span :class="['tag', selectedTrackingDetail.workflowStage === 'COMPLETED' ? 'green' : 'blue']" style="font-size: 12px;">
                      {{ selectedTrackingDetail.workflowLabel }}
                    </span>
                    <div style="font-size: 12px; margin-top: 4px;">
                      คะแนนเฉลี่ยรวม: <strong style="color: var(--primary);">{{ selectedTrackingDetail.averageTotalScore ? selectedTrackingDetail.averageTotalScore + ' / 4.00' : '-' }}</strong>
                      <span v-if="selectedTrackingDetail.grade" style="color: var(--success); font-weight: 700;"> ({{ selectedTrackingDetail.grade }})</span>
                    </div>
                  </div>
                </div>

                <div class="grid-4" style="margin-top: 10px; gap: 8px;">
                  <div style="background: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 8px; font-size: 11.5px;">
                    <div style="color: var(--text-muted);">1. สาขาวิชา</div>
                    <strong>{{ selectedTrackingDetail.teacher.deptStatus === 'APPROVED' ? 'อนุมัติแล้ว' : selectedTrackingDetail.teacher.deptStatus }}</strong>
                  </div>
                  <div style="background: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 8px; font-size: 11.5px;">
                    <div style="color: var(--text-muted);">2. แบบประเมินตนเอง</div>
                    <strong>{{ selectedTrackingDetail.submission.status === 'SUBMITTED' ? 'ส่งแล้ว (' + selectedTrackingDetail.selfProgress + '%)' : 'ยังไม่ส่ง (' + selectedTrackingDetail.selfProgress + '%)' }}</strong>
                  </div>
                  <div style="background: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 8px; font-size: 11.5px;">
                    <div style="color: var(--text-muted);">3. กรรมการกดรับ</div>
                    <strong>{{ selectedTrackingDetail.claimedJudgesCount }} / {{ selectedTrackingDetail.teacher.requiredJudges }} ท่าน</strong>
                  </div>
                  <div style="background: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 8px; font-size: 11.5px;">
                    <div style="color: var(--text-muted);">4. ตรวจเสร็จสิ้น</div>
                    <strong>{{ selectedTrackingDetail.evaluatedJudgesCount }} / {{ selectedTrackingDetail.teacher.requiredJudges }} ท่าน</strong>
                  </div>
                </div>
              </div>

              <!-- Judge Assignments -->
              <h4 style="font-size: 13.5px; margin-bottom: 8px;">สถานะการดำเนินงานของกรรมการ</h4>
              <div class="table-wrap" style="margin-bottom: 16px;">
                <table class="table">
                  <thead>
                    <tr>
                      <th>กรรมการ</th>
                      <th>บทบาท</th>
                      <th width="130">เวลาที่กดรับ</th>
                      <th width="120">สถานะ</th>
                      <th width="90">คะแนนรวม</th>
                      <th>ข้อเสนอแนะ</th>
                      <th width="80" style="text-align: right;">รายงาน</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="a in selectedTrackingDetail.assignments" :key="a.assignmentId">
                      <td>
                        <strong>{{ a.judgeName }}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">{{ a.judgePosition || 'กรรมการ' }}</div>
                      </td>
                      <td><span class="tag blue">{{ a.roleInBoard }}</span></td>
                      <td style="font-size: 11px;">{{ a.claimedAt ? new Date(a.claimedAt).toLocaleString('th-TH') : '-' }}</td>
                      <td>
                        <span v-if="a.status === 'EVALUATED'" class="tag green">ตรวจเสร็จสิ้น</span>
                        <span v-else class="tag yellow">รับแล้วรอตรวจ</span>
                      </td>
                      <td><strong>{{ a.totalScore ? a.totalScore + ' / 4.00' : '-' }}</strong></td>
                      <td style="font-size: 11.5px;">{{ a.overallFeedback || '-' }}</td>
                      <td style="text-align: right;">
                        <button v-if="a.status === 'EVALUATED'" class="btn-sm" @click="openIndividualReportModal(a)">PDF</button>
                      </td>
                    </tr>
                    <tr v-if="!selectedTrackingDetail.assignments || selectedTrackingDetail.assignments.length === 0">
                      <td colspan="7" style="text-align: center; padding: 12px; color: var(--text-muted);">ยังไม่มีกรรมการกดรับ</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Per-Metric Score Details -->
              <h4 style="font-size: 13.5px; margin-bottom: 8px;">รายละเอียดคะแนนรายตัวชี้วัด</h4>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th width="40">ข้อ</th>
                      <th>หมวดหมู่ / ตัวชี้วัด</th>
                      <th width="75">น้ำหนัก</th>
                      <th width="95">ตนเอง</th>
                      <th v-for="(a, idx) in selectedTrackingDetail.assignments" :key="a.assignmentId" width="110">กรรมการ {{ idx + 1 }}</th>
                      <th width="95">ค่าเฉลี่ย</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(m, idx) in selectedTrackingDetail.metrics" :key="m.metricId">
                      <td>{{ idx + 1 }}</td>
                      <td>
                        <span v-if="m.categoryName" class="tag gray" style="font-size: 10px; margin-right: 4px;">{{ m.categoryName }}</span>
                        <strong>{{ m.title }}</strong>
                      </td>
                      <td>{{ m.weight }}%</td>
                      <td>{{ m.selfScore || '-' }}</td>
                      <td v-for="a in selectedTrackingDetail.assignments" :key="a.assignmentId">
                        {{ a.metricScores && a.metricScores[m.metricId] !== undefined ? a.metricScores[m.metricId] : '-' }}
                      </td>
                      <td><strong style="color: var(--primary);">{{ m.avgJudgeScore || '-' }}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" @click="showTrackingDetailModal = false" class="btn-outline">ปิดหน้าต่าง</button>
          </div>
        </div>
      </div>
    </div>
  `
};
