const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Ensure the 'uploads' directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Serve uploaded static files
app.use('/uploads', express.static(uploadDir));

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'admin123',
  database: 'study_hub',
  port: 3306
});

db.connect(err => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to MySQL study_hub database!');
});

// GET all quizzes
app.get('/api/quizzes', (req, res) => {
  db.query('SELECT * FROM quizzes', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST route: Upload photo and append to multi-image array
app.post('/api/quizzes/:id/upload', upload.single('image'), (req, res) => {
  const quizId = req.params.id;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const newImageUrl = `http://localhost:5000/uploads/${req.file.filename}`;

  // 1. Fetch current images first
  db.query('SELECT image_url FROM quizzes WHERE id = ?', [quizId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    let images = [];
    if (rows.length > 0 && rows[0].image_url) {
      try {
        images = JSON.parse(rows[0].image_url);
        if (!Array.isArray(images)) images = [rows[0].image_url];
      } catch (e) {
        images = [rows[0].image_url];
      }
    }

    // 2. Append new image URL
    images.push(newImageUrl);
    const updatedImagesJson = JSON.stringify(images);

    // 3. Save back to database
    db.query('UPDATE quizzes SET image_url = ? WHERE id = ?', [updatedImagesJson, quizId], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      res.json({ message: 'Photo uploaded!', image_url: updatedImagesJson });
    });
  });
});

// PUT ROUTE: Update the image_url array (used to remove a SINGLE photo
// while keeping the rest). The frontend sends the already-trimmed
// array as a JSON string in { image_url }, and we just save it as-is.
app.put('/api/quizzes/:id/photo', (req, res) => {
  const quizId = req.params.id;
  const { image_url } = req.body;

  if (typeof image_url === 'undefined') {
    return res.status(400).json({ error: 'image_url is required' });
  }

  db.query('UPDATE quizzes SET image_url = ? WHERE id = ?', [image_url, quizId], (err, result) => {
    if (err) {
      console.error('MySQL Photo Update Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Photo list updated successfully!' });
  });
});

// DELETE ROUTE 1: Remove ALL photos from a card
app.delete('/api/quizzes/:id/photo', (req, res) => {
  const quizId = req.params.id;

  db.query('UPDATE quizzes SET image_url = NULL WHERE id = ?', [quizId], (err, result) => {
    if (err) {
      console.error('MySQL Photo Removal Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Photos removed successfully!' });
  });
});

// DELETE ROUTE 2: Delete the ENTIRE quiz card from MySQL
app.delete('/api/quizzes/:id', (req, res) => {
  const quizId = req.params.id;

  db.query('DELETE FROM quizzes WHERE id = ?', [quizId], (err, result) => {
    if (err) {
      console.error('MySQL Delete Card Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Card deleted successfully!' });
  });
});

app.post('/api/quizzes', (req, res) => {
  const { title, category } = req.body;

  if (!title || !category) {
    return res.status(400).json({ error: 'Title and category are required.' });
  }

  const query = 'INSERT INTO quizzes (title, category) VALUES (?, ?)';
  db.query(query, [title, category], (err, result) => {
    if (err) {
      console.error('MySQL Insert Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Quiz created successfully!', id: result.insertId });
  });
});

app.listen(5000, () => console.log('Server running on http://localhost:5000')); 