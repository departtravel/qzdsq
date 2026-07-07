import { Router } from 'express';
import { parseEmailHandler, listLogs } from '../controllers/emailsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.post('/parse', parseEmailHandler);
router.get('/', listLogs);

export default router;
