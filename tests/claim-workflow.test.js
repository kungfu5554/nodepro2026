// tests/claim-workflow.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { pool } = require('../config/database');
const { parseRequiredJudges } = require('../utils/validation');
const authController = require('../controllers/auth.controller');
const judgeController = require('../controllers/judge.controller');
const evaluateeController = require('../controllers/evaluatee.controller');
const metricController = require('../controllers/metric.controller');
const periodController = require('../controllers/period.controller');
const apiRoutes = require('../routes/index');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    cookies: {},
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, val, opts) {
      this.cookies[name] = { val, opts };
      return this;
    },
    clearCookie(name) {
      this.clearedCookies.push(name);
      return this;
    }
  };
}

function createMockConn(queryHandler) {
  return {
    began: false,
    committed: false,
    rolledBack: false,
    released: false,
    async beginTransaction() { this.began = true; },
    async commit() { this.committed = true; },
    async rollback() { this.rolledBack = true; },
    release() { this.released = true; },
    query: queryHandler
  };
}

test('routes/index loads Express router cleanly with all expected mounted prefixes', () => {
  assert.ok(apiRoutes);
  const stack = apiRoutes.stack || [];
  const mounted = stack.filter(l => l.name === 'router').map(l => String(l.regexp));
  assert.ok(mounted.length >= 6);
});

test('parseRequiredJudges validates integer range 1..10 and default fallback', () => {
  assert.deepEqual(parseRequiredJudges(undefined, 3), { valid: true, value: 3 });
  assert.deepEqual(parseRequiredJudges('', 3), { valid: true, value: 3 });
  assert.deepEqual(parseRequiredJudges('4', 3), { valid: true, value: 4 });
  assert.deepEqual(parseRequiredJudges(1, 3), { valid: true, value: 1 });
  assert.deepEqual(parseRequiredJudges(10, 3), { valid: true, value: 10 });

  assert.equal(parseRequiredJudges(0).valid, false);
  assert.equal(parseRequiredJudges(11).valid, false);
  assert.equal(parseRequiredJudges(2.5).valid, false);
  assert.equal(parseRequiredJudges('abc').valid, false);
});

test('auth.controller.login rejects plaintext password and sets HttpOnly cookie on bcrypt match', async () => {
  const hashed = await bcrypt.hash('secret123', 4);

  pool.query = async (sql, params) => {
    assert.match(sql, /FROM users WHERE citizen_id = \?/);
    if (params[0] === '1100200000002') {
      return [[{
        id: 2,
        citizen_id: '1100200000002',
        password: 'plain-text-password',
        prefix: 'นาย',
        name: 'นายสมชาย',
        role: 'teacher',
        role_title: 'ผู้รับการประเมิน',
        department: 'คอมพิวเตอร์',
        dept_status: 'APPROVED',
        required_judges: 3
      }]];
    }
    return [[{
      id: 3,
      citizen_id: '1100300000003',
      password: hashed,
      prefix: 'นาง',
      name: 'นางสมหญิง',
      role: 'teacher',
      role_title: 'ผู้รับการประเมิน',
      department: 'คอมพิวเตอร์',
      dept_status: 'APPROVED',
      required_judges: 4
    }]];
  };

  // Plaintext password in DB must fail
  const resPlain = createMockRes();
  await authController.login(
    { body: { citizenId: '1100200000002', password: 'plain-text-password' } },
    resPlain,
    (e) => { throw e; }
  );
  assert.equal(resPlain.statusCode, 401);
  assert.equal(resPlain.body.status, 'error');

  // Bcrypt hash must succeed and include requiredJudges + auth_token cookie
  const resOk = createMockRes();
  await authController.login(
    { body: { citizenId: '1100300000003', password: 'secret123' } },
    resOk,
    (e) => { throw e; }
  );
  assert.equal(resOk.statusCode, 200);
  assert.equal(resOk.body.status, 'success');
  assert.equal(resOk.body.data.user.requiredJudges, 4);
  assert.ok(resOk.body.data.token);
  assert.ok(resOk.cookies.auth_token);
  assert.equal(resOk.cookies.auth_token.opts.httpOnly, true);
});

