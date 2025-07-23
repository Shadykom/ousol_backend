import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get all dashboards for user
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT 
        d.*,
        COUNT(w.id) as widget_count
      FROM user_dashboards d
      LEFT JOIN dashboard_widgets w ON d.id = w.dashboard_id
      WHERE d.user_id = $1
      GROUP BY d.id
      ORDER BY d.is_default DESC, d.created_at DESC`,
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get dashboard by ID with widgets
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get dashboard
    const dashboardResult = await pool.query(
      'SELECT * FROM user_dashboards WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (dashboardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    // Get widgets
    const widgetsResult = await pool.query(
      'SELECT * FROM dashboard_widgets WHERE dashboard_id = $1 ORDER BY position_y, position_x',
      [id]
    );
    
    res.json({
      ...dashboardResult.rows[0],
      widgets: widgetsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Create new dashboard
router.post('/',
  authenticate,
  [
    body('dashboardName').notEmpty().trim(),
    body('layoutConfig').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const client = await pool.connect();
    
    try {
      const { dashboardName, layoutConfig } = req.body;
      
      await client.query('BEGIN');
      
      // Create dashboard
      const dashboardResult = await client.query(
        `INSERT INTO user_dashboards (user_id, dashboard_name, layout_config)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [req.user.id, dashboardName, JSON.stringify(layoutConfig || {})]
      );
      
      const dashboard = dashboardResult.rows[0];
      
      // Add default widgets
      const defaultWidgets = [
        {
          widget_type: 'summary_card',
          widget_title: 'Total Collections',
          position_x: 0,
          position_y: 0,
          width: 3,
          height: 2,
          config: { metric: 'total_collected', period: 'month' }
        },
        {
          widget_type: 'summary_card',
          widget_title: 'Transaction Count',
          position_x: 3,
          position_y: 0,
          width: 3,
          height: 2,
          config: { metric: 'transaction_count', period: 'month' }
        },
        {
          widget_type: 'summary_card',
          widget_title: 'Average Transaction',
          position_x: 6,
          position_y: 0,
          width: 3,
          height: 2,
          config: { metric: 'avg_transaction', period: 'month' }
        },
        {
          widget_type: 'summary_card',
          widget_title: 'Unique Customers',
          position_x: 9,
          position_y: 0,
          width: 3,
          height: 2,
          config: { metric: 'unique_customers', period: 'month' }
        },
        {
          widget_type: 'line_chart',
          widget_title: 'Collection Trends',
          position_x: 0,
          position_y: 2,
          width: 6,
          height: 4,
          config: { 
            chartType: 'line',
            dataSource: 'performance_trends',
            period: 'daily',
            metric: 'total_collected'
          }
        },
        {
          widget_type: 'bar_chart',
          widget_title: 'Branch Comparison',
          position_x: 6,
          position_y: 2,
          width: 6,
          height: 4,
          config: {
            chartType: 'bar',
            dataSource: 'branch_comparison',
            metric: 'total_collected',
            limit: 10
          }
        }
      ];
      
      for (const widget of defaultWidgets) {
        await client.query(
          `INSERT INTO dashboard_widgets 
           (dashboard_id, widget_type, widget_title, position_x, position_y, width, height, config)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            dashboard.id,
            widget.widget_type,
            widget.widget_title,
            widget.position_x,
            widget.position_y,
            widget.width,
            widget.height,
            JSON.stringify(widget.config)
          ]
        );
      }
      
      await client.query('COMMIT');
      
      // Fetch complete dashboard with widgets
      const completeResult = await pool.query(
        'SELECT * FROM dashboard_widgets WHERE dashboard_id = $1',
        [dashboard.id]
      );
      
      res.status(201).json({
        ...dashboard,
        widgets: completeResult.rows
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

// Update dashboard
router.put('/:id',
  authenticate,
  [
    body('dashboardName').optional().trim(),
    body('layoutConfig').optional().isObject(),
    body('isDefault').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    const client = await pool.connect();
    
    try {
      const { id } = req.params;
      const { dashboardName, layoutConfig, isDefault } = req.body;
      
      await client.query('BEGIN');
      
      // Check ownership
      const ownership = await client.query(
        'SELECT id FROM user_dashboards WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      
      if (ownership.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Dashboard not found' });
      }
      
      // If setting as default, unset other defaults
      if (isDefault) {
        await client.query(
          'UPDATE user_dashboards SET is_default = false WHERE user_id = $1',
          [req.user.id]
        );
      }
      
      // Update dashboard
      const updateFields = [];
      const values = [];
      let paramCount = 1;
      
      if (dashboardName !== undefined) {
        updateFields.push(`dashboard_name = $${paramCount}`);
        values.push(dashboardName);
        paramCount++;
      }
      
      if (layoutConfig !== undefined) {
        updateFields.push(`layout_config = $${paramCount}`);
        values.push(JSON.stringify(layoutConfig));
        paramCount++;
      }
      
      if (isDefault !== undefined) {
        updateFields.push(`is_default = $${paramCount}`);
        values.push(isDefault);
        paramCount++;
      }
      
      if (updateFields.length > 0) {
        values.push(id);
        
        const result = await client.query(
          `UPDATE user_dashboards 
           SET ${updateFields.join(', ')}
           WHERE id = $${paramCount}
           RETURNING *`,
          values
        );
        
        await client.query('COMMIT');
        res.json(result.rows[0]);
      } else {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'No fields to update' });
      }
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

// Delete dashboard
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM user_dashboards WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    res.json({ message: 'Dashboard deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Add widget to dashboard
router.post('/:dashboardId/widgets',
  authenticate,
  [
    body('widgetType').notEmpty().trim(),
    body('widgetTitle').notEmpty().trim(),
    body('positionX').isInt({ min: 0 }),
    body('positionY').isInt({ min: 0 }),
    body('width').isInt({ min: 1, max: 12 }),
    body('height').isInt({ min: 1, max: 10 }),
    body('config').isObject()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { dashboardId } = req.params;
      const { widgetType, widgetTitle, positionX, positionY, width, height, config } = req.body;
      
      // Check dashboard ownership
      const ownership = await pool.query(
        'SELECT id FROM user_dashboards WHERE id = $1 AND user_id = $2',
        [dashboardId, req.user.id]
      );
      
      if (ownership.rows.length === 0) {
        return res.status(404).json({ error: 'Dashboard not found' });
      }
      
      const result = await pool.query(
        `INSERT INTO dashboard_widgets 
         (dashboard_id, widget_type, widget_title, position_x, position_y, width, height, config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [dashboardId, widgetType, widgetTitle, positionX, positionY, width, height, JSON.stringify(config)]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Update widget
router.put('/:dashboardId/widgets/:widgetId',
  authenticate,
  [
    body('widgetTitle').optional().trim(),
    body('positionX').optional().isInt({ min: 0 }),
    body('positionY').optional().isInt({ min: 0 }),
    body('width').optional().isInt({ min: 1, max: 12 }),
    body('height').optional().isInt({ min: 1, max: 10 }),
    body('config').optional().isObject(),
    body('isVisible').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { dashboardId, widgetId } = req.params;
      const updates = req.body;
      
      // Check dashboard ownership
      const ownership = await pool.query(
        'SELECT id FROM user_dashboards WHERE id = $1 AND user_id = $2',
        [dashboardId, req.user.id]
      );
      
      if (ownership.rows.length === 0) {
        return res.status(404).json({ error: 'Dashboard not found' });
      }
      
      // Build update query
      const updateFields = [];
      const values = [];
      let paramCount = 1;
      
      Object.entries(updates).forEach(([key, value]) => {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (key === 'config') {
          updateFields.push(`${dbField} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          updateFields.push(`${dbField} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      });
      
      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      values.push(widgetId, dashboardId);
      
      const result = await pool.query(
        `UPDATE dashboard_widgets 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramCount} AND dashboard_id = $${paramCount + 1}
         RETURNING *`,
        values
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Widget not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Delete widget
router.delete('/:dashboardId/widgets/:widgetId', authenticate, async (req, res, next) => {
  try {
    const { dashboardId, widgetId } = req.params;
    
    // Check dashboard ownership
    const ownership = await pool.query(
      'SELECT id FROM user_dashboards WHERE id = $1 AND user_id = $2',
      [dashboardId, req.user.id]
    );
    
    if (ownership.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    const result = await pool.query(
      'DELETE FROM dashboard_widgets WHERE id = $1 AND dashboard_id = $2 RETURNING id',
      [widgetId, dashboardId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Widget not found' });
    }
    
    res.json({ message: 'Widget deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get widget data
router.get('/widgets/:widgetId/data', authenticate, async (req, res, next) => {
  try {
    const { widgetId } = req.params;
    const { startDate, endDate, branchId } = req.query;
    
    // Get widget configuration
    const widgetResult = await pool.query(
      `SELECT w.*, d.user_id 
       FROM dashboard_widgets w
       JOIN user_dashboards d ON w.dashboard_id = d.id
       WHERE w.id = $1 AND d.user_id = $2`,
      [widgetId, req.user.id]
    );
    
    if (widgetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Widget not found' });
    }
    
    const widget = widgetResult.rows[0];
    const config = widget.config;
    
    // Fetch data based on widget configuration
    let data;
    switch (config.dataSource) {
      case 'summary':
        data = await getSummaryData(startDate, endDate, branchId);
        break;
      case 'performance_trends':
        data = await getPerformanceTrends(config.period, startDate, endDate, branchId);
        break;
      case 'branch_comparison':
        data = await getBranchComparison(startDate, endDate, config.limit);
        break;
      default:
        data = { message: 'Data source not implemented' };
    }
    
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Helper functions for widget data
async function getSummaryData(startDate, endDate, branchId) {
  let whereConditions = ['ct.status = \'completed\''];
  const params = [];
  
  if (startDate && endDate) {
    whereConditions.push(`ct.transaction_date BETWEEN $${params.length + 1} AND $${params.length + 2}`);
    params.push(startDate, endDate);
  }
  
  if (branchId) {
    whereConditions.push(`ct.branch_id = $${params.length + 1}`);
    params.push(branchId);
  }
  
  const result = await pool.query(
    `SELECT 
      COUNT(ct.id) as total_transactions,
      SUM(ct.amount) as total_collected,
      AVG(ct.amount) as avg_transaction,
      COUNT(DISTINCT ct.customer_id) as unique_customers
    FROM collection_transactions ct
    WHERE ${whereConditions.join(' AND ')}`,
    params
  );
  
  return result.rows[0];
}

async function getPerformanceTrends(period, startDate, endDate, branchId) {
  const dateTrunc = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';
  let whereConditions = ['ct.status = \'completed\''];
  const params = [];
  
  if (startDate && endDate) {
    whereConditions.push(`ct.transaction_date BETWEEN $${params.length + 1} AND $${params.length + 2}`);
    params.push(startDate, endDate);
  }
  
  if (branchId) {
    whereConditions.push(`ct.branch_id = $${params.length + 1}`);
    params.push(branchId);
  }
  
  const result = await pool.query(
    `SELECT 
      DATE_TRUNC('${dateTrunc}', ct.transaction_date) as period_date,
      SUM(ct.amount) as total_collected,
      COUNT(ct.id) as transaction_count
    FROM collection_transactions ct
    WHERE ${whereConditions.join(' AND ')}
    GROUP BY DATE_TRUNC('${dateTrunc}', ct.transaction_date)
    ORDER BY period_date`,
    params
  );
  
  return result.rows;
}

async function getBranchComparison(startDate, endDate, limit = 10) {
  const params = [];
  let dateFilter = '';
  
  if (startDate && endDate) {
    dateFilter = 'AND ct.transaction_date BETWEEN $1 AND $2';
    params.push(startDate, endDate);
  }
  
  params.push(limit);
  
  const result = await pool.query(
    `SELECT 
      b.branch_name,
      b.branch_code,
      SUM(ct.amount) as total_collected,
      COUNT(ct.id) as transaction_count
    FROM branches b
    LEFT JOIN collection_transactions ct ON 
      b.id = ct.branch_id 
      AND ct.status = 'completed'
      ${dateFilter}
    WHERE b.is_active = true
    GROUP BY b.id, b.branch_name, b.branch_code
    ORDER BY total_collected DESC NULLS LAST
    LIMIT $${params.length}`,
    params
  );
  
  return result.rows;
}

export default router;