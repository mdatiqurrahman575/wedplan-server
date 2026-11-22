import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getCollections } from '../config/db.js';

const authUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
const JWKS = createRemoteJWKSet(new URL(`${authUrl}/api/auth/jwks`));

// ১. টোকেন এবং ব্লক স্ট্যাটাস চেক
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized! No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authUrl,
      audience: authUrl,
    });

    const { usersCollection } = getCollections();
    const dbUser = await usersCollection.findOne({ email: payload.email });

    if (!dbUser) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }
    if (dbUser.isBlocked) {
      return res.status(403).json({ success: false, message: 'Forbidden! Your account is blocked.' });
    }

    req.user = dbUser;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Unauthorized! Invalid or expired token.' });
  }
};

// ২. রোল চেক (Admin / Vendor / Customer)
export const verifyRole = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role || 'Customer';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden! Only ${allowedRoles.join(' or ')} allowed.`,
      });
    }
    next();
  };
};

