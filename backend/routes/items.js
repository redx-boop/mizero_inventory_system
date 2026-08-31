const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const router = express.Router();
const { getItems, getItem, createItem, updateItem, deleteItem, exportCsv, importCsv, previewImportCsv, downloadTemplate, getCategories, getGroupedItems } = require('../controllers/itemController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

const path = require('path');

// Memory storage for CSV uploads
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Disk storage for image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'item-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype.split('/')[1]);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Only image files (jpg, png, gif, webp) are allowed.'));
  }
});

router.use(authenticate);

router.get('/', getItems);
router.get('/grouped', getGroupedItems);
router.get('/categories', getCategories);
router.get('/export/csv', authorize('super_admin', 'admin', 'stock_manager'), exportCsv);
router.get('/export/csv/template', authorize('super_admin', 'admin', 'stock_manager'), downloadTemplate);
router.get('/:id', getItem);

router.post('/', authorize('super_admin', 'admin', 'stock_manager'), imageUpload.single('image'), [
  body('name').notEmpty().withMessage('Item name is required'),
  body('unit').notEmpty().withMessage('Unit is required'),
  body('department_id').notEmpty().withMessage('Department is required')
], validate, createItem);

router.post('/import/csv/preview', authorize('super_admin', 'admin', 'stock_manager'), csvUpload.single('file'), previewImportCsv);
router.post('/import/csv', authorize('super_admin', 'admin', 'stock_manager'), csvUpload.single('file'), importCsv);

router.put('/:id', authorize('super_admin', 'admin', 'stock_manager'), imageUpload.single('image'), [
  body('name').notEmpty().withMessage('Item name is required')
], validate, updateItem);

router.delete('/:id', authorize('super_admin', 'admin'), deleteItem);

module.exports = router;
