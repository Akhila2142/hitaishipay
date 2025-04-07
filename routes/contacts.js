const express = require("express");
const router = express.Router();
const db = require("../db");  // Make sure db.js exists and is correct

// API to store contact details
router.post("/contacts", (req, res) => {
    console.log("Received Data:", req.body); // ✅ Log received data

    const { email, name } = req.body;

    if (!email || !name) {
        return res.status(400).json({ error: "Email and Name are required!" });
    }

    const sql = "INSERT INTO contacts (email, name) VALUES (?, ?)";
    db.query(sql, [email, name], (err, result) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.status(200).json({ message: "✅ Contact stored successfully!" });
    });
});


module.exports = router;