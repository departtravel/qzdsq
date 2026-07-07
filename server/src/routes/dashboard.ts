import { Router } from 'express';
import { stats, monthlyRevenue, otaBreakdown } from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/stats', stats);
router.get('/monthly-revenue', monthlyRevenue);
router.get('/ota-breakdown', otaBreakdown);

export default router;
