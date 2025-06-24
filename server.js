const express = require("express");
const cors = require("cors");

require("dotenv").config();

const app = express();
const session = require("express-session");

app.use(session({
    secret: "your_secret_key", // Replace with a strong secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// ✅ Enable CORS for all domains
app.use(cors());
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import Routes
const userRoutes = require("./routes/users");
const contactRoutes = require("./routes/contacts");
const registerRoutes = require("./routes/students");
const employerRoutes = require("./routes/employers");
const applyRoutes = require("./routes/apply");
const jobPostRoutes = require("./routes/jobPosts");
const employerloginRoutes = require("./routes/employers")
const enrollmentRoutes = require("./routes/enrollment");

app.post('/api/saveProfile', (req, res) => {
    const profileData = req.body;
    console.log("Received profile:", profileData);
    // TODO: Save to database
    res.json({ message: "Profile saved successfully" });
});



// Use Routes
app.use("/api", userRoutes);
app.use("/api", contactRoutes);
app.use("/api", registerRoutes);
app.use("/api", employerRoutes);
app.use("/api" , jobPostRoutes);
app.use("/api",employerloginRoutes);
app.use("/api", applyRoutes);
app.use("/api",enrollmentRoutes);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));