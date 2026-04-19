function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  if (!req.session.guildId) {
    return res.redirect("/select-guild");
  }
  next();
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  next();
}

module.exports = { requireAuth, requireLogin };
