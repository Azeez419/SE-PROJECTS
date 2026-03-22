const bcrypt = require('bcryptjs');

async function generateHash(password) {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    console.log(`Plain: ${password} -> Hash: ${hash}`);
}

