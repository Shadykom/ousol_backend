import express from 'express';
import { query, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Monthly comparison report
router.get('/monthly-comparison',
  authenticate,
  [
    query('year').isInt({ min: 2020 }),
    query('branchId').optional().isInt()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { year, branchId } = req.query;
      
      let branchFilter = '';
      const params = [year];
      
      if (branchId) {
        branchFilter = 'AND ct.branch_id = $2';
        params.push(branchId);
      }
      
      const result = await pool.query(
        `SELECT 
          EXTRACT(MONTH FROM ct.transaction_date) as month,
          b.branch_name,
          b.branch_code,
          COUNT(ct.id) as transaction_count,
          SUM(ct.amount) as total_collected,
          AVG(ct.amount) as avg_transaction,
          COUNT(DISTINCT ct.customer_id) as unique_customers,
          COALESCE(targets.target_amount, 0) as target_amount,
          CASE 
            WHEN targets.target_amount > 0 
            THEN ROUND((SUM(ct.amount) / targets.target_amount) * 100, 2)
            ELSE 0 
          END as achievement_percentage
        FROM collection_transactions ct
        JOIN branches b ON ct.branch_id = b.id
        LEFT JOIN collection_targets targets ON 
          targets.branch_id = ct.branch_id AND
          targets.target_month = EXTRACT(MONTH FROM ct.transaction_date) AND
          targets.target_year = EXTRACT(YEAR FROM ct.transaction_date)
        WHERE EXTRACT(YEAR FROM ct.transaction_date) = $1 
          AND ct.status = 'completed'
          ${branchFilter}
        GROUP BY EXTRACT(MONTH FROM ct.transaction_date), b.id, b.branch_name, b.branch_code, targets.target_amount
        ORDER BY month, b.branch_name`,
        params
      );
      
      // Group by month for easier frontend consumption
      const monthlyData = {};
      result.rows.forEach(row => {
        const monthKey = row.month;
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = [];
        }
        monthlyData[monthKey].push(row);
      });
      
      res.json(monthlyData);
    } catch (error) {
      next(error);
    }
  }
);

// Quarterly comparison report
router.get('/quarterly-comparison',
  authenticate,
  [
    query('year').isInt({ min: 2020 }),
    query('branchId').optional().isInt()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { year, branchId } = req.query;
      
      let branchFilter = '';
      const params = [year];
      
      if (branchId) {
        branchFilter = 'AND ct.branch_id = $2';
        params.push(branchId);
      }
      
      const result = await pool.query(
        `SELECT 
          EXTRACT(QUARTER FROM ct.transaction_date) as quarter,
          b.branch_name,
          b.branch_code,
          COUNT(ct.id) as transaction_count,
          SUM(ct.amount) as total_collected,
          AVG(ct.amount) as avg_transaction,
          COUNT(DISTINCT ct.customer_id) as unique_customers,
          MIN(ct.transaction_date) as quarter_start,
          MAX(ct.transaction_date) as quarter_end
        FROM collection_transactions ct
        JOIN branches b ON ct.branch_id = b.id
        WHERE EXTRACT(YEAR FROM ct.transaction_date) = $1 
          AND ct.status = 'completed'
          ${branchFilter}
        GROUP BY EXTRACT(QUARTER FROM ct.transaction_date), b.id, b.branch_name, b.branch_code
        ORDER BY quarter, b.branch_name`,
        params
      );
      
      // Group by quarter
      const quarterlyData = {};
      result.rows.forEach(row => {
        const quarterKey = `Q${row.quarter}`;
        if (!quarterlyData[quarterKey]) {
          quarterlyData[quarterKey] = [];
        }
        quarterlyData[quarterKey].push(row);
      });
      
      res.json(quarterlyData);
    } catch (error) {
      next(error);
    }
  }
);

