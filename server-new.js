const express = require('express');
const path = require('path');
const app = express();

// Serve legacy HTML files
app.use('/legacy', express.static(path.join(__dirname, 'public')));

// Serve React static files
app.use(express.static(path.join(__dirname, 'client/build')));

// API endpoints (example)
app.get('/api/data', (req, res) => {
    res.json({ message: 'API response' });
});

// Handle client-side routing for React
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});