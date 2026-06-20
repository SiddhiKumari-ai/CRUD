const Contact = require('../models/Contact');

// @desc    Add a new contact
// @route   POST /api/contacts
// @access  Public
const addContact = async (req, res) => {
  try {
    const { name, email, phone, address, gender } = req.body;

    // Validation check (also handled by Mongoose schema, but custom message is nice)
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email, and phone number',
      });
    }

    const contact = await Contact.create({
      name,
      email,
      phone,
      address,
      gender,
    });

    res.status(201).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists',
      });
    }
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map(val => val.message).join(', ');
      return res.status(400).json({
        success: false,
        error: message,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error',
    });
  }
};

// @desc    Get all contacts
// @route   GET /api/contacts
// @access  Public
const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error',
    });
  }
};

// @desc    Get a single contact by ID
// @route   GET /api/contacts/:id
// @access  Public
const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    // If invalid MongoDB ObjectId format
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error',
    });
  }
};

// @desc    Update a contact
// @route   PUT /api/contacts/:id
// @access  Public
const updateContact = async (req, res) => {
  try {
    const { name, email, phone, address, gender } = req.body;

    let contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    // Update fields
    contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, address, gender },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists',
      });
    }
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map(val => val.message).join(', ');
      return res.status(400).json({
        success: false,
        error: message,
      });
    }
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error',
    });
  }
};

// @desc    Delete a contact
// @route   DELETE /api/contacts/:id
// @access  Public
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    await Contact.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {},
      message: 'Contact removed successfully',
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error',
    });
  }
};

module.exports = {
  addContact,
  getContacts,
  getContactById,
  updateContact,
  deleteContact,
};