test('auth.controller.register validates and persists requiredJudges', async () => {
  // Reject invalid requiredJudges > 10
  const resInvalid = createMockRes();
  await authController.register({
    body: {
      citizenId: '1100999999999',
      name: 'ทดสอบ',
      password: 'password123',
      department: 'คอมพิวเตอร์',
      requiredJudges: 15
    }
  }, resInvalid, (e) => { throw e; });
  assert.equal(resInvalid.statusCode, 400);

  let insertedParams = null;
  pool.query = async (sql, params) => {
    if (sql.includes('SELECT id FROM users WHERE citizen_id')) return [[]];
    if (sql.includes('SELECT name FROM departments')) return [[{ name: 'คอมพิวเตอร์' }]];
    if (sql.includes('INSERT INTO users')) {
      insertedParams = params;
      return [{ insertId: 99 }];
    }
    if (sql.includes('SELECT * FROM users WHERE id = ?')) {
      return [[{
        id: 99,
        citizen_id: '1100999999999',
        prefix: 'นาย',
        name: 'นายทดสอบ ระบบ',
        role: 'teacher',
        role_title: 'ผู้รับการประเมิน',
        department: 'คอมพิวเตอร์',
        dept_status: 'APPROVED',
        position: 'ครู',
        required_judges: 4
      }]];
    }
    return [[]];
  };

  const resValid = createMockRes();
  await authController.register({
    body: {
      citizenId: '1100999999999',
      prefix: 'นาย',
      name: 'ทดสอบ ระบบ',
      password: 'password123',
      department: 'คอมพิวเตอร์',
      position: 'ครู',
      requiredJudges: 4
    }
  }, resValid, (e) => { throw e; });

  assert.equal(resValid.statusCode, 201);
  assert.equal(resValid.body.data.user.requiredJudges, 4);
  assert.ok(insertedParams.includes(4));
});

test('auth.controller.updateProfile prevents lowering requiredJudges below already claimed count', async () => {
  pool.query = async (sql) => {
    if (sql.includes('SELECT * FROM users WHERE id = ?')) {
      return [[{ id: 10, citizen_id: '1100200000002', role: 'teacher', prefix: 'นาย', required_judges: 4 }]];
    }
    if (sql.includes('FROM assignments')) {
      return [[{ cnt: 3 }]];
    }
    return [[]];
  };

  const res = createMockRes();
  await authController.updateProfile({
    user: { id: 10 },
    body: { requiredJudges: 2 }
  }, res, (e) => { throw e; });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /3/);
});

test('judge.controller.getAssignedEvaluatees filters SUBMITTED sheets & hides full candidates via HAVING', async () => {
  const capturedSql = [];
  pool.query = async (sql) => {
    capturedSql.push(sql);
    if (sql.includes('FROM department_judges')) {
      return [[{ department_name: 'เทคโนโลยีสารสนเทศ', role_in_board: 'กรรมการ' }]];
    }
    return [[
      {
        teacherCitizenId: '1100200000002',
        teacherName: 'นายครู ก',
        department: 'เทคโนโลยีสารสนเทศ',
        position: 'ครู',
        requiredJudges: 3,
        roleInBoard: 'กรรมการ',
        submissionStatus: 'SUBMITTED',
        assignmentId: null,
        myAssignmentStatus: null,
        totalScore: null,
        claimedJudgesCount: 2,
        totalJudgesEvaluated: 1
      },
      {
        teacherCitizenId: '1100200000005',
        teacherName: 'นางครู ข',
        department: 'เทคโนโลยีสารสนเทศ',
        position: 'ครู',
        requiredJudges: 3,
        roleInBoard: 'กรรมการ',
        submissionStatus: 'SUBMITTED',
        assignmentId: 44,
        myAssignmentStatus: 'CLAIMED',
        totalScore: null,
        claimedJudgesCount: 3,
        totalJudgesEvaluated: 1
      }
    ]];
  };

  const res = createMockRes();
  await judgeController.getAssignedEvaluatees({
    user: { citizenId: '1100300000003', name: 'กรรมการ ค' },
    query: { periodId: '1' }
  }, res, (e) => { throw e; });

  assert.equal(res.statusCode, 200);
  assert.match(capturedSql[1], /INNER JOIN teacher_submissions ts[\s\S]*ts\.status = 'SUBMITTED'/);
  assert.match(capturedSql[1], /HAVING \(a\.id IS NOT NULL AND myAssignmentStatus IN \('CLAIMED', 'SUBMITTED', 'EVALUATED'\)\)\s+OR claimedJudgesCount < requiredJudges/);

  assert.equal(res.body.data.length, 2);
  assert.equal(res.body.data[0].status, 'AVAILABLE');
  assert.equal(res.body.data[0].isClaimedByMe, false);
  assert.equal(res.body.data[0].canUnclaim, false);

  assert.equal(res.body.data[1].status, 'CLAIMED');
  assert.equal(res.body.data[1].isClaimedByMe, true);
  assert.equal(res.body.data[1].canUnclaim, true);
});

