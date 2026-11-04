<template>
  <div class="judge-container">
    
    
    
    
      <div class="card mb-4">
        <div class="table-title-row">
          <h3>📋 ตารางประเมินผลตามตัวชี้วัด</h3>
          <small class="text-muted">ตรวจสอบหลักฐานและคะแนนประเมินตนเอง ก่อนบันทึกคะแนนของกรรมการ</small>
        </div>

        <div class="table-wrapper mt-3">
          <table class="eval-table">
            <thead>
              <tr>
                <th width="50">ลำดับ</th>
                <th width="300">หัวข้อ & ตัวชี้วัด และรายละเอียด</th>
                <th width="150">หลักฐานที่แนบ</th>
                <th width="140">คะแนนประเมินตนเอง</th>
                <th width="240">คะแนนที่กรรมการให้ (1 - 4)</th>
                <th width="110" style="text-align: right;">คะแนนถ่วงน้ำหนัก</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, idx) in metricsList" :key="m.id">
                <td style="text-align: center;"><strong>{{ idx + 1 }}</strong></td>
                
                
                <td>
                  <span class="metric-cat">{{ m.category || 'ด้านวิชาชีพ' }}</span>
                  <strong class="d-block metric-name">{{ m.title }}</strong>
                  <p class="metric-desc">{{ m.description || 'จัดทำแผนการสอนและใช้สื่อนวัตกรรมในการจัดการเรียนรู้' }}</p>
                  <small class="text-primary font-bold">น้ำหนักคะแนน: {{ m.weight }}%</small>
                </td>

                
                <td>
                  <div class="evidence-box">
                    <span class="evidence-icon">📁</span>
                    <div>
                      <small class="d-block text-muted">รูปแบบ: {{ m.evidenceType }}</small>
                      <button class="btn-evidence-view" @click="viewEvidence(m)">
                        🔍 ดูหลักฐาน
                      </button>
                    </div>
                  </div>
                </td>

                
                <td style="text-align: center;">
                  <span class="self-score-badge">
                    {{ getSelfScoreText(m.id) }}
                  </span>
                </td>

                
                <td>
                  
                <td style="text-align: right;">
                  <strong class="weighted-score">
                    {{ calculateWeighted(m.id, m.weight) }}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        
        <div class="score-summary-bar mt-4">
          <div class="summary-left">
            <span>สรุปผลการประเมินรายบุคคล:</span>
            <strong class="performance-level">ระดับผลการปฏิบัติงาน: {{ performanceGrade }}</strong>
          </div>
          <div class="summary-right">
            <span>คะแนนเฉลี่ยรวมสุทธิ (GPA):</span>
            <strong class="total-score-number">{{ totalCalculatedScore }} / 4.00</strong>
          </div>
        </div>
      </div>


      
      
      
        <button class="btn-submit-eval" @click="confirmAndSubmitEvaluation">
          ✍️ ยืนยันและส่งผลการประเมิน
        </button>
      </div>

    </div>

  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'

const props = defineProps(['user', 'sharedData'])

// Assigned evaluatees list
const assignedTeachers = computed(() => {
  return props.sharedData?.users?.filter(u => u.role === 'teacher') || []
})

const selectedTeacherId = ref('1100200000002')

const currentTeacher = computed(() => {
  return assignedTeachers.value.find(t => t.citizenId === selectedTeacherId.value)
})

const selectTeacher = (t) => {
  selectedTeacherId.value = t.citizenId
  loadTeacherEvaluation(t.citizenId)
}

// Evaluation metrics list
const metricsList = computed(() => props.sharedData?.metrics || [])

// Self-evaluation benchmark scores
const teacherSelfScores = reactive({
  '1100200000002': { 1: 4, 2: 3, 3: 'มี' }
})

const getSelfScoreText = (metricId) => {
  const scores = teacherSelfScores[selectedTeacherId.value]
  if (scores && scores[metricId]) {
    return scores[metricId] === 'มี' ? 'มี' : `ระดับ ${scores[metricId]}`
  }
  return 'ระดับ 3'
}

// Evaluator scores (1 - 4)
const judgeScores = reactive({
  1: 4,
  2: 4,
  3: 'มี'
})

// ปรับค่าให้รองรับทุกตัวชี้วัด
metricsList.value.forEach(m => {
  if (judgeScores[m.id] === undefined) {
    judgeScores[m.id] = m.evalType === 'SCALE' ? 3 : 'มี'
  }
})

