require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
const path = require('path');
const cookieParser = require('cookie-parser');
const pino = require('pino');
const pinoHttp = require('pino-http');
const crypto = require('crypto');
const { csrfProtection } = require('./middleware/csrf');
const { apiLimiter, csvImportLimiter } = require('./middleware/rateLimiter');
const { startOverdueCron } = require('./cron/overdueCheck');
const http = require('http');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app = express();
const server = http.createServer(app);

// ================= STRUCTURED LOGGING =================
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.current_password', 'body.new_password'],
    censor: '[REDACTED]'
  }
});

// Request ID middleware — adds a unique ID to each request for tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// HTTP request logging with pino-http
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  autoLogging: {
    ignore: (req) => req.url === '/api/health'
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  }
}));

// Make logger available on req for route handlers
app.use((req, res, next) => {
  req.log = logger.child({ requestId: req.id });
  next();
});

// Export logger for use in other modules
app.logger = logger;

// ================= SECURITY MIDDLEWARE =================
// Helmet sets various HTTP security headers
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Production: no unsafe-inline/eval (API returns JSON, not HTML)
      // Development: allow unsafe-inline/eval for React Fast Refresh / HMR
      scriptSrc: isProduction
        ? ["'self'"]
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: isProduction
        ? ["'self'"]
        : ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173'].filter(Boolean),
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Prevent HTTP parameter pollution
app.use(hpp());

// CORS — hardened configuration
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = [frontendUrl, 'http://localhost:5000'].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, mobile apps, curl, etc.)
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition']
}));

// Trust proxy for correct IP detection behind reverse proxies
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ✅ Input Sanitization — prevent NoSQL injection and XSS
app.use(mongoSanitize());
app.use(xssClean());

// ✅ CSRF Protection — apply to all /api routes except health, auth (login is already rate-limited)
app.use('/api', csrfProtection);

// ✅ Global Rate Limiting — applies to all mutation endpoints
app.use('/api', apiLimiter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================= ROUTES =================
// CSRF token endpoint (no auth required)
app.use('/api', require('./routes/csrf'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/items', require('./routes/items'));
app.use('/api/stock-in', require('./routes/stockIn'));
app.use('/api/stock-out', require('./routes/stockOut'));
app.use('/api/adjustments', require('./routes/adjustments'));
app.use('/api/borrowings', require('./routes/borrowings'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/leftovers', require('./routes/leftovers'));
app.use('/api/damage-liabilities', require('./routes/damageLiabilities'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/activity-logs', require('./routes/activityLogs'));

// ✅ CONTACT FORM ROUTE — public endpoint with tight rate limiting
app.use('/api/contact', require('./routes/contact'));


app.use('/api/budgets', require('./routes/budgets'));

// ✅ SUPPLIER ROUTES
app.use('/api/suppliers', require('./routes/suppliers'));


// ✅ REPORT ROUTES
app.use('/api/reports', require('./routes/reports'));

// ✅ ADMIN ROUTES (Super Admin only) — strict rate limit for destructive actions
app.use('/api/admin', require('./routes/admin'));


// Specific strict limit for CSV import endpoints (mounted under /api/items)
app.use('/api/items/import/csv', csvImportLimiter);

// ================= SWAGGER API DOCS =================
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Mizero Inventory Hub API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: { docExpansion: 'list', filter: true }
}));

// ================= HEALTH CHECK =================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
  // Use structured logger if available
  const log = req.log || logger;
  log.error({ err, url: req.url, method: req.method }, 'Unhandled error');

  // Handle specific error types
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body too large.' });
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Internal server error.'
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;

// Start the scheduled cron job for overdue checking
// Only start cron and server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  startOverdueCron();

  server.listen(PORT, () => {
    console.log(`🚀 Mizero Inventory Hub API running on port ${PORT}`);
  });
}

module.exports = app;