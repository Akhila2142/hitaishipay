const express = require('express');
const router = express.Router();
const db = require('../db'); // Ensure correct path to your db.js

// ✅ POST - Create a Job Posting
router.post('/createJob', (req, res) => {
    console.log("Received a POST request at /api/createJob", req.body);

    const {
        jobTitle, companyName, location, postedBy,
        experience, salary, workMode, education, description, workPay
    } = req.body;

    if (!jobTitle || !companyName || !location || !postedBy || !experience || !salary || !education || !description || !workPay) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = `
        INSERT INTO jobs (jobTitle, companyName, location, postedBy, experience, salary, workMode, education, description, workPay)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        jobTitle, companyName, location, postedBy, experience, salary,
        JSON.stringify(workMode), JSON.stringify(education),
        description, JSON.stringify(workPay)
    ], (err, result) => {
        if (err) {
            console.error('MySQL Error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        res.status(201).json({
            message: 'Job posted successfully',
            jobId: result.insertId,
            redirect: '/jobListings.html'
        });
    });
});

// ✅ GET - Fetch All Job Postings
router.get('/getJobs', (req, res) => {
    const sql = 'SELECT * FROM jobs';

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Parse JSON fields safely
        const jobs = results.map(job => ({
            ...job,
            workMode: job.workMode ? JSON.parse(job.workMode) : null,
            education: job.education ? JSON.parse(job.education) : null,
            workPay: job.workPay ? JSON.parse(job.workPay) : null
        }));

        res.json({ message: "Jobs fetched successfully", jobs });
    });
});

// ✅ PUT - Update a Job Posting
router.put('/updateJob/:id', (req, res) => {
    const { id } = req.params;
    console.log("Updating Job ID:", id); // Debugging log

    const {
        jobTitle, companyName, location, postedBy,
        experience, salary, workMode, education, description, workPay
    } = req.body;

    if (!jobTitle || !companyName || !location || !postedBy || !experience || !salary || !education || !description || !workPay) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = `
        UPDATE jobs 
        SET jobTitle = ?, companyName = ?, location = ?, postedBy = ?, experience = ?, salary = ?, workMode = ?, education = ?, description = ?, workPay = ? 
        WHERE id = ?
    `;

    db.query(sql, [
        jobTitle, companyName, location, postedBy, experience, salary,
        JSON.stringify(workMode), JSON.stringify(education),
        description, JSON.stringify(workPay), id
    ], (err, result) => {
        if (err) {
            console.error('MySQL Error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log("Update Result:", result); // Debugging log

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({ message: 'Job updated successfully' });
    });
});


// ✅ DELETE - Delete a Job Posting
router.delete('/deleteJob/:id', (req, res) => {
    const { id } = req.params;
    console.log("Deleting Job ID:", id); // Debugging log

    const sql = 'DELETE FROM jobs WHERE id = ?';

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('MySQL Error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log("Delete Result:", result); // Debugging log

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({ message: 'Job deleted successfully' });
    });
});


module.exports = router;



