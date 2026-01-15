
import jwt from 'jsonwebtoken';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(password, salt = randomBytes(16)) {
  const hash = scryptSync(password, salt, 64);
  return { hash: hash.toString('hex'), salt: salt.toString('hex') };
}
export function verifyPassword(password, passhash, saltHex) {
  const hash = scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return timingSafeEqual(hash, Buffer.from(passhash, 'hex'));
}
export function signToken(user, secret) {
  const roles = (user.roles || 'user').split(',').map(s => s.trim()).filter(Boolean);
  return jwt.sign({ sub: user.id, username: user.username, roles }, secret, { expiresIn: '7d' });
}
export function requireRole(roles) {
  return (req, res, next) => {
    const my = req.user?.roles || [];
    for (const r of roles) if (my.includes(r)) return next();
    return res.status(403).json({ error: 'forbidden' });
  };
}
