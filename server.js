const express = require("express");
const session = require("express-session");
const Database = require("better-sqlite3");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ================= DB =================
const db = new Database("smartgov.db");

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "SMART-GOV-ERP-2026",
    resave: false,
    saveUninitialized: false
}));

// ================= INIT DB =================
db.exec(`
CREATE TABLE IF NOT EXISTS farmers (
    codpart TEXT PRIMARY KEY,
    name TEXT,
    region TEXT,
    paid REAL,
    debt REAL
);

CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codpart TEXT,
    product TEXT,
    quantity REAL,
    year TEXT,
    region TEXT
);
`);

// ================= SAMPLE DATA =================
const check = db.prepare("SELECT * FROM farmers WHERE codpart=?").get("123");

if (!check) {
    db.prepare("INSERT INTO farmers VALUES (?,?,?,?,?)")
      .run("123","أحمد بن علي","Setif",50000,12000);

    db.prepare("INSERT INTO farmers VALUES (?,?,?,?,?)")
      .run("124","محمد براهيم","Algiers",30000,0);

    db.prepare("INSERT INTO movements VALUES (NULL,?,?,?,?,?)")
      .run("123","Blé",1000,"2024","Setif");

    db.prepare("INSERT INTO movements VALUES (NULL,?,?,?,?,?)")
      .run("123","Orge",600,"2025","Setif");

    db.prepare("INSERT INTO movements VALUES (NULL,?,?,?,?,?)")
      .run("124","Blé",400,"2026","Algiers");
}

// ================= AI =================
function aiPredict(arr){
    if(arr.length === 0) return 0;
    let sum = arr.reduce((a,b)=>a+b,0);
    let avg = sum / arr.length;
    return Math.round(avg * 1.12);
}

// ================= LOGIN =================
app.post("/login",(req,res)=>{
    const {codpart} = req.body;

    const farmer = db.prepare("SELECT * FROM farmers WHERE codpart=?").get(codpart);

    if(!farmer) return res.send("❌ Not Found");

    req.session.user = farmer;
    res.redirect("/dashboard");
});

// ================= AUTH =================
function auth(req,res,next){
    if(req.session.user) next();
    else res.redirect("/");
}

// ================= DASHBOARD =================
app.get("/dashboard",auth,(req,res)=>{

    const u = req.session.user;

    const movements = db.prepare("SELECT * FROM movements WHERE codpart=?").all(u.codpart);

    let total = 0;
    let byYear = {2024:0,2025:0,2026:0};

    movements.forEach(d=>{
        total += d.quantity;
        byYear[d.year] = (byYear[d.year]||0) + d.quantity;
    });

    let prediction = aiPredict(Object.values(byYear));

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>SMART GOV</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
body{margin:0;font-family:Arial;background:#0b1020;color:white}
header{background:#2563eb;padding:15px;text-align:center}
.card{display:inline-block;background:#111827;margin:10px;padding:15px;border-radius:10px;width:160px}
.container{text-align:center}
</style>
</head>

<body>

<header>🏛️ SMART GOV ERP</header>

<h2 style="text-align:center">${u.name} - ${u.region}</h2>

<div class="container">
<div class="card">💰 Paid<br>${u.paid}</div>
<div class="card">💸 Debt<br>${u.debt}</div>
<div class="card">📦 Total<br>${total}</div>
<div class="card">🧠 AI<br>${prediction}</div>
</div>

<canvas id="chart" style="max-width:500px;margin:auto;display:block"></canvas>

<script>
new Chart(document.getElementById("chart"),{
type:"line",
data:{
labels:["2024","2025","2026"],
datasets:[{
label:"Production",
data:[${byYear[2024]},${byYear[2025]},${byYear[2026]}],
borderColor:"#22c55e"
}]
}
});
</script>

<br>
<div style="text-align:center">
<a href="/logout" style="color:red">Logout</a>
</div>

</body>
</html>
    `);
});

// ================= API MAP =================
app.get("/api/map",(req,res)=>{

    const rows = db.prepare(`
        SELECT region, SUM(quantity) as total
        FROM movements
        GROUP BY region
    `).all();

    const map = rows.map(r=>({
        region:r.region,
        value:r.total,
        level: r.total>1000?"HIGH":r.total>500?"MEDIUM":"LOW"
    }));

    res.json(map);
});

// ================= NATIONAL =================
app.get("/api/national",(req,res)=>{

    const data = db.prepare("SELECT * FROM movements").all();

    let total = data.reduce((a,b)=>a+b.quantity,0);
    let forecast = aiPredict(data.map(d=>d.quantity));

    res.json({
        total,
        forecast,
        status:"SMART GOV OK"
    });
});

// ================= HOME =================
app.get("/",(req,res)=>{
    res.send(`
    <h1 style="text-align:center;margin-top:80px">🏛️ SMART GOV</h1>

    <form method="POST" action="/login" style="text-align:center">
        <input name="codpart" placeholder="COD PART">
        <button>Login</button>
    </form>
    `);
});

// ================= START =================
app.listen(PORT,()=>{
    console.log("🏛️ SMART GOV RUNNING ON " + PORT);
});