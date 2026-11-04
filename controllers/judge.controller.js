// controllers/judge.controller.js
const { pool } = require('../config/database');

// Get assigned candidates for logged-in judge (Criteria 5.3.1)
async function getAssignedEvaluatees(req, res, next) {
  try {
    const judgeCitizenId = req.user.citizenId;
    const periodId = req.query.periodId || 1;

    const [rows] = await pool.query(`
      SELECT 
        a.id AS assignmentId,
        a.teacher_citizen_id AS teacherCitizenId,
        u.name AS teacherName,
        u.department,
        u.position,
        a.role_in_board AS roleInBoard,
        a.status,
        es.total_score AS totalScore
      FROM assignments a
      JOIN users u ON a.teacher_citizen_id = u.citizen_id
      LEFT JOIN evaluation_summaries es ON a.id = es.assignment_id
      WHERE a.period_id = ? AND a.judge_citizen_id = ?
      ORDER BY a.id ASC
    `, [periodId, judgeCitizenId]);

    res.status(200).json({
      status: 'success',
      message: 'Assigned candidates retrieved.',
      data: rows
    });
  } catch (error) {
    next(error);
  }
}

// Get candidate metrics, evidence, and self scores for grading (Criteria 5.3.2 - 5.3.3)
async function getCandidateDetailsForGrading(req, res, next) {
  try {
    const { assignmentId } = req.params;

    // Verify assignment exists
    const [assignments] = await pool.query(`
      SELECT 
        a.id,
        a.period_id AS periodId,
        a.teacher_citizen_id AS teacherCitizenId,
        u_t.name AS teacherName,
        u_t.department,
        u_t.position,
        a.role_in_board AS roleInBoard,
        a.status
      FROM assignments a
      JOIN users u_t ON a.teacher_citizen_id = u_t.citizen_id
      WHERE a.id = ?
    `, [assignmentId]);

    if (assignments.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Assignment record not found.',
        data: null
      });
    }

    const assignment = assignments[0];

    // Fetch metrics along with candidate's self scores and previous judge scores
    const [metricRows] = await pool.query(`
      SELECT 
        m.id AS metricId,
        m.title,
        m.weight,
        m.eval_type AS evalType,
        m.evidence_type AS evidenceType,
        se.self_score AS selfScore,
        se.evidence_url AS evidenceUrl,
        se.evidence_original_name AS evidenceOriginalName,
        je.judge_score AS existingJudgeScore
      FROM metrics m
      LEFT JOIN self_evaluations se 
        ON m.id = se.metric_id AND se.teacher_citizen_id = ? AND se.period_id = ?
      LEFT JOIN judge_evaluations je 
        ON m.id = je.metric_id AND je.assignment_id = ?
      WHERE m.period_id = ?
      ORDER BY m.id ASC
    `, [assignment.teacherCitizenId, assignment.periodId, assignment.id, assignment.periodId]);

    // Fetch summary if already submitted
    const [summaries] = await pool.query(`
      SELECT total_score AS totalScore, overall_feedback AS overallFeedback, judge_signature AS judgeSignature, submitted_at AS submittedAt
      FROM evaluation_summaries
      WHERE assignment_id = ?
    `, [assignment.id]);

    res.status(200).json({
      status: 'success',
      message: 'Grading details retrieved.',
      data: {
        assignment,
        metrics: metricRows,
        summary: summaries.length > 0 ? summaries[0] : null
      }
    });
  } catch (error) {
    next(error);
  }
}

// Submit judge scores, overall feedback, and signature (Criteria 5.3.4 - 5.3.8)
async function submitEvaluation(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const { scores, overallFeedback, signature } = req.body;

    if (!scores || typeof scores !== 'object') {
      return res.status(400).json({
        status: 'error',
        message: 'Scores object mapping metricId to score is required.',
        data: null
      });
    }

    // Verify assignment exists
    const [assignments] = await pool.query('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (assignments.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Assignment not found.',
        data: null
      });
    }

    const assignment = assignments[0];

    // Get metrics to calculate weighted score
    const [metrics] = await pool.query('SELECT id, weight FROM metrics WHERE period_id = ?', [assignment.period_id]);
    const metricMap = new Map(metrics.map(m => [m.id, m.weight]));

    let totalWeightedScore = 0;
    let totalWeight = 0;

    // Save individual metric scores
    for (const [metricIdStr, rawScore] of Object.entries(scores)) {
      const metricId = parseInt(metricIdStr, 10);
      const score = parseFloat(rawScore) || 0;
      const weight = metricMap.get(metricId) || 0;

      await pool.query(`
        INSERT INTO judge_evaluations (assignment_id, metric_id, judge_score)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE judge_score = VALUES(judge_score)
      `, [assignmentId, metricId, score]);

      totalWeightedScore += (score * weight);
      totalWeight += weight;
    }

    // Normalized average out of 4.00
    const finalScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;

    // Save summary and digital signature (Criteria 5.3.7 - 5.3.8)
    await pool.query(`
      INSERT INTO evaluation_summaries (assignment_id, total_score, overall_feedback, judge_signature)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_score = VALUES(total_score),
        overall_feedback = VALUES(overall_feedback),
        judge_signature = VALUES(judge_signature),
        submitted_at = CURRENT_TIMESTAMP
    `, [assignmentId, finalScore.toFixed(2), overallFeedback || '', signature || req.user.name]);

    // Mark assignment as EVALUATED
    await pool.query("UPDATE assignments SET status = 'EVALUATED' WHERE id = ?", [assignmentId]);

    res.status(200).json({
      status: 'success',
      message: 'Evaluation submitted successfully.',
      data: {
        assignmentId,
        totalScore: finalScore.toFixed(2)
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAssignedEvaluatees,
  getCandidateDetailsForGrading,
  submitEvaluation
};

