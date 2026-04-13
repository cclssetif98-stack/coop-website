const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const xlsx = require("xlsx");
const path = require("path");

const app = express();
const db = new sqlite3.Database("database.db");

// ================= MIDDLEWARE =================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(session({
    secret: "company-erp-secret",
    resave: false,
    saveUninitialized: false
}));

const upload = multer({ dest: "uploads/" });

// ================= DATABASE =================
db.serialize(() => {

    db.run(`CREATE TABLE IF NOT EXISTS farmers (
        codpart TEXT PRIMARY KEY,
        name TEXT,
        paid REAL DEFAULT 0,
        debt REAL DEFAULT 0,
        status TEXT DEFAULT 'نشط'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codpart TEXT,
        type TEXT,
        product TEXT,
        quantity REAL,
        year TEXT
    )`);
});

// ================= SAMPLE DATA =================
db.get("SELECT * FROM farmers WHERE codpart='123'", (err,row)=>{
    if(!row){
        db.run("INSERT INTO farmers VALUES ('123','أحمد بن علي',50000,12000,'نشط')");
        db.run("INSERT INTO farmers VALUES ('124','محمد براهيم',30000,0,'نشط')");

        db.run("INSERT INTO movements VALUES (NULL,'123','Collecte','Blé',1000,'2024')");
        db.run("INSERT INTO movements VALUES (NULL,'123','Collecte','Orge',500,'2025')");
        db.run("INSERT INTO movements VALUES (NULL,'124','Collecte','Blé',800,'2024')");
    }
});

// ================= HOME =================
app.get("/", (req,res)=>{
    res.send(`
    <div style="text-align:center;font-family:Arial;margin-top:80px">
        <h1>🏢 ERP COMPANY - بوابة الفلاح</h1>

        <form method="POST" action="/login">
            <input name="codpart" placeholder="COD PART" style="padding:10px;width:220px">
            <br><br>
            <button style="padding:10px 25px">دخول النظام</button>
        </form>

        <br>
        <a href="/admin">🧑‍💼 لوحة الإدارة</a>
    </div>
    `);
});

// ================= LOGIN =================
app.post("/login",(req,res)=>{
    db.get("SELECT * FROM farmers WHERE codpart=?",[req.body.codpart],(err,f)=>{
        if(!f) return res.send("❌ غير موجود");

        req.session.user = f;
        res.redirect("/dashboard");
    });
});

// ================= AUTH =================
function auth(req,res,next){
    if(req.session.user) next();
    else res.redirect("/");
}

// ================= DASHBOARD COMPANY =================
app.get("/dashboard", auth, (req,res)=>{

    const u = req.session.user;

    db.all("SELECT * FROM movements WHERE codpart=?",[u.codpart],(err,data)=>{

        let total = 0;
        let chart = {blé:0, orge:0};

        data.forEach(d=>{
            total += Number(d.quantity||0);
            if(d.product.includes("Blé")) chart.blé += Number(d.quantity||0);
            if(d.product.includes("Orge")) chart.orge += Number(d.quantity||0);
        });

        res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>ERP COMPANY</title>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
body{margin:0;font-family:Arial;background:#0a0f1c;color:white}

.header{
    background:#16a34a;
    padding:20px;
    text-align:center;
    font-size:22px;
}

.grid{
    text-align:center;
    margin-top:20px;
}

.card{
    display:inline-block;
    background:#1f2937;
    padding:15px;
    margin:10px;
    width:170px;
    border-radius:10px;
}

table{
    width:90%;
    margin:auto;
    margin-top:20px;
    background:white;
    color:black;
    border-collapse:collapse;
}

th,td{
    padding:10px;
    border:1px solid #ddd;
}

input,select{
    padding:10px;
    margin:10px;
}
</style>

</head>

<body>

<div class="header">
🏢 ERP COMPANY SYSTEM
</div>

<h2 style="text-align:center">👨‍🌾 ${u.name}</h2>

<div class="grid">
<div class="card">💰 مدفوع<br>${u.paid}</div>
<div class="card">💸 دين<br>${u.debt}</div>
<div class="card">🌾 مجموع<br>${total}</div>
</div>

<div style="text-align:center">
<select onchange="location='/dashboard?year='+this.value">
<option value="ALL">كل السنوات</option>
<option value="2024">2024</option>
<option value="2025">2025</option>
<option value="2026">2026</option>
</select>
</div>

<div style="width:400px;margin:auto">
<canvas id="c"></canvas>
</div>

<table>
<tr>
<th>Type</th>
<th>Product</th>
<th>Quantity</th>
<th>Year</th>
</tr>

${data.map(r=>`
<tr>
<td>${r.type}</td>
<td>${r.product}</td>
<td>${r.quantity}</td>
<td>${r.year}</td>
</tr>
`).join("")}

</table>

<script>
new Chart(document.getElementById("c"),{
    type:"bar",
    data:{
        labels:["Blé","Orge"],
        datasets:[{
            label:"Production",
            data:[${chart.blé},${chart.orge}],
            backgroundColor:["#22c55e","#3b82f6"]
        }]
    }
});
</script>

<br><br>
<div style="text-align:center">
<a href="/logout" style="color:red">🚪 خروج</a>
</div>

</body>
</html>
        `);
    });
});

// ================= ADMIN =================
app.get("/admin",(req,res)=>{
    res.send(`
    <div style="text-align:center;font-family:Arial">
        <h2>🧑‍💼 COMPANY ADMIN PANEL</h2>

        <h3>📥 Farmers Excel</h3>
        <form action="/import-farmers" method="POST" enctype="multipart/form-data">
            <input type="file" name="file">
            <button>Upload</button>
        </form>

        <h3>📥 Movements Excel</h3>
        <form action="/import-movements" method="POST" enctype="multipart/form-data">
            <input type="file" name="file">
            <button>Upload</button>
        </form>

        <br>
        <a href="/">Home</a>
    </div>
    `);
});

// ================= IMPORT FARMERS =================
app.post("/import-farmers", upload.single("file"), (req,res)=>{
    const wb = xlsx.readFile(req.file.path);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    data.forEach(r=>{
        db.run("INSERT OR REPLACE INTO farmers VALUES (?,?,?,?,?)",
        [r.Codepart, r.Nompart, 0, 0, "نشط"]);
    });

    res.send("✅ Farmers OK");
});

// ================= IMPORT MOVEMENTS =================
app.post("/import-movements", upload.single("file"), (req,res)=>{
    const wb = xlsx.readFile(req.file.path);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    data.forEach(r=>{
        db.run("INSERT INTO movements VALUES (NULL,?,?,?,?,?)",
        [r.Codepart, r.Type, r.Produit, r.Quantite, r.Annee]);
    });

    res.send("✅ Movements OK");
});

// ================= API (MOBILE FUTURE) =================
app.get("/api/:cod",(req,res)=>{
    db.get("SELECT * FROM farmers WHERE codpart=?",[req.params.cod],(e,f)=>{
        db.all("SELECT * FROM movements WHERE codpart=?",[req.params.cod],(e2,m)=>{
            res.json({farmer:f, movements:m});
        });
    });
});

// ================= LOGOUT =================
app.get("/logout",(req,res)=>{
    req.session.destroy();
    res.redirect("/");
});

// ================= START =================
app.listen(3000,()=>{
    console.log("🏢 COMPANY ERP RUNNING http://localhost:3000");
});