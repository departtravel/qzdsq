import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth';
import reservationsRoutes from './routes/reservations';
import excursionsRoutes from './routes/excursions';
import partnersRoutes from './routes/partners';
import otasRoutes from './routes/otas';
import workflowRoutes from './routes/workflow';
import tasksRoutes from './routes/tasks';
import supplierBookingsRoutes from './routes/supplierBookings';
import emailsRoutes from './routes/emails';
import pdfRoutes from './routes/pdf';
import dashboardRoutes from './routes/dashboard';
import crmRoutes from './routes/crm';
import agentsRoutes from './routes/agents';
import settingsRoutes from './routes/settings';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

// Security & utilities
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'DepartTravel ERP' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/excursions', excursionsRoutes);
app.use('/api/partners', partnersRoutes);
app.use('/api/otas', otasRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/supplier-bookings', supplierBookingsRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/settings', settingsRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
