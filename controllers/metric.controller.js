// controllers/metric.controller.js
const { pool } = require('../config/database');
const { ok, fail } = require('../utils/response');

async function getMetricCategories(req, res, next) {
  try {
    const periodId = req.query.periodId || 1;
    const [rows] = await pool.query(`
      SELECT
        mc.id,
        mc.period_id AS periodId,
        mc.name,
        mc.description,
        mc.sort_order AS sortOrder,
        COUNT(m.id) AS metricCount
      FROM metric_categories mc
      LEFT JOIN metrics m ON m.category_id = mc.id
      WHERE mc.period_id = ?
      GROUP BY mc.id
      ORDER BY mc.sort_order ASC, mc.id ASC
    `, [periodId]);
    return ok(res, 'Metric categories retrieved.', rows);
  } catch (error) {
    next(error);
  }
}

async function createMetricCategory(req, res, next) {
  try {
    const { periodId = 1, name, description, sortOrder } = req.body;
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return fail(res, 'กรุณาระบุชื่อหมวดหมู่ / หัวข้อการประเมิน', 400);
    }

    const orderNum = parseInt(sortOrder, 10) || 1;
    const [result] = await pool.query(`
      INSERT INTO metric_categories (period_id, name, description, sort_order)
      VALUES (?, ?, ?, ?)
    `, [periodId, cleanName, description ? String(description).trim() : null, orderNum]);

    return ok(res, 'เพิ่มหัวข้อการประเมินเรียบร้อยแล้ว', {
      id: result.insertId,
      periodId: Number(periodId),
      name: cleanName,
      description: description || null,
      sortOrder: orderNum
    }, 201);
  } catch (error) {
    next(error);
  }
}

async function updateMetricCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, sortOrder } = req.body;
    const cleanName = name !== undefined ? String(name).trim() : null;
    if (name !== undefined && !cleanName) {
      return fail(res, 'ชื่อหัวข้อการประเมินต้องไม่เป็นค่าว่าง', 400);
    }
    const orderNum = sortOrder !== undefined ? (parseInt(sortOrder, 10) || 1) : null;

    const [result] = await pool.query(`
      UPDATE metric_categories
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `, [cleanName, description !== undefined ? description : null, orderNum, id]);

    if (result.affectedRows === 0) return fail(res, 'ไม่พบหัวข้อการประเมินที่ต้องการแก้ไข', 404);
    return ok(res, 'แก้ไขหัวข้อการประเมินเรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
}

async function deleteMetricCategory(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM metric_categories WHERE id = ?', [id]);
    if (result.affectedRows === 0) return fail(res, 'ไม่พบหัวข้อการประเมินที่ต้องการลบ', 404);
    return ok(res, 'ลบหัวข้อการประเมินเรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
}

async function getMetrics(req, res, next) {
  try {
    const periodId = req.query.periodId || 1;
    const [rows] = await pool.query(`
      SELECT
        m.id,
        m.period_id AS periodId,
        m.category_id AS categoryId,
        mc.name AS categoryName,
        mc.sort_order AS categorySortOrder,
        m.title,
        m.description,
        m.weight,
        m.eval_type AS evalType,
        m.evidence_type AS evidenceType
      FROM metrics m
      LEFT JOIN metric_categories mc ON m.category_id = mc.id
      WHERE m.period_id = ?
      ORDER BY COALESCE(mc.sort_order, 9999) ASC, m.id ASC
    `, [periodId]);
    return ok(res, 'Metrics retrieved.', rows);
  } catch (error) {
    next(error);
  }
}

async function createMetric(req, res, next) {
  try {
    const { title, description, weight, evalType, evidenceType, periodId, categoryId } = req.body;
    if (!title || weight === undefined || weight === null) {
      return fail(res, 'Metric title and weight are required.', 400);
    }

    const numWeight = parseInt(weight, 10);
    if (isNaN(numWeight) || numWeight <= 0) {
      return fail(res, 'Weight must be a positive integer.', 400);
    }

    const parsedCategoryId = categoryId ? parseInt(categoryId, 10) : null;
    if (parsedCategoryId) {
      const [cats] = await pool.query(
        'SELECT id FROM metric_categories WHERE id = ? AND period_id = ?',
        [parsedCategoryId, periodId || 1]
      );
      if (cats.length === 0) {
        return fail(res, 'ไม่พบหัวข้อการประเมินที่เลือกในรอบการประเมินนี้', 400);
      }
    }

    const [result] = await pool.query(`
      INSERT INTO metrics (period_id, category_id, title, description, weight, eval_type, evidence_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [periodId || 1, parsedCategoryId || null, title, description || null, numWeight, evalType || 'SCALE', evidenceType || 'PDF']);

    return ok(res, 'Metric created successfully.', {
      id: result.insertId,
      categoryId: parsedCategoryId || null,
      title,
      weight: numWeight,
      evalType: evalType || 'SCALE',
      evidenceType: evidenceType || 'PDF'
    }, 201);
  } catch (error) {
    next(error);
  }
}

async function updateMetric(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, weight, evalType, evidenceType, categoryId } = req.body;
    const numWeight = weight !== undefined ? parseInt(weight, 10) : null;
    const hasCategoryUpdate = categoryId !== undefined;
    const resolvedCategoryId = (categoryId === null || categoryId === '') ? null : parseInt(categoryId, 10);

    const [result] = await pool.query(`
      UPDATE metrics
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          weight = COALESCE(?, weight),
          eval_type = COALESCE(?, eval_type),
          evidence_type = COALESCE(?, evidence_type),
          category_id = ${hasCategoryUpdate ? '?' : 'category_id'}
      WHERE id = ?
    `, hasCategoryUpdate
      ? [title, description, numWeight, evalType, evidenceType, isNaN(resolvedCategoryId) ? null : resolvedCategoryId, id]
      : [title, description, numWeight, evalType, evidenceType, id]);

    if (result.affectedRows === 0) return fail(res, 'Metric not found.', 404);
    return ok(res, 'Metric updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function deleteMetric(req, res, next) {
  try {
    const { id } = req.params;
    const [subs] = await pool.query('SELECT COUNT(*) AS count FROM self_evaluations WHERE metric_id = ?', [id]);
    if (subs[0].count > 0) {
      return fail(res, 'ไม่สามารถลบตัวชี้วัดได้ เนื่องจากมีผู้รับการประเมินบันทึกข้อมูลในตัวชี้วัดนี้แล้ว', 400);
    }

    await pool.query('DELETE FROM metrics WHERE id = ?', [id]);
    return ok(res, 'Metric deleted successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMetricCategories,
  createMetricCategory,
  updateMetricCategory,
  deleteMetricCategory,
  getMetrics,
  createMetric,
  updateMetric,
  deleteMetric
};
