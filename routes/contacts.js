const express = require("express");
const router = express.Router();
const db = require("../db");  // Make sure db.js exists and is correct

const nodemailer = require("nodemailer");


router.post("/contacts", (req, res) => {
    console.log("Received Data:", req.body);

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

        // Setup Nodemailer
        const transporter = nodemailer.createTransport({
            service: "gmail", // or your SMTP service
            auth: {
                user: "konukatiakhila12@gmail.com",
                pass: "ppwo jgat nvza nkmd"
            }
        });

        const mailOptions = {
            from: '"Hitaishi Pay Support" <your_email@gmail.com>',
            to: email,
            subject: "Thank You for Contacting Us!",
            html: `
                <p>Hi ${name},</p>
                <p>Thank you for reaching out to us. Our team will get back to you shortly.</p>
                <br>
                <p>Best regards,<br>Hitaishi Pay Team</p>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("❌ Email send failed:", error);
                return res.status(500).json({ error: "Message saved but failed to send email." });
            } else {
                console.log("✅ Email sent:", info.response);
                return res.status(200).json({ message: "✅ Thank you for contacting us. A confirmation email has been sent!" });
            }
        });
    });
});

module.exports = router;
