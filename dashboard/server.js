const express = require("express");
const crypto = require("crypto");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const path = require("path");
const { pool } = require("./db");
const authRoutes = require("./routes/auth");
const pageRoutes = require("./routes/pages");
const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Sessions
app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? (() => { throw new Error("SESSION_SECRET is required in production"); })() : "xpholder-dev-secret"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// Body parsing (needed before CSRF check)
app.use(express.urlencoded({ extended: false }));

// CSRF protection
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (req.method === "POST") {
    const token = req.body?._csrf || req.headers["x-csrf-token"];
    if (token !== req.session.csrfToken) {
      return res.status(403).render("error", { message: "Invalid or missing CSRF token." });
    }
  }
  next();
});

// Make user and helpers available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.guildId = req.session.guildId || null;
  res.locals.guildName = req.session.guildName || null;
  // Extract player name from Discord nickname
  // Splits on delimiters (|, [, {, 《, emoji) and strips annotations
  res.locals.playerName = (displayName, username) => {
    if (!displayName && !username) return null;
    const name = displayName || username;
    // Split on brackets, pipes, and emoji — take the longest non-empty segment from the first parts
    // If name starts with [, extract content inside first brackets
    if (name.startsWith("[")) {
      const bracketMatch = name.match(/^\[([^\]]+)\]/);
      if (bracketMatch) return bracketMatch[1].trim();
    }
    const segments = name.split(/[|¦│[\]{}《》]|[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}\u{2300}-\u{23FF}☃★♦♠♣♥✦✧❤♤]/u);
    let raw = segments[0].trim();
    if (!raw) raw = segments.find((s) => s.trim()) || name;
    return raw
      .replace(/\s*\(.*$/, "")
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿˢᵀᵁⱽᵂ]+.*$/, "")
      .trim() || name;
  };
  next();
});

// Routes
app.use("/auth", authRoutes);
app.use("/api", apiRoutes);
app.use("/", pageRoutes);

app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
