import express from 'express';
const app = express();

app.get('/', (req, res) => res.json({ message: 'Nx Monorepo Backend' }));
app.listen(3000, '0.0.0.0');
