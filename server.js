const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 5173;

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback (optional)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
});
