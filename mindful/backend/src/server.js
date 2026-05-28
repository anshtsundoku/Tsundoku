import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import Redis from 'ioredis';

import domainsRouter from './routes/domains.js';
import sourcesRouter from './routes/sources.js';
import postsRouter from './routes/posts.js';
import highlightsRouter from './routes/highlights.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/domains', domainsRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/posts', postsRouter);
app.use('/api/highlights', highlightsRouter);

// Generic error handler so the UI doesn't see opaque 500s.
app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(err.status || 500).json({ error: err.message || 'internal error' });
});

const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: '*' } });

// Bridge Redis pub/sub → Socket.io rooms.
// Workers publish on the channel `posts.new` with a JSON payload
// `{ domain_slug, post }`. We push to a room keyed by domain.
const sub = new Redis(process.env.REDIS_URL);
sub.subscribe('posts.new', (err) => {
  if (err) console.error('[redis] subscribe failed', err);
});
sub.on('message', (channel, payloadStr) => {
  if (channel !== 'posts.new') return;
  try {
    const { domain_slug, post } = JSON.parse(payloadStr);
    io.to(`domain:${domain_slug}`).emit('post:new', post);
    io.emit('feed:tick', { domain_slug });
  } catch (e) {
    console.error('[redis] bad payload', e);
  }
});

io.on('connection', (socket) => {
  socket.on('subscribe:domain', (slug) => {
    if (typeof slug === 'string') socket.join(`domain:${slug}`);
  });
  socket.on('unsubscribe:domain', (slug) => {
    if (typeof slug === 'string') socket.leave(`domain:${slug}`);
  });
});

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => console.log(`[api] listening on :${PORT}`));