test('judge.controller.claimCandidate uses FOR UPDATE, enforces submission, quota & succeeds atomically', async () => {
  // Case 1: Quota already full -> 409 Conflict
  const connFull = createMockConn(async (sql) => {
    if (sql.includes('FROM users WHERE citizen_id = ?')) {
      return [[{ citizen_id: 'T1', department: 'IT', dept_status: 'APPROVED', requiredJudges: 3 }]];
    }
    if (sql.includes('FROM evaluation_periods')) return [[{ is_open: 1 }]];
    if (sql.includes('FROM teacher_submissions')) return [[{ status: 'SUBMITTED' }]];
    if (sql.includes('FROM assignments WHERE period_id = ? AND teacher_citizen_id = ? AND judge_citizen_id = ?')) return [[]];
    if (sql.includes('FROM department_judges')) return [[{ role_in_board: 'กรรมการ' }]];
    if (sql.includes('COUNT(DISTINCT judge_citizen_id) AS claimedCount')) return [[{ claimedCount: 3 }]];
    return [[]];
  });
  pool.getConnection = async () => connFull;

  const resFull = createMockRes();
  await judgeController.claimCandidate({
    user: { citizenId: 'J4' },
    body: { teacherCitizenId: 'T1', periodId: 1 }
  }, resFull, (e) => { throw e; });

  assert.equal(resFull.statusCode, 409);
  assert.equal(connFull.rolledBack, true);
  assert.equal(connFull.released, true);

  // Case 2: Teacher has not submitted self-evaluation -> 400
  const connNotSub = createMockConn(async (sql) => {
    if (sql.includes('FROM users WHERE citizen_id = ?')) {
      return [[{ citizen_id: 'T1', department: 'IT', dept_status: 'APPROVED', requiredJudges: 3 }]];
    }
    if (sql.includes('FROM evaluation_periods')) return [[{ is_open: 1 }]];
    if (sql.includes('FROM teacher_submissions')) return [[]];
    return [[]];
  });
  pool.getConnection = async () => connNotSub;

  const resNotSub = createMockRes();
  await judgeController.claimCandidate({
    user: { citizenId: 'J4' },
    body: { teacherCitizenId: 'T1', periodId: 1 }
  }, resNotSub, (e) => { throw e; });

  assert.equal(resNotSub.statusCode, 400);
  assert.equal(connNotSub.rolledBack, true);

  // Case 3: Slot available -> inserts CLAIMED & commits
  const connSuccess = createMockConn(async (sql) => {
    if (sql.includes('FROM users WHERE citizen_id = ?')) {
      assert.match(sql, /FOR UPDATE/);
      return [[{ citizen_id: 'T1', department: 'IT', dept_status: 'APPROVED', requiredJudges: 3 }]];
    }
    if (sql.includes('FROM evaluation_periods')) return [[{ is_open: 1 }]];
    if (sql.includes('FROM teacher_submissions')) return [[{ status: 'SUBMITTED' }]];
    if (sql.includes('FROM assignments WHERE period_id = ? AND teacher_citizen_id = ? AND judge_citizen_id = ?')) return [[]];
    if (sql.includes('FROM department_judges')) return [[{ role_in_board: 'กรรมการ' }]];
    if (sql.includes('COUNT(DISTINCT judge_citizen_id) AS claimedCount')) return [[{ claimedCount: 2 }]];
    if (sql.includes('INSERT INTO assignments')) return [{ insertId: 77 }];
    return [[]];
  });
  pool.getConnection = async () => connSuccess;

  const resOk = createMockRes();
  await judgeController.claimCandidate({
    user: { citizenId: 'J3' },
    body: { teacherCitizenId: 'T1', periodId: 1 }
  }, resOk, (e) => { throw e; });

  assert.equal(resOk.statusCode, 200);
  assert.equal(connSuccess.committed, true);
  assert.equal(resOk.body.data.assignmentId, 77);
  assert.equal(resOk.body.data.claimedJudgesCount, 3);
  assert.equal(resOk.body.data.requiredJudges, 3);
});

