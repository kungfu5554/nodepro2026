// controllers/period.controller.js
const { pool } = require('../config/database');
const { ok, fail } = require('../utils/response');

function classifyGrade(score) {
  const s = parseFloat(score);
  if (isNaN(s) || s <= 0) return null;
  if (s >= 3.5) return 'ดีเด่น';
  if (s >= 3.0) return 'ดีมาก';
  if (s >= 2.5) return 'ดี';
  if (s >= 2.0) return 'พอใช้';
  return 'ปรับปรุง';
}

function buildWorkflowStage(row) {
  if (row.deptStatus === 'PENDING') return { code: 'DEPT_PENDING', label: 'รออนุมัติสาขาวิชา' };
  if (row.deptStatus === 'REJECTED' || !row.department) return { code: 'DEPT_REJECTED', label: 'สาขาไม่ผ่าน/รอเลือกใหม่' };
  if (row.submissionStatus !== 'SUBMITTED') return { code: 'SELF_DRAFT', label: 'ยังไม่ส่งแบบประเมินตนเอง' };
  if (row.evaluatedJudgesCount >= row.requiredJudges) return { code: 'COMPLETED', label: 'ประเมินเสร็จสมบูรณ์' };
  if (row.evaluatedJudgesCount > 0) return { code: 'PARTIAL_EVALUATED', label: 'ตรวจแล้วบางส่วน' };
  if (row.claimedJudgesCount >= row.requiredJudges) return { code: 'CLAIMED_FULL', label: 'กรรมการรับครบแล้ว รอตรวจ' };
  if (row.claimedJudgesCount > 0) return { code: 'PARTIAL_CLAIM', label: 'กรรมการรับบางส่วน' };
  return { code: 'WAITING_CLAIM', label: 'ส่งแล้ว รอกรรมการกดรับ' };
}

async function getPeriod(req, res, next) {
  try {
    const periodId = req.query.periodId;
    let query = `
      SELECT id, name, DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate, is_open AS isOpen
      FROM evaluation_periods
    `;
    const params = [];
    if (periodId) {
      query += ' WHERE id = ?';
      params.push(periodId);
    } else {
      query += ' ORDER BY id ASC LIMIT 1';
    }

    const [rows] = await pool.query(query, params);
    if (rows.length === 0) return fail(res, 'No evaluation period found.', 404);
    return ok(res, 'Evaluation period retrieved.', rows[0]);
  } catch (error) {
    next(error);
  }
}

