const { apiRoute } = require('./server');

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    await apiRoute(req, res, url);
  } catch (error) {
    console.error('GitHub API function failed:', error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: 'Internal API error.' }));
  }
};
