import { Router } from 'express';
import { getAll, updateSettings, getExchangeRates, updateExchangeRates } from '../controllers/settingsController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();
router.use(authenticateToken);

router.get('/', getAll);
router.put('/', requireRole('admin'), updateSettings);
router.get('/exchange-rates', getExchangeRates);
router.put('/exchange-rates', requireRole('admin'), updateExchangeRates);

export default router;
