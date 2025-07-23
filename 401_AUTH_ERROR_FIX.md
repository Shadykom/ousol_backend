# 401 Authentication Error Fix Guide

## Problem Summary
The frontend at `https://osoul-7d3jdmhls-shadys-projects-429d4be8.vercel.app` is receiving a 401 Unauthorized error when trying to access `/api/v1/collection/accounts` because it's not sending the required authentication token.

## Root Cause
The backend endpoint `/api/v1/collection/accounts` is protected by the `authenticateToken` middleware which requires:
- A Bearer token in the Authorization header
- The token must be a valid JWT signed with the server's secret

## Authentication Flow
1. **Login**: POST to `/api/v1/auth/login` with email and password
2. **Receive Token**: Backend returns a JWT token in the response
3. **Use Token**: Include the token in all subsequent requests as `Authorization: Bearer <token>`

## Frontend Fix

### 1. Update API Client Configuration
The frontend needs to:
- Store the token after successful login
- Include the token in all API requests

Example axios configuration:
```javascript
// After successful login
const loginResponse = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
  email: 'user@example.com',
  password: 'password123'
});

// Store the token
const token = loginResponse.data.token;
localStorage.setItem('authToken', token);

// Configure axios to include token in all requests
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// Or create an axios instance with the token
const apiClient = axios.create({
  baseURL: 'https://ousol-backend-dx9u.vercel.app/api/v1',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Now requests will work
const accountsResponse = await apiClient.get('/collection/accounts', {
  params: { page: 1, limit: 20 }
});
```

### 2. Handle Token Expiration
The token expires after 24 hours. Implement:
- Token refresh mechanism
- Redirect to login on 401/403 errors
- Clear stored token on logout

### 3. Error Interceptor
Add an axios interceptor to handle authentication errors:
```javascript
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Clear token and redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## Backend Considerations

### Current Authentication Setup
- JWT Secret: Stored in environment variable `JWT_SECRET`
- Token Expiry: 24 hours
- Required Header Format: `Authorization: Bearer <token>`

### Public Endpoints (No Auth Required)
- `GET /` - API info
- `GET /health` - Health check
- `GET /api/v1/test-db` - Database connection test
- `POST /api/v1/auth/login` - Login endpoint

### Protected Endpoints (Auth Required)
- `GET /api/v1/auth/me` - Get current user
- `GET /api/v1/collection/reports/daily` - Daily reports
- `GET /api/v1/collection/accounts` - List accounts
- `GET /api/v1/collection/accounts/:id` - Get specific account

## Testing the Fix

### 1. Test Login
```bash
curl -X POST https://ousol-backend-dx9u.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### 2. Test Protected Endpoint with Token
```bash
curl -X GET https://ousol-backend-dx9u.vercel.app/api/v1/collection/accounts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

## Quick Frontend Fix Example
If you need a quick fix in the frontend code, update your API service:

```javascript
// api/collectionService.js
class CollectionService {
  constructor() {
    this.baseURL = 'https://ousol-backend-dx9u.vercel.app/api/v1';
    this.token = localStorage.getItem('authToken');
  }

  async getAccounts(page = 1, limit = 20) {
    if (!this.token) {
      throw new Error('No authentication token found. Please login.');
    }

    try {
      const response = await axios.get(`${this.baseURL}/collection/accounts`, {
        params: { page, limit },
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('authToken');
        throw new Error('Session expired. Please login again.');
      }
      throw error;
    }
  }
}
```

## Summary
The 401 error is occurring because the frontend is not sending the required authentication token. The solution is to:
1. Implement proper login flow to obtain the token
2. Store the token securely (localStorage or sessionStorage)
3. Include the token in all API requests to protected endpoints
4. Handle token expiration gracefully

The backend CORS is already configured to accept all origins, so there are no CORS issues. The only issue is the missing authentication token.