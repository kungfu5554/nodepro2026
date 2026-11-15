// controllers/evaluatee.controller.js
const { pool } = require('../config/database');
const { formatUserPayload } = require('./auth.controller');
const { ok, fail } = require('../utils/response');

async function getMyEvaluationSheet(req, res, next) {
  try {
    const teacherCitizenId = req.user.citizenId;
    const periodId = parseInt(req.query.periodId || 1, 10);

    const [userRows] = await pool.query('SELECT * FROM users WHERE citizen_id = ? LIMIT 1', [teacherCitizenId]);
    const latestUser = userRows.length > 0 ? formatUserPayload(userRows[0]) : null;
    const requiredJudges = latestUser ? latestUser.requiredJudges : 3;

    const [periods] = await pool.query('SELECT * FROM evaluation_periods WHERE id = ?', [periodId]);
    const period = periods[0] || null;

    const [metrics] = await pool.query(`
      SELECT
        m.id,
        m.period_id AS periodId,
        m.category_id AS categoryId,
        mc.name AS categoryName,
        mc.sort_order AS categorySortOrder,
        m.title,
        m.description,
        m.weight,
        m.eval_type AS evalType,
        m.evidence_type AS evidenceType
      FROM metrics m
      LEFT JOIN metric_categories mc ON m.category_id = mc.id
      WHERE m.period_id = ?
      ORDER BY COALESCE(mc.sort_order, 9999) ASC, m.id ASC
    `, [periodId]);

    const [selfScores] = await pool.query(`
      SELECT metric_id AS metricId, self_score AS selfScore, teacher_comment AS teacherComment, evidence_url AS evidenceUrl, evidence_original_name AS evidenceOriginalName
      FROM self_evaluations
      WHERE period_id = ? AND teacher_citizen_id = ?
    `, [periodId, teacherCitizenId]);

    const [submissions] = await pool.query(`
      SELECT status, submitted_at AS submittedAt
      FROM teacher_submissions
      WHERE period_id = ? AND teacher_citizen_id = ?
    `, [periodId, teacherCitizenId]);

    const submissionStatus = submissions.length > 0 ? submissions[0].status : 'DRAFT';
    const submittedAt = submissions.length > 0 ? submissions[0].submittedAt : null;

    const totalMetrics = metrics.length;
    const progress = totalMetrics > 0 ? Math.min(100, Math.round((selfScores.length / totalMetrics) * 100)) : 0;

    // Count claimed judges (claimed, submitted, or evaluated)
    const [[{ claimedJudgesCount }]] = await pool.query(`
      SELECT COUNT(DISTINCT judge_citizen_id) AS claimedJudgesCount
      FROM assignments
      WHERE period_id = ? AND teacher_citizen_id = ? AND status IN ('CLAIMED', 'SUBMITTED', 'EVALUATED')
    `, [periodId, teacherCitizenId]);

    // Fetch evaluated judge rows + batch-load metric scores (avoids N+1 queries)
    const [judgeRows] = await pool.query(`
      SELECT 
        a.id AS assignmentId,
        a.judge_citizen_id AS judgeCitizenId,
        u_j.name AS judgeName, 
        u_j.position AS judgePosition,
        COALESCE(a.role_in_board, 'กรรมการผู้ประเมิน') AS roleInBoard,
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

    const scoresByAssignment = new Map();
    if (judgeRows.length > 0) {
      const assignmentIds = judgeRows.map(j => j.assignmentId);
      const [allJudgeScores] = await pool.query(`
        SELECT assignment_id AS assignmentId, metric_id AS metricId, judge_score AS judgeScore
        FROM judge_evaluations
        WHERE assignment_id IN (?)
      `, [assignmentIds]);

      for (const row of allJudgeScores) {
        if (!scoresByAssignment.has(row.assignmentId)) {
          scoresByAssignment.set(row.assignmentId, []);
        }
        scoresByAssignment.get(row.assignmentId).push(row);
      }
    }

    const metricTotals = {};
    const metricJudgeCounts = {};
    let sumTotalScores = 0;

    const judgeEvaluations = judgeRows.map(j => {
      const metricScoreMap = {};
      for (const s of (scoresByAssignment.get(j.assignmentId) || [])) {
        const val = parseFloat(s.judgeScore) || 0;
        metricScoreMap[s.metricId] = val.toFixed(2);
        metricTotals[s.metricId] = (metricTotals[s.metricId] || 0) + val;
        metricJudgeCounts[s.metricId] = (metricJudgeCounts[s.metricId] || 0) + 1;
      }
      const numTotal = parseFloat(j.totalScore) || 0;
      sumTotalScores += numTotal;

      return {
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
      };
    });

    const metricAverages = {};
    const metricJudgeProgress = {};
    const reqJudgesNum = Math.max(1, Number(requiredJudges) || 3);
    metrics.forEach(m => {
      const count = Number(metricJudgeCounts[m.id] || 0);
      metricAverages[m.id] = count > 0 ? (metricTotals[m.id] / count).toFixed(2) : null;
      metricJudgeProgress[m.id] = {
        evaluatedCount: count,
        claimedCount: Number(claimedJudgesCount) || 0,
        requiredJudges: reqJudgesNum,
        percent: Math.min(100, Math.round((count / reqJudgesNum) * 100))
      };
    });

    const averageTotalScore = judgeEvaluations.length > 0
      ? (sumTotalScores / judgeEvaluations.length).toFixed(2)
      : null;

    return ok(res, 'Evaluation sheet retrieved.', {
      userProfile: latestUser,
      period,
      metrics,
      selfScores,
      submissionStatus,
      submittedAt,
      progress,
      requiredJudges,
      claimedJudgesCount: Number(claimedJudgesCount) || 0,
      judgeFeedback: judgeEvaluations.length > 0 ? judgeEvaluations[0] : null,
      judgeEvaluations,
      consolidatedSummary: {
        averageTotalScore,
        judgeCount: judgeEvaluations.length,
        requiredJudges,
        claimedJudgesCount: Number(claimedJudgesCount) || 0,
        metricAverages,
        metricJudgeCounts,
        metricJudgeProgress
      }
    });
  } catch (error) {
    next(error);
  }
}

async function saveSelfEvaluations(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const teacherCitizenId = req.user.citizenId;
    const { periodId = 1, scores, isEditConfirm = false } = req.body;

    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      conn.release();
      return fail(res, 'กรุณากรอกข้อมูลการประเมินตนเองอย่างน้อย 1 ตัวชี้วัด', 400);
    }

    const [users] = await conn.query(
      'SELECT department, dept_status, requested_department FROM users WHERE citizen_id = ? LIMIT 1',
      [teacherCitizenId]
    );
    if (users.length === 0) {
      conn.release();
      return fail(res, 'ไม่พบข้อมูลผู้ใช้งาน', 404);
    }

    const userRow = users[0];
    if (userRow.dept_status === 'PENDING') {
      conn.release();
      return fail(res, `ไม่สามารถส่งข้อมูลให้กรรมการได้ เนื่องจากสาขาวิชา "${userRow.requested_department || ''}" อยู่ระหว่างรอการอนุมัติจากฝ่ายบุคลากร (HR)`, 403);
    }
    if (userRow.dept_status === 'REJECTED' || !userRow.department) {
      conn.release();
      return fail(res, 'ไม่สามารถส่งข้อมูลให้กรรมการได้ กรุณาเลือกสาขาวิชาที่ได้รับอนุมัติก่อนส่งแบบประเมิน', 403);
    }

    const [periods] = await conn.query('SELECT is_open FROM evaluation_periods WHERE id = ?', [periodId]);
    if (periods.length === 0 || !periods[0].is_open) {
      conn.release();
      return fail(res, 'รอบการประเมินนี้ปิดการรับข้อมูลแล้ว ไม่สามารถบันทึกหรือแก้ไขได้', 403);
    }

    const [existingSubs] = await conn.query(
      'SELECT status FROM teacher_submissions WHERE period_id = ? AND teacher_citizen_id = ?',
      [periodId, teacherCitizenId]
    );
    const alreadySubmitted = existingSubs.length > 0 && existingSubs[0].status === 'SUBMITTED';

    if (alreadySubmitted && !isEditConfirm) {
      conn.release();
      return fail(res, 'ท่านได้ส่งข้อมูลแบบประเมินไปแล้ว ไม่สามารถส่งซ้ำได้ กรุณากดปุ่ม "ขอแก้ไขข้อมูล" หากต้องการแก้ไขแบบประเมิน', 400);
    }

    await conn.beginTransaction();

    for (const item of scores) {
      const { metricId, selfScore, teacherComment, comment, evidenceUrl, evidenceOriginalName } = item;
      if (!metricId || selfScore === undefined || selfScore === null || String(selfScore).trim() === '') {
        await conn.rollback();
        conn.release();
        return fail(res, 'กรุณาเลือกระดับคะแนนประเมินตนเองให้ครบทุกตัวชี้วัดก่อนส่งข้อมูล', 400);
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

    await conn.query(`
      INSERT INTO teacher_submissions (period_id, teacher_citizen_id, status, submitted_at)
      VALUES (?, ?, 'SUBMITTED', CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        status = 'SUBMITTED',
        submitted_at = CURRENT_TIMESTAMP
    `, [periodId, teacherCitizenId]);

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

      // Reset claimed/evaluated judges back to CLAIMED so they re-evaluate the updated sheet
      await conn.query(`
        UPDATE assignments
        SET status = 'CLAIMED', updated_at = CURRENT_TIMESTAMP
        WHERE period_id = ? AND teacher_citizen_id = ? AND status IN ('EVALUATED', 'SUBMITTED')
      `, [periodId, teacherCitizenId]);
    } else {
      await conn.query(`
        UPDATE assignments
        SET status = 'CLAIMED', updated_at = CURRENT_TIMESTAMP
        WHERE period_id = ? AND teacher_citizen_id = ? AND status = 'PENDING'
      `, [periodId, teacherCitizenId]);
    }

    await conn.commit();
    conn.release();

    return ok(
      res,
      alreadySubmitted
        ? 'บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว ผลการประเมินเดิมจากกรรมการถูกรีเซ็ตเพื่อรอการตรวจประเมินใหม่'
        : 'บันทึกและส่งผลการประเมินตนเองเรียบร้อยแล้ว',
      {
        submissionStatus: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        wasEditedReset: alreadySubmitted,
        wipedJudgeEvaluationsCount
      }
    );
  } catch (error) {
    await conn.rollback();
    conn.release();
    next(error);
  }
}

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

    return ok(res, 'Profile updated successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyEvaluationSheet,
  saveSelfEvaluations,
  updateProfile
};
