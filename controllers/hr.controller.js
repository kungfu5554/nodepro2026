// controllers/hr.controller.js
const { pool } = require('../config/database');

// ============================================================================
// 1. Evaluation Period Management
// ============================================================================

// Get active or first evaluation period
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

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No evaluation period found.',
        data: null
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Evaluation period retrieved.',
      data: rows[0]
    });
  } catch (error) {
    next(error);
  }
}

// Get all evaluation periods
async function getAllPeriods(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id, 
        name, 
        DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate, 
        DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate, 
        is_open AS isOpen
      FROM evaluation_periods
      ORDER BY id ASC
    `);

    res.status(200).json({
      status: 'success',
      message: 'All evaluation periods retrieved.',
      data: rows
    });
  } catch (error) {
    next(error);
  }
}

// Update period details or toggle open status
async function updatePeriod(req, res, next) {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, isOpen } = req.body;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        status: 'error',
        message: 'Start date cannot be after end date.',
        data: null
      });
    }

    await pool.query(`
      UPDATE evaluation_periods
      SET name = COALESCE(?, name),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          is_open = COALESCE(?, is_open)
      WHERE id = ?
    `, [name, startDate, endDate, isOpen !== undefined ? (isOpen ? 1 : 0) : null, id]);

    res.status(200).json({
      status: 'success',
      message: 'Evaluation period updated successfully.',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// 2. Metrics Management
// ============================================================================

// Get all metrics
async function getMetrics(req, res, next) {
  try {
    const periodId = req.query.periodId || 1;
    const [rows] = await pool.query(`
      SELECT id, period_id AS periodId, title, description, weight, eval_type AS evalType, evidence_type AS evidenceType
      FROM metrics
      WHERE period_id = ?
      ORDER BY id ASC
    `, [periodId]);

    res.status(200).json({
      status: 'success',
      message: 'Metrics retrieved.',
      data: rows
    });
  } catch (error) {
    next(error);
  }
}

// Create new metric
async function createMetric(req, res, next) {
  try {
    const { title, description, weight, evalType, evidenceType, periodId } = req.body;

    if (!title || weight === undefined || weight === null) {
      return res.status(400).json({
        status: 'error',
        message: 'Metric title and weight are required.',
        data: null
      });
    }

    const numWeight = parseInt(weight, 10);
    if (isNaN(numWeight) || numWeight <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Weight must be a positive integer.',
        data: null
      });
    }

    const [result] = await pool.query(`
      INSERT INTO metrics (period_id, title, description, weight, eval_type, evidence_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [periodId || 1, title, description || null, numWeight, evalType || 'SCALE', evidenceType || 'PDF']);

    res.status(201).json({
      status: 'success',
      message: 'Metric created successfully.',
      data: { id: result.insertId, title, weight: numWeight, evalType: evalType || 'SCALE', evidenceType: evidenceType || 'PDF' }
    });
  } catch (error) {
    next(error);
  }
}

// Update existing metric
async function updateMetric(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, weight, evalType, evidenceType } = req.body;

    const numWeight = weight !== undefined ? parseInt(weight, 10) : null;

    const [result] = await pool.query(`
      UPDATE metrics
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          weight = COALESCE(?, weight),
          eval_type = COALESCE(?, eval_type),
          evidence_type = COALESCE(?, evidence_type)
      WHERE id = ?
    `, [title, description, numWeight, evalType, evidenceType, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Metric not found.',
        data: null
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Metric updated successfully.',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

// Delete metric safely (check submissions first)
async function deleteMetric(req, res, next) {
  try {
    const { id } = req.params;

    // Check if there are active submissions referencing this metric
    const [subs] = await pool.query('SELECT COUNT(*) AS count FROM self_evaluations WHERE metric_id = ?', [id]);
    if (subs[0].count > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete metric: teachers have already submitted self-evaluations under this indicator.',
        data: null
      });
    }

    await pool.query('DELETE FROM metrics WHERE id = ?', [id]);
    res.status(200).json({
      status: 'success',
      message: 'Metric deleted successfully.',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// 3. Assignment Management
// ============================================================================

// Get assignments list with teacher and judge names
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
        a.judge_citizen_id AS judgeId,
        u_j.name AS judgeName,
        a.role_in_board AS roleInBoard,
        a.status,
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

    res.status(200).json({
      status: 'success',
      message: 'Assignments retrieved.',
      data: rows
    });
  } catch (error) {
    next(error);
  }
}

// Assign judge to evaluatee
async function createAssignment(req, res, next) {
  try {
    const { teacherId, judgeId, roleInBoard, periodId } = req.body;

    if (!teacherId || !judgeId) {
      return res.status(400).json({
        status: 'error',
        message: 'Teacher citizen ID and Judge citizen ID are required.',
        data: null
      });
    }

    if (teacherId === judgeId) {
      return res.status(400).json({
        status: 'error',
        message: 'A candidate cannot be assigned to evaluate themselves.',
        data: null
      });
    }

    const [existing] = await pool.query(`
      SELECT id FROM assignments
      WHERE period_id = ? AND teacher_citizen_id = ? AND judge_citizen_id = ?
    `, [periodId || 1, teacherId, judgeId]);

    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'This assignment pairing already exists for this round.',
        data: null
      });
    }

    const [result] = await pool.query(`
      INSERT INTO assignments (period_id, teacher_citizen_id, judge_citizen_id, role_in_board, status)
      VALUES (?, ?, ?, ?, 'PENDING')
    `, [periodId || 1, teacherId, judgeId, roleInBoard || 'ประธานกรรมการ']);

    res.status(201).json({
      status: 'success',
      message: 'Judge assigned successfully.',
      data: { id: result.insertId }
    });
  } catch (error) {
    next(error);
  }
}

