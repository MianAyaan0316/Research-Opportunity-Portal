const express = require('express');
const pool = require('../db');

const router = express.Router();

const REQUIRED_FIELDS = [
  'title',
  'description',
  'research_area',
  'faculty_name',
  'department',
  'required_skills',
  'positions',
  'deadline'
];

// Checks the data and returns a list of problems (empty list = all good)
function validate(data) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    const value = data[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push(`${field} is required`);
    }
  }

  if (data.positions !== undefined && String(data.positions).trim() !== '') {
    const n = Number(data.positions);
    if (!Number.isInteger(n) || n < 1) {
      errors.push('positions must be a whole number, at least 1');
    }
  }

  if (data.deadline !== undefined && String(data.deadline).trim() !== '') {
    const okFormat = /^\d{4}-\d{2}-\d{2}$/.test(data.deadline);
    if (!okFormat || isNaN(Date.parse(data.deadline))) {
      errors.push('deadline must be a valid date in YYYY-MM-DD format');
    }
  }

  if (data.status !== undefined && !['Open', 'Closed'].includes(data.status)) {
    errors.push("status must be either 'Open' or 'Closed'");
  }

  return errors;
}

// Checks that the :id in the URL is a positive whole number
function isValidId(id) {
  return /^\d+$/.test(id) && Number(id) > 0;
}

// 1. CREATE
router.post('/', async (req, res) => {
  try {
    const errors = validate(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const d = req.body;
    const status = d.status || 'Open';

    const [result] = await pool.query(
      `INSERT INTO opportunities
       (title, description, research_area, faculty_name, department,
        required_skills, positions, deadline, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.title.trim(),
        d.description.trim(),
        d.research_area.trim(),
        d.faculty_name.trim(),
        d.department.trim(),
        d.required_skills.trim(),
        Number(d.positions),
        d.deadline,
        status
      ]
    );

    const [rows] = await pool.query('SELECT * FROM opportunities WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while creating opportunity' });
  }
});

// 2. READ ALL
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM opportunities ORDER BY id DESC');
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while fetching opportunities' });
  }
});

// 3. READ ONE
router.get('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'ID must be a positive number' });
    }

    const [rows] = await pool.query('SELECT * FROM opportunities WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while fetching opportunity' });
  }
});

// 4. UPDATE
router.put('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'ID must be a positive number' });
    }

    const [existing] = await pool.query('SELECT * FROM opportunities WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    // Start from the old data, overwrite only what the user sent
    const merged = { ...existing[0], ...req.body };

    const errors = validate(merged);
    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    await pool.query(
      `UPDATE opportunities SET
        title = ?, description = ?, research_area = ?, faculty_name = ?,
        department = ?, required_skills = ?, positions = ?, deadline = ?, status = ?
       WHERE id = ?`,
      [
        String(merged.title).trim(),
        String(merged.description).trim(),
        String(merged.research_area).trim(),
        String(merged.faculty_name).trim(),
        String(merged.department).trim(),
        String(merged.required_skills).trim(),
        Number(merged.positions),
        merged.deadline,
        merged.status,
        req.params.id
      ]
    );

    const [rows] = await pool.query('SELECT * FROM opportunities WHERE id = ?', [req.params.id]);
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while updating opportunity' });
  }
});

// 5. DELETE
router.delete('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'ID must be a positive number' });
    }

    const [result] = await pool.query('DELETE FROM opportunities WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    res.status(200).json({ message: 'Opportunity deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while deleting opportunity' });
  }
});

module.exports = router;