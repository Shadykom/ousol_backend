import express from 'express';
import { body, validationResult } from 'express-validator';
import supabaseService from '../services/supabase.service.js';
import supabase from '../config/supabase.js';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Register new user using Supabase Auth
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('role').isIn(['admin', 'manager', 'collector', 'viewer'])
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      // Register user with Supabase Auth
      const { user, session } = await supabaseService.signUp(email, password, {
        first_name: firstName,
        last_name: lastName,
        role: role
      });

      // Create user profile in database
      const profile = await supabaseService.insert('users', {
        id: user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        role: role
      });

      res.status(201).json({
        user: profile[0],
        token: session.access_token,
        refreshToken: session.refresh_token
      });
    } catch (error) {
      next(error);
    }
  }
);

// Login user using Supabase Auth
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Sign in with Supabase Auth
      const { user, session } = await supabaseService.signIn(email, password);

      // Get user profile
      const profile = await supabaseService.select('users', '*', { id: user.id });

      if (!profile || profile.length === 0) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      res.json({
        user: profile[0],
        token: session.access_token,
        refreshToken: session.refresh_token
      });
    } catch (error) {
      if (error.message.includes('Invalid login credentials')) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      next(error);
    }
  }
);

// Get current user using Supabase Auth
router.get('/me', async (req, res, next) => {
  try {
    // Get auth token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Set the auth token for this request
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile
    const profile = await supabaseService.select('users', '*', { id: user.id });

    if (!profile || profile.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json(profile[0]);
  } catch (error) {
    next(error);
  }
});

// Logout user
router.post('/logout', async (req, res, next) => {
  try {
    await supabaseService.signOut();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { firstName, lastName } = req.body;

    // Update user metadata in Supabase Auth
    if (firstName || lastName) {
      await supabaseService.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName
        }
      });
    }

    // Update user profile in database
    const updates = {};
    if (firstName) updates.first_name = firstName;
    if (lastName) updates.last_name = lastName;

    const updatedProfile = await supabaseService.update('users', updates, { id: user.id });

    res.json(updatedProfile[0]);
  } catch (error) {
    next(error);
  }
});

// Example of using Supabase real-time subscriptions
router.get('/subscribe/users', async (req, res) => {
  // This is just an example - in a real app, you'd use WebSockets
  res.json({
    message: 'To subscribe to real-time changes, use the Supabase client directly',
    example: `
      const channel = supabase
        .channel('users_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'users' }, 
          (payload) => console.log('Change received!', payload)
        )
        .subscribe();
    `
  });
});

export default router;