// controllers/judge.controller.js
const { pool } = require('../config/database');

// Get assigned candidates for logged-in judge (Criteria 5.3.1)
// Judges see teachers in their assigned department(s), with submission and grading statuses
async function getAssignedEvaluatees(req, res, next) {
  try {
    const judgeCitizenId = req.user.citizenId;
    const periodId = parseInt(req.query.periodId || 1, 10);

    // 1. Check departments assigned to this judge
    const [deptRows] = await pool.query(`
      SELECT DISTINCT department_name, role_in_board
      FROM department_judges
      WHERE judge_citizen_id = ? AND period_id = ?
    `, [judgeCitizenId, periodId]);

    const assignedDepts = deptRows.map(r => r.department_name);

    let query = `
      SELECT 
        u.citizen_id AS teacherCitizenId,
        u.name AS teacherName,
        u.department,
        u.position,
        COALESCE(dj.role_in_board, 'กรรมการผู้ประเมิน') AS roleInBoard,
        COALESCE(ts.status, 'PENDING') AS submissionStatus,
        ts.submitted_at AS submittedAt,
        a.id AS assignmentId,
        COALESCE(a.status, 'PENDING') AS myStatus,
        es.total_score AS totalScore,
        es.overall_feedback AS overallFeedback,
        (
          SELECT COUNT(DISTINCT a2.judge_citizen_id)
          FROM assignments a2
          WHERE a2.teacher_citizen_id = u.citizen_id 
            AND a2.period_id = ?
            AND a2.status = 'EVALUATED'
        ) AS totalJudgesEvaluated
      FROM users u
      LEFT JOIN department_judges dj 
        ON dj.department_name = u.department AND dj.judge_citizen_id = ? AND dj.period_id = ?
      LEFT JOIN teacher_submissions ts 
        ON ts.teacher_citizen_id = u.citizen_id AND ts.period_id = ?
      LEFT JOIN assignments a 
        ON a.teacher_citizen_id = u.citizen_id AND a.judge_citizen_id = ? AND a.period_id = ?
      LEFT JOIN evaluation_summaries es 
        ON a.id = es.assignment_id
      WHERE u.role = 'teacher'
    `;
    const params = [periodId, judgeCitizenId, periodId, periodId, judgeCitizenId, periodId];

    if (assignedDepts.length > 0) {
      query += ' AND u.department IN (?)';
      params.push(assignedDepts);
    }

    query += ' ORDER BY u.department ASC, u.name ASC';

    const [rows] = await pool.query(query, params);

    // Normalize candidate status for frontend
    const candidates = rows.map(r => {
      // status field for UI display:
      // If judge already evaluated -> EVALUATED
      // Else if teacher submitted self-evaluation -> SUBMITTED
      // Else -> PENDING
      let displayStatus = 'PENDING';
      if (r.myStatus === 'EVALUATED') {
        displayStatus = 'EVALUATED';
      } else if (r.submissionStatus === 'SUBMITTED') {
        displayStatus = 'SUBMITTED';
      }

      return {
        ...r,
        status: displayStatus,
        myEvaluationCompleted: r.myStatus === 'EVALUATED',
        isSubmittedByTeacher: r.submissionStatus === 'SUBMITTED'
      };
    });

    res.status(200).json({
      status: 'success',
      message: 'Assigned candidates retrieved.',
      data: candidates
    });
  } catch (error) {
    next(error);
  }
}

// Initialize candidate assignment when judge starts grading
async function initCandidateAssignment(req, res, next) {
  try {
    const judgeCitizenId = req.user.citizenId;
    const { teacherCitizenId, periodId = 1 } = req.body;

    if (!teacherCitizenId) {
      return res.status(400).json({
        status: 'error',
        message: 'Teacher citizen ID is required.',
        data: null
      });
    }

    // Determine judge role in board for candidate's department
    const [deptJudge] = await pool.query(`
      SELECT dj.role_in_board 
      FROM users u
      JOIN department_judges dj ON dj.department_name = u.department AND dj.period_id = ?
      WHERE u.citizen_id = ? AND dj.judge_citizen_id = ?
      LIMIT 1
    `, [periodId, teacherCitizenId, judgeCitizenId]);
    const roleInBoard = deptJudge.length > 0 ? deptJudge[0].role_in_board : 'กรรมการผู้ประเมิน';

    // Check candidate submission status
    const [subs] = await pool.query(
      'SELECT status FROM teacher_submissions WHERE period_id = ? AND teacher_citizen_id = ?',
      [periodId, teacherCitizenId]
    );
    const initialStatus = (subs.length > 0 && subs[0].status === 'SUBMITTED') ? 'SUBMITTED' : 'PENDING';

    const [existing] = await pool.query(
      'SELECT id, status FROM assignments WHERE period_id = ? AND teacher_citizen_id = ? AND judge_citizen_id = ?',
      [periodId, teacherCitizenId, judgeCitizenId]
    );

    let assignmentId;
    if (existing.length > 0) {
      assignmentId = existing[0].id;
      // If assignment was PENDING and candidate submitted, update to SUBMITTED
      if (existing[0].status === 'PENDING' && initialStatus === 'SUBMITTED') {
        await pool.query("UPDATE assignments SET status = 'SUBMITTED' WHERE id = ?", [assignmentId]);
      }
    } else {
      const [inserted] = await pool.query(`
        INSERT INTO assignments (period_id, teacher_citizen_id, judge_citizen_id, role_in_board, status)
        VALUES (?, ?, ?, ?, ?)
      `, [periodId, teacherCitizenId, judgeCitizenId, roleInBoard, initialStatus]);
      assignmentId = inserted.insertId;
    }

    res.status(200).json({
      status: 'success',
      message: 'Candidate assignment initialized.',
      data: { assignmentId }
    });
  } catch (error) {
    next(error);
  }
}

