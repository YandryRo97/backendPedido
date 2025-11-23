export function authServiceToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'SERVICE_TOKEN no proporcionado' });
  }

  if (token !== process.env.SERVICE_TOKEN) {
    return res.status(403).json({ error: 'SERVICE_TOKEN inválido' });
  }

  next();
}
