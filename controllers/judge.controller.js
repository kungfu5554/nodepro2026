const { pool } = require('../config/database');
const { ok, fail } = require('../utils/response');

async function getAssignedEvaluatees(req, res, next) {
  try {
    const judgeCitizenId = req.user.citizenId;
    const periodId = parseInt(req.query.periodId || 1, 10);
    const [deptRows] = await pool.query('SELECT DISTINCT department_name, role_in_board FROM department_judges WHERE judge_citizen_id = ? AND period_id = ?', [judgeCitizenId, periodId]);
    const assignedDepts = deptRows.map(r => r.department_name);

    let query = `
      SELECT u.citizen_id AS teacherCitizenId, u.name AS teacherName, u.department, u.position,
        COALESCE(u.required_judges, 3) AS requiredJudges,
        COALESCE(dj.role_in_board, a.role_in_board, 'กรรมการผู้ประเมิน') AS roleInBoard,
        ts.status AS submissionStatus, ts.submitted_at AS submittedAt, a.id AS assignmentId,
        a.status AS myAssignmentStatus, a.claimed_at AS claimedAt, es.total_score AS totalScore,
        es.overall_feedback AS overallFeedback,
        (SELECT COUNT(DISTINCT a2.judge_citizen_id) FROM assignments a2 WHERE a2.teacher_citizen_id = u.citizen_id AND a2.period_id = ? AND a2.status IN ('CLAIMED', 'SUBMITTED', 'EVALUATED')) AS claimedJudgesCount,
        (SELECT COUNT(DISTINCT a3.judge_citizen_id) FROM assignments a3 WHERE a3.teacher_citizen_id = u.citizen_id AND a3.period_id = ? AND a3.status = 'EVALUATED') AS totalJudgesEvaluated
      FROM users u
      INNER JOIN teacher_submissions ts ON ts.teacher_citizen_id = u.citizen_id AND ts.period_id = ? AND ts.status = 'SUBMITTED'
      LEFT JOIN department_judges dj ON dj.department_name = u.department AND dj.judge_citizen_id = ? AND dj.period_id = ?
      LEFT JOIN assignments a ON a.teacher_citizen_id = u.citizen_id AND a.judge_citizen_id = ? AND a.period_id = ?
      LEFT JOIN evaluation_summaries es ON a.id = es.assignment_id
      WHERE u.role = 'teacher' AND u.dept_status = 'APPROVED' AND u.department IS NOT NULL
    `;
    const params = [periodId, periodId, periodId, judgeCitizenId, periodId, judgeCitizenId, periodId];

    if (assignedDepts.length > 0) { query += ' AND (u.department IN (?) OR a.id IS NOT NULL)'; params.push(assignedDepts); }
    else query += ' AND a.id IS NOT NULL';

    query += `
      HAVING (a.id IS NOT NULL AND myAssignmentStatus IN ('CLAIMED', 'SUBMITTED', 'EVALUATED'))
          OR claimedJudgesCount < requiredJudges
      ORDER BY (a.id IS NOT NULL) DESC, u.department ASC, u.name ASC
    `;

    const [rows] = await pool.query(query, params);
    const candidates = rows.map(r => {
      const isClaimedByMe = Boolean(r.assignmentId) && ['CLAIMED', 'SUBMITTED', 'EVALUATED'].includes(r.myAssignmentStatus);
      const myEvaluationCompleted = r.myAssignmentStatus === 'EVALUATED';
      return {
        ...r,
        requiredJudges: Number(r.requiredJudges) || 3,
        claimedJudgesCount: Number(r.claimedJudgesCount) || 0,
        totalJudgesEvaluated: Number(r.totalJudgesEvaluated) || 0,
        judgeName: req.user.name,
        status: myEvaluationCompleted ? 'EVALUATED' : (isClaimedByMe ? 'CLAIMED' : 'AVAILABLE'),
        isClaimedByMe,
        canUnclaim: isClaimedByMe && !myEvaluationCompleted,
        myEvaluationCompleted,
        isSubmittedByTeacher: true
      };
    });
    return ok(res, 'Assigned candidates retrieved.', candidates);
  } catch (e) { next(e); }
}

