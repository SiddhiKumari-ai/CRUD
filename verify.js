const Module = require('module');
const mongoose = require('mongoose');

// 1. Mock DB connection to do nothing when index.js requires it
const originalRequire = Module.prototype.require;
Module.prototype.require = function (path) {
  if (path.endsWith('config/db') || path === './config/db') {
    return () => {
      console.log('[TEST MOCK] DB Connection initialized successfully.');
    };
  }
  return originalRequire.apply(this, arguments);
};

// 2. Load the Contact model to register it
const Contact = require('./src/models/Contact');

// 3. Mock Contact static methods for in-memory operations
let mockDB = [];
let nextId = 1;

Contact.create = async (data) => {
  if (data.email && mockDB.some(item => item.email === data.email)) {
    const err = new Error('Duplicate key');
    err.code = 11000;
    throw err;
  }
  const newDoc = {
    _id: `mockid_${nextId++}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
  };
  mockDB.push(newDoc);
  return newDoc;
};

Contact.find = () => {
  return {
    sort: (criteria) => {
      // Return sorted array
      return [...mockDB].sort((a, b) => b.createdAt - a.createdAt);
    }
  };
};

Contact.findById = async (id) => {
  return mockDB.find(item => item._id === id) || null;
};

Contact.findByIdAndUpdate = async (id, data, options) => {
  const index = mockDB.findIndex(item => item._id === id);
  if (index === -1) return null;
  if (data.email && mockDB.some(item => item._id !== id && item.email === data.email)) {
    const err = new Error('Duplicate key');
    err.code = 11000;
    throw err;
  }
  // Update fields while preserving id and timestamps
  mockDB[index] = {
    ...mockDB[index],
    ...data,
    updatedAt: new Date()
  };
  return mockDB[index];
};

Contact.findByIdAndDelete = async (id) => {
  const index = mockDB.findIndex(item => item._id === id);
  if (index === -1) return null;
  const deleted = mockDB[index];
  mockDB.splice(index, 1);
  return deleted;
};

// 4. Start the server (index.js) on a custom port for testing
process.env.PORT = 5001;
const server = require('./src/index');

// Helper function to make requests
async function makeRequest(path, method = 'GET', body = null) {
  const url = `http://localhost:5001${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, options);
    const data = await res.json();
    return { status: res.status, data };
  } catch (error) {
    console.error(`Request failed to ${path}:`, error.message);
    throw error;
  }
}

// 5. Run tests
async function runTests() {
  console.log('\n--- Starting API Integration Tests ---');
  let testContactId = null;

  try {
    // Test 1: Get all contacts (should be empty initially)
    console.log('\nTest 1: GET /api/contacts (Initial state)');
    const t1 = await makeRequest('/api/contacts');
    console.log(`Status: ${t1.status}`);
    console.log(`Response:`, JSON.stringify(t1.data));
    if (t1.status !== 200 || t1.data.count !== 0) throw new Error('Test 1 failed');

    // Test 2: Add a new contact
    console.log('\nTest 2: POST /api/contacts (Create Contact)');
    const newContact = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      address: '123 Main St',
      gender: 'Male',
    };
    const t2 = await makeRequest('/api/contacts', 'POST', newContact);
    console.log(`Status: ${t2.status}`);
    console.log(`Response:`, JSON.stringify(t2.data));
    if (t2.status !== 201 || !t2.data.success || !t2.data.data._id) throw new Error('Test 2 failed');
    if (t2.data.data.address !== '123 Main St' || t2.data.data.gender !== 'Male') throw new Error('Test 2 failed: address or gender not saved');
    testContactId = t2.data.data._id;

    // Test 2b: Add a contact with duplicate email
    console.log('\nTest 2b: POST /api/contacts (Create Contact with duplicate email)');
    const duplicateContact = {
      name: 'John Copy',
      email: 'john@example.com',
      phone: '555-555-5555',
    };
    const t2b = await makeRequest('/api/contacts', 'POST', duplicateContact);
    console.log(`Status: ${t2b.status}`);
    console.log(`Response:`, JSON.stringify(t2b.data));
    if (t2b.status !== 400 || t2b.data.success !== false || t2b.data.error !== 'Email already exists') {
      throw new Error('Test 2b failed - did not return expected duplicate email error');
    }

    // Test 3: Get all contacts (should now contain 1 contact)
    console.log('\nTest 3: GET /api/contacts (After creation)');
    const t3 = await makeRequest('/api/contacts');
    console.log(`Status: ${t3.status}`);
    console.log(`Response:`, JSON.stringify(t3.data));
    if (t3.status !== 200 || t3.data.count !== 1) throw new Error('Test 3 failed');

    // Test 4: Get contact by ID
    console.log(`\nTest 4: GET /api/contacts/${testContactId} (Retrieve single contact)`);
    const t4 = await makeRequest(`/api/contacts/${testContactId}`);
    console.log(`Status: ${t4.status}`);
    console.log(`Response:`, JSON.stringify(t4.data));
    if (t4.status !== 200 || t4.data.data.name !== 'John Doe') throw new Error('Test 4 failed');
    if (t4.data.data.address !== '123 Main St' || t4.data.data.gender !== 'Male') throw new Error('Test 4 failed: address or gender mismatch');

    // Test 5: Update the contact
    console.log(`\nTest 5: PUT /api/contacts/${testContactId} (Update contact)`);
    const updatedContact = {
      name: 'Johnathan Doe',
      email: 'johnathan@example.com',
      phone: '987-654-3210',
      address: '456 Oak Ave',
      gender: 'Other',
    };
    const t5 = await makeRequest(`/api/contacts/${testContactId}`, 'PUT', updatedContact);
    console.log(`Status: ${t5.status}`);
    console.log(`Response:`, JSON.stringify(t5.data));
    if (t5.status !== 200 || t5.data.data.name !== 'Johnathan Doe') throw new Error('Test 5 failed');
    if (t5.data.data.address !== '456 Oak Ave' || t5.data.data.gender !== 'Other') throw new Error('Test 5 failed: updated address or gender mismatch');

    // Test 6: Delete the contact
    console.log(`\nTest 6: DELETE /api/contacts/${testContactId} (Delete contact)`);
    const t6 = await makeRequest(`/api/contacts/${testContactId}`, 'DELETE');
    console.log(`Status: ${t6.status}`);
    console.log(`Response:`, JSON.stringify(t6.data));
    if (t6.status !== 200 || !t6.data.success) throw new Error('Test 6 failed');

    // Test 7: GET deleted contact (should return 404)
    console.log(`\nTest 7: GET /api/contacts/${testContactId} (Verify deletion)`);
    const t7 = await makeRequest(`/api/contacts/${testContactId}`);
    console.log(`Status: ${t7.status}`);
    console.log(`Response:`, JSON.stringify(t7.data));
    if (t7.status !== 404) throw new Error('Test 7 failed');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Allow server to spin up, then start tests
setTimeout(runTests, 1000);
