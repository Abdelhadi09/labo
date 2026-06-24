const jwt = require('jsonwebtoken');

/**
 * authenticate — verifies the short-lived ACCESS token (15 m).
 *
 * The access token is signed with JWT_SECRET and carries:
 *   { id, username, role }
 *
 * On expiry the client must call POST /api/auth/refresh with its
 * refresh token to obtain a new pair. A 401 with
 *   { error: 'Token expired', code: 'TOKEN_EXPIRED' }
 * is the signal the frontend intercepts to trigger silent refresh.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      // Distinct code so the axios interceptor can trigger a silent refresh
      // instead of immediately redirecting to /login.
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

module.exports = { authenticate, requireRole };