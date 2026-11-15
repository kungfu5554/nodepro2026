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
      currentUser,
      publicDepartments,
      allPeriods,
      selectedPeriodId,
      period,
      metrics,
      reselectDeptForm,
      teacherTab,
      teacherScores,
      teacherComments,
      teacherEvidence,
      teacherSubmissionStatus,
      teacherSubmittedAt,
      teacherRequiredJudges,
      teacherClaimedJudgesCount,
      isEditingSelfEval,
      teacherJudgeEvaluations,
      teacherConsolidatedSummary,
      selectedJudgeEvalIdx,
      currentSelectedJudgeEval,
      isTeacherDeptApproved,
      isTeacherFormLocked,
      teacherProgress,
      teacherJudgeProgressSummary,
      getMetricJudgeProgress,
      loadTeacherEvaluationSheet,
      getPerformanceGrade,
      ...props.actions,
      openProfileModal: props.authActions.openProfileModal,
      submitReselectDepartment: props.authActions.submitReselectDepartment
    };
  },
  template: `
    <div class="container">
      <!-- Period Selector & Status Bar -->
      <div class="period-bar">
        <div class="period-select-wrap">
          <strong>เลือกรอบการประเมิน:</strong>
          <select v-model="selectedPeriodId" @change="onTeacherPeriodChange" style="width: auto; min-width: 280px; font-weight: 600;">
            <option v-for="p in allPeriods" :key="p.id" :value="p.id">
              {{ p.name }} ({{ p.isOpen ? 'เปิดรับประเมิน' : 'ปิดระบบแล้ว' }})
            </option>
          </select>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <span class="tag blue" style="font-size: 12px; padding: 4px 10px;">
            กรรมการกดรับแล้ว: <strong>{{ teacherClaimedJudgesCount }} / {{ teacherRequiredJudges }}</strong> ท่าน
          </span>
          <span :class="['tag', period.isOpen ? 'green' : 'red']" style="font-size: 12px; padding: 4px 10px;">
            {{ period.isOpen ? 'ระบบกำลังเปิดรับการประเมิน' : 'รอบการประเมินนี้ปิดแล้ว' }}
          </span>
        </div>
      </div>

      <!-- Pending Department Notification -->
      <div v-if="currentUser.deptStatus === 'PENDING'" class="alert warning" style="justify-content: space-between; flex-wrap: wrap;">
        <div>
          <strong>คำขอเพิ่มสาขาวิชาใหม่กำลังรอการอนุมัติจากฝ่ายบุคลากร (HR)</strong>
          <div style="font-size: 12.5px; margin-top: 3px;">
            สาขาวิชาที่ขอเพิ่ม: <strong>"{{ currentUser.requestedDepartment }}"</strong> — ท่านจะสามารถส่งแบบประเมินได้เมื่อ HR อนุมัติแล้ว
          </div>
        </div>
        <div style="display: flex; gap: 6px; margin-top: 4px;">
          <button type="button" class="btn-outline btn-sm" @click="loadTeacherEvaluationSheet(selectedPeriodId)">ตรวจสอบสถานะล่าสุด</button>
          <button type="button" class="btn-sm" @click="openProfileModal">เปลี่ยนไปเลือกสาขาวิชาที่มีอยู่</button>
        </div>
      </div>

      <!-- Rejected Department Notification -->
      <div v-else-if="currentUser.deptStatus === 'REJECTED'" class="alert error" style="flex-direction: column; align-items: stretch;">
        <div style="margin-bottom: 8px;">
          <strong>คำขอเพิ่มสาขาวิชา "{{ currentUser.requestedDepartment }}" ไม่ได้รับการอนุมัติจากฝ่ายบุคลากร (HR)</strong>
          <div style="font-size: 12.5px; margin-top: 3px;">
            เหตุผล: {{ currentUser.deptRejectReason || 'กรุณาเลือกสาขาวิชาที่มีในระบบ' }}
          </div>
        </div>
        <div style="background: #fff; border: 1px solid #fca5a5; border-radius: var(--radius-sm); padding: 12px;">
          <div style="font-weight: 700; font-size: 13px; color: #991b1b; margin-bottom: 8px;">
            กรุณาเลือกสาขาวิชาใหม่อีกครั้ง:
          </div>
          <div class="grid-3" style="align-items: end; gap: 10px;">
            <div :style="{ gridColumn: reselectDeptForm.departmentSelect === '__CUSTOM__' ? 'span 1' : 'span 2' }">
              <label>เลือกสาขาวิชา *</label>
              <select v-model="reselectDeptForm.departmentSelect">
                <option value="" disabled>-- เลือกสาขาวิชาที่มีในระบบ (อนุมัติทันที) --</option>
                <option v-for="d in publicDepartments" :key="d.id" :value="d.name">{{ d.name }}</option>
                <option value="__CUSTOM__">+ ขอเพิ่มสาขาวิชาใหม่อีกครั้ง (ส่งให้ HR พิจารณา)</option>
              </select>
            </div>
            <div v-if="reselectDeptForm.departmentSelect === '__CUSTOM__'">
              <label>ชื่อสาขาวิชาใหม่ *</label>
              <input v-model="reselectDeptForm.customDepartment" placeholder="ระบุชื่อสาขาวิชา..." />
            </div>
            <div>
              <button type="button" class="btn-primary" style="width: 100%;" @click="submitReselectDepartment">
                ยืนยันการเลือกสาขาวิชาใหม่
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs Navigation -->
      <div class="tabs">
        <button :class="['tab-btn', teacherTab === 'self' ? 'active' : '']" @click="teacherTab = 'self'">
          การประเมินตนเอง (Self Evaluation)
          <span v-if="teacherSubmissionStatus === 'SUBMITTED'" class="tag green" style="margin-left: 6px; font-size: 10.5px;">ส่งแล้ว</span>
          <span v-else class="tag yellow" style="margin-left: 6px; font-size: 10.5px;">แบบร่าง</span>
        </button>
        <button :class="['tab-btn', teacherTab === 'judge' ? 'active' : '']" @click="teacherTab = 'judge'">
          ผลการตรวจจากคณะกรรมการ
          <span v-if="teacherJudgeEvaluations.length > 0" class="tag blue" style="margin-left: 6px; font-size: 10.5px;">
            {{ teacherJudgeEvaluations.length }} ท่าน
          </span>
        </button>
      </div>

      <!-- Tab 1: Self Evaluation -->
      <div v-if="teacherTab === 'self'">
        <!-- Progress Bar Card -->
        <div class="card" style="margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <strong style="font-size: 14px; color: var(--text);">ความก้าวหน้าการกรอกข้อมูลประเมินตนเอง</strong>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                กรอกแล้ว {{ teacherJudgeProgressSummary.totalMetrics > 0 ? Math.round((teacherProgress / 100) * teacherJudgeProgressSummary.totalMetrics) : 0 }} จาก {{ teacherJudgeProgressSummary.totalMetrics }} ตัวชี้วัด ({{ teacherProgress }}%)
              </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span v-if="teacherSubmissionStatus === 'SUBMITTED' && !isEditingSelfEval" class="tag green" style="font-size: 12px; padding: 4px 10px;">
                ส่งข้อมูลเรียบร้อยแล้ว
              </span>
              <span v-else-if="isEditingSelfEval" class="tag yellow" style="font-size: 12px; padding: 4px 10px;">
                อยู่ระหว่างแก้ไขข้อมูล
              </span>
              <span v-else class="tag yellow" style="font-size: 12px; padding: 4px 10px;">
                ยังไม่ได้ส่งข้อมูล
              </span>
              <button
                v-if="teacherSubmissionStatus === 'SUBMITTED' && !isEditingSelfEval"
                type="button"
                class="btn-outline btn-sm"
                @click="requestEditSelfEval">
                ขอแก้ไขข้อมูล
              </button>
              <button
                v-if="isEditingSelfEval"
                type="button"
                class="btn-outline btn-sm"
                style="color: var(--danger); border-color: #fca5a5;"
                @click="cancelEditSelfEval">
                ยกเลิกการแก้ไข
              </button>
            </div>
          </div>
          <div class="progress-bar-wrap" style="margin-top: 10px;">
            <div class="progress-bar" :style="{ width: teacherProgress + '%' }"></div>
          </div>
        </div>

        <!-- Evaluation Table -->
        <div class="table-wrap card">
          <table class="table">
            <thead>
              <tr>
                <th width="45">ข้อ</th>
                <th width="280">ตัวชี้วัด &amp; ค่าน้ำหนัก</th>
                <th width="210">ระดับการประเมินตนเอง *</th>
                <th>ความคิดเห็นและผลการดำเนินงาน</th>
                <th width="160">เอกสารร่องรอยหลักฐาน</th>
                <th width="160">สถานะการตรวจของกรรมการ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, idx) in metrics" :key="m.id">
                <td>{{ idx + 1 }}</td>
                <td>
                  <div v-if="m.categoryName" style="margin-bottom: 3px;">
                    <span class="tag blue" style="font-size: 10.5px;">{{ m.categoryName }}</span>
                  </div>
                  <strong>{{ m.title }}</strong>
                  <div style="color: var(--text-muted); font-size: 11.5px;">
                    น้ำหนัก {{ m.weight }}% | {{ m.description }}
                  </div>
                </td>
                <td>
                  <select v-if="m.evalType === 'SCALE'" v-model="teacherScores[m.id]" :disabled="isTeacherFormLocked">
                    <option value="" disabled>-- เลือกระดับคะแนน --</option>
                    <option value="4">ระดับ 4 - สูงกว่าคาดหวัง</option>
                    <option value="3">ระดับ 3 - ตามคาดหวัง</option>
                    <option value="2">ระดับ 2 - ต่ำกว่าคาดหวัง</option>
                    <option value="1">ระดับ 1 - ต่ำกว่าคาดหวังมาก</option>
                  </select>
                  <select v-else v-model="teacherScores[m.id]" :disabled="isTeacherFormLocked">
                    <option value="" disabled>-- เลือกผลการปฏิบัติ --</option>
                    <option value="4">มีการปฏิบัติ (4 คะแนน)</option>
                    <option value="0">ไม่มีการปฏิบัติ (0 คะแนน)</option>
                  </select>
                </td>
                <td>
                  <textarea
                    v-model="teacherComments[m.id]"
                    rows="2"
                    placeholder="อธิบายผลการปฏิบัติงาน..."
                    :disabled="isTeacherFormLocked">
                  </textarea>
                </td>
                <td>
                  <div v-if="teacherEvidence[m.id]" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <a :href="teacherEvidence[m.id]" target="_blank" class="btn-outline btn-sm" style="text-decoration: none;">
                      เปิดไฟล์
                    </a>
                    <button
                      v-if="!isTeacherFormLocked"
                      type="button"
                      @click="teacherEvidence[m.id] = ''"
                      class="btn-outline btn-sm"
                      style="color: var(--danger); border-color: #fca5a5; padding: 2px 6px;">
                      ✕
                    </button>
                  </div>
                  <div v-if="!isTeacherFormLocked && !teacherEvidence[m.id]">
                    <input type="file" @change="uploadTeacherFile($event, m.id)" style="font-size: 11px;" />
                  </div>
                  <div v-else-if="!teacherEvidence[m.id]" style="font-size: 11.5px; color: var(--text-muted);">
                    (ไม่มีเอกสารแนบ)
                  </div>
                </td>
                <td>
                  <div style="font-size: 11.5px;">
                    <span :class="['tag', getMetricJudgeProgress(m.id).percent === 100 ? 'green' : (getMetricJudgeProgress(m.id).evaluatedCount > 0 ? 'sky' : 'gray')]">
                      {{ getMetricJudgeProgress(m.id).statusLabel }}
                    </span>
                    <div style="margin-top: 4px; font-size: 11px; color: var(--text-muted);">
                      ตรวจแล้ว: <strong>{{ getMetricJudgeProgress(m.id).evaluatedCount }} / {{ getMetricJudgeProgress(m.id).requiredJudges }} ท่าน</strong>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Submit Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 14px 16px; border-radius: var(--radius); border: 1px solid var(--border); margin-top: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <span style="font-size: 12.5px; color: var(--text-muted);">สถานะปัจจุบัน: </span>
            <strong :style="teacherSubmissionStatus === 'SUBMITTED' ? 'color: var(--success);' : 'color: var(--primary);'">
              {{ teacherSubmissionStatus === 'SUBMITTED' ? (isEditingSelfEval ? 'กำลังแก้ไขข้อมูลแบบประเมิน' : 'ส่งข้อมูลเรียบร้อยแล้ว (ล็อคการแก้ไข)') : 'ยังไม่ได้ส่งข้อมูล' }}
            </strong>
          </div>
          <div style="display: flex; gap: 8px;">
            <button
              v-if="teacherSubmissionStatus === 'SUBMITTED' && !isEditingSelfEval"
              type="button"
              class="btn-outline"
              @click="requestEditSelfEval">
              ขอแก้ไขข้อมูล
            </button>
            <button
              v-if="!isTeacherFormLocked"
              type="button"
              class="btn-primary"
              @click="saveTeacherSelf(isEditingSelfEval)">
              {{ isEditingSelfEval ? 'บันทึกและส่งข้อมูลใหม่ (รีเซ็ตผลตรวจเดิม)' : 'บันทึกและส่งแบบประเมินตนเอง' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tab 2: Judge Feedback & Consolidated Summary -->
      <div v-else-if="teacherTab === 'judge'">
        <!-- Consolidated Summary Card -->
        <div v-if="teacherConsolidatedSummary" class="card" style="margin-bottom: 14px; background: #f0fdf4; border: 1px solid #bbf7d0;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-size: 11.5px; color: var(--success); font-weight: 700; text-transform: uppercase;">
                สรุปผลการประเมินภาพรวม (Consolidated Summary)
              </div>
              <h3 style="font-size: 18px; font-weight: 700; color: #166534; margin-top: 2px;">
                คะแนนเฉลี่ยรวม: {{ teacherConsolidatedSummary.averageTotalScore ? teacherConsolidatedSummary.averageTotalScore + ' / 4.00' : 'รอการตรวจครบถ้วน' }}
              </h3>
              <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
                คณะกรรมการตรวจเสร็จสมบูรณ์แล้ว <strong>{{ teacherConsolidatedSummary.judgeCount }} / {{ teacherRequiredJudges }} ท่าน</strong>
              </p>
            </div>
            <div>
              <button
                v-if="teacherConsolidatedSummary.judgeCount > 0"
                type="button"
                class="btn-primary"
                @click="triggerPrintConsolidated">
                พิมพ์แบบสรุปผลเฉลี่ยรวม (PDF)
              </button>
            </div>
          </div>
        </div>

        <!-- Individual Judges Results -->
        <div v-if="teacherJudgeEvaluations.length > 0" class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button
                v-for="(j, idx) in teacherJudgeEvaluations"
                :key="j.assignmentId"
                :class="['btn-sm', selectedJudgeEvalIdx === idx ? 'active' : '']"
                @click="selectedJudgeEvalIdx = idx">
                {{ j.judgeName }} ({{ j.roleInBoard }})
              </button>
            </div>
            <button
              v-if="currentSelectedJudgeEval"
              type="button"
              class="btn-outline btn-sm"
              @click="triggerPrintIndividualForTeacher">
              พิมพ์รายงานผลฉบับกรรมการท่านนี้ (PDF)
            </button>
          </div>

          <div v-if="currentSelectedJudgeEval" style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; background: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 10px; flex-wrap: wrap; gap: 8px;">
              <div>
                <strong style="font-size: 15px; color: var(--text);">{{ currentSelectedJudgeEval.judgeName }}</strong>
                <div style="font-size: 12px; color: var(--text-muted);">
                  {{ currentSelectedJudgeEval.roleInBoard }} | ตำแหน่ง: {{ currentSelectedJudgeEval.judgePosition || 'กรรมการ' }}
                </div>
              </div>
              <div>
                <span class="tag green" style="font-size: 13px; font-weight: 700;">
                  คะแนนที่ให้: {{ currentSelectedJudgeEval.totalScore }} / 4.00
                </span>
              </div>
            </div>

            <div v-if="currentSelectedJudgeEval.overallFeedback" style="background: #f8fafc; border-left: 4px solid var(--primary); padding: 10px 12px; border-radius: 4px; font-size: 13px; color: #1e293b; margin-bottom: 14px;">
              <strong>ข้อคิดเห็นและข้อเสนอแนะในการพัฒนา:</strong>
              <div style="margin-top: 4px; white-space: pre-line;">{{ currentSelectedJudgeEval.overallFeedback }}</div>
            </div>

            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th width="45">ข้อ</th>
                    <th>ตัวชี้วัด</th>
                    <th width="100" style="text-align: center;">น้ำหนัก</th>
                    <th width="140" style="text-align: center;">คะแนนประเมินตนเอง</th>
                    <th width="140" style="text-align: center;">คะแนนจากกรรมการ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(m, idx) in metrics" :key="m.id">
                    <td>{{ idx + 1 }}</td>
                    <td>
                      <strong>{{ m.title }}</strong>
                      <div style="font-size: 11px; color: var(--text-muted);">{{ m.description }}</div>
                    </td>
                    <td style="text-align: center;">{{ m.weight }}%</td>
                    <td style="text-align: center;">
                      <span class="tag blue">
                        {{ m.evalType === 'BOOLEAN' ? (teacherScores[m.id] === '4' ? 'มี' : 'ไม่มี') : 'ระดับ ' + (teacherScores[m.id] || '-') }}
                      </span>
                    </td>
                    <td style="text-align: center;">
                      <strong style="color: var(--primary); font-size: 13px;">
                        {{ currentSelectedJudgeEval.metricScores?.[m.id] ? currentSelectedJudgeEval.metricScores[m.id] + ' / 4.00' : '-' }}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-else class="card" style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
          <div>ยังไม่มีผลการตรวจประเมินจากคณะกรรมการในรอบการประเมินนี้</div>
          <div style="font-size: 12px; margin-top: 4px;">เมื่อคณะกรรมการกดรับและตรวจประเมินเรียบร้อยแล้ว ผลการประเมินจะแสดงที่นี่</div>
        </div>
      </div>
    </div>
  `
};
