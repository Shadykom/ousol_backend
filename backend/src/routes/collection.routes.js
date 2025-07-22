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

// Dashboard Summary Metrics
router.get('/dashboard/summary',
  authenticate,
  async (req, res, next) => {
    try {
      const { branch, startDate, endDate } = req.query;
      
      let branchFilter = '';
      const params = [];
      
      if (branch && branch !== 'all') {
        branchFilter = 'AND fa.branch_code = $1';
        params.push(branch);
      }
      
      // Get summary metrics
      const summaryQuery = `
        SELECT 
          COUNT(DISTINCT fa.account_id) as total_accounts,
          SUM(fa.outstanding_amount) as total_outstanding,
          SUM(CASE WHEN cc.case_status = 'Active' THEN 1 ELSE 0 END) as active_cases,
          AVG(fa.dpd) as avg_dpd,
          SUM(CASE WHEN fa.dpd > 90 THEN fa.outstanding_amount ELSE 0 END) as npl_amount,
          ROUND((SUM(CASE WHEN fa.dpd > 90 THEN fa.outstanding_amount ELSE 0 END) / 
                 NULLIF(SUM(fa.outstanding_amount), 0)) * 100, 2) as npl_ratio
        FROM finance_accounts fa
        LEFT JOIN collection_cases cc ON fa.account_id = cc.account_id
        WHERE fa.account_status = 'Delinquent'
        ${branchFilter}
      `;
      
      const collectionQuery = `
        SELECT 
          SUM(pt.payment_amount) as total_collected,
          COUNT(DISTINCT pt.account_id) as accounts_collected
        FROM payment_transactions pt
        JOIN finance_accounts fa ON pt.account_id = fa.account_id
        WHERE pt.payment_date >= CURRENT_DATE - INTERVAL '30 days'
        ${branchFilter}
      `;
      
      const ptpQuery = `
        SELECT 
          COUNT(*) as total_ptps,
          SUM(CASE WHEN kept_flag = TRUE THEN 1 ELSE 0 END) as kept_ptps,
          ROUND((SUM(CASE WHEN kept_flag = TRUE THEN 1 ELSE 0 END)::NUMERIC / 
                 NULLIF(COUNT(*), 0)) * 100, 2) as ptp_kept_rate
        FROM promise_to_pay ptp
        JOIN finance_accounts fa ON ptp.account_id = fa.account_id
        WHERE ptp.promise_date >= CURRENT_DATE - INTERVAL '30 days'
        ${branchFilter}
      `;
      
      const [summaryResult, collectionResult, ptpResult] = await Promise.all([
        pool.query(summaryQuery, params),
        pool.query(collectionQuery, params),
        pool.query(ptpQuery, params)
      ]);
      
      const summary = summaryResult.rows[0];
      const collection = collectionResult.rows[0];
      const ptp = ptpResult.rows[0];
      
      res.json({
        totalOutstanding: parseFloat(summary.total_outstanding || 0),
        totalCollected: parseFloat(collection.total_collected || 0),
        collectionRate: summary.total_outstanding > 0 
          ? ((collection.total_collected / summary.total_outstanding) * 100).toFixed(2)
          : 0,
        activeAccounts: parseInt(summary.total_accounts || 0),
        promisesToPay: parseInt(ptp.total_ptps || 0),
        ptpKeptRate: parseFloat(ptp.ptp_kept_rate || 0),
        avgDPD: parseInt(summary.avg_dpd || 0),
        nplRatio: parseFloat(summary.npl_ratio || 0)
      });
    } catch (error) {
      next(error);
    }
  }
);

