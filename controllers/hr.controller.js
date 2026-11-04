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
        a.period_id AS periodId,
        a.teacher_citizen_id AS teacherId,
        u_t.name AS teacherName,
        u_t.department AS teacherDepartment,
        u_t.position AS teacherPosition,
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
      WHERE a.period_id = ?
    `, [periodId]);

    res.status(200).json({
      status: 'success',
      message: 'Statistics calculated successfully.',
      data: {
        totalTeachers,
        totalJudges,
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
  getStatistics
};
