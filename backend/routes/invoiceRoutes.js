const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, invoiceController.getAll);
router.get('/next-number', authMiddleware, invoiceController.getNextNumber);
router.get('/:id', authMiddleware, invoiceController.getById);
router.post('/', authMiddleware, invoiceController.create);
router.patch('/:id/status', authMiddleware, invoiceController.updateStatus);
router.delete('/:id', authMiddleware, invoiceController.delete);

module.exports = router;

