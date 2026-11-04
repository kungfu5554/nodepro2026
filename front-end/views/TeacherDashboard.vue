<template>
  <div class="teacher-container">
    
    
    
        <button class="btn-edit-profile" @click="openEditProfileModal">
          ✏️ แก้ไขข้อมูลส่วนตัว
        </button>
        
        <button class="btn-export-pdf" @click="exportToPDF">
          📄 Export ผลเป็น PDF
        </button>
      </div>
    </div>

    
    
    
    
          <div class="form-group mt-3">
            <label><strong>รายละเอียดผลการปฏิบัติงาน / ร่องรอยการดำเนินงาน:</strong></label>
            <textarea 
              v-model="evalData[m.id].detail" 
              rows="2" 
              placeholder="ระบุรายละเอียดผลงาน ผลการจัดกิจกรรมการเรียนรู้ หรือผลสัมฤทธิ์ที่เกิดขึ้น..."
            ></textarea>
          </div>

          
          <div class="score-area mt-3">
            <label><strong>กรอกคะแนนการประเมินของตนเอง:</strong></label>
            
            
      <div class="card-footer-actions">
        <button class="btn-save-all" @click="saveSelfEvaluation">
          💾 บันทึกและส่งข้อมูลการประเมินตนเองทั้งหมด
        </button>
      </div>
    </div>


    
    <!-- ============================================================== -->
    <div class="printable-area" id="printReport">
      <div class="report-box">
        <div class="report-header">
          <div class="badge-doc">เอกสารประเมินตนเอง • แบบรายงานสรุปผลการปฏิบัติงาน</div>
          <h2>แบบรายงานผลการประเมินตนเองของผู้รับการประเมิน (Self-Assessment Report)</h2>
          <p>รอบการประเมินประจำปีงบประมาณ 2568 | วันที่จัดพิมพ์: 3 พฤศจิกายน 2568</p>
        </div>

        <div class="report-profile">
          <p><strong>ชื่อ-สกุล ผู้รับการประเมิน:</strong> {{ userProfile.name }}</p>
          <p><strong>เลขบัตรประชาชน:</strong> {{ userProfile.citizenId }} | <strong>ตำแหน่ง:</strong> {{ userProfile.position }} | <strong>แผนก:</strong> {{ userProfile.department }}</p>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th width="50">ข้อที่</th>
              <th>ตัวชี้วัดการประเมิน</th>
              <th width="90">น้ำหนัก</th>
              <th>รายละเอียดผลงานที่ดำเนินการ</th>
              <th width="120">คะแนนประเมินตนเอง</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(m, i) in metricsList" :key="m.id">
              <td style="text-align: center;">{{ i + 1 }}</td>
              <td><strong>{{ m.title }}</strong></td>
              <td style="text-align: center;">{{ m.weight }}%</td>
              <td>{{ evalData[m.id].detail || 'ได้จัดทำแผนและปฏิบัติงานตามเกณฑ์มาตรฐาน' }}</td>
              <td style="text-align: center;">
                <strong>ระดับ {{ evalData[m.id].score || 4 }}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="report-comment-box" v-if="judgeComment">
          <strong>ความคิดเห็นของกรรมการผู้ประเมิน:</strong>
          <p>"{{ judgeComment }}"</p>
        </div>

        <div class="report-signatures">
          <div class="sig-space">
            <p>ลงชื่อ..........................................................</p>
            <p>({{ userProfile.name }})</p>
            <small>ผู้รับการประเมินตนเอง</small>
          </div>
          <div class="sig-space">
            <p>ลงชื่อ..........................................................</p>
            <p>(ดร.สมศักดิ์ ทรงธรรม)</p>
            <small>ประธานกรรมการผู้ประเมิน</small>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'

const props = defineProps(['user', 'sharedData'])

// 1. ข้อมูลส่วนตัว
const userProfile = reactive({
  citizenId: props.user.citizenId,
  name: props.user.name,
  department: props.user.department || 'แผนกวิชาเทคโนโลยีสารสนเทศ',
  position: props.user.position || 'ครู คศ.1',
  phone: props.user.phone || '081-234-5678',
  email: props.user.email || 'somchai.j@vec.ac.th'
})

// Modal แก้ไขข้อมูลส่วนตัว
const showEditProfileModal = ref(false)
const editForm = ref({ ...userProfile })

const openEditProfileModal = () => {
  editForm.value = { ...userProfile }
  showEditProfileModal.value = true
}

const saveProfileChanges = () => {
  userProfile.name = editForm.value.name
  userProfile.department = editForm.value.department
  userProfile.position = editForm.value.position
  userProfile.phone = editForm.value.phone
  userProfile.email = editForm.value.email

  // อัปเดตไปยังฐานข้อมูลส่วนกลางด้วย
  const target = props.sharedData?.users?.find(u => u.citizenId === userProfile.citizenId)
  if (target) {
    target.name = userProfile.name
    target.department = userProfile.department
    target.position = userProfile.position
  }

  alert('บันทึกและแก้ไขข้อมูลส่วนตัว สำเร็จเรียบร้อย!')
  showEditProfileModal.value = false
}

