// public/js/components/TeacherDashboard.js
import { getPerformanceGrade } from '../utils/formatters.js';
import {
  currentUser, publicDepartments, allPeriods, selectedPeriodId, period, metrics
} from '../composables/useAppState.js';
import { reselectDeptForm } from '../composables/useAuth.js';
import {
  teacherTab, teacherScores, teacherComments, teacherEvidence,
  teacherSubmissionStatus, teacherSubmittedAt, teacherRequiredJudges, teacherClaimedJudgesCount,
  isEditingSelfEval, teacherJudgeEvaluations, teacherConsolidatedSummary,
  selectedJudgeEvalIdx, currentSelectedJudgeEval, isTeacherDeptApproved, isTeacherFormLocked,
  teacherProgress, teacherJudgeProgressSummary, getMetricJudgeProgress, loadTeacherEvaluationSheet
} from '../composables/useTeacher.js';

export default {
  name: 'TeacherDashboard',
  props: {
    actions: { type: Object, required: true },
    authActions: { type: Object, required: true }
  },
  setup(props) {
    return {
      currentUser, publicDepartments, allPeriods, selectedPeriodId, period, metrics,
      reselectDeptForm, teacherTab, teacherScores, teacherComments, teacherEvidence,
      teacherSubmissionStatus, teacherSubmittedAt, teacherRequiredJudges, teacherClaimedJudgesCount,
      isEditingSelfEval, teacherJudgeEvaluations, teacherConsolidatedSummary,
      selectedJudgeEvalIdx, currentSelectedJudgeEval, isTeacherDeptApproved, isTeacherFormLocked,
      teacherProgress, teacherJudgeProgressSummary, getMetricJudgeProgress, loadTeacherEvaluationSheet, getPerformanceGrade,
      ...props.actions,
      openProfileModal: props.authActions.openProfileModal,
      submitReselectDepartment: props.authActions.submitReselectDepartment
    };
  },
  template: `
    <div class="container">
      <div class="period-bar">
        <div class="period-select-wrap">
          <v-icon name="calendar" size="16" style="color:var(--primary);"></v-icon>
          <strong>เลือกรอบการประเมิน:</strong>
          <select v-model="selectedPeriodId" @change="onTeacherPeriodChange" style="width: auto; min-width: 280px; font-weight: 600;">
            <option v-for="p in allPeriods" :key="p.id" :value="p.id">{{ p.name }} ({{ p.isOpen ? 'เปิดรับประเมิน' : 'ปิดระบบแล้ว' }})</option>
          </select>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="tag blue" style="font-size: 12px; padding: 4px 10px;">
            <v-icon name="users" size="13"></v-icon>
            กรรมการกดรับแล้ว: <strong>{{ teacherClaimedJudgesCount }} / {{ teacherRequiredJudges }}</strong> ท่าน
          </span>
          <span :class="['tag', period.isOpen ? 'green' : 'red']" style="font-size: 12px; padding: 4px 10px;">
            <v-icon :name="period.isOpen ? 'check-circle' : 'alert'" size="13"></v-icon>
            {{ period.isOpen ? 'ระบบกำลังเปิดรับการประเมิน' : 'รอบการประเมินนี้ปิดแล้ว' }}
          </span>
        </div>
      </div>

      <!-- Department Approval / Rejection Banners -->
      <div v-if="currentUser.deptStatus === 'PENDING'" style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: var(--radius); padding: 14px 16px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; gap: 10px; align-items: flex-start;">
            <v-icon name="clock" size="20" style="color: #d97706; flex-shrink: 0; margin-top: 2px;"></v-icon>
            <div>
              <strong style="font-size: 14px; color: #92400e;">คำขอเพิ่มสาขาวิชาใหม่กำลังรอการอนุมัติจากฝ่ายบุคลากร (HR)</strong>
              <div style="font-size: 12.5px; color: #78350f; margin-top: 3px;">
                สาขาวิชาที่ขอเพิ่ม: <strong>"{{ currentUser.requestedDepartment }}"</strong> — ท่านจะสามารถส่งข้อมูลแบบประเมินตนเองให้คณะกรรมการได้เมื่อ HR อนุมัติแล้ว
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-outline btn-sm" @click="loadTeacherEvaluationSheet(selectedPeriodId)"><v-icon name="search" size="12"></v-icon><span>ตรวจสอบสถานะล่าสุด</span></button>
            <button type="button" class="btn-sm" @click="openProfileModal"><v-icon name="edit" size="12"></v-icon><span>เปลี่ยนไปเลือกสาขาวิชาที่มีอยู่</span></button>
          </div>
        </div>
      </div>

      <div v-else-if="currentUser.deptStatus === 'REJECTED'" style="background: #fef2f2; border: 2px solid #dc2626; border-radius: var(--radius); padding: 16px; margin-bottom: 14px;">
        <div style="display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px;">
          <v-icon name="alert" size="22" style="color: #dc2626; flex-shrink: 0; margin-top: 2px;"></v-icon>
          <div style="flex: 1;">
            <strong style="font-size: 14.5px; color: #991b1b;">คำขอเพิ่มสาขาวิชา "{{ currentUser.requestedDepartment }}" ไม่ได้รับการอนุมัติจากฝ่ายบุคลากร (HR)</strong>
            <div style="background: #fff; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 4px; padding: 8px 12px; margin-top: 6px; font-size: 13px; color: #7f1d1d;">
              <strong>เหตุผลที่ไม่อนุมัติจาก HR:</strong> {{ currentUser.deptRejectReason || 'กรุณาเลือกสาขาวิชาที่เปิดสอนในระบบ' }}
            </div>
          </div>
        </div>
        <div style="background: #fff; border: 1px solid #fca5a5; border-radius: var(--radius-sm); padding: 12px;">
          <div style="font-weight: 700; font-size: 13px; color: #991b1b; margin-bottom: 8px;">กรุณาเลือกสาขาวิชาใหม่อีกครั้งเพื่อดำเนินการส่งแบบประเมิน:</div>
          <div class="grid-3" style="align-items: end; gap: 10px;">
            <div :style="{ gridColumn: reselectDeptForm.departmentSelect === '__CUSTOM__' ? 'span 1' : 'span 2' }">
              <label>เลือกสาขาวิชา *</label>
              <select v-model="reselectDeptForm.departmentSelect">
                <option value="" disabled>-- เลือกสาขาวิชาที่มีในระบบ (อนุมัติทันที) --</option>
                <option v-for="d in publicDepartments" :key="d.id" :value="d.name">{{ d.name }}</option>
                <option value="__CUSTOM__">+ ขอเพิ่มสาขาวิชาใหม่อีกครั้ง (ส่งให้ HR พิจารณา)</option>
              </select>
            </div>
            <div v-if="reselectDeptForm.departmentSelect === '__CUSTOM__'"><label>ชื่อสาขาวิชาใหม่ *</label><input v-model="reselectDeptForm.customDepartment" placeholder="ระบุชื่อสาขาวิชา..." /></div>
            <div><button type="button" class="btn-primary" style="width: 100%;" @click="submitReselectDepartment"><v-icon name="check-circle" size="14"></v-icon><span>ยืนยันการเลือกสาขาวิชาใหม่</span></button></div>
          </div>
        </div>
      </div>

      <div class="sub-nav">
        <button :class="{ active: teacherTab === 'self' }" @click="teacherTab = 'self'"><v-icon name="edit" size="14"></v-icon><span>1. กรอกแบบประเมินตนเอง (กรอกแล้ว {{ teacherProgress }}%)</span></button>
        <button :class="{ active: teacherTab === 'result' }" @click="teacherTab = 'result'"><v-icon name="award" size="14"></v-icon><span>2. ผลการประเมินและข้อเสนอแนะจากกรรมการ (ตรวจแล้ว {{ teacherJudgeProgressSummary.overallPercent }}%)</span></button>
      </div>

      <!-- Tab 1: Self Evaluation -->
      <div v-if="teacherTab === 'self'" class="card">
        <div v-if="teacherSubmissionStatus === 'SUBMITTED' && isEditingSelfEval" style="background: #fef2f2; border: 2px solid #dc2626; color: #991b1b; border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 14px; display: flex; align-items: flex-start; gap: 10px;">
          <v-icon name="alert" size="20" style="color: #dc2626; flex-shrink: 0; margin-top: 2px;"></v-icon>
          <div>
            <strong style="font-size: 13.5px; color: #b91c1c;">คำเตือนสำคัญ: กำลังอยู่ในโหมดขอแก้ไขข้อมูลแบบประเมิน</strong>
            <div style="font-size: 12.5px; margin-top: 3px; line-height: 1.45;">
              หากท่านกดปุ่ม <strong>"ยืนยันการแก้ไขและส่งข้อมูลใหม่"</strong> ผลการประเมิน คะแนน และความคิดเห็นที่กรรมการได้ประเมินให้ท่านตอนแรกในรอบนี้จะ<strong>หายไปทั้งหมดทันที</strong> และกรรมการจะต้องประเมินใหม่ตั้งแต่ต้น
            </div>
          </div>
        </div>

        <div v-else-if="teacherSubmissionStatus === 'SUBMITTED'" class="alert success" style="margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <v-icon name="check-circle" size="18"></v-icon>
            <div>
              <strong style="font-size: 13.5px;">ส่งแบบประเมินตนเองเรียบร้อยแล้ว (ข้อมูลถูกล็อก)</strong>
              <div style="font-size: 11.5px; opacity: 0.9; margin-top: 1px;">
                ส่งข้อมูลเมื่อ: {{ teacherSubmittedAt ? new Date(teacherSubmittedAt).toLocaleString('th-TH') : '-' }} | กรรมการกดรับแล้ว {{ teacherClaimedJudgesCount }} / {{ teacherRequiredJudges }} ท่าน (ตรวจแล้ว {{ teacherJudgeEvaluations.length }} ท่าน)
              </div>
            </div>
          </div>
          <span class="tag green"><v-icon name="check" size="11"></v-icon> ส่งแบบประเมินแล้ว</span>
        </div>

        <div v-else class="alert" style="background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
          <v-icon name="clock" size="18"></v-icon>
          <div>
            <strong style="font-size: 13.5px;">สถานะ: กำลังจัดทำแบบประเมินตนเอง (ยังไม่ได้ส่งข้อมูล)</strong>
            <div style="font-size: 11.5px; margin-top: 1px;">เมื่อส่งแบบประเมินตนเองเรียบร้อยแล้ว รายชื่อของท่านจะเปิดให้กรรมการในสาขากดรับได้ (จำนวนที่ต้องการ: {{ teacherRequiredJudges }} ท่าน)</div>
          </div>
        </div>

        <div class="page-header" style="margin-bottom: 12px;">
          <div>
            <h2><v-icon name="user" size="18"></v-icon> แบบประเมินตนเอง: {{ currentUser.name }}</h2>
            <p>สังกัด: {{ currentUser.department || ('รออนุมัติ: ' + (currentUser.requestedDepartment || '-')) }} | รอบการประเมิน: {{ period.name }}</p>
          </div>
          <div v-if="teacherSubmissionStatus !== 'SUBMITTED'">
            <button type="button" @click="saveTeacherSelf(false)" class="btn-primary" :disabled="!period.isOpen || !isTeacherDeptApproved">
              <v-icon name="save" size="14"></v-icon><span>{{ !isTeacherDeptApproved ? 'รออนุมัติสาขาวิชาจึงจะส่งได้' : 'บันทึกและส่งผลการประเมินตนเอง' }}</span>
            </button>
          </div>
          <div v-else-if="!isEditingSelfEval">
            <button type="button" @click="requestEditSelfEval" class="btn-outline" style="border-color: #dc2626; color: #dc2626; font-weight: 700;" :disabled="!period.isOpen || !isTeacherDeptApproved">
              <v-icon name="edit" size="14"></v-icon><span>ขอแก้ไขข้อมูลแบบประเมิน</span>
            </button>
          </div>
          <div v-else style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" @click="cancelEditSelfEval" class="btn-outline"><v-icon name="close" size="13"></v-icon><span>ยกเลิกการแก้ไข</span></button>
            <button type="button" @click="saveTeacherSelf(true)" style="background: #dc2626; color: #fff; border: none; border-radius: var(--radius-sm); padding: 0 14px; height: 34px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <v-icon name="alert" size="14"></v-icon><span>ยืนยันการแก้ไขและส่งข้อมูลใหม่</span>
            </button>
          </div>
        </div>

        <div v-if="!period.isOpen" class="alert error" style="margin-bottom: 14px;"><v-icon name="alert" size="14"></v-icon><span>รอบการประเมินนี้ปิดการรับข้อมูลแล้ว ไม่สามารถบันทึกหรือแก้ไขเพิ่มเติมได้</span></div>

        <!-- Overall & Per-Metric Judge Inspection Progress Banner -->
        <div style="background:#f8fafc; border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
            <strong style="font-size:13px; color:var(--text);">
              ความคืบหน้าการตรวจสอบตัวชี้วัดของกรรมการ ({{ teacherJudgeProgressSummary.overallPercent }}%)
            </strong>
            <div style="display:flex; gap:8px; flex-wrap:wrap; font-size:11.5px;">
              <span class="tag blue">กรรมการรับงาน: {{ teacherJudgeProgressSummary.claimedCount }}/{{ teacherJudgeProgressSummary.requiredJudges }} ท่าน</span>
              <span class="tag sky">ตรวจส่งผลแล้ว: {{ teacherJudgeProgressSummary.evaluatedJudgesCount }}/{{ teacherJudgeProgressSummary.requiredJudges }} ท่าน</span>
              <span class="tag green">ตรวจครบทุกท่านแล้ว: {{ teacherJudgeProgressSummary.fullyCheckedCount }}/{{ teacherJudgeProgressSummary.totalMetrics }} ข้อ</span>
              <span class="tag gray">รอตรวจ: {{ teacherJudgeProgressSummary.waitingCount }}/{{ teacherJudgeProgressSummary.totalMetrics }} ข้อ</span>
            </div>
          </div>
          <div style="width:100%; height:8px; background:#e2e8f0; border-radius:999px; overflow:hidden;">
            <div :style="{ width: teacherJudgeProgressSummary.overallPercent + '%', height: '100%', background: teacherJudgeProgressSummary.overallPercent === 100 ? 'var(--success)' : 'var(--primary)', transition: 'width 0.25s' }"></div>
          </div>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th width="40">ข้อ</th>
                <th>หมวดหมู่ / ตัวชี้วัด & ค่าน้ำหนัก</th>
                <th width="175">ความคืบหน้ากรรมการตรวจ</th>
                <th width="180">ระดับประเมินตนเอง</th>
                <th>ความคิดเห็น / รายละเอียดผลงาน *</th>
                <th width="220">หลักฐานร่องรอย (ไม่บังคับ)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, idx) in metrics" :key="m.id">
                <td>{{ idx + 1 }}</td>
                <td>
                  <div v-if="m.categoryName" style="margin-bottom:3px;"><span class="tag blue" style="font-size:10.5px;">{{ m.categoryName }}</span></div>
                  <strong>{{ m.title }}</strong>
                  <div style="color:var(--text-muted); font-size:11.5px;">น้ำหนัก {{ m.weight }}% | {{ m.description }}</div>
                </td>
                <td>
                  <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
                    <span style="font-weight:700;" :style="{ color: getMetricJudgeProgress(m.id).percent === 100 ? 'var(--success)' : (getMetricJudgeProgress(m.id).evaluatedCount > 0 ? 'var(--primary)' : 'var(--text-muted)') }">
                      {{ getMetricJudgeProgress(m.id).percent }}%
                    </span>
                    <span style="color:var(--text-muted);">
                      ตรวจแล้ว {{ getMetricJudgeProgress(m.id).evaluatedCount }}/{{ getMetricJudgeProgress(m.id).requiredJudges }} ท่าน
                    </span>
                  </div>
                  <div style="width:100%; height:6px; background:#e2e8f0; border-radius:999px; overflow:hidden; margin-bottom:5px;">
                    <div :style="{ width: getMetricJudgeProgress(m.id).percent + '%', height:'100%', background: getMetricJudgeProgress(m.id).percent === 100 ? 'var(--success)' : 'var(--primary)' }"></div>
                  </div>
                  <div>
                    <span :class="['tag', getMetricJudgeProgress(m.id).evaluatedCount >= getMetricJudgeProgress(m.id).requiredJudges ? 'green' : (getMetricJudgeProgress(m.id).evaluatedCount > 0 ? 'blue' : (getMetricJudgeProgress(m.id).claimedCount > 0 ? 'sky' : 'gray'))]" style="font-size:10px; padding:1px 6px;">
                      {{ getMetricJudgeProgress(m.id).statusLabel }}
                    </span>
                  </div>
                </td>
                <td>
                  <select v-if="m.evalType === 'SCALE'" v-model="teacherScores[m.id]" :disabled="isTeacherFormLocked">
                    <option value="" disabled>-- เลือกระดับคะแนน --</option>
                    <option value="4">ระดับ 4 - สูงกว่าคาดหวัง</option><option value="3">ระดับ 3 - ตามคาดหวัง</option>
                    <option value="2">ระดับ 2 - ต่ำกว่าคาดหวัง</option><option value="1">ระดับ 1 - ต่ำกว่าคาดหวังมาก</option>
                  </select>
                  <select v-else v-model="teacherScores[m.id]" :disabled="isTeacherFormLocked">
                    <option value="" disabled>-- เลือกการปฏิบัติ --</option>
                    <option value="มี">มีการปฏิบัติ (4 คะแนน)</option><option value="ไม่มี">ไม่มีการปฏิบัติ (0 คะแนน)</option>
                  </select>
                </td>
                <td><textarea v-model="teacherComments[m.id]" rows="2" placeholder="ระบุความคิดเห็นและสรุปผลการดำเนินงานในตัวชี้วัดนี้..." :disabled="isTeacherFormLocked"></textarea></td>
                <td>
                  <div v-if="m.evidenceType === 'URL'">
                    <input v-model="teacherEvidence[m.id]" placeholder="ระบุลิงก์ผลงาน (ถ้ามี)" :disabled="isTeacherFormLocked" />
                    <div v-if="teacherEvidence[m.id]" style="margin-top: 3px;">
                      <a :href="teacherEvidence[m.id]" target="_blank" style="color:var(--primary); font-size:11.5px; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><v-icon name="paperclip" size="12"></v-icon> เปิดดูลิงก์</a>
                    </div>
                  </div>
                  <div v-else>
                    <input v-if="!isTeacherFormLocked" type="file" @change="uploadTeacherFile($event, m.id)" style="font-size:11px;" :disabled="isTeacherFormLocked" />
                    <div v-if="teacherEvidence[m.id]" style="margin-top: 3px; display:flex; align-items:center; gap:6px;">
                      <a :href="teacherEvidence[m.id]" target="_blank" style="color:var(--primary); font-size:11.5px; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><v-icon name="paperclip" size="12"></v-icon> ดูไฟล์ที่แนบแล้ว</a>
                      <button v-if="!isTeacherFormLocked" type="button" class="btn-sm" style="padding:1px 5px; font-size:10px; border:none; background:#fee2e2; color:#b91c1c; border-radius:3px;" @click="teacherEvidence[m.id] = ''">ลบ</button>
                    </div>
                    <div v-else-if="isTeacherFormLocked" style="font-size:11.5px; color:var(--text-muted);">ไม่มีเอกสารแนบ</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 2: Judge Results -->
      <div v-else class="card">
        <div class="page-header" style="margin-bottom: 14px;">
          <div>
            <h2><v-icon name="award" size="18"></v-icon> ผลการประเมินและข้อคิดเห็นจากคณะกรรมการ</h2>
            <p>รอบการประเมิน: {{ period.name }} (กรรมการรับงานแล้ว {{ teacherClaimedJudgesCount }} / {{ teacherRequiredJudges }} ท่าน)</p>
          </div>
          <div v-if="teacherJudgeEvaluations.length > 0" style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button @click="triggerPrintConsolidated" class="btn-primary"><v-icon name="printer" size="14"></v-icon><span>Export PDF ผลประเมินเฉลี่ยรวม (ไม่รวมความคิดเห็น)</span></button>
            <button @click="triggerPrintIndividualForTeacher" class="btn-outline"><v-icon name="printer" size="14"></v-icon><span>พิมพ์ผลการประเมินรายกรรมการ (Individual PDF)</span></button>
          </div>
        </div>

        <div v-if="teacherJudgeEvaluations.length > 0">
          <div class="stat-grid" style="margin-bottom: 16px;">
            <div class="stat-card"><div class="stat-card-icon sky"><v-icon name="award" size="18"></v-icon></div><div class="stat-card-info"><span>คะแนนประเมินเฉลี่ยรวม</span><strong>{{ teacherConsolidatedSummary ? teacherConsolidatedSummary.averageTotalScore : '-' }} / 4.00</strong></div></div>
            <div class="stat-card"><div class="stat-card-icon green"><v-icon name="check-circle" size="18"></v-icon></div><div class="stat-card-info"><span>ระดับผลการประเมิน</span><strong style="color:var(--success);">{{ getPerformanceGrade(teacherConsolidatedSummary ? teacherConsolidatedSummary.averageTotalScore : 0).grade }}</strong></div></div>
            <div class="stat-card"><div class="stat-card-icon blue"><v-icon name="users" size="18"></v-icon></div><div class="stat-card-info"><span>กรรมการที่ตรวจประเมินแล้ว</span><strong style="font-size:14px; margin-top:3px;">{{ teacherJudgeEvaluations.length }} / {{ teacherRequiredJudges }} ท่าน</strong></div></div>
          </div>

          <div style="margin-bottom: 14px;">
            <label style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; display: block;">เลือกดูกรรมการผู้ประเมินรายบุคคล:</label>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button v-for="(j, idx) in teacherJudgeEvaluations" :key="j.assignmentId" :class="['btn-sm', selectedJudgeEvalIdx === idx ? 'active' : '']" @click="selectedJudgeEvalIdx = idx">
                <v-icon name="user" size="12"></v-icon><span>กรรมการคนที่ {{ idx + 1 }}: {{ j.judgeName }} ({{ j.totalScore }} / 4.00)</span>
              </button>
            </div>
          </div>

          <div v-if="currentSelectedJudgeEval" style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; background: #fff; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 8px;">
              <div>
                <h3 style="font-size: 15px; font-weight: 700; color: var(--text); margin: 0;"><v-icon name="user" size="14" style="color:var(--primary);"></v-icon> <span>{{ currentSelectedJudgeEval.judgeName }}</span></h3>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">ตำแหน่ง: {{ currentSelectedJudgeEval.judgePosition || 'กรรมการ' }} | บทบาท: {{ currentSelectedJudgeEval.roleInBoard }}</div>
              </div>
              <span class="tag green" style="font-size: 12.5px; padding: 4px 10px;">คะแนนที่กรรมการท่านนี้ให้: <strong>{{ currentSelectedJudgeEval.totalScore }} / 4.00</strong></span>
            </div>
            <div class="table-wrap" style="margin-bottom: 14px;">
              <table class="table">
                <thead><tr><th width="40">ข้อ</th><th>ตัวชี้วัด</th><th width="80">น้ำหนัก</th><th width="145">ความคืบหน้ากรรมการตรวจ</th><th>ความคิดเห็นที่คุณระบุ</th><th width="110">ประเมินตนเอง</th><th width="130">คะแนนกรรมการท่านนี้</th></tr></thead>
                <tbody>
                  <tr v-for="(m, idx) in metrics" :key="m.id">
                    <td>{{ idx + 1 }}</td><td><strong>{{ m.title }}</strong></td><td>{{ m.weight }}%</td>
                    <td>
                      <div style="font-size:11px; font-weight:700;" :style="{ color: getMetricJudgeProgress(m.id).percent === 100 ? 'var(--success)' : 'var(--primary)' }">
                        {{ getMetricJudgeProgress(m.id).evaluatedCount }}/{{ getMetricJudgeProgress(m.id).requiredJudges }} ท่าน ({{ getMetricJudgeProgress(m.id).percent }}%)
                      </div>
                      <div style="width:100%; height:5px; background:#e2e8f0; border-radius:999px; overflow:hidden; margin-top:3px;">
                        <div :style="{ width: getMetricJudgeProgress(m.id).percent + '%', height:'100%', background: getMetricJudgeProgress(m.id).percent === 100 ? 'var(--success)' : 'var(--primary)' }"></div>
                      </div>
                    </td>
                    <td style="font-size:12px; color:#475569;">{{ teacherComments[m.id] || '-' }}</td>
                    <td><span class="tag blue">{{ teacherScores[m.id] ? (m.evalType === 'BOOLEAN' ? (teacherScores[m.id] === 'มี' ? 'มี' : 'ไม่มี') : 'ระดับ ' + teacherScores[m.id]) : '-' }}</span></td>
                    <td><strong style="color:var(--primary);">{{ currentSelectedJudgeEval.metricScores && currentSelectedJudgeEval.metricScores[m.id] !== undefined ? currentSelectedJudgeEval.metricScores[m.id] + ' / 4.00' : '-' }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px;">
              <div style="font-weight: 700; font-size: 13px; color: var(--text); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;"><v-icon name="file-text" size="14"></v-icon><span>ความคิดเห็นและข้อเสนอแนะในการพัฒนาจากกรรมการท่านนี้</span></div>
              <p style="font-size: 13px; color: #334155; line-height: 1.5; margin: 0;">{{ currentSelectedJudgeEval.overallFeedback || 'ไม่มีข้อเสนอแนะเพิ่มเติม' }}</p>
              <div style="margin-top: 10px; font-size: 11.5px; color: var(--text-muted); display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span>ลายเซ็นกรรมการ:</span>
                <img v-if="currentSelectedJudgeEval.judgeSignature && (currentSelectedJudgeEval.judgeSignature.startsWith('data:image/') || currentSelectedJudgeEval.judgeSignature.startsWith('/uploads/') || currentSelectedJudgeEval.judgeSignature.startsWith('http'))"
                     :src="currentSelectedJudgeEval.judgeSignature"
                     alt="ลายเซ็นกรรมการ"
                     style="max-height:42px; max-width:150px; background:#fff; border:1px solid var(--border); border-radius:4px; padding:2px 6px;" />
                <strong v-else>{{ currentSelectedJudgeEval.judgeSignature || currentSelectedJudgeEval.judgeName }}</strong>
                <span>| วันที่ส่งผล: {{ currentSelectedJudgeEval.submittedAt ? new Date(currentSelectedJudgeEval.submittedAt).toLocaleDateString('th-TH') : '-' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
          <div v-if="teacherSubmissionStatus === 'SUBMITTED'">
            <v-icon name="clock" size="32" style="color:var(--primary); margin-bottom: 8px; opacity: 0.7;"></v-icon>
            <div style="font-size: 15px; font-weight: 700; color:var(--text);">ส่งแบบประเมินเรียบร้อยแล้ว (รอผลการตรวจประเมิน)</div>
            <p style="font-size: 12.5px; margin-top: 4px; max-width: 500px; margin-left:auto; margin-right:auto;">
              ขณะนี้มีกรรมการกดรับการประเมินแล้ว {{ teacherClaimedJudgesCount }} / {{ teacherRequiredJudges }} ท่าน เมื่อกรรมการตรวจเสร็จ ผลคะแนนและข้อคิดเห็นจะปรากฏที่นี่
            </p>
          </div>
          <div v-else>
            <v-icon name="alert" size="32" style="color:#d97706; margin-bottom: 8px; opacity: 0.7;"></v-icon>
            <div style="font-size: 15px; font-weight: 700; color:var(--text);">ยังไม่มีการส่งแบบประเมินตนเองในรอบนี้</div>
            <p style="font-size: 12.5px; margin-top: 4px;">กรุณากรอกข้อมูลแบบประเมินตนเองในแท็บที่ 1 และกดปุ่มบันทึกและส่งผลการประเมิน</p>
          </div>
        </div>
      </div>
    </div>
  `
};
