const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const PORT = 3000;


const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

app.use(cors({
    origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ]
}));
app.use(express.json());

function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];

    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            error: "Access token required"
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (error, user) => {
        if (error) {
            return res.status(403).json({
                error: "Invalid or expired token"
            });
        }

        req.user = user;
        next();
    });
}

function isValidUrl(value) {
    try {
        const url = new URL(value);

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );
    } catch {
        return false;
    }
}

// GET /
app.get("/", (req, res) => {
    res.json({
        message: "ShortURL API is running!"
    });
});

// GET /api/urls
app.get("/api/urls", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, original_url, short_code, created_at, clicks
     FROM urls
     WHERE user_id = $1
     ORDER BY created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Database error:", error);

        res.status(500).json({
            error: "Failed to get URLs"
        });
    }
});

app.post("/api/register", async (req, res) => {
    const { name, email, password } = req.body;

    // Check required fields
    if (!name || !email || !password) {
        return res.status(400).json({
            error: "Name, email and password are required"
        });
    }

    try {
        // Check if email already exists
        const existingUser = await pool.query(
            `SELECT id FROM users WHERE email = $1`,
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: "Email is already registered"
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Save user
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, created_at`,
            [name, email, passwordHash]
        );

        const user = result.rows[0];

        res.status(201).json({
            message: "Account created successfully",
            user
        });

    } catch (error) {
        console.error("Register error:", error);

        res.status(500).json({
            error: "Failed to create account"
        });
    }
});

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: "Email and password are required"
        });
    }

    try {
        const result = await pool.query(
            `SELECT id, name, email, password_hash
             FROM users
             WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            error: "Failed to login"
        });
    }
});

app.delete("/api/urls", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM urls
             WHERE user_id = $1
             RETURNING id`,
            [req.user.id]
        );

        res.json({
            message: "All your URLs deleted successfully",
            deletedCount: result.rowCount
        });

    } catch (error) {
        console.error("Database error:", error);

        res.status(500).json({
            error: "Failed to delete URLs"
        });
    }
});



app.delete("/api/urls/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM urls
             WHERE id = $1
             AND user_id = $2
             RETURNING id`,
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "URL not found or you do not own this URL"
            });
        }

        res.json({
            message: "URL deleted successfully"
        });

    } catch (error) {
        console.error("Database error:", error);

        res.status(500).json({
            error: "Failed to delete URL"
        });
    }
});


// POST /api/urls
app.post("/api/urls", authenticateToken, async (req, res) => {
    const { originalUrl, customCode } = req.body;

    // 1. Check URL
    if (!originalUrl || typeof originalUrl !== "string") {
    return res.status(400).json({
        error: "URL is required"
    });
}

    // 2. Validate URL
    try {
        const url = new URL(originalUrl);

        if (!["http:", "https:"].includes(url.protocol)) {
            return res.status(400).json({
                error: "Only HTTP and HTTPS URLs are allowed"
            });
        }
    } catch {
        return res.status(400).json({
            error: "Invalid URL"
        });
    }

    try {
        // 3. Check if this URL already exists for this user
        const existing = await pool.query(
            `SELECT id, original_url, short_code, created_at, clicks
             FROM urls
             WHERE original_url = $1
             AND user_id = $2
             LIMIT 1`,
            [originalUrl, req.user.id]
        );

        if (existing.rows.length > 0) {
            const url = existing.rows[0];

            return res.status(200).json({
                id: url.id,
                originalUrl: url.original_url,
                shortCode: url.short_code,
                createdAt: url.created_at,
                clicks: url.clicks,
                existing: true
            });
        }

        // 4. If custom code was provided
        if (
    customCode !== undefined &&
    customCode !== null &&
    customCode !== ""
) {

    // Custom code must be text
    if (typeof customCode !== "string") {
        return res.status(400).json({
            error: "Custom code must be text"
        });
    }
            

            // Only letters, numbers, - and _
            if (!/^[a-zA-Z0-9_-]+$/.test(customCode)) {
                return res.status(400).json({
                    error: "Custom code can only contain letters, numbers, hyphens and underscores"
                });
            }

            // Length: 3-10 characters
            if (customCode.length < 3 || customCode.length > 10) {
                return res.status(400).json({
                    error: "Custom code must be 3-10 characters"
                });
            }

            // Check if custom code already exists
            const existingCode = await pool.query(
                `SELECT id
                 FROM urls
                 WHERE short_code = $1`,
                [customCode]
            );

            if (existingCode.rows.length > 0) {
                return res.status(409).json({
                    error: "Custom code is already taken"
                });
            }
        }

        // 5. Generate random code if custom code is empty
        let shortCode = customCode;

        if (!shortCode) {
            let exists = true;

            while (exists) {
                shortCode = Math.random()
                    .toString(36)
                    .substring(2, 8);

                const check = await pool.query(
                    `SELECT id
                     FROM urls
                     WHERE short_code = $1`,
                    [shortCode]
                );

                exists = check.rows.length > 0;
            }
        }

        // 6. Save URL
        const result = await pool.query(
            `INSERT INTO urls (
                original_url,
                short_code,
                user_id
            )
            VALUES ($1, $2, $3)
            RETURNING id, original_url, short_code, created_at, clicks`,
            [
                originalUrl,
                shortCode,
                req.user.id
            ]
        );

        const urlData = result.rows[0];

        // 7. Send response
        res.status(201).json({
            id: urlData.id,
            originalUrl: urlData.original_url,
            shortCode: urlData.short_code,
            createdAt: urlData.created_at,
            clicks: urlData.clicks
        });

    } catch (error) {

    // PostgreSQL duplicate value error
    if (error.code === "23505") {

        if (error.constraint === "urls_short_code_key") {
            return res.status(409).json({
                error: "Short code is already taken"
            });
        }
    }

    console.error("Create URL error:", error);

    return res.status(500).json({
        error: "Failed to create short URL"
    });
}
});

