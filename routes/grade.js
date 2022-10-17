require('dotenv').config();
const express = require('express');
const router = express.Router({ mergeParams: true });
const {grab, grabSubs, grabStatus,checkAdmin, createSubmission} = require("./displayProblem");
const {getProblem, addProblem, testSql} = require("./problems");
const {queue} = require("./runTests");

const {processFunction} = require("../oauth");
const {check} = require("../profile");
const session = require('express-session');

const FileReader = require('filereader');
const csvtojson = require('csvtojson');
const upload = require('express-fileupload');

router.use(session({
	secret: process.env.SECRET_KEY,
	resave: false,
	saveUninitialized: false
}));

router.get("/login", async (req, res)=>{ 
	let CODE = req.query.code;
	let data = await processFunction(CODE, req, res);
	await check(data.user_data, data.req, data.res);
});
router.post("/logout", (req, res)=> {
	req.session.destroy();
	res.redirect("/");
});
router.get("/profile", checkLoggedIn, (req, res)=>{ 
	res.render("profile", {name: req.session.name, username: req.session.username});
});
router.get("/", (req, res) => {
	res.redirect("/grade/profile");
});
router.get("/contests", checkLoggedIn, (req, res) => {
	res.render('contests');
});
router.get("/problemset", checkLoggedIn, (req, res) => {
	let page = req.query.page;
	if (page == undefined) page = 0;
	let start = page*5; //write multipage later
	res.render("gradeProblemset", {p1: 0, p1n: "Problem 1", p2: 1, p2n: "Problem 2", p3: 2, p3n: "Problem 3", p4: 3, p4n: "Problem 4", p5: 4, p5n: "Problem 5"});
});
router.get("/problemset/:id", checkLoggedIn, async (req, res) => { //req.params.id
	let vals = await grab(req.params.id);
	res.render("gradeProblem", {title: vals.title, statement: vals.statement, id: vals.id});
});


router.get("/submit", checkLoggedIn, (req, res) => {
	res.render("gradeSubmit", {problemid: req.query.problem});
});

router.post("/status", checkLoggedIn, async (req, res) => { //eventually change to post to submit
	//sends file to another website

	let language = req.body.lang;
	console.log(language);
	if (language != 'python' && language != 'cpp' && language != 'java') {
		console.log("bad");
		res.send("unacceptable code language");
		return;
	}

	let pid = req.body.problemid;
	if(pid ==""){
		res.send("WHAT PROBLEM STUPID");
		return;
	}
	let file = req.body.code;

	let sid = await createSubmission(req.session.userid, file, pid, language);
	await queue(pid, sid);
	res.redirect("/grade/status");
});
router.get("/status", checkLoggedIn, async (req, res) => {
	let submissions = await grabSubs(req.session.userid);
	res.render("gradeStatus", {submissions: submissions});
});
router.get("/createProblem", checkLoggedIn, async (req, res) => {
	let admin = await checkAdmin(req.session.userid);//seems insecure LMAO, but issok, ill looka t it later
	if(admin){
		console.log(testSql());
		console.log("HI");
		res.render("portal", {ml:0, pts:0, pid: 0, tl:0, pname:"problem name", cid:-1, secret:"", state:"Your latex code here", latexstate:"We must evaluate the integral $\\int_1^\\infty \\left(\\frac{\\log x}{x}\\right)^{2011} dx$."});
	}else{
		res.send("UR NOT ADMIN");
	}
});
router.post("/create", checkLoggedIn, async(req, res)=>{
	let admin = await checkAdmin(req.session.userid);//seems insecure LMAO, but issok, ill looka t it later
	if(admin){
		let pts= req.body.pts;
		let pid = req.body.pid;
		let pname = req.body.pname;
		let cid= req.body.cid;
		let state= req.body.state;
		let tl= req.body.tl;
		let ml= req.body.ml;
		let secret = req.body.secret;
		let ret = {
			"points": pts,
			"pid":pid,
			"pname":pname,
			"cid":cid,
			"state":state,
			"tl":tl,
			"ml":ml,
			"checker":checker,
			"secret":secret
		};
		//async function addProblem(probid, pname,cid, pts,state, tl, ml, test, checker, secret){
		addProblem(pid, pname, cid, pts, state, tl, ml, secret);
		res.render("portal", ret);
	}else{
		res.send("UR NOT ADMIN");
	}
});
router.get("/status/:id", checkLoggedIn, async (req, res) => { //req.params.id
	let vals = await grabStatus(req.params.id);

	res.render("status", {submission: vals});
});

function checkLoggedIn(req, res, next) {
	if (req.session.loggedin) {
		next();
	}
	else {
		res.redirect("/");
	}
}

module.exports = router;
