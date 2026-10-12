import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import auth from './routes/auth.js';
import chat from './routes/chat.js';
import documents from './routes/documents.js';
import academics from './routes/academics.js';
import { announcements, notifications, profile, dashboard, search, users } from './routes/misc.js';
import { embeddingProvider } from './services/embeddings.js';
import { llmProvider } from './services/llm.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: false }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, llm: llmProvider, embeddings: embeddingProvider }));
app.use('/api/auth', auth);
app.use('/api', requireAuth);                 // everything below requires a valid JWT
app.use('/api/chat', chat);
app.use('/api/documents', documents);
app.use('/api/academics', academics);
app.use('/api/announcements', announcements);
app.use('/api/notifications', notifications);
app.use('/api/profile', profile);
app.use('/api/dashboard', dashboard);
app.use('/api/search', search);
app.use('/api/users', users);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

app.listen(config.PORT, () =>
  console.log(`UniAssist API on :${config.PORT} · llm=${llmProvider} · embeddings=${embeddingProvider}`));