// Get candidate metrics, evidence, and self scores for grading (Criteria 5.3.2 - 5.3.3)
async function getCandidateDetailsForGrading(req, res, next) {
  try {
    const { assignmentId } = req.params;

    // Verify assignment exists and authorize judge/admin/hr
    const [assignments] = await pool.query(`
      SELECT 
        a.id,
        a.period_id AS periodId,
        a.teacher_citizen_id AS teacherCitizenId,
        a.judge_citizen_id AS judgeCitizenId,
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

    // Authorization: only assigned judge or admin/hr
    if (req.user.role === 'judge' && assignment.judgeCitizenId !== req.user.citizenId) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden: You are not authorized to grade this candidate.',
        data: null
      });
    }

    // Check teacher submission info
    const [subs] = await pool.query(
      'SELECT status, submitted_at AS submittedAt FROM teacher_submissions WHERE period_id = ? AND teacher_citizen_id = ?',
      [assignment.periodId, assignment.teacherCitizenId]
    );

    // Fetch metrics along with candidate's self scores, comments, evidence, and previous judge scores
    const [metricRows] = await pool.query(`
      SELECT 
        m.id AS metricId,
        m.title,
        m.description,
        m.weight,
        m.eval_type AS evalType,
        m.evidence_type AS evidenceType,
        se.self_score AS selfScore,
        se.teacher_comment AS teacherComment,
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
        submission: subs.length > 0 ? subs[0] : null,
        metrics: metricRows,
        summary: summaries.length > 0 ? summaries[0] : null
      }
    });
  } catch (error) {
    next(error);
  }
}

// Submit judge scores, overall feedback, and signature
async function submitEvaluation(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { assignmentId } = req.params;
    const { scores, overallFeedback, signature } = req.body;

    if (!scores || typeof scores !== 'object') {
      conn.release();
      return res.status(400).json({
        status: 'error',
        message: 'Scores object mapping metricId to score is required.',
        data: null
      });
    }

    // Verify assignment exists and authorize
    const [assignments] = await conn.query('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (assignments.length === 0) {
      conn.release();
      return res.status(404).json({
        status: 'error',
        message: 'Assignment not found.',
        data: null
      });
    }

    const assignment = assignments[0];

    // Authorization
    if (req.user.role === 'judge' && assignment.judge_citizen_id !== req.user.citizenId) {
      conn.release();
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden: You are not assigned to evaluate this candidate.',
        data: null
      });
    }

    // Check if period is open
    const [periods] = await conn.query('SELECT is_open FROM evaluation_periods WHERE id = ?', [assignment.period_id]);
    if (periods.length > 0 && !periods[0].is_open) {
      conn.release();
      return res.status(403).json({
        status: 'error',
        message: 'Evaluation period is currently closed.',
        data: null
      });
    }

    // Get metrics to calculate weighted score
    const [metrics] = await conn.query('SELECT id, weight, eval_type FROM metrics WHERE period_id = ?', [assignment.period_id]);
    const metricMap = new Map(metrics.map(m => [m.id, m]));

    let totalWeightedScore = 0;
    let totalWeight = 0;

    await conn.beginTransaction();

    // Save individual metric scores
    for (const [metricIdStr, rawScore] of Object.entries(scores)) {
      const metricId = parseInt(metricIdStr, 10);
      const metricDef = metricMap.get(metricId);
      if (!metricDef) continue;

      let score = 0;
      if (metricDef.eval_type === 'BOOLEAN') {
        score = (rawScore === 'มี' || rawScore === 4 || rawScore === '4' || rawScore === true) ? 4.00 : 0.00;
      } else {
        score = Math.min(4, Math.max(0, parseFloat(rawScore) || 0));
      }

      const weight = metricDef.weight || 0;

      await conn.query(`
        INSERT INTO judge_evaluations (assignment_id, metric_id, judge_score)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE judge_score = VALUES(judge_score)
      `, [assignmentId, metricId, score]);

      totalWeightedScore += (score * weight);
      totalWeight += weight;
    }

    // Normalized average out of 4.00
    const finalScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;

    // Save summary and digital signature
    await conn.query(`
      INSERT INTO evaluation_summaries (assignment_id, total_score, overall_feedback, judge_signature)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_score = VALUES(total_score),
        overall_feedback = VALUES(overall_feedback),
        judge_signature = VALUES(judge_signature),
        submitted_at = CURRENT_TIMESTAMP
    `, [assignmentId, finalScore.toFixed(2), overallFeedback || '', signature || req.user.name]);

    // Mark assignment as EVALUATED
    await conn.query("UPDATE assignments SET status = 'EVALUATED' WHERE id = ?", [assignmentId]);

    await conn.commit();
    conn.release();

    res.status(200).json({
      status: 'success',
      message: 'Evaluation submitted successfully.',
      data: {
        assignmentId,
        totalScore: finalScore.toFixed(2)
      }
    });
  } catch (error) {
    await conn.rollback();
    conn.release();
    next(error);
  }
}

module.exports = {
  getAssignedEvaluatees,
  initCandidateAssignment,
  getCandidateDetailsForGrading,
  submitEvaluation
};
