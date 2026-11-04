// controllers/evaluatee.controller.js
const { pool } = require('../config/database');

// Retrieve candidate metrics, current self scores, submission status, and multi-judge reviews (Criteria 5.2.3 - 5.2.6)
async function getMyEvaluationSheet(req, res, next) {
  try {
    const teacherCitizenId = req.user.citizenId;
    const periodId = parseInt(req.query.periodId || 1, 10);

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

    const submissionStatus = submissions.length > 0 ? submissions[0].status : (selfScores.length > 0 ? 'SUBMITTED' : 'DRAFT');
    const submittedAt = submissions.length > 0 ? submissions[0].submittedAt : null;

    // 5. Calculate progress percentage
    const totalMetrics = metrics.length;
    const completedCount = selfScores.length;
    const progress = totalMetrics > 0 ? Math.round((completedCount / totalMetrics) * 100) : 0;

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
        metricScoreMap[s.metricId] = val;
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

// Save or update candidate self evaluations
async function saveSelfEvaluations(req, res, next) {
  try {
    const teacherCitizenId = req.user.citizenId;
    const { periodId = 1, scores } = req.body;

    if (!scores || !Array.isArray(scores)) {
      return res.status(400).json({
        status: 'error',
        message: 'Scores must be an array of metric evaluations.',
        data: null
      });
    }

    // Check if period is open
    const [periods] = await pool.query('SELECT is_open FROM evaluation_periods WHERE id = ?', [periodId]);
    if (periods.length > 0 && !periods[0].is_open) {
      return res.status(403).json({
        status: 'error',
        message: 'Cannot submit: Evaluation period is closed.',
        data: null
      });
    }

    // Insert or update each metric self evaluation
    for (const item of scores) {
      const { metricId, selfScore, teacherComment, comment, evidenceUrl, evidenceOriginalName } = item;
      if (!metricId || selfScore === undefined) continue;
      const finalComment = teacherComment !== undefined ? teacherComment : (comment !== undefined ? comment : null);

      await pool.query(`
        INSERT INTO self_evaluations (period_id, teacher_citizen_id, metric_id, self_score, teacher_comment, evidence_url, evidence_original_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          self_score = VALUES(self_score),
          teacher_comment = VALUES(teacher_comment),
          evidence_url = VALUES(evidence_url),
          evidence_original_name = VALUES(evidence_original_name)
      `, [periodId, teacherCitizenId, metricId, String(selfScore), finalComment, evidenceUrl || null, evidenceOriginalName || null]);
    }

    // Record submission state in teacher_submissions
    await pool.query(`
      INSERT INTO teacher_submissions (period_id, teacher_citizen_id, status, submitted_at)
      VALUES (?, ?, 'SUBMITTED', CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        status = 'SUBMITTED',
        submitted_at = CURRENT_TIMESTAMP
    `, [periodId, teacherCitizenId]);

    // Update assignment status to SUBMITTED if currently PENDING
    await pool.query(`
      UPDATE assignments
      SET status = 'SUBMITTED'
      WHERE period_id = ? AND teacher_citizen_id = ? AND status = 'PENDING'
    `, [periodId, teacherCitizenId]);

    res.status(200).json({
      status: 'success',
      message: 'Self evaluation saved successfully.',
      data: {
        submissionStatus: 'SUBMITTED',
        submittedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
}

// Update candidate personal information
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