test('judge.controller.unclaimCandidate releases CLAIMED row and blocks deleting EVALUATED row', async () => {
  // Already EVALUATED -> 400
  const connEval = createMockConn(async () => [[{ id: 15, judge_citizen_id: 'J1', status: 'EVALUATED' }]]);
  pool.getConnection = async () => connEval;
  const resEval = createMockRes();
  await judgeController.unclaimCandidate({
    user: { citizenId: 'J1' },
    params: { assignmentId: '15' }
  }, resEval, (e) => { throw e; });
  assert.equal(resEval.statusCode, 400);
  assert.equal(connEval.rolledBack, true);

  // CLAIMED -> DELETE and commit
  let deleted = false;
  const connClaimed = createMockConn(async (sql) => {
    if (sql.includes('SELECT id')) return [[{ id: 16, judge_citizen_id: 'J1', status: 'CLAIMED' }]];
    if (sql.includes('DELETE FROM assignments')) {
      deleted = true;
      return [{ affectedRows: 1 }];
    }
    return [[]];
  });
  pool.getConnection = async () => connClaimed;
  const resOk = createMockRes();
  await judgeController.unclaimCandidate({
    user: { citizenId: 'J1' },
    params: { assignmentId: '16' }
  }, resOk, (e) => { throw e; });
  assert.equal(resOk.statusCode, 200);
  assert.equal(deleted, true);
  assert.equal(connClaimed.committed, true);
});

test('judge.controller blocks grading or submitting on PENDING (unclaimed) assignments', async () => {
  pool.query = async () => [[{
    id: 50,
    periodId: 1,
    teacherCitizenId: 'T1',
    judgeCitizenId: 'J1',
    status: 'PENDING'
  }]];

  const resGrade = createMockRes();
  await judgeController.getCandidateDetailsForGrading({
    user: { role: 'judge', citizenId: 'J1' },
    params: { assignmentId: '50' }
  }, resGrade, (e) => { throw e; });
  assert.equal(resGrade.statusCode, 403);

  const connSubmit = createMockConn(async () => [[{
    id: 50,
    period_id: 1,
    teacher_citizen_id: 'T1',
    judge_citizen_id: 'J1',
    status: 'PENDING'
  }]]);
  pool.getConnection = async () => connSubmit;
  const resSubmit = createMockRes();
  await judgeController.submitEvaluation({
    user: { role: 'judge', citizenId: 'J1' },
    params: { assignmentId: '50' },
    body: { scores: { 1: 4 }, overallFeedback: 'ok' }
  }, resSubmit, (e) => { throw e; });
  assert.equal(resSubmit.statusCode, 403);
});

test('evaluatee.controller.getMyEvaluationSheet batch loads scores without N+1 queries and includes judge counts', async () => {
  let judgeEvalQueryCount = 0;
  pool.query = async (sql) => {
    if (sql.includes('FROM users WHERE citizen_id')) return [[{ citizen_id: 'T1', required_judges: 4 }]];
    if (sql.includes('FROM evaluation_periods')) return [[{ id: 1, name: 'P1', is_open: 1 }]];
    if (sql.includes('FROM metrics')) return [[{ id: 101, weight: 100 }]];
    if (sql.includes('FROM self_evaluations')) return [[]];
    if (sql.includes('FROM teacher_submissions')) return [[{ status: 'SUBMITTED' }]];
    if (sql.includes('COUNT(DISTINCT judge_citizen_id)')) return [[{ claimedJudgesCount: 3 }]];
    if (sql.includes('FROM assignments a')) {
      return [[
        { assignmentId: 1, judgeCitizenId: 'J1', judgeName: 'ก1', totalScore: '4.00' },
        { assignmentId: 2, judgeCitizenId: 'J2', judgeName: 'ก2', totalScore: '3.00' }
      ]];
    }
    if (sql.includes('FROM judge_evaluations')) {
      judgeEvalQueryCount += 1;
      assert.match(sql, /WHERE assignment_id IN \(\?\)/);
      return [[
        { assignmentId: 1, metricId: 101, judgeScore: 4 },
        { assignmentId: 2, metricId: 101, judgeScore: 3 }
      ]];
    }
    return [[]];
  };

  const res = createMockRes();
  await evaluateeController.getMyEvaluationSheet({
    user: { citizenId: 'T1' },
    query: { periodId: '1' }
  }, res, (e) => { throw e; });

  assert.equal(res.statusCode, 200);
  assert.equal(judgeEvalQueryCount, 1);
  assert.equal(res.body.data.consolidatedSummary.requiredJudges, 4);
  assert.equal(res.body.data.consolidatedSummary.claimedJudgesCount, 3);
  assert.equal(res.body.data.consolidatedSummary.averageTotalScore, '3.50');
});

