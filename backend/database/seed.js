import bcrypt from 'bcryptjs';
import pool from '../src/config/database.js';
import { addDays, subDays, format } from 'date-fns';

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database seeding...');
    
    await client.query('BEGIN');
    
    // Create users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const users = await client.query(
      `INSERT INTO users (email, password, first_name, last_name, role) VALUES
       ('admin@osoul.com', $1, 'Admin', 'User', 'admin'),
       ('manager@osoul.com', $1, 'Manager', 'User', 'manager'),
       ('collector1@osoul.com', $1, 'Ahmed', 'Ali', 'collector'),
       ('collector2@osoul.com', $1, 'Mohammed', 'Hassan', 'collector'),
       ('viewer@osoul.com', $1, 'Viewer', 'User', 'viewer')
       RETURNING id, email, role`,
      [hashedPassword]
    );
    
    console.log('Created users:', users.rows.length);
    
    // Create branches
    const branches = await client.query(
      `INSERT INTO branches (branch_code, branch_name, region, city, manager_id) VALUES
       ('BR001', 'Riyadh Main Branch', 'Central', 'Riyadh', $1),
       ('BR002', 'Jeddah Branch', 'Western', 'Jeddah', $1),
       ('BR003', 'Dammam Branch', 'Eastern', 'Dammam', $1),
       ('BR004', 'Riyadh North Branch', 'Central', 'Riyadh', $1),
       ('BR005', 'Mecca Branch', 'Western', 'Mecca', $1)
       RETURNING id, branch_code, branch_name`,
      [users.rows[1].id] // Manager user
    );
    
    console.log('Created branches:', branches.rows.length);
    
    // Create collection transactions for the last 90 days
    const transactionTypes = ['Cash', 'Check', 'Bank Transfer', 'Credit Card'];
    const paymentMethods = ['In Person', 'Online', 'Mobile App', 'ATM'];
    const customerNames = [
      'Abdullah Al-Rashid', 'Fatima Al-Zahrani', 'Omar Al-Harbi', 
      'Aisha Al-Qahtani', 'Khalid Al-Otaibi', 'Nora Al-Maliki',
      'Hassan Al-Shehri', 'Maryam Al-Dosari', 'Yousef Al-Ghamdi',
      'Sara Al-Mutairi', 'Ibrahim Al-Omari', 'Layla Al-Shahrani'
    ];
    
    let transactionCount = 0;
    const today = new Date();
    
    for (let i = 0; i < 90; i++) {
      const transactionDate = format(subDays(today, i), 'yyyy-MM-dd');
      
      for (const branch of branches.rows) {
        // Generate 5-15 transactions per branch per day
        const dailyTransactions = Math.floor(Math.random() * 11) + 5;
        
        for (let j = 0; j < dailyTransactions; j++) {
          const customerName = customerNames[Math.floor(Math.random() * customerNames.length)];
          const customerId = `CUST${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`;
          const accountNumber = `ACC${String(Math.floor(Math.random() * 10000)).padStart(5, '0')}`;
          const transactionType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
          const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
          const amount = (Math.random() * 9000 + 1000).toFixed(2); // 1000-10000 SAR
          const collectorId = users.rows[Math.floor(Math.random() * 2) + 2].id; // Random collector
          const referenceNumber = `REF${Date.now()}${j}`;
          
          await client.query(
            `INSERT INTO collection_transactions 
             (branch_id, transaction_date, customer_id, customer_name, account_number,
              transaction_type, amount, payment_method, collector_id, reference_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              branch.id, transactionDate, customerId, customerName, accountNumber,
              transactionType, amount, paymentMethod, collectorId, referenceNumber
            ]
          );
          
          transactionCount++;
        }
      }
    }
    
    console.log('Created collection transactions:', transactionCount);
    
    // Create collection targets for each branch for the current year
    const currentYear = new Date().getFullYear();
    
    for (const branch of branches.rows) {
      for (let month = 1; month <= 12; month++) {
        const targetAmount = (Math.random() * 500000 + 1000000).toFixed(2); // 1M-1.5M SAR
        
        await client.query(
          `INSERT INTO collection_targets 
           (branch_id, target_month, target_year, target_amount, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [branch.id, month, currentYear, targetAmount, users.rows[0].id] // Admin user
        );
      }
    }
    
    console.log('Created collection targets');
    
    // Create default dashboard for admin user
    const dashboard = await client.query(
      `INSERT INTO user_dashboards (user_id, dashboard_name, is_default)
       VALUES ($1, 'Main Dashboard', true)
       RETURNING id`,
      [users.rows[0].id]
    );
    
    // Add widgets to the dashboard
    const widgets = [
      {
        type: 'summary_card',
        title: 'Total Collections',
        x: 0, y: 0, w: 3, h: 2,
        config: { metric: 'total_collected', period: 'month' }
      },
      {
        type: 'summary_card',
        title: 'Transactions',
        x: 3, y: 0, w: 3, h: 2,
        config: { metric: 'transaction_count', period: 'month' }
      },
      {
        type: 'summary_card',
        title: 'Average Transaction',
        x: 6, y: 0, w: 3, h: 2,
        config: { metric: 'avg_transaction', period: 'month' }
      },
      {
        type: 'summary_card',
        title: 'Active Branches',
        x: 9, y: 0, w: 3, h: 2,
        config: { metric: 'active_branches', period: 'month' }
      },
      {
        type: 'line_chart',
        title: 'Daily Collection Trends',
        x: 0, y: 2, w: 12, h: 4,
        config: { 
          chartType: 'line',
          dataSource: 'performance_trends',
          period: 'daily',
          metric: 'total_collected'
        }
      },
      {
        type: 'bar_chart',
        title: 'Top Performing Branches',
        x: 0, y: 6, w: 6, h: 4,
        config: {
          chartType: 'bar',
          dataSource: 'branch_comparison',
          metric: 'total_collected',
          limit: 5
        }
      },
      {
        type: 'pie_chart',
        title: 'Collection by Type',
        x: 6, y: 6, w: 6, h: 4,
        config: {
          chartType: 'pie',
          dataSource: 'collection_by_type',
          metric: 'total_collected'
        }
      }
    ];
    
    for (const widget of widgets) {
      await client.query(
        `INSERT INTO dashboard_widgets 
         (dashboard_id, widget_type, widget_title, position_x, position_y, width, height, config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          dashboard.rows[0].id,
          widget.type,
          widget.title,
          widget.x,
          widget.y,
          widget.w,
          widget.h,
          JSON.stringify(widget.config)
        ]
      );
    }
    
    console.log('Created dashboard with widgets');
    
    await client.query('COMMIT');
    console.log('Database seeding completed successfully');
    
    // Display login credentials
    console.log('\n=== Login Credentials ===');
    console.log('Admin: admin@osoul.com / password123');
    console.log('Manager: manager@osoul.com / password123');
    console.log('Collector: collector1@osoul.com / password123');
    console.log('Viewer: viewer@osoul.com / password123');
    console.log('========================\n');
    
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();