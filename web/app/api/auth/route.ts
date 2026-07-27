/*
Core authentication API
*/

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const BCRYPT_ROUNDS = 12;

export default async function handler(req, res) {
  const { action } = req.query;

  switch(action) {
    case 'login':
      return await login(req, res);
    case 'logout':
      return await logout(req, res);
    case 'me':
      return await getCurrentUser(req, res);
    default:
      return res.status(404).json({ error: 'Action not implemented' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, email, password, name, role FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getCurrentUser(req, res) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    return res.json({ user });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function logout(req, res) {
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}