test('evaluatee.controller.saveSelfEvaluations edit resets assignments back to CLAIMED after wiping scores', async () => {
  const executedSql = [];
  const conn = createMockConn(async (sql) => {
    executedSql.push(sql);
    if (sql.includes('SELECT department, dept_status')) return [[{ department: 'IT', dept_status: 'APPROVED' }]];
    if (sql.includes('SELECT is_open FROM evaluation_periods')) return [[{ is_open: 1 }]];
    if (sql.includes('SELECT status FROM teacher_submissions')) return [[{ status: 'SUBMITTED' }]];
    if (sql.includes('SELECT COUNT(*) AS evalCount')) return [[{ evalCount: 1 }]];
    return [[]];
  });
  pool.getConnection = async () => conn;

  const res = createMockRes();
  await evaluateeController.saveSelfEvaluations({
    user: { citizenId: 'T1' },
    body: {
      periodId: 1,
      isEditConfirm: true,
      scores: [{ metricId: 101, selfScore: '4', teacherComment: 'updated' }]
    }
  }, res, (e) => { throw e; });

  assert.equal(res.statusCode, 200);
  assert.equal(conn.committed, true);
  assert.ok(executedSql.some(s => s.includes("SET status = 'CLAIMED'")));
});

test('metric.controller creates/lists categories and links categoryId on metric creation', async () => {
  pool.query = async (sql) => {
    if (sql.includes('INSERT INTO metric_categories')) return [{ insertId: 12 }];
    if (sql.includes('FROM metric_categories mc')) {
      return [[{ id: 12, periodId: 1, name: 'ด้านการสอน', description: 'รายละเอียด', sortOrder: 1, metricCount: 1 }]];
    }
    if (sql.includes('SELECT id FROM metric_categories WHERE id = ? AND period_id = ?')) return [[{ id: 12 }]];
    if (sql.includes('INSERT INTO metrics')) return [{ insertId: 88 }];
    return [[]];
  };

  const resCat = createMockRes();
  await metricController.createMetricCategory({
    body: { periodId: 1, name: 'ด้านการสอน', description: 'รายละเอียด', sortOrder: 1 }
  }, resCat, (e) => { throw e; });
  assert.equal(resCat.statusCode, 201);
  assert.equal(resCat.body.data.id, 12);

  const resList = createMockRes();
  await metricController.getMetricCategories({ query: { periodId: 1 } }, resList, (e) => { throw e; });
  assert.equal(resList.statusCode, 200);
  assert.equal(resList.body.data[0].name, 'ด้านการสอน');

  const resMetric = createMockRes();
  await metricController.createMetric({
    body: { periodId: 1, categoryId: 12, title: 'แผนการสอน', weight: 40 }
  }, resMetric, (e) => { throw e; });
  assert.equal(resMetric.statusCode, 201);
  assert.equal(resMetric.body.data.categoryId, 12);

  // Invalid category in period -> 400
  pool.query = async (sql) => {
    if (sql.includes('SELECT id FROM metric_categories')) return [[]];
    return [[]];
  };
  const resBadCat = createMockRes();
  await metricController.createMetric({
    body: { periodId: 1, categoryId: 999, title: 'แผนการสอน', weight: 40 }
  }, resBadCat, (e) => { throw e; });
  assert.equal(resBadCat.statusCode, 400);
});

