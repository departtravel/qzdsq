import { Router } from 'express';
import { board, assign, book, complete } from '../controllers/workflowController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/board', board);
router.put('/:id/assign', assign);
router.put('/:id/book', book);
router.put('/:id/complete', complete);

export default router;