// 2. ข้อมูลตัวชี้วัด & การประเมินตนเอง
const metricsList = computed(() => props.sharedData?.metrics || [])

// เก็บผลการประเมินตนเองในแต่ละข้อ
const evalData = reactive({
  1: { score: 4, detail: 'จัดทำแผนการสอนมุ่งเน้นสมรรถนะครบ 18 สัปดาห์ พร้อมบันทึกหลังสอน', evidence: 'แผนการจัดการเรียนรู้_2568.pdf' },
  2: { score: 3, detail: 'เข้ารับการอบรมพัฒนาทักษะวิชาชีพครู AI ในการศึกษา จำนวน 24 ชั่วโมง', evidence: 'https://drive.google.com/cert-2568' },
  3: { score: 'มี', detail: 'ปฏิบัติหน้าที่ครูที่ปรึกษาชมรมวิชาชีพ และร่วมกิจกรรมหน้าเสาธงสม่ำเสมอ', evidence: 'ภาพกิจกรรม_จิตอาสา.jpg' }
})

// รับรองว่ามีค่าเริ่มต้นรองรับตัวชี้วัดทุกตัว
metricsList.value.forEach(m => {
  if (!evalData[m.id]) {
    evalData[m.id] = { score: null, detail: '', evidence: '' }
  }
})

// Score level descriptions (1-4 scale)
const getLevelDesc = (lvl) => {
  if (lvl === 1) return 'ปฏิบัติได้ต่ำกว่าระดับที่คาดหวังมาก'
  if (lvl === 2) return 'ปฏิบัติได้ต่ำกว่าระดับที่คาดหวัง'
  if (lvl === 3) return 'ปฏิบัติได้ตามระดับการปฏิบัติที่คาดหวัง'
  return 'ปฏิบัติได้สูงกว่าระดับการปฏิบัติที่คาดหวัง'
}

const isMetricDone = (id) => {
  return evalData[id] && evalData[id].score !== null && evalData[id].score !== undefined
}

// Evaluation progress calculation
const completedCount = computed(() => {
  return metricsList.value.filter(m => isMetricDone(m.id)).length
})

const progressPercentage = computed(() => {
  if (metricsList.value.length === 0) return 0
  return Math.round((completedCount.value / metricsList.value.length) * 100)
})

const handleFileUpload = (e, mId) => {
  const file = e.target.files[0]
  if (file) {
    evalData[mId].evidence = file.name
  }
}

// Implementation details
const saveSelfEvaluation = () => {
  alert('บันทึกข้อมูลการประเมินตนเองในแต่ละตัวชี้วัด เรียบร้อยแล้ว! ข้อมูลส่งถึงกรรมการแล้ว')
}

// 4. ดูความคิดเห็นของกรรมการ
const judgeComment = ref('ครูสมชายมีความตั้งใจในการเตรียมการสอนและสร้างสรรค์สื่อนวัตกรรมดิจิทัลได้ดีเยี่ยม ขอให้รักษามาตรฐานและต่อยอดผลงานวิจัยต่อไป')

// 5. Export PDF
const exportToPDF = () => {
  window.print()
}
</script>

<style scoped>
.teacher-container {
  max-width: 1100px;
  margin: 24px auto;
  padding: 0 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1e293b;
}

/* Component styling */
.printable-area { display: none; }

@media print {
  body * { visibility: hidden; }
  .no-print { display: none !important; }
  .printable-area, .printable-area * { visibility: visible; }
  .printable-area {
    display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 20px 40px; font-family: 'Sarabun', sans-serif;
  }
  .report-box { border: 2px solid #000; padding: 30px; }
  .report-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 20px; }
  .badge-doc { font-size: 11px; font-weight: bold; margin-bottom: 4px; }
  .report-header h2 { margin: 0 0 6px 0; font-size: 20px; }
  .report-header p { margin: 0; font-size: 12px; }
  .report-profile { margin-bottom: 20px; font-size: 13px; }
  .report-profile p { margin: 4px 0; }
  .report-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
  .report-table th, .report-table td { border: 1px solid #000; padding: 8px 10px; }
  .report-table th { background: #f0f0f0; }
  .report-comment-box { border: 1px solid #000; padding: 12px; border-radius: 6px; font-size: 12px; margin-bottom: 30px; }
  .report-signatures { display: flex; justify-content: space-around; text-align: center; font-size: 12px; margin-top: 40px; }
  .sig-space { width: 220px; }
  .sig-space p { margin: 6px 0; }
}
</style>