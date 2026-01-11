import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { testConnection, getPool } from './config/database';
import patientsRouter from './api/routes/patients';
import initRouter from './api/routes/init';
import jardianceRouter from './api/routes/jardiance';
import riskRouter from './api/routes/risk';
import gcuaRouter from './api/routes/gcua';
import doctorsRouter from './api/routes/doctors';
import emailTemplatesRouter from './api/routes/emailTemplates';
import analyticsRouter from './api/routes/analytics';
import { createAgentRouter } from './api/routes/agent';
import { createNotificationsRouter } from './api/routes/notifications';
import { createSettingsRouter } from './api/routes/settings';
import { DoctorAgentService } from './services/doctorAgent';
import { PatientMonitorService } from './services/patientMonitor';
import { AlertReminderService } from './services/alertReminderService';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Healthcare AI Backend',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Initialize services (will be started in startServer)
let patientMonitor: PatientMonitorService | null = null;
let alertReminder: AlertReminderService | null = null;

// API Routes
app.use('/api/patients', patientsRouter);
app.use('/api/init', initRouter);
app.use('/api/jardiance', jardianceRouter);
app.use('/api/risk', riskRouter);
app.use('/api/gcua', gcuaRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/email-templates', emailTemplatesRouter);
app.use('/api/analytics', analyticsRouter);

// Agent and Notifications routes (initialized with pool)
const pool = getPool();
const agentRouter = createAgentRouter(pool);
const settingsRouter = createSettingsRouter(pool);
// Note: patientMonitor will be created in startServer
app.use('/api/agent', agentRouter);
app.use('/api/settings', settingsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting Healthcare AI Backend...');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Database connection failed. Exiting...');
      process.exit(1);
    }

    // Initialize Doctor Agent and Patient Monitor services
    console.log('Initializing AI services...');
    const agentService = new DoctorAgentService(pool);
    patientMonitor = new PatientMonitorService(pool, agentService);

    // Mount notifications router (depends on patientMonitor)
    const notificationsRouter = createNotificationsRouter(pool, patientMonitor);
    app.use('/api/notifications', notificationsRouter);

    // Start patient monitoring service
    try {
      await patientMonitor.startMonitoring();
      console.log('✓ Patient monitoring service started');
    } catch (error) {
      console.error('⚠️  Warning: Patient monitoring service failed to start:', error);
      console.log('   Continuing without real-time monitoring...');
    }

    // Start alert reminder service (checks every 30 minutes)
    try {
      alertReminder = new AlertReminderService(pool);
      alertReminder.start();
      console.log('✓ Alert reminder service started (runs every 30 minutes)');
    } catch (error) {
      console.error('⚠️  Warning: Alert reminder service failed to start:', error);
      console.log('   Continuing without automated reminders...');
    }

    // Start listening
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/health`);
      console.log(`✓ Patients API: http://localhost:${PORT}/api/patients`);
      console.log(`✓ GCUA Risk API: http://localhost:${PORT}/api/gcua`);
      console.log(`✓ Doctor Agent API: http://localhost:${PORT}/api/agent`);
      console.log(`✓ Doctors API: http://localhost:${PORT}/api/doctors`);
      console.log(`✓ Notifications API: http://localhost:${PORT}/api/notifications`);
      console.log(`✓ Settings API: http://localhost:${PORT}/api/settings`);
      console.log('✓ Ready to accept requests');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (patientMonitor) {
    await patientMonitor.stopMonitoring();
  }
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (patientMonitor) {
    await patientMonitor.stopMonitoring();
  }
  await pool.end();
  process.exit(0);
});

startServer();
