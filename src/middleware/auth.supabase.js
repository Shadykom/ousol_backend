import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .limit(1);

    if (error || !users || users.length === 0) {
      throw new Error();
    }

    req.user = users[0];
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

