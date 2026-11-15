// controllers/assignment.controller.js
const { pool } = require('../config/database');
const { ok, fail } = require('../utils/response');

async function getAssignments(req, res, next) {
  try {
    const periodId = req.query.periodId || 1;
    const [rows] = await pool.query(`
      SELECT 
        a.id,
        a.id AS assignmentId,
        a.period_id AS periodId,
        a.teacher_citizen_id AS teacherId,
        a.teacher_citizen_id AS teacherCitizenId,
        u_t.name AS teacherName,
        u_t.department AS teacherDepartment,
        u_t.department AS department,
        u_t.position AS teacherPosition,
        u_t.position AS position,
        COALESCE(u_t.required_judges, 3) AS requiredJudges,
        a.judge_citizen_id AS judgeId,
        u_j.name AS judgeName,
        a.role_in_board AS roleInBoard,
        a.status,
        a.claimed_at AS claimedAt,
        es.total_score AS totalScore,
        es.overall_feedback AS overallFeedback,
        es.submitted_at AS evaluatedAt
      FROM assignments a
      JOIN users u_t ON a.teacher_citizen_id = u_t.citizen_id
      JOIN users u_j ON a.judge_citizen_id = u_j.citizen_id
      LEFT JOIN evaluation_summaries es ON a.id = es.assignment_id
      WHERE a.period_id = ?
      ORDER BY a.id DESC
    `, [periodId]);
    return ok(res, 'Assignments retrieved.', rows);
  } catch (error) {
    next(error);
  }
}

async function createAssignment(req, res, next) {
  try {
    const { teacherId, judgeId, roleInBoard, periodId } = req.body;
    if (!teacherId || !judgeId) return fail(res, 'Teacher citizen ID and Judge citizen ID are required.', 400);
    if (teacherId === judgeId) return fail(res, 'A candidate cannot be assigned to evaluate themselves.', 400);

    const [existing] = await pool.query(
      'SELECT id FROM assignments WHERE period_id = ? AND teacher_citizen_id = ? AND judge_citizen_id = ?',
      [periodId || 1, teacherId, judgeId]
    );
    if (existing.length > 0) return fail(res, 'This assignment pairing already exists for this round.', 409);

    const [result] = await pool.query(`
      INSERT INTO assignments (period_id, teacher_citizen_id, judge_citizen_id, role_in_board, status, claimed_at)
      VALUES (?, ?, ?, ?, 'CLAIMED', CURRENT_TIMESTAMP)
    `, [periodId || 1, teacherId, judgeId, roleInBoard || 'ประธานกรรมการ']);

    return ok(res, 'Judge assigned successfully.', { id: result.insertId }, 201);
  } catch (error) {
    next(error);
  }
}

async function deleteAssignment(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM assignments WHERE id = ?', [id]);
    if (result.affectedRows === 0) return fail(res, 'Assignment not found.', 404);
    return ok(res, 'Assignment removed successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAssignments,
  createAssignment,
  deleteAssignment
};
