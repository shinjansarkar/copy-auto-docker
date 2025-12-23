import express from 'express';
const app = express();

app.get('/api', (req, res) => res.json({ message: 'MEAN Stack API' }));
app.listen(5000, '0.0.0.0', () => console.log('MEAN server on port 5000'));