test('period.controller.getStatistics and getTrackingOverview/getIndividualTrackingDetail return detailed stats & pipelines', async () => {
  pool.query = async (sql) => {
    if (sql.includes('COUNT(*) AS totalTeachers')) return [[{ totalTeachers: 2 }]];
    if (sql.includes('COUNT(*) AS approvedTeachers')) return [[{ approvedTeachers: 2 }]];
    if (sql.includes('COUNT(*) AS totalJudges')) return [[{ totalJudges: 2 }]];
    if (sql.includes('COUNT(*) AS pendingDeptRequests')) return [[{ pendingDeptRequests: 0 }]];
    if (sql.includes('COUNT(*) AS submittedTeachers')) return [[{ submittedTeachers: 1 }]];
    if (sql.includes('SUM(CASE WHEN status')) {
      return [[{ totalAssignments: 2, pendingAssignments: 0, claimedAssignments: 1, submittedAssignments: 0, completedAssignments: 1 }]];
    }
    if (sql.includes('MAX(es.total_score)')) {
      return [[{ avgScore: 3.75, maxScore: 3.75, minScore: 3.75, scoreCount: 1 }]];
    }
    if (sql.includes('GROUP BY u.citizen_id, u.department')) {
      return [[
        { citizenId: 'T1', department: 'IT', requiredJudges: 1, isSubmitted: 1, claimedCount: 1, evaluatedCount: 1, teacherAvgScore: 3.75 },
        { citizenId: 'T2', department: 'IT', requiredJudges: 3, isSubmitted: 0, claimedCount: 0, evaluatedCount: 0, teacherAvgScore: null }
      ]];
    }
    return [[]];
  };

  const resStats = createMockRes();
  await periodController.getStatistics({ query: { periodId: '1' } }, resStats, (e) => { throw e; });
  assert.equal(resStats.statusCode, 200);
  assert.equal(resStats.body.data.fullyEvaluatedTeachers, 1);
  assert.equal(resStats.body.data.completionRate, 50);
  assert.equal(resStats.body.data.gradeDistribution['ดีเด่น'], 1);
  assert.equal(resStats.body.data.departmentStats[0].department, 'IT');

  // getTrackingOverview
  pool.query = async (sql) => {
    if (sql.includes('COUNT(*) AS totalMetricsCount')) return [[{ totalMetricsCount: 3 }]];
    if (sql.includes('FROM users u') && sql.includes("u.role = 'teacher'")) {
      return [[
        { citizenId: 'T1', name: 'ครู ก', department: 'IT', deptStatus: 'APPROVED', position: 'ครู', requiredJudges: 3, submissionStatus: 'SUBMITTED', selfMetricDoneCount: 3 },
        { citizenId: 'T2', name: 'ครู ข', department: 'IT', deptStatus: 'APPROVED', position: 'ครู', requiredJudges: 3, submissionStatus: 'DRAFT', selfMetricDoneCount: 1 }
      ]];
    }
    if (sql.includes('FROM assignments a')) {
      return [[
        { assignmentId: 10, teacherCitizenId: 'T1', teacherName: 'ครู ก', teacherDepartment: 'IT', judgeCitizenId: 'J1', judgeName: 'กรรมการ 1', status: 'EVALUATED', totalScore: '3.80' },
        { assignmentId: 11, teacherCitizenId: 'T1', teacherName: 'ครู ก', teacherDepartment: 'IT', judgeCitizenId: 'J2', judgeName: 'กรรมการ 2', status: 'CLAIMED', totalScore: null }
      ]];
    }
    if (sql.includes('FROM users') && sql.includes("role = 'judge'")) {
      return [[{ citizenId: 'J1', name: 'กรรมการ 1', department: 'IT', position: 'ประธาน' }]];
    }
    if (sql.includes('FROM department_judges')) {
      return [[{ judgeCitizenId: 'J1', departmentName: 'IT', roleInBoard: 'ประธานกรรมการ' }]];
    }
    return [[]];
  };

  const resTrack = createMockRes();
  await periodController.getTrackingOverview({ query: { periodId: '1' } }, resTrack, (e) => { throw e; });
  assert.equal(resTrack.statusCode, 200);
  assert.equal(resTrack.body.data.evaluatees[0].workflowStage, 'PARTIAL_EVALUATED');
  assert.equal(resTrack.body.data.evaluatees[0].claimedJudgesCount, 2);
  assert.equal(resTrack.body.data.evaluatees[0].evaluatedJudgesCount, 1);
  assert.equal(resTrack.body.data.evaluatees[1].workflowStage, 'SELF_DRAFT');
  assert.equal(resTrack.body.data.judges[0].evaluatedCount, 1);
  assert.equal(resTrack.body.data.judges[0].assignedDepartments[0].departmentName, 'IT');
});

