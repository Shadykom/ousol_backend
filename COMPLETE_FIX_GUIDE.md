# Complete Fix Guide for Osoul Frontend/Backend Issues

## Issue 1: 401 Authentication Error

### Problem
The frontend is not sending the required authentication token when calling `/api/v1/collection/accounts`.

### Solution for Frontend

1. **Create an authentication service** (if not already exists):

```javascript
// services/authService.js
class AuthService {
  constructor() {
    this.baseURL = 'https://ousol-backend-dx9u.vercel.app/api/v1';
  }

  async login(email, password) {
    try {
      const response = await axios.post(`${this.baseURL}/auth/login`, {
        email,
        password
      });
      
      if (response.data.token) {
        // Store token in localStorage
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Set default authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      
      return response.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  }

  getToken() {
    return localStorage.getItem('authToken');
  }

  isAuthenticated() {
    return !!this.getToken();
  }
}

export default new AuthService();
```

2. **Update API configuration**:

```javascript
// config/api.js
import axios from 'axios';

const API_BASE_URL = 'https://ousol-backend-dx9u.vercel.app/api/v1';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

3. **Update the accounts API call**:

```javascript
// services/collectionService.js
import apiClient from '../config/api';

export const collectionService = {
  async getAccounts(params = {}) {
    const { page = 1, limit = 20, status, search, sortBy, sortOrder } = params;
    
    try {
      const response = await apiClient.get('/collection/accounts', {
        params: {
          page,
          limit,
          status,
          search,
          sortBy,
          sortOrder
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      throw error;
    }
  },

  async getAccountById(id) {
    try {
      const response = await apiClient.get(`/collection/accounts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch account:', error);
      throw error;
    }
  }
};
```

## Issue 2: Database Schema Error

### Problem
The backend query has a relationship issue: "Could not find a relationship between 'collection_cases' and 'users' in the schema cache"

### Backend Fix

The issue is in the Supabase query join. The `users` table relationship might not be properly defined. Here's the fix:

```javascript
// Updated server.js - Fix the collection accounts endpoint
app.get('/api/v1/collection/accounts', authenticateToken, async (req, res) => {
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

    // Build query - Remove the users join if relationship doesn't exist
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
        )
      `, { count: 'exact' });

    // Apply filters and sorting (same as before)
    // ... rest of the code

    const { data: cases, error: casesError, count } = await query;

    if (casesError) {
      console.error('❌ Error fetching collection accounts:', casesError);
      return res.status(500).json({ 
        error: 'Failed to fetch collection accounts',
        details: casesError.message 
      });
    }

    // If you need collector info, fetch it separately
    const collectorIds = [...new Set(cases?.map(c => c.assigned_to).filter(Boolean))];
    let collectors = {};
    
    if (collectorIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', collectorIds);
      
      collectors = usersData?.reduce((acc, user) => {
        acc[user.id] = `${user.first_name} ${user.last_name}`;
        return acc;
      }, {}) || {};
    }

    // Transform data with separate collector lookup
    const accounts = cases?.map(caseItem => {
      const customer = caseItem.customers;
      const account = caseItem.finance_accounts;
      const collectorName = collectors[caseItem.assigned_to] || 'Unassigned';

      return {
        // ... rest of the transformation
        caseInfo: {
          // ... other fields
          assignedCollector: collectorName,
          // ... rest of the fields
        }
      };
    }) || [];

    // ... rest of the endpoint code
  } catch (error) {
    console.error('❌ Error fetching collection accounts:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      requestOrigin: res.locals.requestOrigin
    });
  }
});
```

## Quick Test Commands

### 1. Test Backend Health
```bash
curl https://ousol-backend-dx9u.vercel.app/health
```

### 2. Login and Get Token
```bash
# Login
curl -X POST https://ousol-backend-dx9u.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@osoul.com", "password": "password123"}'

# Save the token from the response
```

### 3. Test Accounts Endpoint with Token
```bash
curl -X GET "https://ousol-backend-dx9u.vercel.app/api/v1/collection/accounts?page=1&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

## Summary

The main issues are:
1. **Frontend**: Not sending authentication token → Fix by implementing proper auth handling
2. **Backend**: Database relationship issue → Fix by adjusting the query or fixing the database schema

The frontend needs to:
- Implement login flow
- Store and send authentication tokens
- Handle token expiration

The backend needs to:
- Fix the database query relationship issue
- Either define the proper foreign key relationship in Supabase or fetch user data separately