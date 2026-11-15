// public/js/components/JudgeDashboard.js
import {
  currentUser, allPeriods, selectedPeriodId
} from '../composables/useAppState.js';
import {
  judgeViewMode, judgeCandidates, candidateGradingMetrics,
  judgeScores, judgeOverallFeedback, judgeSignatureMode, judgeSignatureData, judgeProfileSignatureUrl,
  candidateSearchQuery, candidateFilterStatus,
  filteredJudgeCandidates, judgeStats, claimedJudgeCandidates, currentJudgeCandidate,
  judgeWorkspaceSummary
} from '../composables/useJudge.js';

export default {
  name: 'JudgeDashboard',
  props: {
    actions: { type: Object, required: true }
  },
  setup(props) {
    return {
      currentUser,
      allPeriods,
      selectedPeriodId,
      judgeViewMode,
      judgeCandidates,
      candidateGradingMetrics,
      judgeScores,
      judgeOverallFeedback,
      judgeSignatureMode,
      judgeSignatureData,
      judgeProfileSignatureUrl,
      candidateSearchQuery,
      candidateFilterStatus,
      filteredJudgeCandidates,
      judgeStats,
      claimedJudgeCandidates,
      currentJudgeCandidate,
      judgeWorkspaceSummary,
      ...props.actions
    };
  },
  template: `
    <div class="container">
      <!-- Period Selector Header for Judge -->
      <div class="period-bar">
        <div class="period-select-wrap">
          <v-icon name="calendar" size="16" style="color:var(--primary);"></v-icon>
          <strong>รอบการประเมิน:</strong>
          <select v-model="selectedPeriodId" @change="onJudgePeriodChange" style="width: auto; min-width: 280px; font-weight: 600;">
            <option v-for="p in allPeriods" :key="p.id" :value="p.id">
              {{ p.name }} ({{ p.isOpen ? 'เปิดรับประเมิน' : 'ปิดระบบแล้ว' }})
            </option>
          </select>
        </div>
        <div>
          <span style="font-size: 12.5px; color: var(--text-muted);">
            กรรมการผู้ประเมิน: <strong>{{ currentUser.name }}</strong> ({{ currentUser.position || 'กรรมการ' }})
          </span>
        </div>
      </div>

      <!-- MODE 1: CANDIDATE SELECTION LIST -->
      <div v-if="judgeViewMode === 'list'">
        <!-- Judge Summary Cards -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-card-icon blue"><v-icon name="users" size="18"></v-icon></div>
            <div class="stat-card-info">
              <span>รายการที่เห็นได้ทั้งหมด</span>
              <strong>{{ judgeCandidates.length }} คน</strong>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card-icon amber"><v-icon name="clock" size="18"></v-icon></div>
            <div class="stat-card-info">
              <span>เปิดรับการประเมิน</span>
              <strong>{{ judgeStats.available }} คน</strong>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card-icon sky"><v-icon name="edit" size="18"></v-icon></div>
            <div class="stat-card-info">
              <span>กดรับแล้ว (รอตรวจ)</span>
              <strong>{{ judgeStats.claimed }} คน</strong>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card-icon green"><v-icon name="check-circle" size="18"></v-icon></div>
            <div class="stat-card-info">
              <span>ตรวจเสร็จสิ้นแล้ว</span>
              <strong>{{ judgeStats.evaluated }} คน</strong>
            </div>
          </div>
        </div>

        <div class="alert info" style="margin-bottom: 12px;">
          <v-icon name="alert" size="15"></v-icon>
          <span>
            ระบบจะแสดงเฉพาะผู้รับการประเมินที่ <strong>ส่งแบบประเมินตนเองเรียบร้อยแล้ว</strong> และยังไม่ครบจำนวนกรรมการที่กำหนด
            (กรุณากด <strong>"กดรับการประเมิน"</strong> ก่อนเข้าตรวจ และหากครบจำนวนแล้วระบบจะซ่อนจากกรรมการท่านอื่นทันทีเพื่อป้องกันการประเมินซ้ำซ้อน)
          </span>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
              <button v-for="st in ['ALL', 'AVAILABLE', 'CLAIMED', 'EVALUATED']" :key="st"
                      :class="['btn-sm', candidateFilterStatus === st ? 'active' : '']"
                      @click="candidateFilterStatus = st">
                {{ st === 'ALL'
                    ? 'ทั้งหมด (' + judgeCandidates.length + ')'
                    : (st === 'AVAILABLE'
                        ? 'เปิดรับ (' + judgeStats.available + ')'
                        : (st === 'CLAIMED'
                            ? 'รับแล้วรอตรวจ (' + judgeStats.claimed + ')'
                            : 'ตรวจแล้ว (' + judgeStats.evaluated + ')')) }}
              </button>
            </div>
            <div style="position: relative; width: 260px;">
              <input v-model="candidateSearchQuery" placeholder="ค้นหาชื่อครู หรือ แผนกวิชา..." style="padding-left: 28px;" />
              <v-icon name="search" size="13" style="position: absolute; left: 9px; top: 9px; color: var(--text-muted);"></v-icon>
            </div>
          </div>

          <!-- Candidate Grid -->
          <div v-if="filteredJudgeCandidates.length > 0" class="candidate-grid">
            <div v-for="c in filteredJudgeCandidates" :key="c.teacherCitizenId || c.assignmentId" class="candidate-card">
              <div>
                <div class="candidate-header">
                  <div class="candidate-avatar">{{ (c.teacherName || 'ค').charAt(0) }}</div>
                  <div style="flex: 1;">
                    <strong style="font-size: 13.5px; color: var(--text);">{{ c.teacherName }}</strong>
                    <div style="font-size: 11.5px; color: var(--text-muted);">{{ c.department }}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">ตำแหน่ง: {{ c.position || 'ครู' }}</div>
                  </div>
                  <div style="text-align: right;">
                    <div>
                      <span class="tag blue"><v-icon name="check-circle" size="11"></v-icon> ส่งแบบประเมินแล้ว</span>
                    </div>
                    <div style="margin-top: 3px;">
                      <span v-if="c.status === 'EVALUATED'" class="tag green">
                        <v-icon name="check-circle" size="11"></v-icon> ท่านตรวจแล้ว
                      </span>
                      <span v-else-if="c.status === 'CLAIMED'" class="tag sky">
                        <v-icon name="edit" size="11"></v-icon> ท่านกดรับแล้ว
                      </span>
                      <span v-else class="tag yellow">
                        <v-icon name="clock" size="11"></v-icon> เปิดรับการประเมิน
                      </span>
                    </div>
                  </div>
                </div>

                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
                  <div>
                    <span style="color: var(--text-muted);">บทบาทในสาขา: </span>
                    <strong>{{ c.roleInBoard }}</strong>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                      กดรับแล้ว: <strong>{{ c.claimedJudgesCount || 0 }} / {{ c.requiredJudges || 3 }} ท่าน</strong>
                      (ตรวจเสร็จ {{ c.totalJudgesEvaluated || 0 }} ท่าน)
                    </div>
                  </div>
                  <div v-if="c.totalScore" style="text-align: right;">
                    <span style="color: var(--text-muted);">คะแนนของท่าน: </span>
                    <strong style="color: var(--primary); font-size: 13px;">{{ c.totalScore }} / 4.00</strong>
                  </div>
                </div>
              </div>

              <div style="margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap;">
                <button v-if="!c.isClaimedByMe" @click="claimJudgeCandidate(c)" class="btn-primary" style="flex: 1; height: 32px; font-size: 12px;">
                  <v-icon name="check" size="13"></v-icon>
                  <span>กดรับการประเมิน</span>
                </button>
                <template v-else>
                  <button @click="openCandidateGrading(c)" class="btn-primary" style="flex: 1; height: 32px; font-size: 12px;">
                    <v-icon :name="c.myEvaluationCompleted ? 'edit' : 'award'" size="13"></v-icon>
                    <span>{{ c.myEvaluationCompleted ? 'แก้ไขผลประเมิน' : 'เริ่มตรวจประเมิน' }}</span>
                  </button>
                  <button v-if="c.canUnclaim" @click="unclaimJudgeCandidate(c)" class="btn-outline" style="height: 32px; font-size: 12px; color: var(--danger); border-color: #fecaca;" title="ยกเลิกการรับและปล่อยสิทธิ์คืนให้กรรมการท่านอื่น">
                    <v-icon name="close" size="13"></v-icon>
                    <span>ปล่อยคืน</span>
                  </button>
                  <button v-if="c.myEvaluationCompleted" @click="openJudgeReportModal(c)" class="btn-outline" style="height: 32px; font-size: 12px;" title="พิมพ์รายงานสรุปผล PDF">
                    <v-icon name="printer" size="13"></v-icon>
                    <span>PDF</span>
                  </button>
                </template>
              </div>
            </div>
          </div>

          <div v-else style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
            <v-icon name="user" size="28" style="margin-bottom: 6px; opacity: 0.5;"></v-icon>
            <div>ไม่พบรายชื่อผู้รับการประเมินที่พร้อมตรวจตามเงื่อนไขที่ค้นหา</div>
          </div>
        </div>
      </div>

      <!-- MODE 2: CANDIDATE EVALUATION WORKSPACE -->
      <div v-else-if="currentJudgeCandidate" class="card">
        <!-- Back button and candidate switcher header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 8px;">
          <button @click="backToCandidateList" class="btn-outline btn-sm">
            <v-icon name="arrow-left" size="13"></v-icon>
            <span>กลับสู่หน้ารายชื่อผู้รับการประเมิน</span>
          </button>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 12px; color: var(--text-muted);">สลับผู้รับการประเมินที่รับไว้:</span>
            <select :value="currentJudgeCandidate.teacherCitizenId" @change="onJudgeCandidateDropdownChange($event.target.value)" style="width: 240px; height: 30px; font-size: 12px;">
              <option v-for="c in claimedJudgeCandidates" :key="c.teacherCitizenId || c.assignmentId" :value="c.teacherCitizenId">
                {{ c.teacherName }} ({{ c.status === 'EVALUATED' ? 'ตรวจแล้ว' : 'รับแล้วรอตรวจ' }})
              </option>
            </select>
            <button v-if="currentJudgeCandidate.canUnclaim" @click="unclaimJudgeCandidate(currentJudgeCandidate)" class="btn-outline btn-sm" style="color: var(--danger); border-color: #fecaca;">
              <v-icon name="close" size="12"></v-icon>
              <span>ยกเลิกการรับ</span>
            </button>
            <button @click="openJudgeReportModal(currentJudgeCandidate)" class="btn-outline btn-sm">
              <v-icon name="file-text" size="12"></v-icon>
              <span>ดูแบบสรุปรายงาน (PDF)</span>
            </button>
          </div>
        </div>

        <!-- Active Candidate Profile Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; color: var(--primary); font-weight: 700; letter-spacing: 0.03em;">กำลังตรวจประเมิน</div>
            <h2 style="font-size: 17px; font-weight: 700; color: var(--text); margin-top: 1px;">
              {{ currentJudgeCandidate.teacherName }}
            </h2>
            <p style="font-size: 12.5px; color: var(--text-muted);">
              สังกัด: {{ currentJudgeCandidate.department }} | ตำแหน่ง: {{ currentJudgeCandidate.position || 'ครู' }} | บทบาทกรรมการ: {{ currentJudgeCandidate.roleInBoard }} |
              กรรมการรับแล้ว: {{ currentJudgeCandidate.claimedJudgesCount || 0 }} / {{ currentJudgeCandidate.requiredJudges || 3 }} ท่าน
            </p>
          </div>
          <div>
            <span v-if="currentJudgeCandidate.status === 'EVALUATED'" class="tag green" style="padding: 4px 10px; font-size: 12px;">
              <v-icon name="check-circle" size="12"></v-icon> ตรวจประเมินเรียบร้อย (คะแนน: {{ currentJudgeCandidate.totalScore }} / 4.00)
            </span>
            <span v-else class="tag blue" style="padding: 4px 10px; font-size: 12px;">
              <v-icon name="edit" size="12"></v-icon> ท่านกดรับการประเมินแล้ว พร้อมบันทึกคะแนน
            </span>
          </div>
        </div>

        <!-- Evaluation Table with Teacher Comments visible -->
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th width="40">ข้อ</th>
                <th width="260">ตัวชี้วัด & ค่าน้ำหนัก</th>
                <th>ผลการประเมินตนเอง & ความคิดเห็นของผู้รับการประเมิน</th>
                <th width="140">หลักฐานร่องรอย</th>
                <th width="200">คะแนนที่กรรมการให้</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, idx) in candidateGradingMetrics" :key="m.metricId">
                <td>{{ idx + 1 }}</td>
                <td>
                  <div v-if="m.categoryName" style="margin-bottom:3px;"><span class="tag blue" style="font-size:10.5px;">{{ m.categoryName }}</span></div>
                  <strong>{{ m.title }}</strong>
                  <div style="color:var(--text-muted); font-size:11.5px;">น้ำหนัก {{ m.weight }}% | {{ m.description }}</div>
                </td>
                <td>
                  <div style="margin-bottom: 4px;">
                    <span v-if="m.selfScore" class="tag blue">
                      {{ m.evalType === 'BOOLEAN' ? (m.selfScore === 'มี' ? 'มีการปฏิบัติ' : 'ไม่มี') : 'ระดับ ' + m.selfScore }}
                    </span>
                    <span v-else class="tag yellow">ยังไม่ประเมินตนเอง</span>
                  </div>
                  <div v-if="m.teacherComment" style="background:#f1f5f9; border-left:3px solid var(--primary); padding:6px 8px; border-radius:4px; font-size:12px; color:#334155; margin-top:4px;">
                    <strong>ความคิดเห็นครู:</strong> {{ m.teacherComment }}
                  </div>
                  <div v-else style="color:var(--text-muted); font-size:11px; margin-top:4px;">
                    <em>(ไม่มีความคิดเห็นเพิ่มเติมจากผู้รับการประเมิน)</em>
                  </div>
                </td>
                <td>
                  <a v-if="m.evidenceUrl && m.evidenceUrl.trim() !== ''" :href="m.evidenceUrl" target="_blank" class="btn-outline btn-sm" style="text-decoration:none; height:26px; font-size:11.5px; display:inline-flex; align-items:center; gap:4px;">
                    <v-icon name="paperclip" size="12"></v-icon>
                    <span>เปิดดูเอกสารแนบ ({{ m.evidenceType }})</span>
                  </a>
                  <span v-else class="tag gray" style="font-size:11px; display:inline-flex; align-items:center; gap:3px;">
                    <v-icon name="alert" size="11"></v-icon>
                    <span>ไม่มีเอกสารแนบ</span>
                  </span>
                </td>
                <td>
                  <select v-if="m.evalType === 'SCALE'" v-model="judgeScores[m.metricId]">
                    <option value="4">ระดับ 4 - สูงกว่าคาดหวัง</option>
                    <option value="3">ระดับ 3 - ตามคาดหวัง</option>
                    <option value="2">ระดับ 2 - ต่ำกว่าคาดหวัง</option>
                    <option value="1">ระดับ 1 - ต่ำกว่าคาดหวังมาก</option>
                  </select>
                  <select v-else v-model="judgeScores[m.metricId]">
                    <option value="4">มีการปฏิบัติ (4 คะแนน)</option>
                    <option value="0">ไม่มีการปฏิบัติ (0 คะแนน)</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Overall Feedback -->
        <div style="margin-top: 14px;">
          <label><strong>ความคิดเห็นสรุปและข้อเสนอแนะในการพัฒนา *</strong></label>
          <textarea v-model="judgeOverallFeedback" rows="3" placeholder="ระบุความคิดเห็นสรุปผลการปฏิบัติงาน จุดเด่น และสิ่งที่ควรพัฒนา..."></textarea>
        </div>

        <!-- Per-Metric Result Summary Table & Individual Overview -->
        <div style="margin-top: 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; background: #fcfdff;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <strong style="font-size:13.5px; color:var(--text); display:flex; align-items:center; gap:6px;">
              <v-icon name="bar-chart" size="15" style="color:var(--primary);"></v-icon>
              <span>สรุปผลลัพธ์การประเมินแต่ละตัวชี้วัดและภาพรวมรายบุคคล</span>
            </strong>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <span class="tag blue" style="font-size:12px;">คะแนนรวมสุทธิ: <strong>{{ judgeWorkspaceSummary.totalScore }} / 4.00</strong> ({{ judgeWorkspaceSummary.percentage }}%)</span>
              <span class="tag green" style="font-size:12px;">ระดับผล: <strong>{{ judgeWorkspaceSummary.grade }}</strong></span>
            </div>
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th width="45">ข้อ</th>
                  <th>หมวดหมู่ / ตัวชี้วัด</th>
                  <th width="95" style="text-align:center;">น้ำหนัก</th>
                  <th width="110" style="text-align:center;">คะแนนที่ได้ (เต็ม 4)</th>
                  <th width="130" style="text-align:center;">คะแนนถ่วงน้ำหนัก</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, idx) in judgeWorkspaceSummary.rows" :key="r.metricId">
                  <td>{{ idx + 1 }}</td>
                  <td>
                    <span v-if="r.categoryName" class="tag gray" style="font-size:10px; margin-right:6px;">{{ r.categoryName }}</span>
                    <strong>{{ r.title }}</strong>
                  </td>
                  <td style="text-align:center;">{{ r.weight }}%</td>
                  <td style="text-align:center;"><strong>{{ r.score }}</strong></td>
                  <td style="text-align:center;"><strong style="color:var(--primary);">{{ r.weightedPoints }}</strong> / {{ r.weight }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="background:#f8fafc; font-weight:700;">
                  <td colspan="2" style="text-align:right;">รวมภาพรวมของผู้รับการประเมินรายบุคคล:</td>
                  <td style="text-align:center;">{{ judgeWorkspaceSummary.totalWeight }}%</td>
                  <td style="text-align:center; color:var(--primary);">{{ judgeWorkspaceSummary.totalScore }} / 4.00</td>
                  <td style="text-align:center; color:var(--success);">{{ judgeWorkspaceSummary.percentage }}% ({{ judgeWorkspaceSummary.grade }})</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Digital Signature Attachment Panel -->
        <div style="margin-top: 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; background: #f8fafc;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <div>
              <strong style="font-size:13px; color:var(--text);">ลงนามการประเมินโดยแนบลายเซ็นกรรมการ *</strong>
              <div style="font-size:11.5px; color:var(--text-muted);">
                ผู้ลงนาม: <strong>{{ currentUser.name }}</strong> ({{ currentUser.position || 'กรรมการ' }})
              </div>
            </div>
            <div style="display:flex; gap:5px; flex-wrap:wrap;">
              <button type="button" :class="['btn-sm', judgeSignatureMode === 'draw' ? 'active' : '']" @click="judgeSignatureMode = 'draw'">
                <v-icon name="pen" size="12"></v-icon><span>วาดลายเซ็น</span>
              </button>
              <button type="button" :class="['btn-sm', judgeSignatureMode === 'upload' ? 'active' : '']" @click="judgeSignatureMode = 'upload'">
                <v-icon name="upload" size="12"></v-icon><span>อัปโหลดรูปลายเซ็น</span>
              </button>
              <button v-if="judgeProfileSignatureUrl || currentUser.signatureUrl" type="button" :class="['btn-sm', judgeSignatureMode === 'profile' ? 'active' : '']" @click="useProfileJudgeSignature">
                <v-icon name="check-circle" size="12"></v-icon><span>ใช้ลายเซ็นจากโปรไฟล์</span>
              </button>
            </div>
          </div>

          <div v-if="judgeSignatureMode === 'draw'" style="border:1px solid var(--border); background:#fff; border-radius:var(--radius-sm); padding:10px;">
            <canvas id="judgeCanvas" width="460" height="100"
                    style="background:#fff; border:1px dashed #94a3b8; border-radius:4px; display:block; margin:0 auto; cursor:crosshair; max-width:100%;"
                    @mousedown="startJudgeDraw" @mousemove="drawingJudge" @mouseup="stopJudgeDraw" @mouseleave="stopJudgeDraw"
                    @touchstart="judgeTouchStart" @touchmove="judgeTouchMove" @touchend="stopJudgeDraw"></canvas>
            <div style="margin-top:8px; display:flex; gap:8px; justify-content:center; align-items:center; flex-wrap:wrap;">
              <button type="button" class="btn-sm" @click="clearJudgeCanvas"><v-icon name="eraser" size="12"></v-icon><span>ล้างลายเซ็น</span></button>
              <button type="button" class="btn-primary btn-sm" @click="captureJudgeCanvas(false)"><v-icon name="check" size="12"></v-icon><span>ยืนยันลายเซ็น</span></button>
            </div>
          </div>

          <div v-else-if="judgeSignatureMode === 'upload'" style="border:1px solid var(--border); background:#fff; border-radius:var(--radius-sm); padding:10px;">
            <input type="file" accept="image/*" @change="onJudgeSigUpload" />
            <small style="display:block; margin-top:4px; color:var(--text-muted);">รองรับไฟล์ PNG, JPG, GIF (แนะนำพื้นหลังขาวหรือโปร่งใส)</small>
          </div>

          <div v-if="judgeSignatureData" style="margin-top:10px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <span class="tag green"><v-icon name="check-circle" size="12"></v-icon> แนบลายเซ็นพร้อมส่งแล้ว</span>
            <img :src="judgeSignatureData" alt="ตัวอย่างลายเซ็น" style="max-height:54px; max-width:200px; background:#fff; border:1px solid var(--border); border-radius:4px; padding:3px 8px;" />
          </div>
          <div v-else style="margin-top:8px;">
            <span class="tag yellow"><v-icon name="alert" size="12"></v-icon> ยังไม่ได้แนบลายเซ็น (กรุณาวาด อัปโหลด หรือเลือกจากโปรไฟล์)</span>
          </div>
        </div>

        <!-- Action Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); margin-top: 14px; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 12px;">
            <span style="color: var(--text-muted);">สรุปคะแนนที่จะส่ง: </span>
            <strong style="color:var(--primary);">{{ judgeWorkspaceSummary.totalScore }} / 4.00 ({{ judgeWorkspaceSummary.grade }})</strong>
          </div>
          <div style="display: flex; gap: 8px;">
            <button @click="backToCandidateList" class="btn-outline">
              <v-icon name="arrow-left" size="13"></v-icon>
              <span>รายชื่อผู้รับการประเมิน</span>
            </button>
            <button @click="submitJudgeScore" class="btn-success">
              <v-icon name="check-circle" size="14"></v-icon>
              <span>ลงนามและบันทึกส่งผลการประเมิน</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
};
