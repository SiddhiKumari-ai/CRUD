const express = require('express');
const router = express.Router();
const {
  addContact,
  getContacts,
  getContactById,
  updateContact,
  deleteContact,
} = require('../controllers/contactController');

// Routes mapping
router.route('/')
  .post(addContact)
  .get(getContacts);

router.route('/:id')
  .get(getContactById)
  .put(updateContact)
  .delete(deleteContact);

module.exports = router;
