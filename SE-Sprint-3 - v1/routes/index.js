const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../app/services/db'); 

// ─── MIDDLEWARE ──────────────────────────────
function requireLogin(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

// ─── AUTH ROUTES ─────────────────────────────
router.get('/', (req, res) => res.redirect('/login'));
router.get('/login', (req, res) => res.render('login', { title: 'Sign In', user: null }));

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const rows = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (!rows || rows.length === 0) return res.render('login', { title: 'Sign In', user: null, error: 'User not found.' });
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.render('login', { title: 'Sign In', user: null, error: 'Wrong password.' });
        req.session.user = user;
        res.redirect('/listing');
    } catch (err) { res.render('login', { title: 'Sign In', user: null, error: 'Server error.' }); }
});

router.get('/register', (req, res) => res.render('register', { title: 'Register', user: null }));
router.post('/register', async (req, res) => {
    const { fname, lname, email, role, password, confirm_password } = req.body;
    if (password !== confirm_password) return res.render('register', { title: 'Register', user: null, error: 'Passwords mismatch.' });
    try {
        const hash = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (name, email, password, course, credits) VALUES (?,?,?,?,0)', [`${fname} ${lname}`, email, hash, role]);
        res.render('login', { title: 'Sign In', user: null, success: 'Account created! Please sign in.' });
    } catch (err) { res.render('register', { title: 'Register', user: null, error: 'Error creating account.' }); }
});

// ─── LISTING ─────────────────────────────────
router.get('/listing', requireLogin, async (req, res) => {
    try {
        const { destination, tag } = req.query;
        let sql = `SELECT r.*, u.name as driver_name, u.credits as driver_points, u.rating as driver_rating
                   FROM rides r JOIN users u ON r.driver_id = u.id WHERE 1=1`;
        const params = [];
        if (destination) { sql += ' AND r.destination LIKE ?'; params.push(`%${destination}%`); }
        if (tag) { sql += ' AND r.tag = ?'; params.push(tag); }

        const rides = await db.query(sql, params);
        rides.forEach(r => {
            const parts = (r.driver_name || "User").split(' ');
            r.driver_initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
            // Matching your SQL screenshot columns to the UI
            r.pickup = r.pickup_location;
            if (r.ride_time) {
                const dt = new Date(r.ride_time);
                r.date = dt.toLocaleDateString();
                r.time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        });
        res.render('listing', { title: 'Find a Ride', user: req.session.user, rides, query: destination || '', activeTag: tag || '' });
    } catch (err) { res.send("Listing Error. Check Terminal."); }
});

// ─── OFFER A RIDE (FIXED: Added GET and corrected POST) ───────────
router.get('/offer', requireLogin, (req, res) => {
    res.render('offer', { title: 'Offer a Ride', user: req.session.user });
});

router.post('/offer', requireLogin, async (req, res) => {
    const { pickup, destination, date, time, seats, notes } = req.body;
    try {
        const rideDateTime = `${date} ${time}`;
        await db.query(
            'INSERT INTO rides (driver_id, pickup_location, destination, ride_time, seats_available, notes) VALUES (?,?,?,?,?,?)',
            [req.session.user.id, pickup, destination, rideDateTime, seats, notes]
        );
        await db.query('UPDATE users SET credits = credits + 2 WHERE id = ?', [req.session.user.id]);
        res.redirect('/listing');
    } catch (err) { 
        console.error("Offer Error:", err);
        res.redirect('/offer'); 
    }
});

// ─── CATEGORIES (FIXED: Added destinations array) ────────────────
router.get('/categories', requireLogin, async (req, res) => {
    try {
        const categories = [
            { tag: 'Morning', name: 'Morning', icon: '🌅' },
            { tag: 'Afternoon', name: 'Afternoon', icon: '☀️' },
            { tag: 'Evening', name: 'Evening', icon: '🌙' },
            { tag: 'Quiet Ride', name: 'Quiet Ride', icon: '🤫' },
            { tag: 'Music OK', name: 'Music OK', icon: '🎵' }
        ];
        // This is what the Pug file was missing!
        const destinations = ['Main Campus', 'Library', 'Train Station', 'Sports Centre', 'Student Union'];
        
        res.render('categories', { 
            title: 'Categories', 
            user: req.session.user, 
            categories, 
            destinations 
        });
    } catch (err) { res.redirect('/listing'); }
});

// ─── PROFILE ─────────────────────────────────
router.get('/profile', requireLogin, async (req, res) => {
    try {
        const rows = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        const userData = rows[0];
        const parts = userData.name.split(' ');
        userData.initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
        const rides = await db.query("SELECT * FROM rides WHERE driver_id = ? ORDER BY id DESC", [userData.id]);
        res.render('profile', { title: 'My Profile', user: userData, rides });
    } catch (err) { res.redirect('/listing'); }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});


// ─── USERS (COMMUNITY) ────────────────────────
router.get('/users', requireLogin, async (req, res) => {
    try {
        // Fetching users to show in the community list
        // Using 'name', 'course', and 'credits' to match your campusride.sql
        const users = await db.query('SELECT id, name, course, credits, rating FROM users LIMIT 50');
        
        if (users && users.length > 0) {
            users.forEach(u => {
                // Generate initials for the avatar circles
                const parts = (u.name || "User").split(' ');
                const firstInitial = parts[0] ? parts[0][0] : 'U';
                const lastInitial = parts[1] ? parts[1][0] : '';
                u.initials = (firstInitial + lastInitial).toUpperCase();
            });
        }

        res.render('users', { 
            title: 'Community', 
            user: req.session.user, 
            users: users || [] 
        });
    } catch (err) {
        console.error("Community Page Error:", err);
        res.redirect('/listing');
    }
});

// ─── RIDE DETAILS ──────────────────────────────
router.get('/detail/:id', requireLogin, async (req, res) => {
    try {
        const rows = await db.query(`
            SELECT r.*, u.name as driver_name, u.rating as driver_rating, u.credits as driver_points
            FROM rides r JOIN users u ON r.driver_id = u.id WHERE r.id = ?
        `, [req.params.id]);
        
        if (!rows || rows.length === 0) return res.redirect('/listing');
        
        const ride = rows[0];
        // Fix names to match Pug expectations
        ride.pickup = ride.pickup_location;
        
        const parts = (ride.driver_name || "User").split(' ');
        ride.driver_initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();

        res.render('detail', { title: 'Ride Details', user: req.session.user, ride });
    } catch (err) {
        console.error(err);
        res.redirect('/listing');
    }
});

module.exports = router;