function isValidYmd(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(str);
}

module.exports = { isValidYmd };
