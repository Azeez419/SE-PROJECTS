const express = require('express');
const router = express.Router();
const db = require('../app/services/db');
const { requireLogin } = require('./index');

// GET /messages — show inbox + send form
router.get('/', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [inbox] = await db.query(`
      SELECT m.content, m.created_at, u.name AS sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.driver_id = ?
      ORDER BY m.created_at DESC
    `, [userId]);

    const [drivers] = await db.query(
      "SELECT id, name FROM users WHERE role = 'driver'"
    );

    res.render('messages', {
      user: req.session.user,
      inbox,
      drivers,
      success: req.query.success
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

router.post('/', requireLogin, async (req, res) => {
  const senderId = req.session.user.id;
  const { driver_id, content } = req.body;

  if (!driver_id || !content || content.trim() === '') {
    return res.redirect('/messages?error=empty');
  }

  try {
    await db.query(
      'INSERT INTO messages (sender_id, driver_id, content) VALUES (?, ?, ?)',
      [senderId, driver_id, content.trim()]
    );
    res.redirect('/messages?success=1');
  } catch (err) {
    console.error(err);
    res.status(500).send('Could not send message');
  }
});

module.exports = router;