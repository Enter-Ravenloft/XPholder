const express = require("express");
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
    secret: process.env.SESSION_SECRET || "xpholder-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 1 week
  })
);

// Make user and helpers available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.guildId = req.session.guildId || null;
  // Extract player name from Discord nickname (before delimiters like |, [, {, 《, ()
  res.locals.playerName = (displayName, username) => {
    if (!displayName && !username) return null;
    const name = displayName || username;
    return name
      .split(/[|¦│[\]{}《》]/)[0]
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
