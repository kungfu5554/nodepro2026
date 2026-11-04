// controllers/judge.controller.js
const { pool } = require('../config/database');

// Get assigned candidates for logged-in judge
// Judges see approved-department teachers in their assigned department(s), with submission and grading statuses
async function getAssignedEvaluatees(req, res, next) {
  try {
    const judgeCitizenId = req.user.citizenId;
    const periodId = parseInt(req.query.periodId || 1, 10);

    // 1. Check departments assigned to this judge in this period
    let [deptRows] = await pool.query(`
      SELECT DISTINCT department_name, role_in_board
      FROM department_judges
      WHERE judge_citizen_id = ? AND period_id = ?
    `, [judgeCitizenId, periodId]);

    // Fallback: if no period-specific rows yet, check judge's standing department assignments
    if (deptRows.length === 0) {
      [deptRows] = await pool.query(`
        SELECT DISTINCT department_name, role_in_board
        FROM department_judges
        WHERE judge_citizen_id = ?
      `, [judgeCitizenId]);
    }

    let assignedDepts = deptRows.map(r => r.department_name);

    // Fallback: check if judge's own user department matches an official department
    if (assignedDepts.length === 0) {
      const [judgeUser] = await pool.query(`
        SELECT d.name
        FROM users u
        JOIN departments d ON d.name = u.department
        WHERE u.citizen_id = ?
        LIMIT 1
      `, [judgeCitizenId]);
      if (judgeUser.length > 0) {
        assignedDepts = [judgeUser[0].name];
      }
    }

    let query = `
      SELECT 
        u.citizen_id AS teacherCitizenId,
        u.name AS teacherName,
        u.department,
        u.position,
        COALESCE(dj.role_in_board, a.role_in_board, 'กรรมการผู้ประเมิน') AS roleInBoard,
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
        AND u.dept_status = 'APPROVED'
        AND u.department IS NOT NULL
    `;
    const params = [periodId, judgeCitizenId, periodId, periodId, judgeCitizenId, periodId];

    if (assignedDepts.length > 0) {
      query += ' AND (u.department IN (?) OR a.id IS NOT NULL)';
      params.push(assignedDepts);
    } else {
      query += ' AND a.id IS NOT NULL';
    }

    query += ' ORDER BY u.department ASC, u.name ASC';

    const [rows] = await pool.query(query, params);

    // Normalize candidate status for frontend
    const candidates = rows.map(r => {
      let displayStatus = 'PENDING';
      if (r.myStatus === 'EVALUATED' && r.submissionStatus === 'SUBMITTED') {
        displayStatus = 'EVALUATED';
      } else if (r.submissionStatus === 'SUBMITTED') {
        displayStatus = 'SUBMITTED';
      }

      return {
        ...r,
        judgeName: req.user.name,
        status: displayStatus,
        myEvaluationCompleted: displayStatus === 'EVALUATED',
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
        message: 'กรุณาระบุรหัสผู้รับการประเมิน',
        data: null
      });
    }

    // Verify teacher exists and has approved department
    const [teacherRows] = await pool.query(
      'SELECT department, dept_status FROM users WHERE citizen_id = ? AND role = ? LIMIT 1',
      [teacherCitizenId, 'teacher']
    );
    if (teacherRows.length === 0 || teacherRows[0].dept_status !== 'APPROVED') {
      return res.status(403).json({
        status: 'error',
        message: 'ผู้รับการประเมินยังไม่ได้รับอนุมัติสังกัดสาขาวิชา',
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

// Get candidate metrics, evidence, self scores, teacher comments, and judge scores (for grading & PDF report)
async function getCandidateDetailsForGrading(req, res, next) {
  try {
    const { assignmentId } = req.params;

    const [assignments] = await pool.query(`
      SELECT 
        a.id,
        a.period_id AS periodId,
        ep.name AS periodName,
        a.teacher_citizen_id AS teacherCitizenId,
        a.judge_citizen_id AS judgeCitizenId,
        u_t.name AS teacherName,
        u_t.department,
        u_t.position,
        u_j.name AS judgeName,
        u_j.position AS judgePosition,
        a.role_in_board AS roleInBoard,
        a.status
      FROM assignments a
      JOIN users u_t ON a.teacher_citizen_id = u_t.citizen_id
      JOIN users u_j ON a.judge_citizen_id = u_j.citizen_id
      LEFT JOIN evaluation_periods ep ON a.period_id = ep.id
      WHERE a.id = ?
    `, [assignmentId]);

    if (assignments.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลการมอบหมายการประเมิน',
        data: null
      });
    }

    const assignment = assignments[0];

    // Authorization: only assigned judge or admin/hr
    if (req.user.role === 'judge' && assignment.judgeCitizenId !== req.user.citizenId) {
      return res.status(403).json({
        status: 'error',
        message: 'ท่านไม่มีสิทธิ์เข้าถึงข้อมูลการประเมินรายการนี้',
        data: null
      });
    }

    // Check teacher submission info
    const [subs] = await pool.query(
      'SELECT status, submitted_at AS submittedAt FROM teacher_submissions WHERE period_id = ? AND teacher_citizen_id = ?',
      [assignment.periodId, assignment.teacherCitizenId]
    );

    // Fetch metrics along with candidate's self scores, comments, evidence, and judge scores
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
        message: 'กรุณาระบุคะแนนประเมินในแต่ละตัวชี้วัด',
        data: null
      });
    }

    const [assignments] = await conn.query('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (assignments.length === 0) {
      conn.release();
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลการมอบหมายการประเมิน',
        data: null
      });
    }

    const assignment = assignments[0];

    if (req.user.role === 'judge' && assignment.judge_citizen_id !== req.user.citizenId) {
      conn.release();
      return res.status(403).json({
        status: 'error',
        message: 'ท่านไม่ได้รับมอบหมายให้ประเมินผู้รับการประเมินรายนี้',
        data: null
      });
    }

    // Verify period is open
    const [periods] = await conn.query('SELECT is_open FROM evaluation_periods WHERE id = ?', [assignment.period_id]);
    if (periods.length > 0 && !periods[0].is_open) {
      conn.release();
      return res.status(403).json({
        status: 'error',
        message: 'รอบการประเมินนี้ปิดระบบแล้ว ไม่สามารถส่งผลประเมินได้',
        data: null
      });
    }

    // Verify evaluatee has approved department and has actually submitted their self-evaluation
    const [teacherCheck] = await conn.query(
      'SELECT dept_status FROM users WHERE citizen_id = ? LIMIT 1',
      [assignment.teacher_citizen_id]
    );
    if (teacherCheck.length === 0 || teacherCheck[0].dept_status !== 'APPROVED') {
      conn.release();
      return res.status(403).json({
        status: 'error',
        message: 'ผู้รับการประเมินยังไม่ได้รับอนุมัติสาขาวิชาจากฝ่ายบุคลากร',
        data: null
      });
    }

    const [subs] = await conn.query(
      "SELECT status FROM teacher_submissions WHERE period_id = ? AND teacher_citizen_id = ? AND status = 'SUBMITTED'",
      [assignment.period_id, assignment.teacher_citizen_id]
    );
    if (subs.length === 0) {
      conn.release();
      return res.status(400).json({
        status: 'error',
        message: 'ผู้รับการประเมินยังไม่ได้ส่งข้อมูลแบบประเมินตนเอง กรุณารอให้ผู้รับการประเมินส่งข้อมูลก่อน',
        data: null
      });
    }

    // Get metrics to calculate weighted score
    const [metrics] = await conn.query('SELECT id, weight, eval_type FROM metrics WHERE period_id = ?', [assignment.period_id]);
    const metricMap = new Map(metrics.map(m => [m.id, m]));

    let totalWeightedScore = 0;
    let totalWeight = 0;

    await conn.beginTransaction();

    for (const [metricIdStr, rawScore] of Object.entries(scores)) {
      const metricId = parseInt(metricIdStr, 10);
      const metricDef = metricMap.get(metricId);
      if (!metricDef) continue;

      let score = 0;
      if (metricDef.eval_type === 'BOOLEAN') {
        score = (rawScore === 'มี' || rawScore === 4 || rawScore === '4' || rawScore === '4.00' || rawScore === true) ? 4.00 : 0.00;
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

    const finalScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;

    await conn.query(`
      INSERT INTO evaluation_summaries (assignment_id, total_score, overall_feedback, judge_signature)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_score = VALUES(total_score),
        overall_feedback = VALUES(overall_feedback),
        judge_signature = VALUES(judge_signature),
        submitted_at = CURRENT_TIMESTAMP
    `, [assignmentId, finalScore.toFixed(2), overallFeedback || '', signature || req.user.name]);

    await conn.query("UPDATE assignments SET status = 'EVALUATED' WHERE id = ?", [assignmentId]);

    await conn.commit();
    conn.release();

    res.status(200).json({
      status: 'success',
      message: 'บันทึกและส่งผลการประเมินสำเร็จ',
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
