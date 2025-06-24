const express = require('express');
const router = express.Router();
const db = require('../db'); // Ensure correct path to your db.js
const app = express();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
// ...existing code...
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // must be before your routes

//api to search jobs,the index page searching by job title, country, state, city 
router.get('/api/jobs', (req, res) => {
  const { jobTitle, country, state, city } = req.query;

  let query = `SELECT * FROM jobs WHERE 1=1`;
  const params = [];

  if (jobTitle) {
    const term = `%${jobTitle}%`;
    query += ` AND (jobTitle LIKE ? OR companyName LIKE ? OR postedBy LIKE ?)`;
    params.push(term, term, term);
  }

  if (country) {
    query += ` AND country = ?`;
    params.push(country);
  }

  if (state) {
    query += ` AND state = ?`;
    params.push(state);
  }

  if (city) {
    query += ` AND city = ?`;
    params.push(city);
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ jobs: results });
  });
});


// ✅ POST - Create a Job Posting
router.post('/createJob', (req, res) => {
    console.log("Received a POST request at /api/createJob");

    // Destructure data from the request body
    const {
        jobTitle,
        companyName,
        country,
        state,
        city,
        postedBy,
        jobType,
        experience,
        salary,
        workMode,
        education,
        description,
        workPay,
        salaryDetails
    } = req.body;

    // Validate required fields
    if (
        !jobTitle || !companyName || !city || !postedBy || !country || !state ||
        !experience || !salary || !workMode || !education ||
        !description || !workPay || !jobType
    ) {
        return res.status(400).json({ 
            error: 'Missing required fields',
            missingFields: {
                jobTitle: !jobTitle,
                companyName: !companyName,
                city: !city,
                postedBy: !postedBy,
                country: !country,
                state: !state,
                experience: !experience,
                salary: !salary,
                workMode: !workMode,
                education: !education,
                description: !description,
                workPay: !workPay,
                jobType: !jobType
            }
        });
    }

    // Format the salary for database storage
    const formattedSalary = typeof salary === 'string' ? salary : 
        `${workPay.amount || salary} ${salaryDetails?.[0]?.duration ? 'per ' + salaryDetails[0].duration : ''}`;

    // SQL Query - using only existing columns
    const sql = `
        INSERT INTO jobs (
            jobTitle, companyName, country, state, city, postedBy,
            experience, salary, workMode, education,
            description, workPay, jobType
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Execute query
    try {
        db.query(sql, [
            jobTitle,
            companyName,
            country,
            state,
            city,
            postedBy,            
            experience,
            formattedSalary,
            JSON.stringify(workMode),
            JSON.stringify(education),
            description,
            JSON.stringify(workPay),
            JSON.stringify(jobType)
        ], (err, result) => {
            if (err) {
                console.error('MySQL Error:', err);
                return res.status(500).json({
                    error: 'Database insert failed',
                    details: err.sqlMessage,
                    sql: err.sql
                });
            }

            // Successful response
            res.status(201).json({
                message: 'Job posted successfully',
                jobId: result.insertId,
                redirect: 'index.html',
                jobData: {
                    jobTitle,
                    companyName,
                    location: { country, state, city },
                    postedBy,
                    experience,
                    salary: formattedSalary,
                    jobType,
                    workMode,
                    education
                }
            });
        });
    } catch (e) {
        console.error('Unexpected Error:', e);
        res.status(500).json({ 
            error: 'Unexpected error occurred',
            details: e.message,
            stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
        });
    }
});

//search bar in every page
router.get('/jobs', (req, res) => {
  const keyword = req.query.keyword?.trim().toLowerCase();

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  const searchTerm = `%${keyword}%`;

  const sqlQuery = `
    SELECT * FROM jobs
    WHERE LOWER(jobTitle) LIKE ?
       OR LOWER(description) LIKE ?
       OR LOWER(companyName) LIKE ?
       OR LOWER(experience) LIKE ?
       OR LOWER(JSON_UNQUOTE(workMode)) LIKE ?
       OR LOWER(JSON_UNQUOTE(education)) LIKE ?
       OR LOWER(city) LIKE ?
       OR LOWER(state) LIKE ?
       OR LOWER(country) LIKE ?
  `;

  const values = [
    searchTerm, // jobTitle
    searchTerm, // description
    searchTerm, // companyName
    searchTerm, // experience
    searchTerm, // workMode (JSON)
    searchTerm, // education (JSON)
    searchTerm, // city
    searchTerm, // state
    searchTerm  // country
  ];

  db.query(sqlQuery, values, (error, results) => {
    if (error) {
      console.error("Database error:", error);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(results);
  });
});


  
// ✅ GET - Fetch All Job Postings

// router.get('/getJobs', (req, res) => {
//     const sql = 'SELECT * FROM jobs';

//     db.query(sql, (err, results) => {
//         if (err) {
//             console.error('MySQL query error:', err);
//             return res.status(500).json({ error: 'Internal server error' });
//         }

//         // Parse JSON fields safely
//         const jobs = results.map(job => ({
//             ...job,
//             workMode: job.workMode ? JSON.parse(job.workMode) : null,
//             education: job.education ? JSON.parse(job.education) : null,
//             workPay: job.workPay ? JSON.parse(job.workPay) : null
//         }));

//         res.json({ message: "Jobs fetched successfully", jobs });
//     });
// });

router.get('/getJobs', (req, res) => {
    const { jobTitle, skills, company, country, state, city, exactMatch } = req.query;
    console.log("Search parameters:", req.query); // Debugging log
    
    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    
    // Helper function to add conditions based on exactMatch
    const addCondition = (field, value) => {
        if (exactMatch === 'true') {
            sql += ` AND ${field} = ?`;
            params.push(value);
        } else {
            sql += ` AND ${field} LIKE ?`;
            params.push(`%${value}%`);
        }
    };

    if (jobTitle) {
        addCondition('jobTitle', jobTitle);
    }
    if (skills) {
        addCondition('skills', skills);
    }
    if (company) {
        addCondition('companyName', company);
    }
    if (country) {
        addCondition('country', country);
    }
    if (state) {
        addCondition('state', state);
    }
    if (city) {
        addCondition('city', city);
    }

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Parse JSON fields safely
        const jobs = results.map(job => {
            try {
                return {
                    ...job,
                    workMode: job.workMode ? JSON.parse(job.workMode) : null,
                    education: job.education ? JSON.parse(job.education) : null,
                    workPay: job.workPay ? JSON.parse(job.workPay) : null
                };
            } catch (e) {
                console.error('Error parsing JSON fields:', e);
                return job; // Return unparsed job if error occurs
            }
        });

        res.json({ message: "Jobs fetched successfully", jobs });
    });
});

// router.get('/jobs', (req, res) => {
//     const { jobTitle, country, city } = req.query;

//     let query = 'SELECT * FROM jobs WHERE 1=1';
//     const values = [];

//     if (jobTitle) {
//         query += ' AND jobTitle LIKE ?';
//         values.push(`%${jobTitle}%`);
//     }

//     if (country) {
//         query += ' AND country = ?';
//         values.push(country);
//     }

//     if (city) {
//         query += ' AND city = ?';
//         values.push(city);
//     }

//     db.query(query, values, (err, results) => {
//         if (err) {
//             console.error('Database error:', err);
//             return res.status(500).json({ success: false, message: 'Server error' });
//         }

//         if (results.length === 0) {
//             return res.status(404).json({ success: false, message: 'No matching jobs found' });
//         }

//         res.status(200).json({ success: true, jobs: results });
//     });
// });

// router.get('/jobs', (req, res) => {
//     const { jobTitle, country, state, city } = req.query;

//     let query = 'SELECT * FROM jobs WHERE 1=1';
//     const values = [];

//     if (jobTitle) {
//         query += ' AND jobTitle LIKE ?';
//         values.push(`%${jobTitle}%`);
//     }

//     if (country) {
//         query += ' AND country = ?';
//         values.push(country);
//     }

//     if (state) {
//         query += ' AND state = ?';
//         values.push(state);
//     }

//     if (city) {
//         query += ' AND city = ?';
//         values.push(city);
//     }

//     db.query(query, values, (err, results) => {
//         if (err) {
//             console.error('Database error:', err);
//             return res.status(500).json({ success: false, message: 'Server error' });
//         }

//         res.status(200).json({ success: true, jobs: results });
//     });
// });

router.get('/getJobs/HourlyPay', (req, res) => {
    const sql = "SELECT * FROM jobs WHERE JSON_CONTAINS(jobType, JSON_ARRAY('HourlyPay'))";

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched jobs:', results);  // Check if results are coming back
       
        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "HourlyPay jobs fetched successfully", jobs });
    });
});

//get fetch jobs by jobtype (wfh)
router.get('/getJobs/WFH', (req, res) => {
    const sql = "SELECT * FROM jobs WHERE JSON_CONTAINS(jobType, JSON_ARRAY('WFH'))";

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched WFH jobs:', results);  // Log for debugging

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "WFH jobs fetched successfully", jobs });
    });
});


// Utility to parse JSON safely
function safeParse(data) {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

//get fetch jobs by jobtype (secondjob)
router.get('/getJobs/SecondaryJobs', (req, res) => {
    const sql = "SELECT * FROM jobs WHERE JSON_CONTAINS(jobType, JSON_ARRAY('SecondaryJobs'))";

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched SecondaryJobs:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "SecondaryJobs fetched successfully", jobs });
    });
});

router.get('/getJobs/PartTime', (req, res) => {
    const sql = `
        SELECT * FROM jobs 
        WHERE 
            (
                JSON_VALID(jobType) = 1 AND 
                (
                    JSON_CONTAINS(jobType, '"PartTime"', '$') = 1 OR
                    JSON_SEARCH(jobType, 'one', 'PartTime') IS NOT NULL
                )
            )
            OR LOWER(CAST(jobType AS CHAR)) LIKE '%parttime%'
    `;

    console.log('Executing SQL:', sql);

    db.query(sql, async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
                error: 'Database error',
                details: process.env.NODE_ENV === 'development' ? err.message : null
            });
        }

        if (results.length === 0) {
            const diagnostics = await getJobTypeDiagnostics();
            return res.status(404).json({
                message: "No PartTime jobs found",
                diagnostics: diagnostics
            });
        }

        res.status(200).json({
            message: "PartTime jobs fetched successfully",
            count: results.length,
            jobs: results
        });
    });
});


// async function getJobTypeDiagnostics() {
//     return new Promise((resolve) => {
//         db.query(`
//             SELECT
//                 COUNT(*) as total_jobs,
//                 SUM(IF(JSON_CONTAINS(jobType, '"PartTime"', '$'), 1, 0)) as exact_match,
//                 SUM(IF(JSON_CONTAINS(jobType, '["PartTime"]', '$'), 1, 0)) as array_match,
//                 SUM(IF(LOWER(CAST(jobType AS CHAR)) LIKE '%parttime%', 1, 0)) as text_match,
//                 SUM(IF(JSON_TYPE(jobType) IS NULL, 1, 0)) as null_values,
//                 SUM(IF(JSON_VALID(jobType) = 0, 1, 0)) as invalid_json
//             FROM jobs
//         `, (err, stats) => {
//             if (err) return resolve({ error: err.message });

//             db.query(`
//                 SELECT DISTINCT 
//                     JSON_TYPE(jobType) as json_type,
//                     COUNT(*) as count
//                 FROM jobs
//                 GROUP BY JSON_TYPE(jobType)
//             `, (err, types) => {
//                 resolve({
//                     stats: stats[0],
//                     type_distribution: types,
//                     suggestions: getSuggestions(stats[0])
//                 });
//             });
//         });
//     });
// }


// function getSuggestions(stats) {
//     const suggestions = [];

//     if (stats.text_match > 0 && stats.exact_match === 0) {
//         suggestions.push("Job types are stored as plain text. Consider normalizing them to JSON arrays using: UPDATE jobs SET jobType = JSON_ARRAY('PartTime') WHERE LOWER(jobType) LIKE '%parttime%';");
//     }

//     if (stats.invalid_json > 0) {
//         suggestions.push("Some records have invalid JSON. Check using: SELECT id, jobType FROM jobs WHERE JSON_VALID(jobType) = 0;");
//     }

//     if (stats.null_values > 0) {
//         suggestions.push(`${stats.null_values} job records have NULL jobType values. Consider reviewing or updating them.`);
//     }

//     return suggestions.length ? suggestions : ["No obvious issues found - verify data contains 'PartTime' values"];
// }

//get fetch jobs by jobType (Projects)
router.get('/getJobs/Projects', (req, res) => {
    const sql = "SELECT * FROM jobs WHERE JSON_CONTAINS(jobType, JSON_ARRAY('Projects'))";

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched Projects jobs:', results);  // Log for debugging

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Projects jobs fetched successfully", jobs });
    });
});
//get fetch jobs for jobType as Training
router.get('/getJobs/Training', (req, res) => {
    const sql = "SELECT * FROM jobs WHERE JSON_CONTAINS(jobType, JSON_ARRAY('Training'))";

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched Training jobs:', results);  // Log for debugging

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Training jobs fetched successfully", jobs });
    });
});
//get fetch jobs for jobType as TechnicalSupport
router.get('/getJobs/TechnicalSupport', (req, res) => {
    const sql = "SELECT * FROM jobs WHERE JSON_CONTAINS(jobType, JSON_ARRAY('TechnicalSupport'))";

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched TechnicalSupport jobs:', results);  // Log for debugging

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "TechnicalSupport jobs fetched successfully", jobs });
    });
});
//get fetch jobs for jobType as FresherJobs
router.get('/getJobs/FreshersJobs', (req, res) => {
    const sql = "SELECT * FROM jobs WHERE JSON_CONTAINS(jobType, JSON_ARRAY('FreshersJobs'))";

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched FresherJobs:', results);  // Log for debugging

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "FresherJobs fetched successfully", jobs });
    });
});
router.get('/getJobs/Senior', (req, res) => {
    const sql = "SELECT * FROM jobs WHERE CAST(experience AS UNSIGNED) > 2";

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched jobs with experience > 2:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Jobs with experience > 2 fetched successfully", jobs });
    });
});
//if experienece is less than 2
router.get('/getJobs/MidLevel', (req, res) => {
    const sql = `
        SELECT * FROM jobs 
        WHERE CAST(experience AS UNSIGNED) >= 1 
          AND CAST(experience AS UNSIGNED) <= 2
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched jobs with experience between 1 and 2:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Jobs with experience between 1 and 2 fetched successfully", jobs });
    });
});
//if experienece is frehser
router.get('/getJobs/Fresher', (req, res) => {
    const sql = `
        SELECT * FROM jobs 
        WHERE CAST(experience AS UNSIGNED) = 0
    `;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Fresher jobs fetched", jobs });
    });
});

//if location is hyderabad
router.get('/getJobs/State/Hyderabad', (req, res) => {
    const sql = `
        SELECT * FROM jobs 
        WHERE state = 'Hyderabad'
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched jobs with state = Hyderabad:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Jobs in Hyderabad fetched successfully", jobs });
    });
});
//if location is noida
router.get('/getJobs/State/Noida', (req, res) => {
    const sql = `SELECT * FROM jobs WHERE state = 'Noida'`;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Jobs in Noida fetched successfully", jobs });
    });
});
//if location is bangalore
router.get('/getJobs/State/Bangalore', (req, res) => {
    const sql = `SELECT * FROM jobs WHERE state = 'Bangalore'`;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Jobs in Bangalore fetched successfully", jobs });
    });
});
//if location is chennai
router.get('/getJobs/State/Chennai', (req, res) => {
    const sql = `SELECT * FROM jobs WHERE state = 'Chennai'`;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Jobs in Chennai fetched successfully", jobs });
    });
});
//if location is pune
router.get('/getJobs/State/Pune', (req, res) => {
    const sql = `SELECT * FROM jobs WHERE state = 'Pune'`;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Jobs in Pune fetched successfully", jobs });
    });
});
//if location is andhrapradesh
router.get('/getJobs/State/AndhraPradesh', (req, res) => {
    const sql = `SELECT * FROM jobs WHERE state = 'Andhra Pradesh'`;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Internal server error' });

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Jobs in Andhra Pradesh fetched successfully", jobs });
    });
});
//if workmode is remote
router.get('/getJobs/WorkMode/Remote', (req, res) => {
    const sql = `
        SELECT * FROM jobs 
        WHERE JSON_CONTAINS(workMode, JSON_ARRAY('Remote'))
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched Remote workMode jobs:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Remote jobs fetched successfully", jobs });
    });
});
//if workmode is hybrid
router.get('/getJobs/WorkMode/Hybrid', (req, res) => {
    const sql = `
        SELECT * FROM jobs 
        WHERE JSON_CONTAINS(workMode, JSON_ARRAY('Hybrid'))
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched Hybrid workMode jobs:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Hybrid jobs fetched successfully", jobs });
    });
});
//if workmode is onsite
router.get('/getJobs/WorkMode/Onsite', (req, res) => {
    const sql = `
        SELECT * FROM jobs 
        WHERE JSON_CONTAINS(workMode, JSON_ARRAY('Onsite'))
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched Onsite workMode jobs:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Onsite jobs fetched successfully", jobs });
    });
});
//if education is Btech
router.get('/getJobs/Education/BtechVariants', (req, res) => {
    const sql = `
        SELECT * FROM jobs 
        WHERE 
            JSON_CONTAINS(education, JSON_ARRAY('Btech'))
            OR JSON_CONTAINS(education, JSON_ARRAY('btech'))
            OR JSON_CONTAINS(education, JSON_ARRAY('BTECH'))
            OR JSON_CONTAINS(education, JSON_ARRAY('BTech'))
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched jobs with education Btech/btech/BTECH/BTech:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Jobs with education Btech/btech/BTECH/BTech fetched successfully", jobs });
    });
});
//if education is degree
router.get('/getJobs/Education/DegreeVariants', (req, res) => {
    const sql = `
        SELECT * FROM jobs 
        WHERE 
            JSON_CONTAINS(education, JSON_ARRAY('Degree'))
            OR JSON_CONTAINS(education, JSON_ARRAY('degree'))
            OR JSON_CONTAINS(education, JSON_ARRAY('DEGREE'))
            OR JSON_CONTAINS(education, JSON_ARRAY('DEGree'))
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched jobs with education Degree/degree/DEGREE/DEGree:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Jobs with education Degree/degree/DEGREE/DEGree fetched successfully", jobs });
    });
});
//if the education is pg
router.get('/getJobs/Education/PGVariants', (req, res) => {
    const sql = `
        SELECT * FROM jobs 
        WHERE 
            JSON_CONTAINS(education, JSON_ARRAY('PG'))
            OR JSON_CONTAINS(education, JSON_ARRAY('pg'))
            OR JSON_CONTAINS(education, JSON_ARRAY('Post Graduate'))
            OR JSON_CONTAINS(education, JSON_ARRAY('post graduate'))
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched jobs with education PG/pg/Post Graduate/post graduate:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            workPay: safeParse(job.workPay)
        }));

        res.status(200).json({ message: "Jobs with education PG/pg/Post Graduate/post graduate fetched successfully", jobs });
    });
});
//if the salary ranges in between in this 
router.get('/getJobs/Salary/Range', (req, res) => {
    const sql = `
        SELECT * FROM jobs
        WHERE 
            salary >= 0 AND salary <= 3.75
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched jobs with salary range 0-3.75 LPA:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            salary: safeParse(job.salary)
        }));

        res.status(200).json({ message: "Jobs with salary range 0-3.75 LPA fetched successfully", jobs });
    });
});
//if the salary is in the range of 3.75-7.5
router.get('/getJobs/Salary/Range', (req, res) => {
    const sql = `
        SELECT * FROM jobs
        WHERE 
            salary >= 3.5 AND salary <= 7
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched jobs with salary range 3.5-7 LPA:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            salary: safeParse(job.salary)
        }));

        res.status(200).json({ message: "Jobs with salary range 3.5-7 LPA fetched successfully", jobs });
    });
});
//if the salary is in the range of 7.5-10
router.get('/getJobs/Salary/Range', (req, res) => {
    const sql = `
        SELECT * FROM jobs
        WHERE 
            salary >= 7 AND salary <= 10
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched jobs with salary range 7-10 LPA:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            salary: safeParse(job.salary)
        }));

        res.status(200).json({ message: "Jobs with salary range 7-10 LPA fetched successfully", jobs });
    });
});
//if the salary is in the range of 10 and above
router.get('/getJobs/Salary/Range', (req, res) => {
    const sql = `
        SELECT * FROM jobs
        WHERE 
            salary >= 10
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err.sqlMessage || err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        console.log('Fetched jobs with salary range 10 LPA and above:', results);  // Debug log

        const jobs = results.map(job => ({
            ...job,
            jobType: safeParse(job.jobType),
            workMode: safeParse(job.workMode),
            education: safeParse(job.education),
            salary: safeParse(job.salary)
        }));

        res.status(200).json({ message: "Jobs with salary range 10 LPA and above fetched successfully", jobs });
    });
});



