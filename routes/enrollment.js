// api/enrollment.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Assume you have a db.js with MySQL connection
const nodemailer = require('nodemailer');

// Create table if not exists
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS enrollment (
    id INT AUTO_INCREMENT PRIMARY KEY UNIQUE,
    courseName VARCHAR(255),
    trainingMode VARCHAR(50),
    duration VARCHAR(50),
    customDuration INT,
    requirements TEXT,
    firstName VARCHAR(100),
    lastName VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    education VARCHAR(255),
    location VARCHAR(100),
    preferredDays TEXT,
    timeSlot VARCHAR(50),
    customTime VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

db.query(createTableQuery, (err, result) => {
  if (err) console.error('Table creation failed:', err);
  else console.log('Enrollment table ready');
});



router.post('/submit-enrollment', (req, res) => {
  const {
    courseName, trainingMode, duration, customDuration, requirements,
    firstName, lastName, email, phone, education, location,
    preferredDays, timeSlot, customTime
  } = req.body;

  const query = `INSERT INTO enrollment (
    courseName, trainingMode, duration, customDuration, requirements,
    firstName, lastName, email, phone, education, location,
    preferredDays, timeSlot, customTime
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(query, [
    courseName, trainingMode, duration, customDuration || null, requirements,
    firstName, lastName, email, phone, education, location,
    preferredDays.join(','), timeSlot, customTime
  ], async (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Database error' });
    } else {
      // Send confirmation email
      try {
        let transporter = nodemailer.createTransport({
          service: 'Gmail', // or use 'hotmail', 'yahoo', or custom SMTP
          auth: {
            user: 'konukatiakhila12@gmail.com',       // replace with your email
            pass: 'ppwo jgat nvza nkmd'   // use app password (for Gmail)
          }
        });

        let mailOptions = {
          from: '"Hitaishi Pay" <konukatiakhila12@gmail.com>',
          to: email,
          subject: 'Enrollment Confirmation',
          html: `
            <h3>Hi ${firstName},</h3>
            <p>Thank you for enrolling in our <strong>${courseName}</strong> training program.</p>
            <p><strong>Mode:</strong> ${trainingMode}<br>
            <strong>Duration:</strong> ${duration}${customDuration ? ` (${customDuration} weeks)` : ''}<br>
            <strong>Preferred Days:</strong> ${preferredDays.join(', ')}<br>
            <strong>Time Slot:</strong> ${timeSlot}${customTime ? ` (${customTime})` : ''}</p>
            <p>We’ll contact you soon to finalize the schedule.</p>
            <br><p>Best Regards,<br><strong>Hitaishi Pay Team</strong></p>
          `
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Enrollment submitted and email sent!' });
      } catch (emailError) {
        console.error('Email error:', emailError);
        res.status(200).json({ message: 'Enrollment submitted, but failed to send email.' });
      }
    }
  });
});

module.exports = router;