async function claimCandidate(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const judgeCitizenId = req.user.citizenId;
    const { teacherCitizenId, periodId = 1 } = req.body;
    if (!teacherCitizenId) { conn.release(); return fail(res, 'กรุณาระบุรหัสผู้รับการประเมิน', 400); }
    if (teacherCitizenId === judgeCitizenId) { conn.release(); return fail(res, 'ไม่สามารถกดรับประเมินตนเองได้', 400); }

    await conn.beginTransaction();
    const [teacherRows] = await conn.query(
      'SELECT citizen_id, department, dept_status, COALESCE(required_judges, 3) AS requiredJudges FROM users WHERE citizen_id = ? AND role = ? FOR UPDATE',
      [teacherCitizenId, 'teacher']
    );
    if (teacherRows.length === 0 || teacherRows[0].dept_status !== 'APPROVED') {
      await conn.rollback(); conn.release(); return fail(res, 'ผู้รับการประเมินยังไม่ได้รับอนุมัติสังกัดสาขาวิชา', 403);
    }
    const teacher = teacherRows[0];

    const [periods] = await conn.query('SELECT is_open FROM evaluation_periods WHERE id = ?', [periodId]);
    if (periods.length === 0 || !periods[0].is_open) {
      await conn.rollback(); conn.release(); return fail(res, 'รอบการประเมินนี้ปิดระบบแล้ว ไม่สามารถกดรับการประเมินได้', 403);
    }

    const [subs] = await conn.query("SELECT status FROM teacher_submissions WHERE period_id = ? AND teacher_citizen_id = ? AND status = 'SUBMITTED'", [periodId, teacherCitizenId]);
    if (subs.length === 0) {
      await conn.rollback(); conn.release(); return fail(res, 'ผู้รับการประเมินยังไม่ได้ส่งแบบประเมินตนเอง', 400);
    }

    const [existing] = await conn.query('SELECT id, status FROM assignments WHERE period_id = ? AND teacher_citizen_id = ? AND judge_citizen_id = ?', [periodId, teacherCitizenId, judgeCitizenId]);
    if (existing.length > 0 && ['CLAIMED', 'SUBMITTED', 'EVALUATED'].includes(existing[0].status)) {
      await conn.commit(); conn.release(); return ok(res, 'ท่านได้รับผู้รับการประเมินรายนี้ไว้แล้ว', { assignmentId: existing[0].id });
    }

    const [deptJudge] = await conn.query('SELECT role_in_board FROM department_judges WHERE department_name = ? AND judge_citizen_id = ? AND period_id = ? LIMIT 1', [teacher.department, judgeCitizenId, periodId]);
    if (deptJudge.length === 0 && existing.length === 0) {
      await conn.rollback(); conn.release(); return fail(res, 'ท่านไม่ได้รับแต่งตั้งให้เป็นกรรมการประจำสาขาวิชาของผู้รับการประเมินรายนี้', 403);
    }

    const [[{ claimedCount }]] = await conn.query("SELECT COUNT(DISTINCT judge_citizen_id) AS claimedCount FROM assignments WHERE period_id = ? AND teacher_citizen_id = ? AND status IN ('CLAIMED', 'SUBMITTED', 'EVALUATED')", [periodId, teacherCitizenId]);
    if (Number(claimedCount) >= Number(teacher.requiredJudges)) {
      await conn.rollback(); conn.release(); return fail(res, `ผู้รับการประเมินรายนี้มีกรรมการกดรับครบ ${teacher.requiredJudges} ท่านแล้ว`, 409);
    }

    const roleInBoard = deptJudge.length > 0 ? deptJudge[0].role_in_board : 'กรรมการผู้ประเมิน';
    let assignmentId;
    if (existing.length > 0) {
      assignmentId = existing[0].id;
      await conn.query("UPDATE assignments SET status = 'CLAIMED', role_in_board = ?, claimed_at = CURRENT_TIMESTAMP WHERE id = ?", [roleInBoard, assignmentId]);
    } else {
      const [inserted] = await conn.query("INSERT INTO assignments (period_id, teacher_citizen_id, judge_citizen_id, role_in_board, status, claimed_at) VALUES (?, ?, ?, ?, 'CLAIMED', CURRENT_TIMESTAMP)", [periodId, teacherCitizenId, judgeCitizenId, roleInBoard]);
      assignmentId = inserted.insertId;
    }
    await conn.commit();
    conn.release();
    return ok(res, 'กดรับผู้รับการประเมินเรียบร้อยแล้ว ท่านสามารถเข้าตรวจประเมินได้ทันที', { assignmentId, claimedJudgesCount: Number(claimedCount) + 1, requiredJudges: Number(teacher.requiredJudges) });
  } catch (e) {
    await conn.rollback(); conn.release(); next(e);
  }
}

