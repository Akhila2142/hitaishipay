const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET; // Your JWT secret key

// Middleware to authenticate the JWT token
function authenticateToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1]; // Extract token from the "Authorization" header

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  // Verify the token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    // Attach decoded user information to request object for use in further route handling
    req.user = decoded;
    next(); // Allow the request to proceed to the next middleware/route handler
  });
}

module.exports = authenticateToken;