//index page filtering
router.get("/filters", (req, res) => {
    const filters = {
        experience: [],
        state: [],
        workMode: [],
        education: []
    };

    // Step 1: Fetch experience
    db.query("SELECT DISTINCT experience FROM jobs", (err, results) => {
        if (err) return res.status(500).json({ error: "Error fetching experience" });
        filters.experience = results.map(row => row.experience);

        // Step 2: Fetch location
        db.query("SELECT DISTINCT state FROM jobs", (err, results) => {
            if (err) return res.status(500).json({ error: "Error fetching locations" });
            filters.location = results.map(row => row.state);

            // Step 3: Fetch work modes
            db.query("SELECT DISTINCT workMode FROM jobs", (err, results) => {
                if (err) return res.status(500).json({ error: "Error fetching work modes" });
                filters.workmode = results.map(row => row.workMode);

                // Step 4: Fetch education
                db.query("SELECT DISTINCT education FROM jobs", (err, results) => {
                    if (err) return res.status(500).json({ error: "Error fetching education" });
                    filters.education = results.map(row => row.education);

                    // Final response
                    res.json(filters);
                });
            });
        });
    });
});

function safeParse(data) {
    try {
        return JSON.parse(data || '[]');
    } catch (e) {
        console.warn('Invalid JSON:', data);
        return [];
    }
}
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
// get fetch jobs by jobtitle (skills,company,job title),skills,country,state,city
router.get('/getJobssearch?jobType=Developer&exactMatch=true', (req, res) => {
    const { jobType, skills, company, country, state, city } = req.query;
    console.log("Search parameters:", req.query); // Debugging log
    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    if (jobTitle) {
        sql += ' AND jobTitle LIKE ?';
        params.push(`%${jobTitle}%`);
    }
    if (skills) {
        sql += ' AND skills LIKE ?';
        params.push(`%${skills}%`);
    }
    if (company) {
        sql += ' AND companyName LIKE ?';
        params.push(`%${company}%`);
    }
    if (country) {
        sql += ' AND country LIKE ?';
        params.push(`%${country}%`);
    }
    if (state) {
        sql += ' AND state LIKE ?';
        params.push(`%${state}%`);
    }
    if (city) {
        sql += ' AND city LIKE ?';
        params.push(`%${city}%`);
    }
    db.query(sql, params, (err, results) => {
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


router.get('/getJobssearch', (req, res) => {
    const { jobType, skills, company, country, state, city, exactMatch } = req.query;
    console.log("Search parameters:", req.query);

    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];

    if (jobType) {
        if (exactMatch === 'true') {
            sql += ' AND jobTitle = ?';
            params.push(jobType);
        } else {
            sql += ' AND jobTitle LIKE ?';
            params.push(`%${jobType}%`);
        }
    }

    if (skills) {
        sql += ' AND skills LIKE ?';
        params.push(`%${skills}%`);
    }

    if (company) {
        sql += ' AND companyName LIKE ?';
        params.push(`%${company}%`);
    }

    if (country) {
        sql += ' AND country LIKE ?';
        params.push(`%${country}%`);
    }

    if (state) {
        sql += ' AND state LIKE ?';
        params.push(`%${state}%`);
    }

    if (city) {
        sql += ' AND city LIKE ?';
        params.push(`%${city}%`);
    }

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('MySQL query error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        const jobs = results.map(job => ({
            ...job,
            workMode: job.workMode ? JSON.parse(job.workMode) : null,
            education: job.education ? JSON.parse(job.education) : null,
            workPay: job.workPay ? JSON.parse(job.workPay) : null
        }));

        res.json({ message: "Jobs fetched successfully", jobs });
    });
});



module.exports = router;