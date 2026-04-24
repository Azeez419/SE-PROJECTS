require('dotenv').config();
const express = require("express");
const session = require('express-session');
const app = express();

// 1. Settings
app.set('view engine', 'pug');
app.set('views', './views');

// 2. Middleware
app.use(express.static("static"));
app.use(express.urlencoded({ extended: true })); // VERY IMPORTANT FOR LOGIN
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-for-dev',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // Keep false since we are on http://localhost
    maxAge: 24 * 60 * 60 * 1000 // Session lasts 24 hours
  }
}));

// 3. Database
const db = require('./services/db');

// 4. Routes
const mainRoutes = require('../routes/index');
app.use('/', mainRoutes);

// Database Test Route
app.get("/db_test", function(req, res) {
    const sql = 'select * from users';
    db.query(sql).then(results => {
        res.send(results);
    });
});

// 5. Start Server
app.listen(3000, function(){
    console.log(`Server running at http://127.0.0.1:3000/`);
}); 

