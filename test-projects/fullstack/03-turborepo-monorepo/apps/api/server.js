import express from 'express';
const app = express();

app.get('/', (req, res) => res.json({ message: 'Turborepo API' }));
app.listen(3001, '0.0.0.0', () => console.log('API on port 3001'));
