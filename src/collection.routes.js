const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://mrecphuxcweignmdytal.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZWNwaHV4Y3dlaWdubWR5dGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNjY2MjMsImV4cCI6MjA2ODc0MjYyM30.4I-S7pvJT4py5Ui5cJL08euMdoTWd3YxDF_-IJYqHeY';

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR'
  }).format(amount || 0);
};

// Helper function to calculate days overdue
const calculateDaysOverdue = (lastPaymentDate) => {
  if (!lastPaymentDate) return 0;
  const today = new Date();
  const lastPayment = new Date(lastPaymentDate);
  const diffTime = today - lastPayment;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// GET /api/v1/collection/reports/daily
router.get('/reports/daily', async (req, res) => {
  try {
    const { date, collector } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log('📊 Fetching daily collection report for:', { date: targetDate, collector });

    // Base query for collection activities on the target date
    let activitiesQuery = supabase
      .from('collection_activities')
      .select(`
        *,
        collection_cases!inner(
          case_id,
          total_outstanding,
          customer_id,
          account_id,
          customers!inner(first_name, last_name, first_name_ar, last_name_ar)
        ),
        users!inner(first_name, last_name)
      `)
      .gte('activity_datetime', `${targetDate}T00:00:00`)
      .lte('activity_datetime', `${targetDate}T23:59:59`);

    // Filter by collector if specified
    if (collector) {
      activitiesQuery = activitiesQuery.eq('collector_id', collector);
    }

    const { data: activities, error: activitiesError } = await activitiesQuery;

    if (activitiesError) {
      console.error('❌ Error fetching activities:', activitiesError);
      return res.status(500).json({ 
        error: 'Failed to fetch collection activities',
        details: activitiesError.message 
      });
    }

    // Get payment transactions for the same date
    let paymentsQuery = supabase
      .from('payment_transactions')
      .select(`
        *,
        finance_accounts!inner(
          account_id,
          customer_id,
          customers!inner(first_name, last_name, first_name_ar, last_name_ar)
        )
      `)
      .eq('payment_date', targetDate)
      .eq('transaction_status', 'completed');

    const { data: payments, error: paymentsError } = await paymentsQuery;

    if (paymentsError) {
      console.error('❌ Error fetching payments:', paymentsError);
      return res.status(500).json({ 
        error: 'Failed to fetch payment transactions',
        details: paymentsError.message 
      });
    }

    // Calculate summary statistics
    const totalActivities = activities?.length || 0;
    const totalPayments = payments?.length || 0;
    const totalAmountCollected = payments?.reduce((sum, payment) => sum + (payment.payment_amount || 0), 0) || 0;
    
    // Group activities by type
    const activitiesByType = activities?.reduce((acc, activity) => {
      const type = activity.activity_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {}) || {};

    // Group activities by result
    const activitiesByResult = activities?.reduce((acc, activity) => {
      const result = activity.activity_result || 'unknown';
      acc[result] = (acc[result] || 0) + 1;
      return acc;
    }, {}) || {};

    // Calculate promises to pay
    const promisesToPay = activities?.filter(activity => 
      activity.promise_amount && activity.promise_amount > 0
    ).length || 0;

    const totalPromiseAmount = activities?.reduce((sum, activity) => 
      sum + (activity.promise_amount || 0), 0
    ) || 0;

    // Prepare response
    const report = {
      date: targetDate,
      collector: collector || 'all',
      summary: {
        totalActivities,
        totalPayments,
        totalAmountCollected: formatCurrency(totalAmountCollected),
        totalAmountCollectedRaw: totalAmountCollected,
        promisesToPay,
        totalPromiseAmount: formatCurrency(totalPromiseAmount),
        totalPromiseAmountRaw: totalPromiseAmount
      },
      breakdown: {
        activitiesByType,
        activitiesByResult,
        paymentMethods: payments?.reduce((acc, payment) => {
          const method = payment.payment_method || 'unknown';
          acc[method] = (acc[method] || 0) + 1;
          return acc;
        }, {}) || {}
      },
      activities: activities?.map(activity => ({
        id: activity.activity_id,
        type: activity.activity_type,
        result: activity.activity_result,
        datetime: activity.activity_datetime,
        customerName: `${activity.collection_cases?.customers?.first_name || ''} ${activity.collection_cases?.customers?.last_name || ''}`.trim(),
        customerNameAr: `${activity.collection_cases?.customers?.first_name_ar || ''} ${activity.collection_cases?.customers?.last_name_ar || ''}`.trim(),
        collectorName: `${activity.users?.first_name || ''} ${activity.users?.last_name || ''}`.trim(),
        promiseAmount: activity.promise_amount,
        notes: activity.notes
      })) || [],
      payments: payments?.map(payment => ({
        id: payment.transaction_id,
        amount: payment.payment_amount,
        amountFormatted: formatCurrency(payment.payment_amount),
        method: payment.payment_method,
        customerName: `${payment.finance_accounts?.customers?.first_name || ''} ${payment.finance_accounts?.customers?.last_name || ''}`.trim(),
        customerNameAr: `${payment.finance_accounts?.customers?.first_name_ar || ''} ${payment.finance_accounts?.customers?.last_name_ar || ''}`.trim(),
        receiptNumber: payment.receipt_number
      })) || []
    };

    console.log('✅ Daily report generated successfully:', {
      activities: totalActivities,
      payments: totalPayments,
      amount: totalAmountCollected
    });

    res.json({
      success: true,
      data: report,
      message: `Daily collection report for ${targetDate}`
    });

  } catch (error) {
    console.error('❌ Error generating daily report:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/v1/collection/accounts
router.get('/accounts', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      search, 
      sortBy = 'created_date', 
      sortOrder = 'desc' 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    console.log('📋 Fetching collection accounts:', { page, limit, status, search });

    // Build query
    let query = supabase
      .from('collection_cases')
      .select(`
        *,
        customers!inner(
          customer_id,
          first_name,
          last_name,
          first_name_ar,
          last_name_ar,
          national_id,
          risk_category
        ),
        finance_accounts!inner(
          account_id,
          product_type,
          outstanding_amount,
          monthly_installment,
          dpd,
          bucket
        ),
        users(first_name, last_name)
      `, { count: 'exact' });

    // Apply status filter
    if (status && status !== 'all') {
      if (status === 'Active') {
        query = query.in('case_status', ['new', 'in_progress']);
      } else if (status === 'Closed') {
        query = query.in('case_status', ['resolved', 'closed']);
      } else {
        query = query.eq('case_status', status.toLowerCase());
      }
    }

    // Apply search filter
    if (search) {
      query = query.or(`
        customers.first_name.ilike.%${search}%,
        customers.last_name.ilike.%${search}%,
        customers.first_name_ar.ilike.%${search}%,
        customers.last_name_ar.ilike.%${search}%,
        customers.national_id.ilike.%${search}%
      `);
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    const { data: cases, error: casesError, count } = await query;

    if (casesError) {
      console.error('❌ Error fetching collection accounts:', casesError);
      return res.status(500).json({ 
        error: 'Failed to fetch collection accounts',
        details: casesError.message 
      });
    }

    // Transform data for frontend
    const accounts = cases?.map(caseItem => {
      const customer = caseItem.customers;
      const account = caseItem.finance_accounts;
      const collector = caseItem.users;

      return {
        id: caseItem.case_id,
        caseNumber: `CASE${String(caseItem.case_id).padStart(5, '0')}`,
        accountId: account?.account_id,
        customerInfo: {
          id: customer?.customer_id,
          name: `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim(),
          nameAr: `${customer?.first_name_ar || ''} ${customer?.last_name_ar || ''}`.trim(),
          nationalId: customer?.national_id,
          riskCategory: customer?.risk_category
        },
        accountInfo: {
          productType: account?.product_type,
          outstandingAmount: account?.outstanding_amount,
          outstandingAmountFormatted: formatCurrency(account?.outstanding_amount),
          monthlyInstallment: account?.monthly_installment,
          monthlyInstallmentFormatted: formatCurrency(account?.monthly_installment),
          dpd: account?.dpd || 0,
          bucket: account?.bucket
        },
        caseInfo: {
          status: caseItem.case_status,
          priority: caseItem.priority_level,
          totalOutstanding: caseItem.total_outstanding,
          totalOutstandingFormatted: formatCurrency(caseItem.total_outstanding),
          lastPaymentDate: caseItem.last_payment_date,
          lastContactDate: caseItem.last_contact_date,
          nextActionDate: caseItem.next_action_date,
          assignedCollector: collector ? `${collector.first_name} ${collector.last_name}` : 'Unassigned',
          createdDate: caseItem.created_date,
          daysOverdue: calculateDaysOverdue(caseItem.last_payment_date)
        }
      };
    }) || [];

    // Calculate summary statistics
    const totalCases = count || 0;
    const totalPages = Math.ceil(totalCases / parseInt(limit));
    const totalOutstanding = accounts.reduce((sum, account) => 
      sum + (account.caseInfo.totalOutstanding || 0), 0
    );

    const statusCounts = accounts.reduce((acc, account) => {
      const status = account.caseInfo.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    console.log('✅ Collection accounts fetched successfully:', {
      total: totalCases,
      page: parseInt(page),
      returned: accounts.length
    });

    res.json({
      success: true,
      data: {
        accounts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords: totalCases,
          recordsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        summary: {
          totalCases,
          totalOutstanding: formatCurrency(totalOutstanding),
          totalOutstandingRaw: totalOutstanding,
          statusCounts
        }
      },
      message: `Retrieved ${accounts.length} collection accounts`
    });

  } catch (error) {
    console.error('❌ Error fetching collection accounts:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/v1/collection/accounts/:id
router.get('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔍 Fetching collection account details for ID:', id);

    const { data: caseItem, error } = await supabase
      .from('collection_cases')
      .select(`
        *,
        customers!inner(*),
        finance_accounts!inner(*),
        users(first_name, last_name),
        collection_activities(
          activity_id,
          activity_type,
          activity_datetime,
          activity_result,
          notes,
          promise_amount,
          promise_date,
          users(first_name, last_name)
        )
      `)
      .eq('case_id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching account details:', error);
      return res.status(404).json({ 
        error: 'Collection account not found',
        details: error.message 
      });
    }

    // Get recent payment transactions
    const { data: payments } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('account_id', caseItem.account_id)
      .order('payment_date', { ascending: false })
      .limit(10);

    // Transform data
    const customer = caseItem.customers;
    const account = caseItem.finance_accounts;
    const collector = caseItem.users;

    const accountDetails = {
      id: caseItem.case_id,
      caseNumber: `CASE${String(caseItem.case_id).padStart(5, '0')}`,
      customerInfo: {
        ...customer,
        name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        nameAr: `${customer.first_name_ar || ''} ${customer.last_name_ar || ''}`.trim()
      },
      accountInfo: {
        ...account,
        outstandingAmountFormatted: formatCurrency(account.outstanding_amount),
        monthlyInstallmentFormatted: formatCurrency(account.monthly_installment)
      },
      caseInfo: {
        ...caseItem,
        totalOutstandingFormatted: formatCurrency(caseItem.total_outstanding),
        assignedCollector: collector ? `${collector.first_name} ${collector.last_name}` : 'Unassigned',
        daysOverdue: calculateDaysOverdue(caseItem.last_payment_date)
      },
      activities: caseItem.collection_activities?.map(activity => ({
        ...activity,
        collectorName: activity.users ? `${activity.users.first_name} ${activity.users.last_name}` : 'Unknown',
        promiseAmountFormatted: formatCurrency(activity.promise_amount)
      })) || [],
      recentPayments: payments?.map(payment => ({
        ...payment,
        paymentAmountFormatted: formatCurrency(payment.payment_amount)
      })) || []
    };

    console.log('✅ Account details fetched successfully');

    res.json({
      success: true,
      data: accountDetails,
      message: 'Account details retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Error fetching account details:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;

