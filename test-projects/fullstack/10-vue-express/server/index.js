import express from 'express';
const app = express();
app.get('/api', (req, res) => res.json({ message: 'Vue Express API' }));
app.listen(5000, '0.0.0.0');