async function unclaimCandidate(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { assignmentId } = req.params;
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT id, judge_citizen_id, status FROM assignments WHERE id = ? FOR UPDATE', [assignmentId]);
    if (rows.length === 0) { await conn.rollback(); conn.release(); return fail(res, 'ไม่พบข้อมูลการรับประเมินรายการนี้', 404); }
    const asn = rows[0];
    if (asn.judge_citizen_id !== req.user.citizenId) { await conn.rollback(); conn.release(); return fail(res, 'ท่านไม่มีสิทธิ์ยกเลิกการรับประเมินรายการนี้', 403); }
    if (asn.status === 'EVALUATED') { await conn.rollback(); conn.release(); return fail(res, 'ไม่สามารถยกเลิกการรับได้ เนื่องจากท่านได้บันทึกผลการประเมินไปแล้ว', 400); }

    await conn.query('DELETE FROM assignments WHERE id = ?', [assignmentId]);
    await conn.commit();
    conn.release();
    return ok(res, 'ยกเลิกการรับและปล่อยสิทธิ์คืนให้กรรมการท่านอื่นเรียบร้อยแล้ว');
  } catch (e) {
    await conn.rollback(); conn.release(); next(e);
  }
}

async function getCandidateDetailsForGrading(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const [assignments] = await pool.query(`
      SELECT a.id, a.period_id AS periodId, ep.name AS periodName, a.teacher_citizen_id AS teacherCitizenId,
        a.judge_citizen_id AS judgeCitizenId, u_t.name AS teacherName, u_t.department, u_t.position,
        u_j.name AS judgeName, u_j.position AS judgePosition, u_j.signature_url AS judgeProfileSignatureUrl,
        a.role_in_board AS roleInBoard, a.status
      FROM assignments a
      JOIN users u_t ON a.teacher_citizen_id = u_t.citizen_id
      JOIN users u_j ON a.judge_citizen_id = u_j.citizen_id
      LEFT JOIN evaluation_periods ep ON a.period_id = ep.id
      WHERE a.id = ?
    `, [assignmentId]);
    if (assignments.length === 0) return fail(res, 'ไม่พบข้อมูลการรับประเมิน กรุณากดรับผู้รับการประเมินก่อน', 404);
    const assignment = assignments[0];

    if (req.user.role === 'judge') {
      if (assignment.judgeCitizenId !== req.user.citizenId) return fail(res, 'ท่านไม่มีสิทธิ์เข้าถึงข้อมูลการประเมินรายการนี้', 403);
      if (assignment.status === 'PENDING') return fail(res, 'กรุณากดรับผู้รับการประเมินก่อนเข้าตรวจให้คะแนน', 403);
    }

    const [subs] = await pool.query('SELECT status, submitted_at AS submittedAt FROM teacher_submissions WHERE period_id = ? AND teacher_citizen_id = ?', [assignment.periodId, assignment.teacherCitizenId]);
    const [metricRows] = await pool.query(`
      SELECT m.id AS metricId, m.category_id AS categoryId, mc.name AS categoryName, m.title, m.description,
        m.weight, m.eval_type AS evalType, m.evidence_type AS evidenceType, se.self_score AS selfScore,
        se.teacher_comment AS teacherComment, se.evidence_url AS evidenceUrl, se.evidence_original_name AS evidenceOriginalName,
        je.judge_score AS existingJudgeScore
      FROM metrics m
      LEFT JOIN metric_categories mc ON m.category_id = mc.id
      LEFT JOIN self_evaluations se ON m.id = se.metric_id AND se.teacher_citizen_id = ? AND se.period_id = ?
      LEFT JOIN judge_evaluations je ON m.id = je.metric_id AND je.assignment_id = ?
      WHERE m.period_id = ? ORDER BY COALESCE(mc.sort_order, 9999) ASC, m.id ASC
    `, [assignment.teacherCitizenId, assignment.periodId, assignment.id, assignment.periodId]);

    const [summaries] = await pool.query('SELECT total_score AS totalScore, overall_feedback AS overallFeedback, judge_signature AS judgeSignature, submitted_at AS submittedAt FROM evaluation_summaries WHERE assignment_id = ?', [assignment.id]);
    return ok(res, 'Grading details retrieved.', { assignment, submission: subs[0] || null, metrics: metricRows, summary: summaries[0] || null });
  } catch (e) { next(e); }
}

