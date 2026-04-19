const express = require("express");
const crypto = require("crypto");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const path = require("path");
const { pool } = require("./db");
const authRoutes = require("./routes/auth");
const pageRoutes = require("./routes/pages");
const apiRoutes = require("./routes/api");
const { playerName } = require("../xpholder/utils/playerName");

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Heroku's proxy so secure cookies work behind TLS termination
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

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
  res.locals.playerName = playerName;
  next();
});

// Routes
app.use("/auth", authRoutes);
app.use("/api", apiRoutes);
app.use("/", pageRoutes);

app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
