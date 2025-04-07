const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const router = express.Router();
const nodemailer = require("nodemailer");
require("dotenv").config();

router.use(express.json());

// Generate a 6-digit unique ID with characters 0-9 and a-z
function generateUniqueId() {
    const characters = '0123456789abcdefghijklmnopqrstuvwxyz';
    let uniqueId = '';
    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        uniqueId += characters[randomIndex];
    }
    return uniqueId;
}

// Nodemailer setup
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 🚀 Register Student
router.post("/register", async (req, res) => {
    let { full_name, email, phone, password, receive_updates } = req.body;

    full_name = full_name?.trim();
    email = email?.trim();
    phone = phone?.trim();
    password = password?.trim();

    if (!full_name || !email || !phone || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const receiveUpdatesValue = receive_updates ? 1 : 0;

    const emailCheckSql = "SELECT * FROM students WHERE email = ?";
    db.query(emailCheckSql, [email], async (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database query error" });
        if (result.length > 0) return res.status(409).json({ success: false, message: "Email already registered" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const uniqueId = generateUniqueId();

        const insertSql = `
            INSERT INTO students (student_id, full_name, email, phone, password, receive_updates)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.query(insertSql, [uniqueId, full_name, email, phone, hashedPassword, receiveUpdatesValue], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: "Error registering student" });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Registration Successful - Hitaishi Pay",
                text: `Dear ${full_name},\n\nThank you for registering with Hitaishi Pay.\n\nBest regards,\nHitaishi Pay Team`
            };

            transporter.sendMail(mailOptions, (emailErr, info) => {
                if (emailErr) {
                    return res.status(500).json({ success: false, message: "Registration successful, but email failed" });
                }
                res.status(201).json({ success: true, message: "Registration successful. Email sent!", student_id: uniqueId });
            });
        });
    });
});

// 🚀 Login Student
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and Password are required" });
    }

    const sql = "SELECT * FROM students WHERE email = ?";
    db.query(sql, [email], async (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (result.length === 0) return res.status(401).json({ success: false, message: "Invalid email or password" });

        const student = result[0];
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) return res.status(401).json({ success: false, message: "Invalid email or password" });

        req.session.student = {
            student_id: student.student_id,
            full_name: student.full_name,
            email: student.email,
            phone: student.phone
        };

        res.status(200).json({
            success: true,
            message: "Login successful",
            student: req.session.student,
            redirect: "/student-profile"
        });
    });
});

// 🚀 Update Student Profile
router.put("/update-profile/:student_id", async (req, res) => {
    const studentId = req.params.student_id;
    let {
        full_name, email, phone, password, receive_updates,
        dateofbirth, address, ssc, intermediate, ug, pg,
        experience, profile, resume
    } = req.body;

    if (!full_name || !email || !phone) {
        return res.status(400).json({ success: false, message: "Full name, email, and phone are required" });
    }

    try {
        let hashedPassword = password ? await bcrypt.hash(password, 10) : password;

        if (typeof ssc === "object") ssc = JSON.stringify(ssc);
        if (typeof intermediate === "object") intermediate = JSON.stringify(intermediate);

        const updateSql = `
            UPDATE students
            SET full_name = ?, email = ?, phone = ?, password = ?, receive_updates = ?,
                dateofbirth = ?, address = ?, ssc = ?, intermediate = ?, ug = ?, pg = ?,
                experience = ?, profile = ?, resume = ?
            WHERE student_id = ?
        `;

        const values = [
            full_name, email, phone, hashedPassword, receive_updates || 0,
            dateofbirth, address, ssc, intermediate, ug, pg,
            experience, profile, resume, studentId
        ];

        db.query(updateSql, values, (err, result) => {
            if (err) return res.status(500).json({ success: false, message: "Error updating profile" });
            res.status(200).json({ success: true, message: "Profile updated successfully" });
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// 🚀 Get Student Profile
router.get("/student-profile", (req, res) => {
    if (!req.session || !req.session.student) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    res.status(200).json({ success: true, message: "Authenticated", student: req.session.student });
});

// 🚀 Logout Student
router.post("/logout-student", (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ success: false, message: "Logout failed" });
        res.status(200).json({ success: true, message: "Logout successful" });
    });
});

// 🚀 Delete Student
router.delete("/delete-student/:student_id", (req, res) => {
    const { student_id } = req.params;

    if (!student_id) {
        return res.status(400).json({ success: false, message: "Student ID is required" });
    }

    const sql = "DELETE FROM students WHERE student_id = ?";
    db.query(sql, [student_id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Internal server error" });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Student not found" });

        res.json({ success: true, message: "Student deleted successfully" });
    });
});

module.exports = router;