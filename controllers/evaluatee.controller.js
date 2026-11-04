// controllers/evaluatee.controller.js
const { pool } = require('../config/database');

// Retrieve candidate metrics, current self scores, and progress (Criteria 5.2.3 - 5.2.6)
async function getMyEvaluationSheet(req, res, next) {
  try {
    const teacherCitizenId = req.user.citizenId;
    const periodId = req.query.periodId || 1;

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
      SELECT metric_id AS metricId, self_score AS selfScore, evidence_url AS evidenceUrl, evidence_original_name AS evidenceOriginalName
      FROM self_evaluations
      WHERE period_id = ? AND teacher_citizen_id = ?
    `, [periodId, teacherCitizenId]);

    // 4. Calculate progress percentage
    const totalMetrics = metrics.length;
    const completedCount = selfScores.length;
    const progress = totalMetrics > 0 ? Math.round((completedCount / totalMetrics) * 100) : 0;

    // 5. Get judge feedback if available
    const [summaries] = await pool.query(`
      SELECT es.total_score AS totalScore, es.overall_feedback AS overallFeedback, u_j.name AS judgeName, es.submitted_at AS submittedAt
      FROM assignments a
      JOIN users u_j ON a.judge_citizen_id = u_j.citizen_id
      JOIN evaluation_summaries es ON a.id = es.assignment_id
      WHERE a.period_id = ? AND a.teacher_citizen_id = ?
      ORDER BY es.id DESC
      LIMIT 1
    `, [periodId, teacherCitizenId]);

    res.status(200).json({
      status: 'success',
      message: 'Evaluation sheet retrieved.',
      data: {
        period,
        metrics,
        selfScores,
        progress,
        judgeFeedback: summaries.length > 0 ? summaries[0] : null
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
      const { metricId, selfScore, evidenceUrl, evidenceOriginalName } = item;
      if (!metricId || selfScore === undefined) continue;

      await pool.query(`
        INSERT INTO self_evaluations (period_id, teacher_citizen_id, metric_id, self_score, evidence_url, evidence_original_name)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          self_score = VALUES(self_score),
          evidence_url = VALUES(evidence_url),
          evidence_original_name = VALUES(evidence_original_name)
      `, [periodId, teacherCitizenId, metricId, String(selfScore), evidenceUrl || null, evidenceOriginalName || null]);
    }

    // Update assignment status to SUBMITTED if currently PENDING
    await pool.query(`
      UPDATE assignments
      SET status = 'SUBMITTED'
      WHERE period_id = ? AND teacher_citizen_id = ? AND status = 'PENDING'
    `, [periodId, teacherCitizenId]);

    res.status(200).json({
      status: 'success',
      message: 'Self evaluation saved successfully.',
      data: null
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