test('print-reports consolidated PDF omits comments & per-judge breakdown, while individual PDF embeds judge signature image', async () => {
  const { buildOfficialInnerHTML } = await import('../public/js/utils/print-reports.js');

  const consolidatedHtml = buildOfficialInnerHTML('consolidated', {
    teacherName: 'นายสมชาย ใจดี',
    department: 'แผนกวิชาเทคโนโลยีสารสนเทศ',
    teacherCitizenId: '1100200000002',
    periodName: 'รอบที่ 1/2568',
    totalScore: '3.60',
    judgeCount: 3,
    requiredJudges: 3,
    judges: [
      { name: 'ดร.สมศักดิ์ หนึ่ง', roleInBoard: 'ประธานกรรมการ', judgeSignature: 'data:image/png;base64,SIG1', submittedAt: '2026-10-15T09:00:00Z' },
      { name: 'นางสมหญิง สอง', roleInBoard: 'กรรมการ', judgeSignature: 'data:image/png;base64,SIG2', submittedAt: '2026-10-16T09:00:00Z' },
      { name: 'นายสมหมาย สาม', roleInBoard: 'กรรมการและเลขานุการ', judgeSignature: 'data:image/png;base64,SIG3', submittedAt: '2026-10-17T09:00:00Z' }
    ],
    totalWeight: 100,
    metricsRows: [
      {
        id: 1,
        categoryName: 'ด้านการจัดการเรียนรู้',
        title: 'การจัดทำแผนการสอน',
        weight: 100,
        selfScoreDisplay: 'ระดับ 4',
        avgScoreDisplay: '3.60 / 4.00',
        avgRawScore: '3.60',
        teacherComment: 'SECRET_COMMENT_SHOULD_NOT_APPEAR'
      }
    ],
    overallFeedback: 'SECRET_FEEDBACK_SHOULD_NOT_APPEAR'
  });

  assert.match(consolidatedHtml, /แบบสรุปผลการประเมินผลการปฏิบัติงานเฉลี่ยรวม/);
  assert.match(consolidatedHtml, /3\.60 \/ 4\.00/);
  assert.match(consolidatedHtml, /ดร\.สมศักดิ์ หนึ่ง/);
  assert.match(consolidatedHtml, /นางสมหญิง สอง/);
  assert.match(consolidatedHtml, /นายสมหมาย สาม/);
  assert.match(consolidatedHtml, /data:image\/png;base64,SIG1/);
  assert.match(consolidatedHtml, /data:image\/png;base64,SIG2/);
  assert.match(consolidatedHtml, /data:image\/png;base64,SIG3/);
  assert.doesNotMatch(consolidatedHtml, /SECRET_COMMENT_SHOULD_NOT_APPEAR/);
  assert.doesNotMatch(consolidatedHtml, /SECRET_FEEDBACK_SHOULD_NOT_APPEAR/);
  assert.doesNotMatch(consolidatedHtml, /สรุปผลการประเมินและข้อเสนอแนะจากกรรมการผู้ประเมินแต่ละท่าน/);

  const individualHtml = buildOfficialInnerHTML('individual', {
    teacherName: 'นายสมชาย ใจดี',
    judgeName: 'ดร.สมศักดิ์',
    judgeSignature: 'data:image/png;base64,AAAA',
    totalScore: '3.80',
    totalWeight: 100,
    metricsRows: []
  });
  assert.match(individualHtml, /<img src="data:image\/png;base64,AAAA"[^>]*class="print-sig-img"/);
});