async function getAllPeriods(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate, is_open AS isOpen
      FROM evaluation_periods
      ORDER BY id ASC
    `);
    return ok(res, 'All evaluation periods retrieved.', rows);
  } catch (error) {
    next(error);
  }
}

async function updatePeriod(req, res, next) {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, isOpen } = req.body;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return fail(res, 'Start date cannot be after end date.', 400);
    }

    await pool.query(`
      UPDATE evaluation_periods
      SET name = COALESCE(?, name),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          is_open = COALESCE(?, is_open)
      WHERE id = ?
    `, [name, startDate, endDate, isOpen !== undefined ? (isOpen ? 1 : 0) : null, id]);

    return ok(res, 'Evaluation period updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function getStatistics(req, res, next) {
  try {
    const periodId = parseInt(req.query.periodId || 1, 10);

    const [[{ totalTeachers }]] = await pool.query("SELECT COUNT(*) AS totalTeachers FROM users WHERE role = 'teacher'");
    const [[{ approvedTeachers }]] = await pool.query(
      "SELECT COUNT(*) AS approvedTeachers FROM users WHERE role = 'teacher' AND dept_status = 'APPROVED' AND department IS NOT NULL"
    );
    const [[{ totalJudges }]] = await pool.query("SELECT COUNT(*) AS totalJudges FROM users WHERE role = 'judge'");
    const [[{ pendingDeptRequests }]] = await pool.query("SELECT COUNT(*) AS pendingDeptRequests FROM users WHERE dept_status = 'PENDING'");
    const [[{ submittedTeachers }]] = await pool.query(`
      SELECT COUNT(*) AS submittedTeachers
      FROM teacher_submissions ts
      INNER JOIN users u ON ts.teacher_citizen_id = u.citizen_id
      WHERE ts.period_id = ? AND ts.status = 'SUBMITTED' AND u.role = 'teacher' AND u.dept_status = 'APPROVED'
    `, [periodId]);

    const [[assignStats]] = await pool.query(`
      SELECT
        COUNT(*) AS totalAssignments,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pendingAssignments,
        SUM(CASE WHEN status = 'CLAIMED' THEN 1 ELSE 0 END) AS claimedAssignments,
        SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) AS submittedAssignments,
        SUM(CASE WHEN status = 'EVALUATED' THEN 1 ELSE 0 END) AS completedAssignments
      FROM assignments
      WHERE period_id = ?
    `, [periodId]);

    const [[scoreAgg]] = await pool.query(`
      SELECT
        COALESCE(AVG(es.total_score), 0) AS avgScore,
        COALESCE(MAX(es.total_score), 0) AS maxScore,
        COALESCE(MIN(es.total_score), 0) AS minScore,
        COUNT(es.id) AS scoreCount
      FROM evaluation_summaries es
      JOIN assignments a ON es.assignment_id = a.id
      WHERE a.period_id = ? AND a.status = 'EVALUATED'
    `, [periodId]);

    // Teacher-level aggregate for grade distribution, completion counts, and department stats
    const [teacherSummaryRows] = await pool.query(`
      SELECT
        u.citizen_id AS citizenId,
        COALESCE(u.department, 'ไม่ระบุสังกัด') AS department,
        COALESCE(u.required_judges, 3) AS requiredJudges,
        CASE WHEN ts.status = 'SUBMITTED' THEN 1 ELSE 0 END AS isSubmitted,
        SUM(CASE WHEN a.status IN ('CLAIMED', 'SUBMITTED', 'EVALUATED') THEN 1 ELSE 0 END) AS claimedCount,
        SUM(CASE WHEN a.status = 'EVALUATED' THEN 1 ELSE 0 END) AS evaluatedCount,
        AVG(CASE WHEN a.status = 'EVALUATED' THEN es.total_score ELSE NULL END) AS teacherAvgScore
      FROM users u
      LEFT JOIN teacher_submissions ts ON ts.teacher_citizen_id = u.citizen_id AND ts.period_id = ?
      LEFT JOIN assignments a ON a.teacher_citizen_id = u.citizen_id AND a.period_id = ?
      LEFT JOIN evaluation_summaries es ON es.assignment_id = a.id
      WHERE u.role = 'teacher' AND u.dept_status = 'APPROVED' AND u.department IS NOT NULL
      GROUP BY u.citizen_id, u.department, u.required_judges, ts.status
    `, [periodId, periodId]);

    let fullyClaimedTeachers = 0;
    let fullyEvaluatedTeachers = 0;
    const gradeDistribution = { 'ดีเด่น': 0, 'ดีมาก': 0, 'ดี': 0, 'พอใช้': 0, 'ปรับปรุง': 0 };
    const deptMap = new Map();

    for (const row of teacherSummaryRows) {
      const reqJudges = Number(row.requiredJudges) || 3;
      const claimed = Number(row.claimedCount) || 0;
      const evaluated = Number(row.evaluatedCount) || 0;

      if (claimed >= reqJudges) fullyClaimedTeachers += 1;
      if (evaluated >= reqJudges) fullyEvaluatedTeachers += 1;

      const grade = row.teacherAvgScore !== null ? classifyGrade(row.teacherAvgScore) : null;
      if (grade) gradeDistribution[grade] += 1;

      if (!deptMap.has(row.department)) {
        deptMap.set(row.department, {
          department: row.department,
          teacherCount: 0,
          submittedCount: 0,
          fullyClaimedCount: 0,
          evaluatedTeacherCount: 0,
          scoreSum: 0,
          scoredTeacherCount: 0
        });
      }
      const d = deptMap.get(row.department);
      d.teacherCount += 1;
      if (row.isSubmitted) d.submittedCount += 1;
      if (claimed >= reqJudges) d.fullyClaimedCount += 1;
      if (evaluated >= reqJudges) d.evaluatedTeacherCount += 1;
      if (row.teacherAvgScore !== null) {
        d.scoreSum += parseFloat(row.teacherAvgScore);
        d.scoredTeacherCount += 1;
      }
    }

    const departmentStats = Array.from(deptMap.values()).map(d => ({
      department: d.department,
      teacherCount: d.teacherCount,
      submittedCount: d.submittedCount,
      fullyClaimedCount: d.fullyClaimedCount,
      evaluatedTeacherCount: d.evaluatedTeacherCount,
      avgScore: d.scoredTeacherCount > 0 ? (d.scoreSum / d.scoredTeacherCount).toFixed(2) : null
    }));

    const hasScores = Number(scoreAgg.scoreCount) > 0;
    const completionRate = approvedTeachers > 0
      ? Math.round((fullyEvaluatedTeachers / approvedTeachers) * 100)
      : 0;

    return ok(res, 'Statistics calculated successfully.', {
      totalTeachers,
      approvedTeachers,
      totalJudges,
      pendingDeptRequests,
      submittedTeachers,
      notSubmittedTeachers: Math.max(0, approvedTeachers - submittedTeachers),
      fullyClaimedTeachers,
      fullyEvaluatedTeachers,
      completionRate,
      totalAssignments: Number(assignStats.totalAssignments) || 0,
      pendingAssignments: Number(assignStats.pendingAssignments) || 0,
      claimedAssignments: Number(assignStats.claimedAssignments) || 0,
      submittedAssignments: Number(assignStats.submittedAssignments) || 0,
      completedAssignments: Number(assignStats.completedAssignments) || 0,
      averageScore: hasScores ? parseFloat(scoreAgg.avgScore).toFixed(2) : '0.00',
      maxScore: hasScores ? parseFloat(scoreAgg.maxScore).toFixed(2) : null,
      minScore: hasScores ? parseFloat(scoreAgg.minScore).toFixed(2) : null,
      gradeDistribution,
      departmentStats
    });
  } catch (error) {
    next(error);
  }
}

async function getTrackingOverview(req, res, next) {
  try {
    const periodId = parseInt(req.query.periodId || 1, 10);

    const [[{ totalMetricsCount }]] = await pool.query(
      'SELECT COUNT(*) AS totalMetricsCount FROM metrics WHERE period_id = ?',
      [periodId]
    );

    const [teacherRows] = await pool.query(`
      SELECT
        u.citizen_id AS citizenId,
        u.name,
        u.department,
        u.dept_status AS deptStatus,
        u.requested_department AS requestedDepartment,
        u.position,
        COALESCE(u.required_judges, 3) AS requiredJudges,
        COALESCE(ts.status, 'DRAFT') AS submissionStatus,
        ts.submitted_at AS submittedAt,
        COUNT(DISTINCT se.metric_id) AS selfMetricDoneCount
      FROM users u
      LEFT JOIN teacher_submissions ts
        ON ts.teacher_citizen_id = u.citizen_id AND ts.period_id = ?
      LEFT JOIN self_evaluations se
        ON se.teacher_citizen_id = u.citizen_id AND se.period_id = ? AND se.self_score IS NOT NULL AND se.self_score <> ''
      WHERE u.role = 'teacher'
      GROUP BY u.citizen_id, u.name, u.department, u.dept_status, u.requested_department, u.position, u.required_judges, ts.status, ts.submitted_at
      ORDER BY u.department ASC, u.name ASC
    `, [periodId, periodId]);

    const [assignmentRows] = await pool.query(`
      SELECT
        a.id AS assignmentId,
        a.teacher_citizen_id AS teacherCitizenId,
        u_t.name AS teacherName,
        u_t.department AS teacherDepartment,
        a.judge_citizen_id AS judgeCitizenId,
        u_j.name AS judgeName,
        u_j.position AS judgePosition,
        a.role_in_board AS roleInBoard,
        a.status,
        a.claimed_at AS claimedAt,
        es.total_score AS totalScore,
        es.overall_feedback AS overallFeedback,
        es.judge_signature AS judgeSignature,
        es.submitted_at AS evaluatedAt
      FROM assignments a
      JOIN users u_t ON a.teacher_citizen_id = u_t.citizen_id
      JOIN users u_j ON a.judge_citizen_id = u_j.citizen_id
      LEFT JOIN evaluation_summaries es ON a.id = es.assignment_id
      WHERE a.period_id = ?
      ORDER BY a.id ASC
    `, [periodId]);

    const [judgeUsers] = await pool.query(`
      SELECT citizen_id AS citizenId, name, department, position
      FROM users
      WHERE role = 'judge'
      ORDER BY name ASC
    `);

    const [deptJudgeRows] = await pool.query(`
      SELECT judge_citizen_id AS judgeCitizenId, department_name AS departmentName, role_in_board AS roleInBoard
      FROM department_judges
      WHERE period_id = ?
      ORDER BY department_name ASC
    `, [periodId]);

    const assignByTeacher = new Map();
    const assignByJudge = new Map();
    for (const a of assignmentRows) {
      if (!assignByTeacher.has(a.teacherCitizenId)) assignByTeacher.set(a.teacherCitizenId, []);
      assignByTeacher.get(a.teacherCitizenId).push(a);

      if (!assignByJudge.has(a.judgeCitizenId)) assignByJudge.set(a.judgeCitizenId, []);
      assignByJudge.get(a.judgeCitizenId).push(a);
    }

    const deptsByJudge = new Map();
    for (const dj of deptJudgeRows) {
      if (!deptsByJudge.has(dj.judgeCitizenId)) deptsByJudge.set(dj.judgeCitizenId, []);
      deptsByJudge.get(dj.judgeCitizenId).push({
        departmentName: dj.departmentName,
        roleInBoard: dj.roleInBoard
      });
    }

    const evaluatees = teacherRows.map(t => {
      const myAssigns = assignByTeacher.get(t.citizenId) || [];
      const activeAssigns = myAssigns.filter(a => ['CLAIMED', 'SUBMITTED', 'EVALUATED'].includes(a.status));
      const evaluatedAssigns = myAssigns.filter(a => a.status === 'EVALUATED');
      const reqJudges = Number(t.requiredJudges) || 3;
      const claimedJudgesCount = activeAssigns.length;
      const evaluatedJudgesCount = evaluatedAssigns.length;

      const scoreVals = evaluatedAssigns
        .map(a => parseFloat(a.totalScore))
        .filter(n => !isNaN(n));
      const averageScore = scoreVals.length > 0
        ? (scoreVals.reduce((acc, v) => acc + v, 0) / scoreVals.length).toFixed(2)
        : null;

      const selfMetricDoneCount = Number(t.selfMetricDoneCount) || 0;
      const totalM = Number(totalMetricsCount) || 0;
      const selfProgress = totalM > 0 ? Math.min(100, Math.round((selfMetricDoneCount / totalM) * 100)) : 0;

      const stage = buildWorkflowStage({
        deptStatus: t.deptStatus,
        department: t.department,
        submissionStatus: t.submissionStatus,
        requiredJudges: reqJudges,
        claimedJudgesCount,
        evaluatedJudgesCount
      });

      return {
        ...t,
        requiredJudges: reqJudges,
        selfMetricDoneCount,
        totalMetricsCount: totalM,
        selfProgress,
        claimedJudgesCount,
        evaluatedJudgesCount,
        remainingSlots: Math.max(0, reqJudges - claimedJudgesCount),
        workflowStage: stage.code,
        workflowLabel: stage.label,
        averageScore,
        grade: averageScore ? classifyGrade(averageScore) : null,
        judges: myAssigns
      };
    });

    const judges = judgeUsers.map(j => {
      const handled = assignByJudge.get(j.citizenId) || [];
      const claimedPendingCount = handled.filter(a => a.status === 'CLAIMED' || a.status === 'SUBMITTED').length;
      const evaluatedCount = handled.filter(a => a.status === 'EVALUATED').length;
      const scores = handled
        .filter(a => a.status === 'EVALUATED' && a.totalScore !== null)
        .map(a => parseFloat(a.totalScore))
        .filter(n => !isNaN(n));
      const averageGivenScore = scores.length > 0
        ? (scores.reduce((acc, v) => acc + v, 0) / scores.length).toFixed(2)
        : null;

      return {
        ...j,
        assignedDepartments: deptsByJudge.get(j.citizenId) || [],
        claimedPendingCount,
        evaluatedCount,
        totalHandled: handled.length,
        averageGivenScore,
        assignments: handled
      };
    });

    return ok(res, 'Tracking overview retrieved.', {
      totalMetricsCount: Number(totalMetricsCount) || 0,
      evaluatees,
      judges
    });
  } catch (error) {
    next(error);
  }
}

async function getIndividualTrackingDetail(req, res, next) {
  try {
    const { teacherCitizenId } = req.params;
    const periodId = parseInt(req.query.periodId || 1, 10);

    const [teacherRows] = await pool.query(`
      SELECT
        citizen_id AS citizenId,
        name,
        department,
        dept_status AS deptStatus,
        requested_department AS requestedDepartment,
        position,
        email,
        phone,
        employee_id AS employeeId,
        COALESCE(required_judges, 3) AS requiredJudges
      FROM users
      WHERE citizen_id = ? AND role = 'teacher'
      LIMIT 1
    `, [teacherCitizenId]);

    if (teacherRows.length === 0) {
      return fail(res, 'ไม่พบข้อมูลผู้รับการประเมินรายนี้', 404);
    }
    const teacher = teacherRows[0];

    const [subs] = await pool.query(
      'SELECT status, submitted_at AS submittedAt FROM teacher_submissions WHERE period_id = ? AND teacher_citizen_id = ?',
      [periodId, teacherCitizenId]
    );
    const submission = subs.length > 0 ? subs[0] : { status: 'DRAFT', submittedAt: null };

    const [metrics] = await pool.query(`
      SELECT
        m.id AS metricId,
        m.category_id AS categoryId,
        mc.name AS categoryName,
        m.title,
        m.description,
        m.weight,
        m.eval_type AS evalType,
        m.evidence_type AS evidenceType,
        se.self_score AS selfScore,
        se.teacher_comment AS teacherComment,
        se.evidence_url AS evidenceUrl
      FROM metrics m
      LEFT JOIN metric_categories mc ON m.category_id = mc.id
      LEFT JOIN self_evaluations se
        ON se.metric_id = m.id AND se.period_id = ? AND se.teacher_citizen_id = ?
      WHERE m.period_id = ?
      ORDER BY COALESCE(mc.sort_order, 9999) ASC, m.id ASC
    `, [periodId, teacherCitizenId, periodId]);

    const [assignments] = await pool.query(`
      SELECT
        a.id AS assignmentId,
        a.judge_citizen_id AS judgeCitizenId,
        u_j.name AS judgeName,
        u_j.position AS judgePosition,
        a.role_in_board AS roleInBoard,
        a.status,
        a.claimed_at AS claimedAt,
        es.total_score AS totalScore,
        es.overall_feedback AS overallFeedback,
        es.judge_signature AS judgeSignature,
        es.submitted_at AS evaluatedAt
      FROM assignments a
      JOIN users u_j ON a.judge_citizen_id = u_j.citizen_id
      LEFT JOIN evaluation_summaries es ON a.id = es.assignment_id
      WHERE a.period_id = ? AND a.teacher_citizen_id = ?
      ORDER BY a.id ASC
    `, [periodId, teacherCitizenId]);

    const scoreMapByAssignment = new Map();
    if (assignments.length > 0) {
      const assignmentIds = assignments.map(a => a.assignmentId);
      const [scoreRows] = await pool.query(`
        SELECT assignment_id AS assignmentId, metric_id AS metricId, judge_score AS judgeScore
        FROM judge_evaluations
        WHERE assignment_id IN (?)
      `, [assignmentIds]);
      for (const s of scoreRows) {
        if (!scoreMapByAssignment.has(s.assignmentId)) scoreMapByAssignment.set(s.assignmentId, {});
        scoreMapByAssignment.get(s.assignmentId)[s.metricId] = Number(s.judgeScore).toFixed(2);
      }
    }

    const enrichedAssignments = assignments.map(a => ({
      ...a,
      metricScores: scoreMapByAssignment.get(a.assignmentId) || {}
    }));

    const evaluatedList = enrichedAssignments.filter(a => a.status === 'EVALUATED' && a.totalScore !== null);
    const averageTotalScore = evaluatedList.length > 0
      ? (evaluatedList.reduce((sum, a) => sum + parseFloat(a.totalScore), 0) / evaluatedList.length).toFixed(2)
      : null;

    const claimedJudgesCount = enrichedAssignments.filter(a => ['CLAIMED', 'SUBMITTED', 'EVALUATED'].includes(a.status)).length;
    const evaluatedJudgesCount = evaluatedList.length;
    const selfDoneCount = metrics.filter(m => m.selfScore !== null && m.selfScore !== undefined && String(m.selfScore).trim() !== '').length;
    const selfProgress = metrics.length > 0 ? Math.min(100, Math.round((selfDoneCount / metrics.length) * 100)) : 0;

    const stage = buildWorkflowStage({
      deptStatus: teacher.deptStatus,
      department: teacher.department,
      submissionStatus: submission.status,
      requiredJudges: Number(teacher.requiredJudges) || 3,
      claimedJudgesCount,
      evaluatedJudgesCount
    });

    return ok(res, 'Individual tracking detail retrieved.', {
      teacher: {
        ...teacher,
        requiredJudges: Number(teacher.requiredJudges) || 3
      },
      submission,
      workflowStage: stage.code,
      workflowLabel: stage.label,
      selfDoneCount,
      totalMetricsCount: metrics.length,
      selfProgress,
      claimedJudgesCount,
      evaluatedJudgesCount,
      averageTotalScore,
      grade: averageTotalScore ? classifyGrade(averageTotalScore) : null,
      metrics: metrics.map(m => {
        const scores = evaluatedList
          .map(a => parseFloat(a.metricScores[m.metricId]))
          .filter(n => !isNaN(n));
        return {
          ...m,
          avgJudgeScore: scores.length > 0
            ? (scores.reduce((acc, v) => acc + v, 0) / scores.length).toFixed(2)
            : null
        };
      }),
      assignments: enrichedAssignments
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPeriod,
  getAllPeriods,
  updatePeriod,
  getStatistics,
  getTrackingOverview,
  getIndividualTrackingDetail
};