// Compute weighted score per metric
const calculateWeighted = (mId, weight) => {
  const score = judgeScores[mId]
  if (score === 'มี') return `${((4 * weight) / 100).toFixed(2)}`
  if (score === 'ไม่มี') return '0.00'
  return `${((Number(score) * weight) / 100).toFixed(2)}`
}

// Compute cumulative total score (4.00 scale)
const totalCalculatedScore = computed(() => {
  let total = 0
  metricsList.value.forEach(m => {
    const val = Number(calculateWeighted(m.id, m.weight))
    total += val
  })
  return total.toFixed(2)
})

const performanceGrade = computed(() => {
  const s = Number(totalCalculatedScore.value)
  if (s >= 3.50) return 'ดีเด่น (Outstanding)'
  if (s >= 3.00) return 'ดีมาก (Very Good)'
  if (s >= 2.00) return 'พอใช้ (Fair)'
  return 'ต้องปรับปรุง (Needs Improvement)'
})

// Evaluator overall feedback
const judgeFeedbackText = ref('ผลการปฏิบัติงานเป็นไปตามเกณฑ์มาตรฐานวิชาชีพ มีความรับผิดชอบในการปฏิบัติงานอย่างดียิ่ง')

// Evaluator digital signature
const judgeSignatureImg = ref('')
const onJudgeSigUpload = (e) => {
  const file = e.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (ev) => { judgeSignatureImg.value = ev.target.result }
    reader.readAsDataURL(file)
  }
}

// Confirm and submit evaluation
const evaluatedTeachersSet = ref(new Set(['1100200000002']))
const isTeacherEvaluated = (cId) => evaluatedTeachersSet.value.has(cId)

const confirmAndSubmitEvaluation = () => {
  if (!judgeFeedbackText.value.trim()) {
    alert('กรุณากรอกความคิดเห็นสรุปโดยภาพรวมของการประเมิน!')
    return
  }

  // อัปเดตสถานะและคะแนนเข้าฐานข้อมูลกลาง
  evaluatedTeachersSet.value.add(selectedTeacherId.value)

  // อัปเดตไปยัง assignments ใน sharedData เพื่อให้ HR และครูเห็นผลทันที
  if (props.sharedData?.assignments) {
    let assign = props.sharedData.assignments.find(a => a.teacherCitizenId === selectedTeacherId.value)
    if (!assign) {
      assign = { teacherCitizenId: selectedTeacherId.value }
      props.sharedData.assignments.push(assign)
    }
    assign.status = 'DONE'
    assign.finalScore = totalCalculatedScore.value
    assign.feedback = judgeFeedbackText.value
    assign.judgeName = props.user.name
  }

  alert(`บันทึกและส่งผลการประเมินของ "${currentTeacher.value.name}" เรียบร้อยแล้ว!\nคะแนนสุทธิ: ${totalCalculatedScore.value} / 4.00`)
}

// ดูหลักฐาน
const viewEvidence = (m) => {
  alert(`หลักฐานประกอบตัวชี้วัด: ${m.title}\nรูปแบบหลักฐาน: ${m.evidenceType}\nไฟล์: ผลงาน_${currentTeacher.value.name}_2568.${m.evidenceType.toLowerCase()}`)
}

const loadTeacherEvaluation = (cId) => {
  if (cId === '1100200000002') {
    judgeScores[1] = 4
    judgeScores[2] = 4
    judgeScores[3] = 'มี'
    judgeFeedbackText.value = 'มีแผนการจัดการเรียนรู้ที่สอดคล้องกับมาตรฐานอาชีพ นำสื่อเทคโนโลยีดิจิทัลมาใช้ในการสอนได้ดีเยี่ยม'
  } else {
    judgeScores[1] = 3
    judgeScores[2] = 3
    judgeScores[3] = 'มี'
    judgeFeedbackText.value = 'ปฏิบัติหน้าที่การสอนได้ตามเกณฑ์มาตรฐาน'
  }
}
</script>

<style scoped>
.judge-container {
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
  background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px;
}

