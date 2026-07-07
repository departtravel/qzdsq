import { Router } from 'express';
import { parseEmailHandler, alertsHandler, accountingEntry, listLogs } from '../controllers/agentsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.post('/voyage/parse', parseEmailHandler);
router.post('/erp/alerts', alertsHandler);
router.post('/accounting/entry', accountingEntry);
router.get('/logs', listLogs);

export default router;
