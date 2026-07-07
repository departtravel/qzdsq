import { Router } from 'express';
import { list, getOne, create, update, remove, advanceWorkflow, getNetPrice } from '../controllers/reservationsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', list);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
router.put('/:id/workflow', advanceWorkflow);
router.get('/:id/net-price', getNetPrice);

export default router;
