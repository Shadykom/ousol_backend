import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get all branches
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { isActive } = req.query;
    
    let query = `
      SELECT b.*, 
             u.first_name || ' ' || u.last_name as manager_name
      FROM branches b
      LEFT JOIN users u ON b.manager_id = u.id
    `;
    
    const params = [];
    if (isActive !== undefined) {
      query += ' WHERE b.is_active = $1';
      params.push(isActive === 'true');
    }
    
    query += ' ORDER BY b.branch_name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get branch by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT b.*, 
              u.first_name || ' ' || u.last_name as manager_name
       FROM branches b
       LEFT JOIN users u ON b.manager_id = u.id
       WHERE b.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create new branch
router.post('/',
  authenticate,
  authorize('admin', 'manager'),
  [
    body('branchCode').notEmpty().trim(),
    body('branchName').notEmpty().trim(),
    body('region').optional().trim(),
    body('city').optional().trim(),
    body('managerId').optional().isInt()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { branchCode, branchName, region, city, managerId } = req.body;
      
      // Check if branch code exists
      const existing = await pool.query(
        'SELECT id FROM branches WHERE branch_code = $1',
        [branchCode]
      );
      
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Branch code already exists' });
      }
      
      const result = await pool.query(
        `INSERT INTO branches (branch_code, branch_name, region, city, manager_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [branchCode, branchName, region, city, managerId]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Update branch
router.put('/:id',
  authenticate,
  authorize('admin', 'manager'),
  [
    body('branchName').optional().trim(),
    body('region').optional().trim(),
    body('city').optional().trim(),
    body('managerId').optional().isInt(),
    body('isActive').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramCount = 1;
      
      Object.entries(updates).forEach(([key, value]) => {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateFields.push(`${dbField} = $${paramCount}`);
        values.push(value);
        paramCount++;
      });
      
      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      values.push(id);
      
      const result = await pool.query(
        `UPDATE branches 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Branch not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Delete branch (soft delete)
router.delete('/:id',
  authenticate,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        'UPDATE branches SET is_active = false WHERE id = $1 RETURNING *',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Branch not found' });
      }
      
      res.json({ message: 'Branch deactivated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Get branch statistics
router.get('/:id/stats', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    const params = [id];
    let dateFilter = '';
    
    if (startDate && endDate) {
      dateFilter = ' AND transaction_date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }
    
    const stats = await pool.query(
      `SELECT 
        COUNT(*) as total_transactions,
        SUM(amount) as total_collected,
        AVG(amount) as avg_transaction,
        COUNT(DISTINCT customer_id) as unique_customers
       FROM collection_transactions
       WHERE branch_id = $1 AND status = 'completed'${dateFilter}`,
      params
    );
    
    res.json(stats.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;