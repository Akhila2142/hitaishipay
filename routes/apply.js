const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');
const fs = require('fs'); // At the top if not already imported
const nodemailer = require('nodemailer');

// ✅ Create job_applications table if not exists
const createTableQuery = `
CREATE TABLE IF NOT EXISTS job_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT UNIQUE,
  full_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  dob DATE,
  gender VARCHAR(50),
  location VARCHAR(255),
  linkedin_url TEXT,
  naukri_url TEXT,
  portfolio_url TEXT,
  highest_education VARCHAR(100),
  education JSON,
  experience JSON,
  total_experience DECIMAL(5,2),
  cover_letter TEXT,
  resume_path VARCHAR(255),
  agree_terms BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

db.query(createTableQuery, (err) => {
  if (err) console.error("Error creating job_applications table:", err);
  else console.log("✅ job_applications table ready.");
});


// ✅ Ensure uploads folder exists
const uploadPath = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// ✅ Multer Storage with safe path
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`)
});

// ✅ Define 'upload' AFTER storage
const upload = multer({ storage });


// Your existing /apply route
router.post('/apply', upload.single('applicantResume'), (req, res) => {
  const {
    jobId,
    applicantName,
    applicantEmail,
    applicantPhone,
    applicantDOB,
    applicantGender,
    applicantLocation,
    applicantLinkedIn,
    applicantNaukri,
    applicantPortfolio,
    applicantHighestEducation,
    totalExperience,
    applicantCoverLetter,
    agreeTerms,
  } = req.body;

  console.log("Received data:", req.body);

  const education = JSON.stringify(req.body.institution ? formatEducation(req.body) : []);
  const experience = JSON.stringify(req.body.company ? formatExperience(req.body) : []);
  const resumePath = req.file ? req.file.filename : null;

  const insertQuery = `
    INSERT INTO job_applications
    (job_id, full_name, email, phone, dob, gender, location,
     linkedin_url, naukri_url, portfolio_url, highest_education,
     education, experience, total_experience, cover_letter, resume_path, agree_terms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(insertQuery, [
    jobId, applicantName, applicantEmail, applicantPhone, applicantDOB || null,
    applicantGender, applicantLocation, applicantLinkedIn, applicantNaukri, applicantPortfolio,
    applicantHighestEducation, education, experience, totalExperience || 0,
    applicantCoverLetter, resumePath, agreeTerms ? 1 : 0
  ], (err, result) => {
    if (err) {
      console.error("Insert Error:", err);
      return res.status(500).json({ message: 'Database error' });
    }

    // ✅ Send Confirmation Email
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or use your SMTP provider
      auth: {
        user: 'konukatiakhila12@gmail.com', // your email
        pass: 'ppwo jgat nvza nkmd'      // use App Password for Gmail
      }
    });

    const mailOptions = {
      from: '"Hitaishi Pay Careers" <your_email@gmail.com>',
      to: applicantEmail,
      subject: 'Application Received - Hitaishi Pay',
      html: `
        <p>Dear ${applicantName},</p>
        <p>Thank you for applying to the job (ID: ${jobId}) at Hitaishi Pay.</p>
        <p>We’ve successfully received your application and our team will review it shortly.</p>
        <br>
        <p><strong>Your Submitted Info:</strong></p>
        <ul>
          <li>Email: ${applicantEmail}</li>
          <li>Phone: ${applicantPhone}</li>
          <li>Location: ${applicantLocation}</li>
        </ul>
        <br>
        <p>Regards,<br>Hitaishi Pay Hiring Team</p>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("❌ Email Error:", error);
        return res.status(200).json({ message: 'Application submitted, but confirmation email failed.' });
      } else {
        console.log("✅ Confirmation email sent:", info.response);
        return res.status(200).json({ message: 'Application submitted successfully. Confirmation email sent.' });
      }
    });
  });
});


function formatEducation(data) {
  const institutions = Array.isArray(data.institution) ? data.institution : [data.institution];
  return institutions.map((_, i) => ({
    institution: data.institution[i],
    degree: data.degree[i],
    fieldOfStudy: data.fieldOfStudy[i],
    percentage: data.percentage[i],
    startYear: data.startYear[i],
    endYear: data.endYear[i]
  }));
}

function formatExperience(data) {
  const companies = Array.isArray(data.company) ? data.company : [data.company];
  return companies.map((_, i) => ({
    company: data.company[i],
    jobTitle: data.jobTitle[i],
    jobDescription: data.jobDescription[i],
    startDate: data.startDate[i],
    endDate: data.endDate[i]
  }));
}




module.exports = router;
