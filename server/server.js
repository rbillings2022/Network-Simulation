const express = require("express");
const cors    = require("cors");
const bcrypt  = require("bcrypt");
const path    = require("path");         
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));  
// ─── DB Connection ───────────────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "tracer",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "",
});

// ─── Init Table ──────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("👍DataBase is ready👍");
}
initDB().catch(console.error);

// ─── Password Handler POST /api/register ───────────────────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: "All fields are required." });

  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0)
      return res.status(409).json({ error: "Email already registered." });

    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashed]
    );

    res.status(201).json({ message: "Account created.", user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// ─── Sign-in Handler POST /api/login ──────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user)
      return res.status(401).json({ error: "Invalid email or password." });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: "Invalid email or password." });

    // In production, issue a JWT here instead
    res.json({
      message: "Login successful.",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐Tracer API is running on http://localhost:${PORT}🌐`));

// ─── Topology Routes — ORDER MATTERS ─────────────────────────
// The specific /load/:id route MUST be declared before /:userId
// otherwise Express matches "load" as a userId.

// ─── Init Topologies Table ────────────────────────────────────
async function initTopologies() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS topologies (
            id          SERIAL PRIMARY KEY,
            user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            state       JSONB NOT NULL,
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            updated_at  TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    console.log('Topologies table ready');
}
initTopologies().catch(console.error);

// ─── POST /api/topologies — Save ─────────────────────────────
app.post('/api/topologies', async (req, res) => {
    const { userId, name, state } = req.body;
    if (!userId || !name || !state)
        return res.status(400).json({ error: 'userId, name, and state are required.' });

    try {
        const result = await pool.query(
            `INSERT INTO topologies (user_id, name, state)
             VALUES ($1, $2, $3)
             RETURNING id, name, created_at`,
            [userId, name, JSON.stringify(state)]
        );
        res.status(201).json({ message: 'Topology saved.', topology: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── GET /api/topologies/load/:id — Load single ──────────────
// ⚠ MUST come BEFORE /:userId to avoid "load" matching as a userId
app.get('/api/topologies/load/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT state FROM topologies WHERE id = $1',
            [id]
        );
        if (!result.rows.length)
            return res.status(404).json({ error: 'Topology not found.' });
        res.json({ state: result.rows[0].state });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── GET /api/topologies/:userId — Load list ─────────────────
app.get('/api/topologies/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            'SELECT id, name, created_at FROM topologies WHERE user_id = $1 ORDER BY updated_at DESC',
            [userId]
        );
        res.json({ topologies: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ─── POST /api/logout ─────────────────────────────────────────
app.post('/api/logout', (req, res) => {
    res.json({ message: 'Logged out.' });
});