async function submitEvaluation(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { assignmentId } = req.params;
    const { scores, overallFeedback, signature } = req.body;
    if (!scores || typeof scores !== 'object') { conn.release(); return fail(res, 'กรุณาระบุคะแนนประเมินในแต่ละตัวชี้วัด', 400); }

    const [assignments] = await conn.query('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (assignments.length === 0) { conn.release(); return fail(res, 'ไม่พบข้อมูลการรับประเมิน กรุณากดรับผู้รับการประเมินก่อน', 404); }
    const assignment = assignments[0];

    if (req.user.role === 'judge' && assignment.judge_citizen_id !== req.user.citizenId) { conn.release(); return fail(res, 'ท่านไม่ได้รับมอบหมายให้ประเมินผู้รับการประเมินรายนี้', 403); }
    if (assignment.status === 'PENDING') { conn.release(); return fail(res, 'กรุณากดรับผู้รับการประเมินก่อนส่งผลการประเมิน', 403); }

    const [periods] = await conn.query('SELECT is_open FROM evaluation_periods WHERE id = ?', [assignment.period_id]);
    if (periods.length > 0 && !periods[0].is_open) { conn.release(); return fail(res, 'รอบการประเมินนี้ปิดระบบแล้ว ไม่สามารถส่งผลประเมินได้', 403); }

    const [teacherCheck] = await conn.query('SELECT dept_status FROM users WHERE citizen_id = ? LIMIT 1', [assignment.teacher_citizen_id]);
    if (teacherCheck.length === 0 || teacherCheck[0].dept_status !== 'APPROVED') { conn.release(); return fail(res, 'ผู้รับการประเมินยังไม่ได้รับอนุมัติสาขาวิชาจากฝ่ายบุคลากร', 403); }

    const [subs] = await conn.query("SELECT status FROM teacher_submissions WHERE period_id = ? AND teacher_citizen_id = ? AND status = 'SUBMITTED'", [assignment.period_id, assignment.teacher_citizen_id]);
    if (subs.length === 0) { conn.release(); return fail(res, 'ผู้รับการประเมินยังไม่ได้ส่งข้อมูลแบบประเมินตนเอง กรุณารอให้ผู้รับการประเมินส่งข้อมูลก่อน', 400); }

    const [metrics] = await conn.query('SELECT id, weight, eval_type FROM metrics WHERE period_id = ?', [assignment.period_id]);
    const metricMap = new Map(metrics.map(m => [m.id, m]));
    let totalWeightedScore = 0;
    let totalWeight = 0;

    await conn.beginTransaction();
    for (const [metricIdStr, rawScore] of Object.entries(scores)) {
      const metricId = parseInt(metricIdStr, 10);
      const metricDef = metricMap.get(metricId);
      if (!metricDef) continue;

      const score = metricDef.eval_type === 'BOOLEAN'
        ? ((rawScore === 'มี' || rawScore === 4 || rawScore === '4' || rawScore === '4.00' || rawScore === true) ? 4.00 : 0.00)
        : Math.min(4, Math.max(0, parseFloat(rawScore) || 0));
      const weight = metricDef.weight || 0;

      await conn.query('INSERT INTO judge_evaluations (assignment_id, metric_id, judge_score) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE judge_score = VALUES(judge_score)', [assignmentId, metricId, score]);
      totalWeightedScore += score * weight;
      totalWeight += weight;
    }

    const finalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    await conn.query(`
      INSERT INTO evaluation_summaries (assignment_id, total_score, overall_feedback, judge_signature) VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE total_score = VALUES(total_score), overall_feedback = VALUES(overall_feedback), judge_signature = VALUES(judge_signature), submitted_at = CURRENT_TIMESTAMP
    `, [assignmentId, finalScore.toFixed(2), overallFeedback || '', signature || req.user.name]);
    await conn.query("UPDATE assignments SET status = 'EVALUATED' WHERE id = ?", [assignmentId]);
    await conn.commit();
    conn.release();

    return ok(res, 'บันทึกและส่งผลการประเมินสำเร็จ', { assignmentId, totalScore: finalScore.toFixed(2) });
  } catch (e) {
    await conn.rollback(); conn.release(); next(e);
  }
}

module.exports = { getAssignedEvaluatees, claimCandidate, unclaimCandidate, getCandidateDetailsForGrading, submitEvaluation };
