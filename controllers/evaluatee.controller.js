// controllers/evaluatee.controller.js
const { pool } = require('../config/database');
const { formatUserPayload } = require('./auth.controller');

// Retrieve candidate metrics, current self scores, submission status, department approval status, and multi-judge reviews
async function getMyEvaluationSheet(req, res, next) {
  try {
    const teacherCitizenId = req.user.citizenId;
    const periodId = parseInt(req.query.periodId || 1, 10);

    // 0. Get latest user profile & department approval status
    const [userRows] = await pool.query('SELECT * FROM users WHERE citizen_id = ? LIMIT 1', [teacherCitizenId]);
    const latestUser = userRows.length > 0 ? formatUserPayload(userRows[0]) : null;

    // 1. Get active period
    const [periods] = await pool.query('SELECT * FROM evaluation_periods WHERE id = ?', [periodId]);
    const period = periods[0] || null;

    // 2. Get metrics for this period
    const [metrics] = await pool.query(`
      SELECT id, period_id AS periodId, title, description, weight, eval_type AS evalType, evidence_type AS evidenceType
      FROM metrics
      WHERE period_id = ?
      ORDER BY id ASC
    `, [periodId]);

    // 3. Get existing self evaluations
    const [selfScores] = await pool.query(`
      SELECT metric_id AS metricId, self_score AS selfScore, teacher_comment AS teacherComment, evidence_url AS evidenceUrl, evidence_original_name AS evidenceOriginalName
      FROM self_evaluations
      WHERE period_id = ? AND teacher_citizen_id = ?
    `, [periodId, teacherCitizenId]);

    // 4. Get teacher submission status
    const [submissions] = await pool.query(`
      SELECT status, submitted_at AS submittedAt
      FROM teacher_submissions
      WHERE period_id = ? AND teacher_citizen_id = ?
    `, [periodId, teacherCitizenId]);

    const submissionStatus = submissions.length > 0
      ? submissions[0].status
      : (selfScores.length > 0 ? 'SUBMITTED' : 'DRAFT');
    const submittedAt = submissions.length > 0 ? submissions[0].submittedAt : null;

    // 5. Calculate progress percentage
    const totalMetrics = metrics.length;
    const completedCount = selfScores.length;
    const progress = totalMetrics > 0 ? Math.min(100, Math.round((completedCount / totalMetrics) * 100)) : 0;

    // 6. Get all judge evaluations for this candidate in this period
    const [judgeRows] = await pool.query(`
      SELECT 
        a.id AS assignmentId,
        a.judge_citizen_id AS judgeCitizenId,
        u_j.name AS judgeName, 
        u_j.position AS judgePosition,
        COALESCE(a.role_in_board, 'กรรมการผู้ประเมิน') AS roleInBoard,
        a.status AS assignmentStatus,
        es.total_score AS totalScore, 
        es.overall_feedback AS overallFeedback, 
        es.judge_signature AS judgeSignature,
        es.submitted_at AS submittedAt
      FROM assignments a
      JOIN users u_j ON a.judge_citizen_id = u_j.citizen_id
      JOIN evaluation_summaries es ON a.id = es.assignment_id
      WHERE a.period_id = ? AND a.teacher_citizen_id = ? AND a.status = 'EVALUATED'
      ORDER BY a.id ASC
    `, [periodId, teacherCitizenId]);

    // 7. For each judge, retrieve their metric-level scores
    const judgeEvaluations = [];
    const metricTotals = {};
    const metricJudgeCounts = {};
    let sumTotalScores = 0;

    for (const j of judgeRows) {
      const [scores] = await pool.query(`
        SELECT metric_id AS metricId, judge_score AS judgeScore
        FROM judge_evaluations
        WHERE assignment_id = ?
      `, [j.assignmentId]);

      const metricScoreMap = {};
      scores.forEach(s => {
        const val = parseFloat(s.judgeScore) || 0;
        metricScoreMap[s.metricId] = val.toFixed(2);
        metricTotals[s.metricId] = (metricTotals[s.metricId] || 0) + val;
        metricJudgeCounts[s.metricId] = (metricJudgeCounts[s.metricId] || 0) + 1;
      });

      const numTotal = parseFloat(j.totalScore) || 0;
      sumTotalScores += numTotal;

      judgeEvaluations.push({
        assignmentId: j.assignmentId,
        judgeCitizenId: j.judgeCitizenId,
        judgeName: j.judgeName,
        judgePosition: j.judgePosition,
        roleInBoard: j.roleInBoard,
        totalScore: numTotal.toFixed(2),
        overallFeedback: j.overallFeedback,
        judgeSignature: j.judgeSignature,
        submittedAt: j.submittedAt,
        metricScores: metricScoreMap
      });
    }

    // Consolidated metrics averages
    const metricAverages = {};
    metrics.forEach(m => {
      const count = metricJudgeCounts[m.id] || 0;
      metricAverages[m.id] = count > 0 ? (metricTotals[m.id] / count).toFixed(2) : null;
    });

    const averageTotalScore = judgeEvaluations.length > 0
      ? (sumTotalScores / judgeEvaluations.length).toFixed(2)
      : null;

    res.status(200).json({
      status: 'success',
      message: 'Evaluation sheet retrieved.',
      data: {
        userProfile: latestUser,
        period,
        metrics,
        selfScores,
        submissionStatus,
        submittedAt,
        progress,
        judgeFeedback: judgeEvaluations.length > 0 ? judgeEvaluations[0] : null,
        judgeEvaluations,
        consolidatedSummary: {
          averageTotalScore,
          judgeCount: judgeEvaluations.length,
          metricAverages
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// Save or update candidate self evaluations (with department approval check, duplicate-submit lock, and edit-reset of judge scores)
async function saveSelfEvaluations(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const teacherCitizenId = req.user.citizenId;
    const { periodId = 1, scores, isEditConfirm = false } = req.body;

    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      conn.release();
      return res.status(400).json({
        status: 'error',
        message: 'กรุณากรอกข้อมูลการประเมินตนเองอย่างน้อย 1 ตัวชี้วัด',
        data: null
      });
    }

    // 1. Check user's department approval status
    const [users] = await conn.query(
      'SELECT department, dept_status, requested_department, dept_reject_reason FROM users WHERE citizen_id = ? LIMIT 1',
      [teacherCitizenId]
    );
    if (users.length === 0) {
      conn.release();
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลผู้ใช้งาน',
        data: null
      });
    }

    const userRow = users[0];
    if (userRow.dept_status === 'PENDING') {
      conn.release();
      return res.status(403).json({
        status: 'error',
        message: `ไม่สามารถส่งข้อมูลให้กรรมการได้ เนื่องจากสาขาวิชา "${userRow.requested_department || ''}" อยู่ระหว่างรอการอนุมัติจากฝ่ายบุคลากร (HR)`,
        data: null
      });
    }
    if (userRow.dept_status === 'REJECTED' || !userRow.department) {
      conn.release();
      return res.status(403).json({
        status: 'error',
        message: 'ไม่สามารถส่งข้อมูลให้กรรมการได้ กรุณาเลือกสาขาวิชาที่ได้รับอนุมัติก่อนส่งแบบประเมิน',
        data: null
      });
    }

    // 2. Check if evaluation period is open
    const [periods] = await conn.query('SELECT is_open FROM evaluation_periods WHERE id = ?', [periodId]);
    if (periods.length === 0 || !periods[0].is_open) {
      conn.release();
      return res.status(403).json({
        status: 'error',
        message: 'รอบการประเมินนี้ปิดการรับข้อมูลแล้ว ไม่สามารถบันทึกหรือแก้ไขได้',
        data: null
      });
    }

    // 3. Check if already submitted -> enforce lock unless isEditConfirm === true
    const [existingSubs] = await conn.query(
      'SELECT status FROM teacher_submissions WHERE period_id = ? AND teacher_citizen_id = ?',
      [periodId, teacherCitizenId]
    );
    const alreadySubmitted = existingSubs.length > 0 && existingSubs[0].status === 'SUBMITTED';

    if (alreadySubmitted && !isEditConfirm) {
      conn.release();
      return res.status(400).json({
        status: 'error',
        message: 'ท่านได้ส่งข้อมูลแบบประเมินไปแล้ว ไม่สามารถส่งซ้ำได้ กรุณากดปุ่ม "ขอแก้ไขข้อมูล" หากต้องการแก้ไขแบบประเมิน',
        data: null
      });
    }

    await conn.beginTransaction();

    // 4. Insert or update each metric self evaluation
    for (const item of scores) {
      const { metricId, selfScore, teacherComment, comment, evidenceUrl, evidenceOriginalName } = item;
      if (!metricId || selfScore === undefined || selfScore === null || String(selfScore).trim() === '') {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          status: 'error',
          message: 'กรุณาเลือกระดับคะแนนประเมินตนเองให้ครบทุกตัวชี้วัดก่อนส่งข้อมูล',
          data: null
        });
      }
      const finalComment = teacherComment !== undefined ? teacherComment : (comment !== undefined ? comment : null);

      await conn.query(`
        INSERT INTO self_evaluations (period_id, teacher_citizen_id, metric_id, self_score, teacher_comment, evidence_url, evidence_original_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          self_score = VALUES(self_score),
          teacher_comment = VALUES(teacher_comment),
          evidence_url = VALUES(evidence_url),
          evidence_original_name = VALUES(evidence_original_name)
      `, [periodId, teacherCitizenId, metricId, String(selfScore), finalComment, evidenceUrl || null, evidenceOriginalName || null]);
    }

    // 5. Record submission state in teacher_submissions
    await conn.query(`
      INSERT INTO teacher_submissions (period_id, teacher_citizen_id, status, submitted_at)
      VALUES (?, ?, 'SUBMITTED', CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        status = 'SUBMITTED',
        submitted_at = CURRENT_TIMESTAMP
    `, [periodId, teacherCitizenId]);

    // 6. If editing an already-submitted evaluation, WIPE all initial judge evaluations & reset assignments to SUBMITTED
    let wipedJudgeEvaluationsCount = 0;
    if (alreadySubmitted && isEditConfirm) {
      const [[{ evalCount }]] = await conn.query(
        "SELECT COUNT(*) AS evalCount FROM assignments WHERE period_id = ? AND teacher_citizen_id = ? AND status = 'EVALUATED'",
        [periodId, teacherCitizenId]
      );
      wipedJudgeEvaluationsCount = evalCount;

      await conn.query(`
        DELETE je FROM judge_evaluations je
        INNER JOIN assignments a ON je.assignment_id = a.id
        WHERE a.period_id = ? AND a.teacher_citizen_id = ?
      `, [periodId, teacherCitizenId]);

      await conn.query(`
        DELETE es FROM evaluation_summaries es
        INNER JOIN assignments a ON es.assignment_id = a.id
        WHERE a.period_id = ? AND a.teacher_citizen_id = ?
      `, [periodId, teacherCitizenId]);

      await conn.query(`
        UPDATE assignments
        SET status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP
        WHERE period_id = ? AND teacher_citizen_id = ?
      `, [periodId, teacherCitizenId]);
    } else {
      // First-time submission: upgrade any PENDING assignments to SUBMITTED
      await conn.query(`
        UPDATE assignments
        SET status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP
        WHERE period_id = ? AND teacher_citizen_id = ? AND status = 'PENDING'
      `, [periodId, teacherCitizenId]);
    }

    await conn.commit();
    conn.release();

    res.status(200).json({
      status: 'success',
      message: alreadySubmitted
        ? 'บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว ผลการประเมินเดิมจากกรรมการถูกรีเซ็ตเพื่อรอการตรวจประเมินใหม่'
        : 'บันทึกและส่งผลการประเมินตนเองเรียบร้อยแล้ว',
      data: {
        submissionStatus: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        wasEditedReset: alreadySubmitted,
        wipedJudgeEvaluationsCount
      }
    });
  } catch (error) {
    await conn.rollback();
    conn.release();
    next(error);
  }
}

// Update candidate personal information (legacy alias)
async function updateProfile(req, res, next) {
  try {
    const teacherCitizenId = req.user.citizenId;
    const { name, department, position, signatureUrl } = req.body;

    await pool.query(`
      UPDATE users
      SET name = COALESCE(?, name),
          department = COALESCE(?, department),
          position = COALESCE(?, position),
          signature_url = COALESCE(?, signature_url)
      WHERE citizen_id = ?
    `, [name, department, position, signatureUrl, teacherCitizenId]);

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyEvaluationSheet,
  saveSelfEvaluations,
  updateProfile
};
