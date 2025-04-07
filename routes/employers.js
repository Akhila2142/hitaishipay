const express = require("express");
const db = require("../db"); // Database connection
const router = express.Router();
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs"); // Password hashing
require("dotenv").config();

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
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
});
router.put("/update-employer/:id", async (req, res) => {
    const employerId = req.params.id;

    let {
        company_name,
        employer_name,
        email,
        phone,
        password,
        created_at,
        profileimage,
        username,
        industry,
        location,
        designation,
        experience,
        companytype,
        summary,
        aboutus
    } = req.body;

    if (!company_name || !employer_name || !email || !phone) {
        return res.status(400).json({ success: false, message: "company_name, employer_name, email, and phone are required" });
    }

    try {
        let hashedPassword = password;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const updateSql = `
            UPDATE employers
            SET company_name = ?, employer_name = ?, email = ?, phone = ?, password = ?, 
                created_at = ?, profileimage = ?, username = ?, industry = ?, location = ?, 
                designation = ?, experience = ?, companytype = ?, summary = ?, aboutus = ?
            WHERE id = ?
        `;

        const values = [
            company_name, employer_name, email, phone, hashedPassword,
            created_at, profileimage, username, industry, location,
            designation, experience, companytype, summary, aboutus, employerId
        ];

        db.query(updateSql, values, (err, result) => {
            if (err) {
                console.error("❌ SQL Error:", err.sqlMessage);
                return res.status(500).json({ success: false, message: "Error updating employer profile" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Employer not found" });
            }

            res.status(200).json({ success: true, message: "Employer profile updated successfully" });
        });

    } catch (err) {
        console.error("❌ Server Error:", err.message);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

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
router.get("/employer-profile/:id", (req, res) => {
    const employerId = req.params.id;

    const sql = `
        SELECT 
            username AS userName,
            employer_name AS employerName,
            password,
            employer_name AS name,
            company_name AS companyName,
            industry,
            location,
            designation,
            experience,
            companytype AS companyType,
            summary,
            aboutus AS aboutUs,
            email,
            phone
        FROM employers
        WHERE id = ?
    `;

    db.query(sql, [employerId], (err, results) => {
        if (err) {
            console.error("❌ SQL Error:", err.message);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "Employer not found" });
        }

        return res.status(200).json({ success: true, profile: results[0] });
    });
});

router.get("/profile", (req, res) => {
    console.log("Checking authentication...");

    if (!req.session || !req.session.user) {
        console.error("❌ User is not authenticated");
        return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    console.log("✅ User authenticated:", req.session.user);
    res.status(200).json({ success: true, message: "Authenticated", user: req.session.user });
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
