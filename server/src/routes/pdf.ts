import { Router } from 'express';
import { missionOrder, partnerSheet, otaSheet } from '../controllers/pdfController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/mission-order/:reservationId', missionOrder);
router.get('/partner-sheet/:partnerId/:month', partnerSheet);
router.get('/ota-sheet/:otaId/:month', otaSheet);

export default router;