test('evaluatee.controller.getMyEvaluationSheet includes per-metric judge verification progress', async () => {
  pool.query = async (sql) => {
    if (sql.includes('FROM users WHERE citizen_id')) {
      return [[{
        id: 2, citizen_id: 'T1', role: 'teacher', name: 'ครู ก',
        department: 'IT', dept_status: 'APPROVED', position: 'ครู', required_judges: 4
      }]];
    }
    if (sql.includes('FROM evaluation_periods')) {
      return [[{ id: 1, name: 'รอบ 1', is_open: 1 }]];
    }
    if (sql.includes('FROM metrics')) {
      return [[
        { id: 101, categoryId: 1, categoryName: 'ด้านการสอน', title: 'แผนการสอน', weight: 50, evalType: 'SCALE', evidenceType: 'PDF' },
        { id: 102, categoryId: 1, categoryName: 'ด้านการสอน', title: 'สื่อการสอน', weight: 50, evalType: 'SCALE', evidenceType: 'PDF' }
      ]];
    }
    if (sql.includes('FROM self_evaluations')) {
      return [[
        { metricId: 101, selfScore: '4', teacherComment: 'ok', evidenceUrl: null },
        { metricId: 102, selfScore: '3', teacherComment: 'ok', evidenceUrl: null }
      ]];
    }
    if (sql.includes('FROM teacher_submissions')) {
      return [[{ status: 'SUBMITTED', submittedAt: '2026-10-10T10:00:00Z' }]];
    }
    if (sql.includes('COUNT(DISTINCT judge_citizen_id)')) {
      return [[{ claimedJudgesCount: 3 }]];
    }
    if (sql.includes('FROM assignments a') && sql.includes("a.status = 'EVALUATED'")) {
      return [[
        { assignmentId: 10, judgeCitizenId: 'J1', judgeName: 'กรรมการ 1', judgePosition: 'ครู', roleInBoard: 'ประธาน', totalScore: '4.00', overallFeedback: 'ดีมาก', judgeSignature: 'data:image/png;base64,X', submittedAt: '2026-10-11' },
        { assignmentId: 11, judgeCitizenId: 'J2', judgeName: 'กรรมการ 2', judgePosition: 'ครู', roleInBoard: 'กรรมการ', totalScore: '3.50', overallFeedback: 'ดี', judgeSignature: 'data:image/png;base64,Y', submittedAt: '2026-10-11' }
      ]];
    }
    if (sql.includes('FROM judge_evaluations')) {
      return [[
        { assignmentId: 10, metricId: 101, judgeScore: 4 },
        { assignmentId: 10, metricId: 102, judgeScore: 4 },
        { assignmentId: 11, metricId: 101, judgeScore: 3 }
      ]];
    }
    return [[]];
  };

  const res = createMockRes();
  await evaluateeController.getMyEvaluationSheet(
    { query: { periodId: '1' }, user: { citizenId: 'T1' } },
    res,
    (e) => { throw e; }
  );
  assert.equal(res.statusCode, 200);
  const summary = res.body.data.consolidatedSummary;
  assert.deepEqual(summary.metricJudgeProgress[101], {
    evaluatedCount: 2,
    claimedCount: 3,
    requiredJudges: 4,
    percent: 50
  });
  assert.deepEqual(summary.metricJudgeProgress[102], {
    evaluatedCount: 1,
    claimedCount: 3,
    requiredJudges: 4,
    percent: 25
  });
});

test('deleteMetric & deleteUser handle blocked and successful deletions cleanly', async () => {
  const userController = require('../controllers/user.controller');

  // deleteMetric blocked when self_evaluations exist (returns clear Thai message)
  pool.query = async (sql) => {
    if (sql.includes('SELECT COUNT(*) AS count FROM self_evaluations')) return [[{ count: 2 }]];
    return [[]];
  };
  const resBlocked = createMockRes();
  await metricController.deleteMetric({ params: { id: '5' } }, resBlocked, (e) => { throw e; });
  assert.equal(resBlocked.statusCode, 400);
  assert.match(resBlocked.body.message, /ไม่สามารถลบตัวชี้วัดได้/);

  // deleteMetric succeeds when unused
  let deletedMetricId = null;
  pool.query = async (sql, params) => {
    if (sql.includes('SELECT COUNT(*) AS count FROM self_evaluations')) return [[{ count: 0 }]];
    if (sql.includes('DELETE FROM metrics WHERE id = ?')) {
      deletedMetricId = params[0];
      return [{ affectedRows: 1 }];
    }
    return [[]];
  };
  const resOk = createMockRes();
  await metricController.deleteMetric({ params: { id: '5' } }, resOk, (e) => { throw e; });
  assert.equal(resOk.statusCode, 200);
  assert.equal(deletedMetricId, '5');

  // deleteUser deletes via transaction when not self
  const connCalls = [];
  const origGetConnection = pool.getConnection;
  pool.getConnection = async () => ({
    beginTransaction: async () => connCalls.push('BEGIN'),
    query: async (sql) => {
      connCalls.push(sql);
      if (sql.includes('SELECT id, citizen_id FROM users')) {
        return [[{ id: 9, citizen_id: 'T9' }]];
      }
      if (sql.includes('DELETE FROM users')) return [{ affectedRows: 1 }];
      return [{}];
    },
    commit: async () => connCalls.push('COMMIT'),
    rollback: async () => connCalls.push('ROLLBACK'),
    release: () => connCalls.push('RELEASE')
  });
  try {
    const resDelUser = createMockRes();
    await userController.deleteUser(
      { params: { citizenId: 'T9' }, user: { citizenId: 'ADMIN1' } },
      resDelUser,
      (e) => { throw e; }
    );
    assert.equal(resDelUser.statusCode, 200);
    assert.ok(connCalls.includes('COMMIT'));
  } finally {
    pool.getConnection = origGetConnection;
  }
});