// Delete / unassign committee pairing
async function deleteAssignment(req, res, next) {
  try {
    const { id } = req.params;

    const [result] = await pool.query('DELETE FROM assignments WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Assignment not found.',
        data: null
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Assignment removed successfully.',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// 4. Tracking & Statistics
// ============================================================================

async function getStatistics(req, res, next) {
  try {
    const periodId = req.query.periodId || 1;

    // Total counts
    const [[{ totalTeachers }]] = await pool.query("SELECT COUNT(*) AS totalTeachers FROM users WHERE role = 'teacher'");
    const [[{ totalJudges }]] = await pool.query("SELECT COUNT(*) AS totalJudges FROM users WHERE role = 'judge'");
    const [[{ pendingDeptRequests }]] = await pool.query("SELECT COUNT(*) AS pendingDeptRequests FROM users WHERE dept_status = 'PENDING'");
    const [[{ submittedTeachers }]] = await pool.query(`
      SELECT COUNT(*) AS submittedTeachers
      FROM teacher_submissions ts
      INNER JOIN users u ON ts.teacher_citizen_id = u.citizen_id
      WHERE ts.period_id = ? AND ts.status = 'SUBMITTED' AND u.role = 'teacher' AND u.dept_status = 'APPROVED'
    `, [periodId]);

    // Assignment status breakdown
    const [[{ totalAssignments }]] = await pool.query('SELECT COUNT(*) AS totalAssignments FROM assignments WHERE period_id = ?', [periodId]);
    const [[{ pendingAssignments }]] = await pool.query("SELECT COUNT(*) AS pendingAssignments FROM assignments WHERE period_id = ? AND status = 'PENDING'", [periodId]);
    const [[{ submittedAssignments }]] = await pool.query("SELECT COUNT(*) AS submittedAssignments FROM assignments WHERE period_id = ? AND status = 'SUBMITTED'", [periodId]);
    const [[{ completedAssignments }]] = await pool.query("SELECT COUNT(*) AS completedAssignments FROM assignments WHERE period_id = ? AND status = 'EVALUATED'", [periodId]);

    // Average score calculation
    const [[{ avgScore }]] = await pool.query(`
      SELECT COALESCE(AVG(es.total_score), 0) AS avgScore
      FROM evaluation_summaries es
      JOIN assignments a ON es.assignment_id = a.id
      WHERE a.period_id = ? AND a.status = 'EVALUATED'
    `, [periodId]);

    res.status(200).json({
      status: 'success',
      message: 'Statistics calculated successfully.',
      data: {
        totalTeachers,
        totalJudges,
        pendingDeptRequests,
        submittedTeachers,
        totalAssignments,
        pendingAssignments,
        submittedAssignments,
        completedAssignments,
        averageScore: parseFloat(avgScore).toFixed(2)
      }
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// 5. Department Management
// ============================================================================

// Get all departments
async function getDepartments(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        d.id,
        d.name,
        d.code,
        (SELECT COUNT(*) FROM users u WHERE u.role = 'teacher' AND u.department = d.name AND u.dept_status = 'APPROVED') AS teacherCount,
        (SELECT COUNT(DISTINCT dj.judge_citizen_id) FROM department_judges dj WHERE dj.department_name = d.name) AS judgeCount,
        d.created_at AS createdAt
      FROM departments d
      ORDER BY d.id ASC
    `);

    res.status(200).json({
      status: 'success',
      message: 'Departments retrieved successfully.',
      data: rows
    });
  } catch (error) {
    next(error);
  }
}

// Create department
async function createDepartment(req, res, next) {
  try {
    const { name, code } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณากรอกชื่อสาขาวิชา/แผนก',
        data: null
      });
    }

    const cleanName = name.trim();
    const [existing] = await pool.query('SELECT id FROM departments WHERE name = ?', [cleanName]);
    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'ชื่อสาขาวิชานี้มีอยู่ในระบบแล้ว',
        data: null
      });
    }

    const [result] = await pool.query(
      'INSERT INTO departments (name, code) VALUES (?, ?)',
      [cleanName, code ? code.trim() : null]
    );

    // Auto-approve any pending teacher requests waiting for this exact department name
    await pool.query(`
      UPDATE users
      SET department = ?, dept_status = 'APPROVED', requested_department = NULL, dept_reject_reason = NULL
      WHERE dept_status = 'PENDING' AND requested_department = ?
    `, [cleanName, cleanName]);

    res.status(201).json({
      status: 'success',
      message: 'เพิ่มสาขาวิชาเรียบร้อยแล้ว',
      data: { id: result.insertId, name: cleanName, code: code ? code.trim() : null }
    });
  } catch (error) {
    next(error);
  }
}

// Delete department safely
async function deleteDepartment(req, res, next) {
  try {
    const { id } = req.params;
    const [depts] = await pool.query('SELECT id, name FROM departments WHERE id = ?', [id]);
    if (depts.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลสาขาวิชา',
        data: null
      });
    }

    const deptName = depts[0].name;
    const [[{ userCount }]] = await pool.query('SELECT COUNT(*) AS userCount FROM users WHERE department = ?', [deptName]);
    if (userCount > 0) {
      return res.status(400).json({
        status: 'error',
        message: `ไม่สามารถลบสาขาวิชา "${deptName}" ได้ เนื่องจากยังมีบุคลากรสังกัดอยู่ ${userCount} คน กรุณาย้ายสังกัดบุคลากรก่อนลบ`,
        data: null
      });
    }

    await pool.query('DELETE FROM department_judges WHERE department_name = ?', [deptName]);
    await pool.query('DELETE FROM departments WHERE id = ?', [id]);
    res.status(200).json({
      status: 'success',
      message: 'ลบสาขาวิชาเรียบร้อยแล้ว',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// 6. Department Judges Management (Assign judges to departments)
// ============================================================================

// Get judges assigned to departments
async function getDepartmentJudges(req, res, next) {
  try {
    const periodId = req.query.periodId || 1;
    const [rows] = await pool.query(`
      SELECT 
        dj.id,
        dj.department_name AS departmentName,
        dj.judge_citizen_id AS judgeCitizenId,
        u.name AS judgeName,
        u.position AS judgePosition,
        dj.role_in_board AS roleInBoard,
        dj.period_id AS periodId,
        dj.created_at AS createdAt
      FROM department_judges dj
      JOIN users u ON dj.judge_citizen_id = u.citizen_id
      WHERE dj.period_id = ?
      ORDER BY dj.department_name ASC, dj.id ASC
    `, [periodId]);

    res.status(200).json({
      status: 'success',
      message: 'Department judges retrieved successfully.',
      data: rows
    });
  } catch (error) {
    next(error);
  }
}

// Assign judge to department
async function assignDepartmentJudge(req, res, next) {
  try {
    const { departmentName, judgeCitizenId, roleInBoard, periodId = 1 } = req.body;

    if (!departmentName || !judgeCitizenId) {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณาเลือกสาขาวิชาและกรรมการผู้ประเมิน',
        data: null
      });
    }

    const [result] = await pool.query(`
      INSERT INTO department_judges (department_name, judge_citizen_id, role_in_board, period_id)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE role_in_board = VALUES(role_in_board)
    `, [departmentName, judgeCitizenId, roleInBoard || 'กรรมการ', periodId]);

    res.status(201).json({
      status: 'success',
      message: 'แต่งตั้งกรรมการประจำสาขาวิชาเรียบร้อยแล้ว',
      data: { id: result.insertId }
    });
  } catch (error) {
    next(error);
  }
}

// Remove judge from department
async function removeDepartmentJudge(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM department_judges WHERE id = ?', [id]);
    res.status(200).json({
      status: 'success',
      message: 'ถอดถอนกรรมการออกจากสาขาวิชาเรียบร้อยแล้ว',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// 7. Custom Department Requests Approval / Rejection by HR
// ============================================================================

async function getDepartmentRequests(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id,
        citizen_id AS citizenId,
        prefix,
        name,
        role,
        position,
        phone,
        email,
        department,
        dept_status AS deptStatus,
        requested_department AS requestedDepartment,
        dept_reject_reason AS deptRejectReason,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE dept_status IN ('PENDING', 'REJECTED')
      ORDER BY FIELD(dept_status, 'PENDING', 'REJECTED'), updated_at DESC
    `);

    res.status(200).json({
      status: 'success',
      message: 'Department requests retrieved.',
      data: rows
    });
  } catch (error) {
    next(error);
  }
}

async function approveDepartmentRequest(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { userId } = req.params;
    const { departmentName, code } = req.body || {};

    const [users] = await conn.query(
      'SELECT * FROM users WHERE id = ? OR citizen_id = ? LIMIT 1',
      [userId, userId]
    );
    if (users.length === 0) {
      conn.release();
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลบุคลากรที่ส่งคำขอ',
        data: null
      });
    }

    const userRow = users[0];
    const approvedName = String(departmentName || userRow.requested_department || '').trim();
    if (!approvedName) {
      conn.release();
      return res.status(400).json({
        status: 'error',
        message: 'ไม่พบชื่อสาขาวิชาที่จะอนุมัติ',
        data: null
      });
    }

    await conn.beginTransaction();

    await conn.query(
      'INSERT INTO departments (name, code) VALUES (?, ?) ON DUPLICATE KEY UPDATE code = COALESCE(VALUES(code), code)',
      [approvedName, code && String(code).trim() ? String(code).trim() : null]
    );

    // Approve this user and any other pending users who requested the exact same department name
    await conn.query(`
      UPDATE users
      SET department = ?,
          dept_status = 'APPROVED',
          requested_department = NULL,
          dept_reject_reason = NULL
      WHERE id = ? OR (dept_status = 'PENDING' AND requested_department = ?)
    `, [approvedName, userRow.id, userRow.requested_department || approvedName]);

    await conn.commit();
    conn.release();

    res.status(200).json({
      status: 'success',
      message: `อนุมัติสาขาวิชา "${approvedName}" เรียบร้อยแล้ว`,
      data: { departmentName: approvedName }
    });
  } catch (error) {
    await conn.rollback();
    conn.release();
    next(error);
  }
}

async function rejectDepartmentRequest(req, res, next) {
  try {
    const { userId } = req.params;
    const { reason } = req.body || {};

    if (!reason || String(reason).trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณาระบุเหตุผลที่ไม่อนุมัติสาขาวิชา เพื่อแจ้งให้ผู้รับการประเมินทราบ',
        data: null
      });
    }

    const [users] = await pool.query(
      'SELECT * FROM users WHERE id = ? OR citizen_id = ? LIMIT 1',
      [userId, userId]
    );
    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลบุคลากรที่ส่งคำขอ',
        data: null
      });
    }

    await pool.query(`
      UPDATE users
      SET dept_status = 'REJECTED',
          dept_reject_reason = ?
      WHERE id = ?
    `, [String(reason).trim(), users[0].id]);

    res.status(200).json({
      status: 'success',
      message: 'บันทึกการไม่อนุมัติพร้อมแจ้งเหตุผลให้บุคลากรทราบเรียบร้อยแล้ว',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPeriod,
  getAllPeriods,
  updatePeriod,
  getMetrics,
  createMetric,
  updateMetric,
  deleteMetric,
  getAssignments,
  createAssignment,
  deleteAssignment,
  getStatistics,
  getDepartments,
  createDepartment,
  deleteDepartment,
  getDepartmentJudges,
  assignDepartmentJudge,
  removeDepartmentJudge,
  getDepartmentRequests,
  approveDepartmentRequest,
  rejectDepartmentRequest
};
