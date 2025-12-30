import express from 'express';
const app = express();
app.get('/', (req, res) => res.json({ message: 'Lerna Monorepo API' }));
app.listen(3000, '0.0.0.0');