// GET /api/analytics
app.get("/api/analytics", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                COUNT(*) AS total_links,
                COALESCE(SUM(clicks), 0) AS total_clicks,
                COUNT(*) FILTER (WHERE clicks > 0) AS active_links
             FROM urls
             WHERE user_id = $1`,
            [req.user.id]
        );

        const analytics = result.rows[0];

        res.json({
            totalLinks: Number(analytics.total_links),
            totalClicks: Number(analytics.total_clicks),
            activeLinks: Number(analytics.active_links)
        });

    } catch (error) {
        console.error("Analytics error:", error);

        res.status(500).json({
            error: "Failed to load analytics"
        });
    }
});

// GET /api/analytics/clicks
app.get("/api/analytics/clicks", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                TO_CHAR(DATE(clicked_at), 'YYYY-MM-DD') AS click_date,
                COUNT(*) AS clicks
             FROM url_clicks
             INNER JOIN urls
                ON url_clicks.url_id = urls.id
             WHERE urls.user_id = $1
               AND clicked_at >= CURRENT_DATE - INTERVAL '6 days'
             GROUP BY DATE(clicked_at)
             ORDER BY DATE(clicked_at) ASC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Click analytics error:", error);
        res.status(500).json({
            error: "Failed to load click analytics"
        });
    }
});

// GET /api/analytics/links
app.get("/api/analytics/links", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id,
                original_url,
                short_code,
                created_at,
                clicks
             FROM urls
             WHERE user_id = $1
             ORDER BY clicks DESC, created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error("Link analytics error:", error);

        res.status(500).json({
            error: "Failed to load link analytics"
        });
    }
});



app.get("/:shortCode", async (req, res) => {
    const { shortCode } = req.params;

    const client = await pool.connect();

    try {
        // Find the short URL
        const result = await client.query(
            `SELECT id, original_url
             FROM urls
             WHERE short_code = $1`,
            [shortCode]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Short URL not found"
            });
        }

        const url = result.rows[0];

        // Start transaction
        await client.query("BEGIN");

        // Increase click count
        await client.query(
            `UPDATE urls
             SET clicks = clicks + 1
             WHERE id = $1`,
            [url.id]
        );

        // Record click history
        await client.query(
            `INSERT INTO url_clicks (url_id)
             VALUES ($1)`,
            [url.id]
        );

        // Finish transaction
        await client.query("COMMIT");

        // Redirect
        res.redirect(url.original_url);

    } catch (error) {

        // Undo database changes if something fails
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback error:", rollbackError);
        }

        console.error("Redirect error:", error);

        res.status(500).json({
            error: "Failed to redirect"
        });

    } finally {
        // Return connection to the pool
        client.release();
    }
});

pool.query("SELECT NOW()", (error, result) => {
    if (error) {
        console.error("Database connection failed:", error);
    } else {
        console.log("Database connected successfully!");
        console.log("Database time:", result.rows[0].now);
    }
});



// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});