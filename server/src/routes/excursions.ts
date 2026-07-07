import { Router } from 'express';
import { list, getOne, create, update, remove, costBreakdown } from '../controllers/excursionsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', list);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
router.get('/:id/cost-breakdown', costBreakdown);

export default router;
