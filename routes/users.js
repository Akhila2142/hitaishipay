const express = require("express");
const router = express.Router();
const db = require("../db"); 

// Store mobile number in MySQL
router.post("/storeNumber", (req, res) => {
    const { mobile } = req.body;

    if (!mobile) {
        return res.status(400).json({ message: "Mobile number is required" });
    }

    const sql = "INSERT INTO users (mobile) VALUES (?) ON DUPLICATE KEY UPDATE mobile = VALUES(mobile)";
    db.query(sql, [mobile], (err, result) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ message: "Database error", error: err });
        }
        res.json({ message: "✅ Link sent successfully!" });
    });
});

module.exports = router; 