const members = require('../services/members');

module.exports = function requireMember(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const member = members.memberForToken(token);
  if (!member) {
    return res.status(401).json({
      error: {
        message: 'Please log in to continue. Open the member dashboard and sign in or create your free account.'
      }
    });
  }
  req.member = member;
  next();
};
