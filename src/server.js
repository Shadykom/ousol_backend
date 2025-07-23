import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();

// Environment variables
const supabaseUrl = 'https://mrecphuxcweignmdytal.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZWNwaHV4Y3dlaWdubWR5dGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxNjY2MjMsImV4cCI6MjA2ODc0MjYyM30.4I-S7pvJT4py5Ui5cJL08euMdoTWd3YxDF_-IJYqHeY';
const jwtSecret = process.env.JWT_SECRET || 'osoul_jwt_secret_key_production_2024_supabase_secure';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// UNIVERSAL CORS configuration - Accepts ALL origins
app.use(cors({
  origin: true, // This allows ALL origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200
}));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Additional CORS headers middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    corsPolicy: 'Universal - All origins allowed'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Osoul Collection Reporting API',
    version: '1.0.0',
    status: 'running',
    corsPolicy: 'Universal - All origins allowed',
    endpoints: {
      health: '/health',
      login: '/api/v1/auth/login',
      legacyLogin: '/auth/login',
      testDb: '/api/v1/test-db',
      debugUsers: '/api/v1/debug/users'
    }
  });
});

// Test database connection
app.get('/api/v1/test-db', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role')
      .limit(1);
    
    if (error) {
      return res.status(500).json({
        error: 'Database connection failed',
        details: error.message
      });
    }
    
    res.status(200).json({
      message: 'Database connection successful',
      userCount: data.length,
      sample: data[0] || null
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database test failed',
      details: error.message
    });
  }
});

// Debug endpoint to check user table structure
app.get('/api/v1/debug/users', async (req, res) => {
  try {
    // First, let's check what columns exist in the users table
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .limit(3);
    
    if (error) {
      return res.status(500).json({ 
        error: 'Database query failed',
        details: error.message 
      });
    }
    
    // Show the structure of the first user
    const sampleUser = users[0] || {};
    const availableColumns = Object.keys(sampleUser);
    
    const debugInfo = users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role || 'No role',
      isActive: user.is_active,
      availableColumns: availableColumns,
      hasPasswordHash: !!user.password_hash,
      hasPassword: !!user.password,
      passwordValue: user.password || user.password_hash || 'No password field found'
    }));
    
    res.json({ 
      users: debugInfo,
      totalUsers: users.length,
      availableColumns: availableColumns
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Debug query failed',
      details: error.message 
    });
  }
});

// Simple password verification - handles multiple password storage methods
function verifyPassword(inputPassword, storedPassword) {
  try {
    // If no stored password, return false
    if (!storedPassword) {
      return false;
    }
    
    // If stored password is bcrypt hash (starts with $2)
    if (storedPassword.startsWith('$2')) {
      return bcrypt.compareSync(inputPassword, storedPassword);
    }
    
    // If stored password is plain text, do direct comparison
    return inputPassword === storedPassword;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

// Login endpoint - /api/v1/auth/login
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    console.log('Login attempt received');
    console.log('Request body:', req.body);
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }
    
    console.log('Querying database for user:', email);
    
    // Get user from database - select all columns to see what's available
    const { data: users, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .limit(1);
    
    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({
        error: 'Database query failed',
        details: dbError.message
      });
    }
    
    console.log('Database query result:', users);
    
    if (!users || users.length === 0) {
      console.log('User not found');
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }
    
    const user = users[0];
    console.log('User found:', { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      availableFields: Object.keys(user)
    });
    
    // Check password - try different possible password field names
    let storedPassword = null;
    let passwordField = null;
    
    // Try different possible password field names
    if (user.password_hash) {
      storedPassword = user.password_hash;
      passwordField = 'password_hash';
    } else if (user.password) {
      storedPassword = user.password;
      passwordField = 'password';
    } else if (user.pwd) {
      storedPassword = user.pwd;
      passwordField = 'pwd';
    } else if (user.pass) {
      storedPassword = user.pass;
      passwordField = 'pass';
    }
    
    console.log('Password field used:', passwordField);
    console.log('Stored password exists:', !!storedPassword);
    
    if (!storedPassword) {
      console.log('No password field found in user record');
      console.log('Available user fields:', Object.keys(user));
      
      // For testing purposes, if no password is stored, allow login with default password
      if (password === 'password123') {
        console.log('Using default password for testing');
      } else {
        return res.status(500).json({
          error: 'User password not configured',
          details: 'No password field found in database',
          availableFields: Object.keys(user)
        });
      }
    }
    
    // Verify password
    let isValidPassword = false;
    
    if (storedPassword) {
      isValidPassword = verifyPassword(password, storedPassword);
    } else {
      // Default password for testing
      isValidPassword = (password === 'password123');
    }
    
    console.log('Password validation result:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('Invalid password');
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }
    
    // Check if user is active
    if (user.is_active === false) {
      console.log('User account is deactivated');
      return res.status(401).json({
        error: 'Account is deactivated'
      });
    }
    
    console.log('Generating JWT token');
    
    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role || 'user'
      },
      jwtSecret,
      { expiresIn: '7d' }
    );
    
    console.log('Login successful for user:', user.email);
    
    // Return user data and token
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name || user.firstname || 'User',
        lastName: user.last_name || user.lastname || '',
        role: user.role || 'user',
        isActive: user.is_active !== false
      },
      token,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Legacy login endpoint - /auth/login
app.post('/auth/login', async (req, res) => {
  console.log('Legacy login endpoint called, redirecting to main login');
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }
    
    // Get user from database
    const { data: users, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .limit(1);
    
    if (dbError) {
      return res.status(500).json({
        error: 'Database query failed',
        details: dbError.message
      });
    }
    
    if (!users || users.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }
    
    const user = users[0];
    
    // Check password using the same logic as the main endpoint
    let storedPassword = user.password_hash || user.password || user.pwd || user.pass;
    let isValidPassword = false;
    
    if (storedPassword) {
      isValidPassword = verifyPassword(password, storedPassword);
    } else {
      // Default password for testing
      isValidPassword = (password === 'password123');
    }
    
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }
    
    if (user.is_active === false) {
      return res.status(401).json({
        error: 'Account is deactivated'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role || 'user'
      },
      jwtSecret,
      { expiresIn: '7d' }
    );
    
    // Return user data and token
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name || user.firstname || 'User',
        lastName: user.last_name || user.lastname || '',
        role: user.role || 'user',
        isActive: user.is_active !== false
      },
      token,
      message: 'Login successful (legacy endpoint)'
    });
    
  } catch (error) {
    console.error('Legacy login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Get current user endpoint
app.get('/api/v1/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authorization token required'
      });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtSecret);
    
    // Get fresh user data
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .limit(1);
    
    if (error || !users || users.length === 0) {
      return res.status(401).json({
        error: 'User not found'
      });
    }
    
    const user = users[0];
    
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name || user.firstname || 'User',
        lastName: user.last_name || user.lastname || '',
        role: user.role || 'user',
        isActive: user.is_active !== false
      }
    });
    
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({
      error: 'Invalid token'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
    availableRoutes: [
      '/health',
      '/api/v1/test-db',
      '/api/v1/auth/login',
      '/api/v1/auth/me',
      '/api/v1/debug/users',
      '/auth/login'
    ]
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// Export for Vercel
export default app;

