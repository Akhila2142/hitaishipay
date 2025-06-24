const express = require("express");
const db = require("../db"); // Database connection
const router = express.Router();
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs"); // Password hashing
require("dotenv").config();

const authenticateToken = require("./authenticateToken");
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// LOGIN
const jwt = require("jsonwebtoken"); // Add this line to import the jwt module
const JWT_SECRET = process.env.JWT_SECRET;

router.post("/login-employer", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const sql = "SELECT * FROM employers WHERE email = ?";
    db.query(sql, [email], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (result.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const user = result[0];

        // Simple password check (if not hashed)
        if (password !== user.password) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        // ✅ Create the payload
        const payload = { id: user.id, email: user.email };

        // ✅ Generate JWT token
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });

        // ✅ Send token and user info
        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            formatted_id: user.formatted_id,
            user: {
                id: user.id,
                company_name: user.company_name,
                employer_name: user.employer_name,
                email: user.email
            }
        });
    });
});

router.put("/update-profile", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const {
        employer_name,
        company_name,
        phone,
        email,
        password,
        industry,
        location,
        designation
    } = req.body;

    if (!employer_name || !company_name || !phone || !email) {
        return res.status(400).json({
            success: false,
            message: "Employer name, company name, phone, and email are required."
        });
    }

    try {
        let sql = `
            UPDATE employers SET 
                employer_name = ?, 
                company_name = ?, 
                phone = ?, 
                email = ?, 
        `;

        const values = [employer_name, company_name, phone, email];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            sql += "password = ?, ";
            values.push(hashedPassword);
        }

        sql += `
                industry = ?, 
                location = ?, 
                designation = ? 
            WHERE id = ?
        `;

        values.push(industry, location, designation, userId);

        const [result] = await db.execute(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Employer not found" });
        }

        res.status(200).json({
            success: true,
            message: "Profile updated successfully"
        });
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// A protected route that requires the user to be authenticated
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // The user information is attached to the request object

    const [user] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user: user[0] }); // Send the user data back
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Profile Update Route
router.put("/api/saveProfile", authenticateToken, async (req, res) => {
    const employerFormattedId = req.body.formatted_id; // Get the formatted_id from the request body
    const {
        username, employer_name, password, company_name,
        industry, location, designation, experience,
        companytype, summary, aboutus, email, phone
    } = req.body;

    if (!employerFormattedId || !employer_name || !company_name || !email || !phone) {
        return res.status(400).json({
            success: false,
            message: "formatted_id, employer_name, company_name, email, and phone are required"
        });
    }

    try {
        // Check if new email is already used by another account with the same formatted_id
        const [existing] = await db.execute(
            "SELECT id FROM employers WHERE email = ? AND formatted_id != ?",
            [email, employerFormattedId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "Email already in use" });
        }

        // Hash password if updated
        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        // SQL query for updating the profile
        const sql = `
            UPDATE employers SET 
                username = ?, employer_name = ?, 
                ${hashedPassword ? "password = ?," : ""} 
                company_name = ?, industry = ?, location = ?, 
                designation = ?, experience = ?, companytype = ?, 
                summary = ?, aboutus = ?, email = ?, phone = ? 
            WHERE formatted_id = ?
        `;

        const values = [
            username, employer_name,
            ...(hashedPassword ? [hashedPassword] : []),
            company_name, industry, location,
            designation, parseInt(experience) || 0, companytype,
            summary, aboutus, email, phone,
            employerFormattedId  // Use the formatted_id to locate the record
        ];

        const [result] = await db.execute(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Employer not found" });
        }

        res.status(200).json({ success: true, message: "Profile updated successfully" });

    } catch (err) {
        console.error("❌ Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 🚀 *Register Employer*
router.post("/register-employer", async (req, res) => {
    console.log("Route hit!");
    console.log("Request body:", req.body);
    
    const { company_name, employer_name, email, phone, password } = req.body;

    if (!company_name || !employer_name || !email || !phone || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // Check if email already exists
    const emailCheckSql = "SELECT * FROM employers WHERE email = ?";
    db.query(emailCheckSql, [email], async (emailCheckErr, emailCheckResult) => {
        if (emailCheckErr) {
            console.error("❌ SQL Error:", emailCheckErr.sqlMessage);
            return res.status(500).json({ success: false, message: "Database query error" });
        }

        if (emailCheckResult.length > 0) {
            return res.status(409).json({ success: false, message: "Email address already registered" });
        }

        // Store password as plain text (⚠ **NOT SECURE**)
        const sql = "INSERT INTO employers (company_name, employer_name, email, phone, password) VALUES (?, ?, ?, ?, ?)";
        db.query(sql, [company_name, employer_name, email, phone, password], (err, result) => {
            if (err) {
                console.error("Database Error:", err);
                return res.status(500).json({ success: false, message: "Error registering employer" });
            }

            res.status(201).json({ success: true, message: "Registration successful" });
        });
    });
})

// 🚀 *Login Employer*
router.post("/login-employer", (req, res) => {
    console.log("Login Route hit!");
    console.log("Request body:", req.body);

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and Password are required" });
    }

    const sql = "SELECT * FROM employers WHERE email = ?";
    db.query(sql, [email], (err, result) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (result.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const user = result[0];

        // Compare password as plain text (⚠ **NOT SECURE**)
        if (password !== user.password) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        if (!req.session) {
            return res.status(500).json({ success: false, message: "Session not initialized" });
        }

        // Set session data
        req.session.user = {
            id: user.id,
            company_name: user.company_name,
            employer_name: user.employer_name,
            email: user.email
        };

        res.status(200).json({
            success: true,
            message: "Login successful",
            user: req.session.user,
            redirect: "/profile"
        });
    });
});

// 🚀 **Logout Employer**
router.post("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: "Logout failed" });
        }
        res.status(200).json({ success: true, message: "Logout successful" });
    });
});

router.delete("/delete-employer/:id", (req, res) => {
    const employerId = req.params.id;

    if (!employerId) {
        return res.status(400).json({ success: false, message: "Employer ID is required" });
    }

    const deleteSql = "DELETE FROM employers WHERE id = ?";

    db.query(deleteSql, [employerId], (err, result) => {
        if (err) {
            console.error("❌ SQL Error:", err.sqlMessage);
            return res.status(500).json({ success: false, message: "Database error while deleting employer" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Employer not found" });
        }

        res.status(200).json({ success: true, message: "Employer deleted successfully" });
    });
});

module.exports = router;