.judge-profile-chip {
  background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 8px 16px;
  display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.03);
}
.judge-avatar {
  width: 38px; height: 38px; background: #fef3c7; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}

.card {
  background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 22px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

/* Candidate Selector */
.section-title h3 { margin: 0 0 2px 0; font-size: 15.5px; color: #0f172a; }
.teacher-selector-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;
}
.teacher-card {
  border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px; display: flex;
  align-items: center; gap: 12px; cursor: pointer; transition: all 0.2s; background: #fcfcfd;
}
.teacher-card:hover { border-color: #3b82f6; background: #eff6ff; }
.teacher-card.active { border-color: #2563eb; background: #eff6ff; box-shadow: 0 4px 10px rgba(37,99,235,0.15); }
.t-avatar { font-size: 24px; }
.t-info { flex: 1; }
.t-info strong { display: block; font-size: 13.5px; color: #0f172a; }
.t-info p { margin: 2px 0; font-size: 11.5px; color: #64748b; }
.status-pill { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 20px; }
.status-pill.done { background: #dcfce7; color: #15803d; }
.status-pill.waiting { background: #fef3c7; color: #b45309; }

/* Evaluating Target Banner */
.eval-target-banner {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  color: #ffffff; border-radius: 14px; padding: 18px 22px;
  display: flex; justify-content: space-between; align-items: center;
}
.label-evaluating { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #93c5fd; }
.eval-target-banner h3 { margin: 4px 0; font-size: 20px; }
.eval-target-banner p { margin: 0; font-size: 12.5px; color: #cbd5e1; }
.badge-board {
  background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;
}

/* Evaluation Table */
.table-title-row { display: flex; justify-content: space-between; align-items: center; }
.table-title-row h3 { margin: 0; font-size: 16px; color: #0f172a; }
.table-wrapper { overflow-x: auto; }
.eval-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.eval-table th {
  background-color: #f8fafc; padding: 12px 14px; text-align: left; color: #475569; font-weight: 700; border-bottom: 1px solid #e2e8f0;
}
.eval-table td { padding: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }

.metric-cat { font-size: 10.5px; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-weight: 700; }
.metric-name { font-size: 13.5px; color: #0f172a; margin-top: 4px; }
.metric-desc { margin: 4px 0 6px; font-size: 11.5px; color: #64748b; line-height: 1.4; }

.evidence-box { display: flex; align-items: center; gap: 8px; }
.evidence-icon { font-size: 20px; }
.btn-evidence-view {
  background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 8px; border-radius: 6px;
  font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer; margin-top: 2px;
}
.btn-evidence-view:hover { background: #e2e8f0; }

.self-score-badge {
  background: #dcfce7; color: #15803d; font-weight: 800; font-size: 12.5px;
  padding: 4px 10px; border-radius: 8px; display: inline-block;
}

.select-score {
  width: 100%; padding: 8px 10px; border: 1.5px solid #2563eb; border-radius: 8px;
  font-size: 12px; font-weight: 700; color: #0f172a; background: #eff6ff; outline: none;
}
.judge-bool-input { display: flex; gap: 8px; }
.judge-bool-input label {
  border: 1.5px solid #cbd5e1; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;
}
.judge-bool-input label.active { border-color: #2563eb; background: #eff6ff; color: #2563eb; }

.weighted-score { color: #2563eb; font-size: 15px; }

/* Summary Bar */
.score-summary-bar {
  background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px 20px;
  display: flex; justify-content: space-between; align-items: center;
}
.summary-left span { font-size: 12.5px; color: #64748b; display: block; }
.performance-level { font-size: 15px; color: #16a34a; }
.summary-right { text-align: right; }
.summary-right span { font-size: 12px; color: #64748b; display: block; }
.total-score-number { font-size: 22px; color: #2563eb; }

/* Feedback Textarea */
textarea {
  width: 100%; padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 10px;
  font-size: 13.5px; outline: none; box-sizing: border-box; font-family: inherit;
}
textarea:focus { border-color: #2563eb; }

/* Submit Card */
.submit-evaluation-card {
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;
  background: #fdfdfd; border-color: #cbd5e1;
}
.sig-section label { display: block; font-size: 13px; color: #0f172a; margin-bottom: 6px; }
.sig-upload-row { display: flex; align-items: center; gap: 12px; }
.file-sig-input { font-size: 12px; }
.sig-hint { font-size: 12px; }
.sig-preview-chip {
  display: flex; align-items: center; gap: 8px; background: #fff; padding: 4px 8px;
  border: 1px solid #e2e8f0; border-radius: 6px;
}
.sig-preview-chip img { max-height: 35px; }
.btn-remove-sig { background: #fee2e2; color: #dc2626; border: none; padding: 2px 6px; border-radius: 4px; font-size: 11px; cursor: pointer; }

.btn-submit-eval {
  background-color: #16a34a; color: #ffffff; border: none; padding: 12px 24px; border-radius: 10px;
  font-size: 14.5px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 10px rgba(22,163,74,0.25);
}
.btn-submit-eval:hover { background-color: #15803d; }

.text-muted { color: #64748b; font-size: 12px; }
.d-block { display: block; }
.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 20px; }
.mt-3 { margin-top: 14px; }
.mt-4 { margin-top: 20px; }
</style>