// Collection Trends
router.get('/dashboard/trends/:period',
  authenticate,
  async (req, res, next) => {
    try {
      const { period } = req.params;
      const { branch } = req.query;
      
      let dateFormat, interval;
      switch (period) {
        case 'daily':
          dateFormat = 'YYYY-MM-DD';
          interval = '30 days';
          break;
        case 'weekly':
          dateFormat = 'YYYY-WW';
          interval = '12 weeks';
          break;
        case 'monthly':
          dateFormat = 'YYYY-MM';
          interval = '12 months';
          break;
        default:
          dateFormat = 'YYYY-MM-DD';
          interval = '30 days';
      }
      
      let branchFilter = '';
      const params = [];
      
      if (branch && branch !== 'all') {
        branchFilter = 'AND fa.branch_code = $1';
        params.push(branch);
      }
      
      const query = `
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '${interval}',
            CURRENT_DATE,
            '1 ${period}'::INTERVAL
          )::DATE as date
        ),
        collections AS (
          SELECT 
            TO_CHAR(pt.payment_date, '${dateFormat}') as period,
            SUM(pt.payment_amount) as collected,
            COUNT(DISTINCT pt.account_id) as accounts
          FROM payment_transactions pt
          JOIN finance_accounts fa ON pt.account_id = fa.account_id
          WHERE pt.payment_date >= CURRENT_DATE - INTERVAL '${interval}'
          ${branchFilter}
          GROUP BY TO_CHAR(pt.payment_date, '${dateFormat}')
        ),
        ptps AS (
          SELECT 
            TO_CHAR(ptp.promise_date, '${dateFormat}') as period,
            COUNT(*) as ptp_count
          FROM promise_to_pay ptp
          JOIN finance_accounts fa ON ptp.account_id = fa.account_id
          WHERE ptp.promise_date >= CURRENT_DATE - INTERVAL '${interval}'
          ${branchFilter}
          GROUP BY TO_CHAR(ptp.promise_date, '${dateFormat}')
        )
        SELECT 
          TO_CHAR(ds.date, '${dateFormat}') as date,
          COALESCE(c.collected, 0) as collected,
          COALESCE(c.accounts, 0) as accounts,
          COALESCE(p.ptp_count, 0) as ptp,
          400000 as target -- Mock target, should come from targets table
        FROM date_series ds
        LEFT JOIN collections c ON TO_CHAR(ds.date, '${dateFormat}') = c.period
        LEFT JOIN ptps p ON TO_CHAR(ds.date, '${dateFormat}') = p.period
        ORDER BY ds.date
      `;
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// Aging Analysis
router.get('/dashboard/aging',
  authenticate,
  async (req, res, next) => {
    try {
      const { branch } = req.query;
      
      let branchFilter = '';
      const params = [];
      
      if (branch && branch !== 'all') {
        branchFilter = 'AND branch_code = $1';
        params.push(branch);
      }
      
      const query = `
        SELECT 
          CASE 
            WHEN dpd = 0 THEN 'Current'
            WHEN dpd BETWEEN 1 AND 30 THEN '1-30'
            WHEN dpd BETWEEN 31 AND 60 THEN '31-60'
            WHEN dpd BETWEEN 61 AND 90 THEN '61-90'
            WHEN dpd BETWEEN 91 AND 180 THEN '91-180'
            ELSE '180+'
          END AS bucket,
          COUNT(*) as count,
          SUM(outstanding_amount) as amount,
          ROUND((SUM(outstanding_amount) / 
                (SELECT SUM(outstanding_amount) FROM finance_accounts WHERE account_status = 'Delinquent' ${branchFilter})) * 100, 2) as percentage
        FROM finance_accounts
        WHERE account_status = 'Delinquent'
        ${branchFilter}
        GROUP BY 
          CASE 
            WHEN dpd = 0 THEN 'Current'
            WHEN dpd BETWEEN 1 AND 30 THEN '1-30'
            WHEN dpd BETWEEN 31 AND 60 THEN '31-60'
            WHEN dpd BETWEEN 61 AND 90 THEN '61-90'
            WHEN dpd BETWEEN 91 AND 180 THEN '91-180'
            ELSE '180+'
          END
        ORDER BY 
          CASE bucket
            WHEN 'Current' THEN 1
            WHEN '1-30' THEN 2
            WHEN '31-60' THEN 3
            WHEN '61-90' THEN 4
            WHEN '91-180' THEN 5
            ELSE 6
          END
      `;
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// Collector Performance
router.get('/dashboard/collector-performance',
  authenticate,
  async (req, res, next) => {
    try {
      const { branch, period = '30 days' } = req.query;
      
      let branchFilter = '';
      const params = [period];
      
      if (branch && branch !== 'all') {
        branchFilter = 'AND EXISTS (SELECT 1 FROM collection_cases cc2 JOIN finance_accounts fa ON cc2.account_id = fa.account_id WHERE cc2.assigned_collector_id = c.collector_id AND fa.branch_code = $2)';
        params.push(branch);
      }
      
      const query = `
        SELECT 
          c.collector_id,
          c.employee_name as name,
          COUNT(DISTINCT cc.case_id) as cases,
          SUM(cc.total_outstanding) as assigned_amount,
          COALESCE(SUM(pt.payment_amount), 0) as collected,
          COALESCE(cp.target_amount, 150000) as target,
          COUNT(DISTINCT ptp.ptp_id) as ptp_obtained,
          SUM(CASE WHEN ptp.kept_flag = TRUE THEN 1 ELSE 0 END) as ptp_kept,
          ROUND((SUM(CASE WHEN ptp.kept_flag = TRUE THEN 1 ELSE 0 END)::NUMERIC / 
                 NULLIF(COUNT(DISTINCT ptp.ptp_id), 0)) * 100, 2) as ptp_rate
        FROM collectors c
        LEFT JOIN collection_cases cc ON c.collector_id = cc.assigned_collector_id
        LEFT JOIN payment_transactions pt ON c.collector_id = pt.collected_by 
          AND pt.payment_date >= CURRENT_DATE - INTERVAL $1
        LEFT JOIN promise_to_pay ptp ON c.collector_id = ptp.collector_id
          AND ptp.created_date >= CURRENT_DATE - INTERVAL $1
        LEFT JOIN collector_performance cp ON c.collector_id = cp.collector_id
          AND cp.performance_date = CURRENT_DATE
        WHERE c.is_active = TRUE
        ${branchFilter}
        GROUP BY c.collector_id, c.employee_name, cp.target_amount
        ORDER BY collected DESC
      `;
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// Product-wise NPF
router.get('/dashboard/product-npf',
  authenticate,
  async (req, res, next) => {
    try {
      const { branch } = req.query;
      
      let branchFilter = '';
      const params = [];
      
      if (branch && branch !== 'all') {
        branchFilter = 'WHERE branch_code = $1';
        params.push(branch);
      }
      
      const query = `
        SELECT 
          product_type as product,
          SUM(CASE WHEN dpd > 90 THEN outstanding_amount ELSE 0 END) as amount,
          ROUND((SUM(CASE WHEN dpd > 90 THEN outstanding_amount ELSE 0 END) / 
                 NULLIF(SUM(outstanding_amount), 0)) * 100, 2) as npf
        FROM finance_accounts
        ${branchFilter}
        GROUP BY product_type
        ORDER BY npf DESC
      `;
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// Reports endpoints
router.get('/reports/daily',
  authenticate,
  async (req, res, next) => {
    try {
      const { date, branch, collector } = req.query;
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      let filters = [];
      const params = [targetDate];
      
      if (branch && branch !== 'all') {
        params.push(branch);
        filters.push(`fa.branch_code = $${params.length}`);
      }
      
      if (collector && collector !== 'all') {
        params.push(collector);
        filters.push(`pt.collected_by = $${params.length}`);
      }
      
      const whereClause = filters.length > 0 ? `AND ${filters.join(' AND ')}` : '';
      
      const query = `
        SELECT 
          DATE(pt.payment_date) as date,
          COUNT(DISTINCT pt.account_id) as accounts,
          SUM(pt.payment_amount) as collected,
          COUNT(DISTINCT ca.activity_id) as calls,
          COUNT(DISTINCT CASE WHEN ca.activity_type = 'Visit' THEN ca.activity_id END) as visits,
          150000 as target -- Mock target
        FROM payment_transactions pt
        JOIN finance_accounts fa ON pt.account_id = fa.account_id
        LEFT JOIN collection_activities ca ON pt.account_id = ca.account_id
          AND DATE(ca.activity_datetime) = DATE(pt.payment_date)
        WHERE DATE(pt.payment_date) = $1::DATE
        ${whereClause}
        GROUP BY DATE(pt.payment_date)
      `;
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// Add more report endpoints...

export default router;