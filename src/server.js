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

// CORS configuration
app.use(cors({
  origin: true, // This allows all origins temporarily
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Osoul Collection Reporting API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      login: '/api/v1/auth/login',
      legacyLogin: '/auth/login'
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

// Login endpoint - /api/v1/auth/login
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    console.log('Login attempt:', req.body);
    
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
      console.error('Database error:', dbError);
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
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }
    
    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        error: 'Account is deactivated'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      jwtSecret,
      { expiresIn: '7d' }
    );
    
    // Return user data and token
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active
      },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Legacy login endpoint - /auth/login
app.post('/auth/login', async (req, res) => {
  // Redirect to the new endpoint
  return app._router.handle({ ...req, url: '/api/v1/auth/login' }, res);
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
      .select('id, email, first_name, last_name, role, is_active')
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
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active
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
      '/auth/login'
    ]
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: error.message
  });
});

// Export for Vercel
export default app;