// Branch comparison report
router.get('/branch-comparison',
  authenticate,
  [
    query('startDate').isISO8601(),
    query('endDate').isISO8601(),
    query('region').optional().trim()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { startDate, endDate, region } = req.query;
      
      let regionFilter = '';
      const params = [startDate, endDate];
      
      if (region) {
        regionFilter = 'AND b.region = $3';
        params.push(region);
      }
      
      const result = await pool.query(
        `SELECT 
          b.id as branch_id,
          b.branch_name,
          b.branch_code,
          b.region,
          b.city,
          COUNT(ct.id) as transaction_count,
          SUM(ct.amount) as total_collected,
          AVG(ct.amount) as avg_transaction,
          COUNT(DISTINCT ct.customer_id) as unique_customers,
          COUNT(DISTINCT DATE_TRUNC('day', ct.transaction_date)) as active_days,
          RANK() OVER (ORDER BY SUM(ct.amount) DESC) as collection_rank,
          ROUND(SUM(ct.amount) / COUNT(DISTINCT DATE_TRUNC('day', ct.transaction_date)), 2) as daily_average
        FROM branches b
        LEFT JOIN collection_transactions ct ON 
          b.id = ct.branch_id 
          AND ct.transaction_date BETWEEN $1 AND $2
          AND ct.status = 'completed'
        WHERE b.is_active = true ${regionFilter}
        GROUP BY b.id, b.branch_name, b.branch_code, b.region, b.city
        ORDER BY total_collected DESC NULLS LAST`,
        params
      );
      
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// Performance trends
router.get('/performance-trends',
  authenticate,
  [
    query('branchId').optional().isInt(),
    query('period').isIn(['daily', 'weekly', 'monthly']),
    query('startDate').isISO8601(),
    query('endDate').isISO8601()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { branchId, period, startDate, endDate } = req.query;
      
      let dateTrunc;
      switch (period) {
        case 'daily':
          dateTrunc = 'day';
          break;
        case 'weekly':
          dateTrunc = 'week';
          break;
        case 'monthly':
          dateTrunc = 'month';
          break;
      }
      
      let branchFilter = '';
      const params = [startDate, endDate];
      
      if (branchId) {
        branchFilter = 'AND ct.branch_id = $3';
        params.push(branchId);
      }
      
      const result = await pool.query(
        `SELECT 
          DATE_TRUNC('${dateTrunc}', ct.transaction_date) as period_date,
          COUNT(ct.id) as transaction_count,
          SUM(ct.amount) as total_collected,
          AVG(ct.amount) as avg_transaction,
          COUNT(DISTINCT ct.customer_id) as unique_customers
        FROM collection_transactions ct
        WHERE ct.transaction_date BETWEEN $1 AND $2
          AND ct.status = 'completed'
          ${branchFilter}
        GROUP BY DATE_TRUNC('${dateTrunc}', ct.transaction_date)
        ORDER BY period_date`,
        params
      );
      
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// Top performers report
router.get('/top-performers',
  authenticate,
  [
    query('startDate').isISO8601(),
    query('endDate').isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { startDate, endDate, limit = 10 } = req.query;
      
      // Top branches
      const topBranches = await pool.query(
        `SELECT 
          b.branch_name,
          b.branch_code,
          SUM(ct.amount) as total_collected,
          COUNT(ct.id) as transaction_count
        FROM branches b
        JOIN collection_transactions ct ON b.id = ct.branch_id
        WHERE ct.transaction_date BETWEEN $1 AND $2
          AND ct.status = 'completed'
        GROUP BY b.id, b.branch_name, b.branch_code
        ORDER BY total_collected DESC
        LIMIT $3`,
        [startDate, endDate, limit]
      );
      
      // Top collectors
      const topCollectors = await pool.query(
        `SELECT 
          u.first_name || ' ' || u.last_name as collector_name,
          u.email,
          SUM(ct.amount) as total_collected,
          COUNT(ct.id) as transaction_count,
          AVG(ct.amount) as avg_transaction
        FROM users u
        JOIN collection_transactions ct ON u.id = ct.collector_id
        WHERE ct.transaction_date BETWEEN $1 AND $2
          AND ct.status = 'completed'
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY total_collected DESC
        LIMIT $3`,
        [startDate, endDate, limit]
      );
      
      res.json({
        topBranches: topBranches.rows,
        topCollectors: topCollectors.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

// Summary statistics
router.get('/summary',
  authenticate,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('branchId').optional().isInt()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { startDate, endDate, branchId } = req.query;
      
      let dateFilter = '';
      let branchFilter = '';
      const params = [];
      let paramCount = 1;
      
      if (startDate && endDate) {
        dateFilter = `AND ct.transaction_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
        params.push(startDate, endDate);
        paramCount += 2;
      }
      
      if (branchId) {
        branchFilter = `AND ct.branch_id = $${paramCount}`;
        params.push(branchId);
      }
      
      // Overall statistics
      const overallStats = await pool.query(
        `SELECT 
          COUNT(ct.id) as total_transactions,
          SUM(ct.amount) as total_collected,
          AVG(ct.amount) as avg_transaction,
          COUNT(DISTINCT ct.customer_id) as unique_customers,
          COUNT(DISTINCT ct.branch_id) as active_branches,
          COUNT(DISTINCT ct.collector_id) as active_collectors
        FROM collection_transactions ct
        WHERE ct.status = 'completed' ${dateFilter} ${branchFilter}`,
        params
      );
      
      // Period comparison (current vs previous)
      let periodComparison = null;
      if (startDate && endDate) {
        const currentStart = new Date(startDate);
        const currentEnd = new Date(endDate);
        const periodLength = currentEnd - currentStart;
        const previousStart = new Date(currentStart - periodLength);
        const previousEnd = new Date(currentStart - 1);
        
        const previousParams = [previousStart.toISOString(), previousEnd.toISOString()];
        if (branchId) previousParams.push(branchId);
        
        const previousStats = await pool.query(
          `SELECT 
            COUNT(ct.id) as total_transactions,
            SUM(ct.amount) as total_collected
          FROM collection_transactions ct
          WHERE ct.status = 'completed' 
            AND ct.transaction_date BETWEEN $1 AND $2 
            ${branchFilter}`,
          previousParams
        );
        
        const current = overallStats.rows[0];
        const previous = previousStats.rows[0];
        
        periodComparison = {
          transactionGrowth: previous.total_transactions > 0 
            ? ((current.total_transactions - previous.total_transactions) / previous.total_transactions * 100).toFixed(2)
            : 100,
          collectionGrowth: previous.total_collected > 0
            ? ((current.total_collected - previous.total_collected) / previous.total_collected * 100).toFixed(2)
            : 100
        };
      }
      
      res.json({
        summary: overallStats.rows[0],
        periodComparison
      });
    } catch (error) {
      next(error);
    }
  }
);

// Export report data
router.get('/export',
  authenticate,
  [
    query('reportType').isIn(['transactions', 'summary', 'comparison']),
    query('format').isIn(['csv', 'json']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('branchId').optional().isInt()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { reportType, format, startDate, endDate, branchId } = req.query;
      
      // Implementation would generate CSV or JSON files based on report type
      // For now, returning a placeholder
      res.json({
        message: 'Export functionality to be implemented',
        reportType,
        format
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;