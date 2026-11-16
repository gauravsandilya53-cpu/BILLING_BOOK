const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, quotationController.getAll);
router.get('/next-number', authMiddleware, quotationController.getNextNumber);
router.get('/:id', authMiddleware, quotationController.getById);
router.post('/', authMiddleware, quotationController.create);
router.post('/:id/convert', authMiddleware, quotationController.convertToInvoice);
router.patch('/:id/status', authMiddleware, quotationController.updateStatus);
router.delete('/:id', authMiddleware, quotationController.delete);

module.exports = router;

