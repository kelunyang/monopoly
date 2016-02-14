var http = require("http");
var url = require('url');
var fs = require('fs');
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var mime = require('/usr/lib/node_modules/mime-types');
var io = require('/usr/lib/node_modules/socket.io');
var ios = require('/usr/lib/node_modules/socket.io-express-session');
var ss = require('socket.io-stream');
var mysql = require('/usr/lib/node_modules/mysql');
var MemoryStore = require('/usr/lib/node_modules/sessionstore');
var express = require('/usr/lib/node_modules/express');
var moment = require('/usr/lib/node_modules/moment');
var xml = require('xml2js');
//var json = require("express-json");
//var urlencode = require("urlencode");
var session = require("express-session");
var cookieParser = require("cookie-parser");
var bodyParser = require('body-parser');
var rimraf = require('rimraf');
var sessionSecret = "mozillapersona";
var dir = "/mnt/www/monopoly";
var mysqlServer = "localhost";
var mysqlUser = "webapp";
var mysqlPass = "75*0F*d4b6";
var mysqlDB_string = "monopoly";
var session_store = MemoryStore.createSessionStore();
var sessioninstance = session({
    secret: sessionSecret,
	resave: true,
	saveUninitialized: true,
	store: session_store
})
var app = express();
var server = http.Server(app);
app.use(express.static(dir));
server.listen(80,function() {
	console.log("http server complete");
});
allClient = new Array();
var serv_io = io(server);
serv_io.use(ios(sessioninstance));
/* GameObjs */
var questionDB = new Array();
var stage = 0;
var currentQuestion = null;
currentUser = null;	//如果照正常流程登入再操作，這個變數會保留下來
var gameSession = new Object();	//session 暫存點
/* Authericate */
app.use(bodyParser());
//app.use(json());
//app.use(urlencode());
//app.use(cookieParser());
app.use(sessioninstance);
require("express-persona")(app, {
	audience: "http://163.21.114.152", // Must match your browser's address bar 
	verifyResponse: function(err, req, res, email) {
		req.session.currentuser = {
			email: email
		}
		req.session.authorized = true;
		req.session.save();
		/*data.salt = Math.round(Math.random() * 10);
		var md5 = crypto.createHash('sha1');
		md5.update(data.pass+data.salt,"utf8");
		console.log(data.pass.concat(data.salt));
		data.pass = md5.digest("hex");
		console.log(data.pass);*/
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		connection.connect();
		connection.query("SELECT * FROM user WHERE email = ?",[email],function(error, rows, fields){
			if(error) {
				connection.end();
				throw error;
			} else {
				if(rows.length > 0) {
					userlog(connection, req.session.currentuser.email, 1, "", function() {
						connection.end();
						req.session.currentuser = rows[0];
						req.session.save();
						serv_io.sockets.emit("getUser", {obj: req.session.currentuser, auth: false});
					});
				} else {
					req.session.currentuser = {
						email: email,
						nickname: "未設定",
						color: "336699",
						icon: "question-circle",
						level: 0
					}
					req.session.save();
					serv_io.sockets.emit("getUser", {obj: req.session.currentuser, auth: false});
					connection.query('INSERT INTO `user` SET ?', req.session.currentuser, function(error){
						if(error){
							console.log('創建用戶資料失敗！');
							connection.end();
							throw error;
						} else {
							userlog(connection, req.session.currentuser.email, 0, "", function() {
								userlog(connection, req.session.currentuser.email, 1, "", function() {
									connection.end();
								});
							});
						}
					});
				}
			}
		});
		res.json({ status: "okay", email: email });
	},
	logoutResponse: function(err, req, res) {
		if (req.session.authorized) {
			req.session.authorized = null;
		}
		console.log(req.session.currentuser);
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		if(req.session.currentuser != null) {
			connection.connect();
			userlog(connection, req.session.currentuser.email, 2, "", function() {
				connection.end();
			});
		}
		req.session.currentuser = null;
		req.session.save();
		res.json({ status: "okay" });
	}
});

/* configure */
app.get("/",function(req,res) {
	fs.readFile(dir+'/index.htm', function(err, data){
		res.send(data.toString());
	});
});
app.get("/id",function(req,res) {
	res.send(req.session.currentuser);
});

/* map Services */
app.get("/listmapService", function(req,res) {
	var connection = mysql.createConnection({
		host: mysqlServer,
		user: mysqlUser,
		password: mysqlPass,
		database: mysqlDB_string
	});
	connection.connect();
	connection.query("SELECT * FROM gameboard ORDER BY createdate",function(error, rows, fields){
		if(error){
			connection.end();
			throw error;
		}
		res.json(rows);
		connection.end();
	});
});
app.get("/readmapinfoService",function(req,res) {
});
serv_io.of("/fileupload").on("connection", function(socket) {
	ss(socket).on("mapConfigs", function(stream, data) {
		console.log(dir+"/data/"+data.boardid+"/"+data.type+".xml");
		stream.pipe(fs.createWriteStream(dir+"/data/"+data.boardid+"/"+data.type+".xml"));	//fs.createWriteStream opintion default set to override
	});
});
/*serv_io.sockets.on("disconnect", function(socket) {
	var sessioni = socket.handshake.session;
	console.log(sessioni);
	var connection = mysql.createConnection({
		host: 'localhost',
		user: 'webapp',
		password: '75*0F*d4b6',
		database: 'monopoly'
	});
	if(sessioni.currentuser != null) {
		connection.connect();
		userlog(connection, sessioni.currentuser.email, 2, "", function() {
			connection.end();
			var i = allClients.indexOf(socket);
			allClients.splice(i, 1);
		});
	}
});*/
serv_io.sockets.on('connection', function(socket) {
	var sessioni = socket.handshake.session;
	console.log(sessioni);
	console.log("socket.io executed!");
	allClient.push(socket);
    socket.emit('socketon', {'status': true, "id": socket.id });
	socket.on("addTurn", function(data) {
		console.log(gameSession[sessioni.currentgame].currentplayer);
		if(gameSession[sessioni.currentgame].currentplayer == sessioni.currentuser.email) {
			gameSession[sessioni.currentgame].currentturn++;
			var playerindex = 0;
			for(var i=0;i<gameSession[sessioni.currentgame].players.length;i++) {
				if(gameSession[sessioni.currentgame].players[i] == gameSession[sessioni.currentgame].currentplayer) {
					playerindex = i;
				}
			}
			gameSession[sessioni.currentgame].currentplayer = gameSession[sessioni.currentgame].players[(gameSession[sessioni.currentgame].currentturn + i) % gameSession[sessioni.currentgame].players.length];
			var stageturn = 0;
			for(var i=0; i < gameSession[sessioni.currentgame].stages.length;i++) {
				stageturn = stageturn + gameSession[sessioni.currentgame].stages[i].duration;
				if(gameSession[sessioni.currentgame].currentturn <= stageturn) {
					gameSession[sessioni.currentgame].currentstage = i;
					break;
				}
			}
			socket.emit('turnadded', {
				currentplayer: gameSession[sessioni.currentgame].currentplayer,
				currentstage: gameSession[sessioni.currentgame].currentstage,
				currentturn: gameSession[sessioni.currentgame].currentturn
			});
		} else {
			console.log("wrong player!");
		}
	});
	socket.on("preparemapbackend", function(data) {	//這裡的data就是session id，棋局編號
		console.log(sessioni);
		data = sessioni.currentgame;
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		connection.connect();
		console.log(data);
		connection.query("SELECT * FROM gamesession WHERE id = ?", [data], function(error, rows, fields){
			if(error) {
				connection.end();
				throw error;
			} else {
				bid = rows[0].bid;
				var boardname = ["incidents", "questions", "roads", "shortcuts", "stages", "upgrades"];
				gameSession[data] = new Object();
				var obj = new Object;
				obj.currentstage = 0;
				obj.currentturn = 0;
				obj.players = new Array();
				connection.query("SELECT * FROM sessionplayer WHERE sid = ?", data, function(error, rows, fields){
					if(error) {
						connection.end();
						throw error;
					} else {
						for(var i=0;i<rows.length;i++) {
							obj.players.push(rows[i].uid);
						}
						console.log(obj.players);
						obj.currentplayer = obj.players[0];
						connection.end();
					}
				});
				var log = 0;
				console.log("reading map");
				for(var i=0;i<boardname.length;i++) {
					console.log("reading"+dir+"/data/"+bid+"/"+boardname[i]+".xml");
					fs.readFile(dir+"/data/"+bid+"/"+boardname[i]+".xml",function(err, data) {
						var xmldata = xml.parseString(data, function(err, result) {
							console.log(result.Workbook.DocumentProperties[0].Title[0]);
							switch(result.Workbook.DocumentProperties[0].Title[0]) {
								case "incidents":
									obj.incident = new Array();
									for(var i=0;i<result.Workbook.Worksheet.length;i++) {
										for(var c=0;c<result.Workbook.Worksheet[i].Table[0].Row.length;c++) {
											obj.incident.push({
												stage: i,
												name:result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._,
												desc:result.Workbook.Worksheet[i].Table[0].Row[c].Cell[1].Data[0]._,
												type:parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[2].Data[0]._),
												effect:parseFloat(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[3].Data[0]._),
												brick:parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[4].Data[0]._,10)
											});
										}
									}
									console.log("incident loaded");
								break;
								case "questions":
									obj.questions = new Array();
									for(var i=0;i<result.Workbook.Worksheet.length;i++) {
										var stagequestion = new Array();
										for(var c=0;c<result.Workbook.Worksheet[i].Table[0].Row.length;c++) {
											var answers = new Array();
											for(var a=4;a<result.Workbook.Worksheet[i].Table[0].Row[c].Cell.length;a++) {
												answers.push(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[a].Data[0]._);
											}
											stagequestion.push({
												stage: i,
												question:result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._,
												credit:parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[1].Data[0]._,10),
												answer:parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[2].Data[0]._,10),
												reason:result.Workbook.Worksheet[i].Table[0].Row[c].Cell[3].Data[0]._,
												answers:answers
											});
										}
										stagequestion.sort(function(a,b) {return 0.5-Math.random();});
										obj.questions.push(stagequestion);
									}
									console.log("question loaded");
								break;
								case "roads":
									obj.roads = new Array();
									for(var i=0;i<result.Workbook.Worksheet.length;i++) {
										for(var c=0;c<result.Workbook.Worksheet[i].Table[0].Row.length;c++) {
											obj.roads.push({
												name: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._,
												desc: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[1].Data[0]._,
												brick: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[2].Data[0]._,10),
												next: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[3].Data[0]._,10),
												previous: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[4].Data[0]._,10),
												price: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[5].Data[0]._,10),
												stage: i
											});
										}
									}
								break;
								case "shortcuts":
									obj.shortcuts = new Array();
									for(var i=0;i<result.Workbook.Worksheet.length;i++) {
										for(var c=0;c<result.Workbook.Worksheet[i].Table[0].Row.length;c++) {
											var bricks = new Array();
											for(var a=4;a<result.Workbook.Worksheet[i].Table[0].Row[c].Cell.length;a++) {
												bricks.push(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[a].Data[0]._);
											}
											obj.shortcuts.push({
												name: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._,
												desc: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[1].Data[0]._,
												startturn: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[2].Data[0]._,10),
												endturn: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[3].Data[0]._,10),
												bricks: bricks
											});
										}
									}
									console.log("shortcut loaded");
								break;
								case "stages":
									obj.stages = new Array();
									for(var i=0;i<result.Workbook.Worksheet.length;i++) {
										for(var c=0;c<result.Workbook.Worksheet[i].Table[0].Row.length;c++) {
											obj.stages.push({
												name: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._,
												desc: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[1].Data[0]._,
												duration: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[2].Data[0]._,10),
											});
										}
									}
									console.log("stage loaded");
								break;
								case "upgrades":
									obj.upgrades = new Array();
									for(var i=0;i<result.Workbook.Worksheet.length;i++) {
										for(var c=0;c<result.Workbook.Worksheet[i].Table[0].Row.length;c++) {
											obj.upgrades.push({
												name: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._,
												rent: parseFloat(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[1].Data[0]._),
												price: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[2].Data[0]._,10),
												icon:result.Workbook.Worksheet[i].Table[0].Row[c].Cell[3].Data[0]._,
												desc:result.Workbook.Worksheet[i].Table[0].Row[c].Cell[4].Data[0]._,
												stage:i
											});
										}
									}
									console.log("upgrades loaded");
								break;
							}
							socket.emit('boardprepared', {
								status: true,
								id: rows[0].id,
								upgrades: obj.upgrades,
								shortcut: obj.shortcuts,
								roads: obj.roads,
								stage: obj.stages,
								incident: obj.incident,
								localplayer: sessioni.currentuser.email,
								currentplayer: obj.currentplayer
							});
						});
					});
				}
				gameSession[data] = obj;
			}
		});
	});
	socket.on("startgame", function(data) {
		sessioni.currentgame = data.sid;
		sessioni.save();
		console.log(sessioni);
		socket.emit("gamestarted", {status: true});
	});
	socket.on("removemap", function(data) {
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		connection.connect();
		connection.query("DELETE FROM sessionplayer WHERE bid = ?",[data.id], function(err, results) {
			if(err) {
				connection.end();
				throw err;
			} else {
				rimraf(dir+"/data/"+data.id, function(error) {
					if(error) {
						connection.end();
						throw err;
					} else {
						connection.query("DELETE FROM gamesession WHERE bid = ?",[data.id], function(err, results) {
							if(err) {
								connection.end();
								throw err;
							} else {
								connection.query("DELETE FROM gameboard WHERE id = ?",[data.id], function(err, results) {
									if(err) {
										connection.end();
										throw err;
									} else {
										userlog(connection, sessioni.currentuser.email, 4, JSON.stringify(data), function() {
											socket.emit("gameboardRemoved", data);
											connection.end();
										});
									}
								});
							}
						});
					}
				});
			}
		});
	});
	socket.on("removesession", function(data) {
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		connection.connect();
		connection.query("DELETE FROM sessionplayer WHERE sid = ?", [data.sid], function(err, results) {
			if(err) {
				connection.end();
				throw err;
			} else {
				connection.query("DELETE FROM gamesession WHERE id = ?", [data.sid], function(err, results) {
					if(err) {
						connection.end();
						throw err;
					} else {
						userlog(connection, sessioni.currentuser.email, 4, JSON.stringify(data), function() {
							socket.emit("sessionRemoved", data);
							connection.end();
						});
					}
				});
			}
		});
	});
	socket.on("exitsession", function(data) {
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		connection.connect();
		connection.query("DELETE FROM sessionplayer WHERE uid = ? AND sid = ?", [data.uid, data.sid], function(err, results) {
			if(err) {
				connection.end();
				throw err;
			} else {
				userlog(connection, sessioni.currentuser.email, 4, JSON.stringify(data), function() {
					socket.emit("sessionleaved", data);
					connection.end();
				});
			}
		});
	});
	socket.on("joinsession", function(data) {
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		var record = {
			sid: data.sid,
			uid: sessioni.currentuser.email,
			bid: data.bid
		};
		connection.connect();
		connection.query("INSERT INTO sessionplayer SET ?", record,function(error){
			if(error){
				connection.end();
				socket.emit('joinsessionerror', {'error': true});
				throw error;
			} else {
				socket.emit('gamesessionjoined', data.sid);
				connection.end();
			}
		});
	});
	socket.on("createsession", function(data) {
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		var record = {
			bid: data.bid,
			createdate: moment().unix(),
			hosteduser: sessioni.currentuser.email,
			maxplayer: data.maxplayer,
			maxround: data.maxround
		};
		connection.connect();
		connection.query("INSERT INTO gamesession SET ?", record,function(error){
			if(error){
				connection.end();
				socket.emit('gamesessionmanageerror', {'error': true});
				throw error;
			} else {
				console.log(record.createdate);
				connection.query("SELECT * FROM gamesession WHERE createdate = ?",[record.createdate],function(error, rows, fields){
					if(error) {
						connection.end();
						socket.emit('gamesessionmanageerror', {'error': true});
						throw error;
					} else {
						record = {
							sid: rows[0].id,
							uid: rows[0].hosteduser,
							bid: rows[0].bid
						}
						connection.query("INSERT INTO sessionplayer SET ?", record,function(error){
							if(error){
								connection.end();
								socket.emit('gamesessionmanageerror', {'error': true});
								throw error;
							} else {
								socket.emit('gamesessioncreated', rows[0].id);
								connection.end();
							}
						});
					}
				});
			}
		});
	});
	socket.on("uploadmap", function(data) {
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		var record = {
			name: data.name,
			comment: data.comment,
			createdate: moment().unix(),
			user: sessioni.currentuser.email
		};
		if(data.type == 0) {
			connection.connect();
			connection.query("INSERT INTO gameboard SET ?", record,function(error){
				if(error){
					connection.end();
					socket.emit('gameboardmanageError', {'error': true});
					throw error;
				} else {
					console.log(record.createdate);
					connection.query("SELECT * FROM gameboard WHERE createdate = ?",[record.createdate],function(error, rows, fields){
						if(error) {
							connection.end();
							socket.emit('gameboardmanageError', {'error': true});
							throw error;
						} else {
							mkdirp(dir+"/data/"+rows[0].id,function(err) {
								socket.emit('gameboardModified', rows[0]);
								connection.end();
							});
						}
					});
				}
			});
		} else {
			connection.connect();
			connection.query("UPDATE gameboard SET ? WHERE id = ?",[record,data.type], function(err, results) {
				if(err) {
					connection.end();
					throw err;
				} else {
					userlog(connection, sessioni.currentuser.email, 3, JSON.stringify(data), function() {
						socket.emit("gameboardModified", data);
						connection.end();
					});
				}
			});
		}
	});
	socket.on("querymap", function(data) {
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		connection.connect();
		console.log(data);
		connection.query("SELECT * FROM gameboard WHERE id = ?", [data], function(error, rows, fields){
			if(error) {
				connection.end();
				socket.emit('gameboardmanageError', {'error': true});
				throw error;
			} else {
				fs.readdir(dir+"/data/"+data, function(error, list) {
					if(error) {
						socket.emit('gameboardmanageError', {'error': true});
						connection.end();
						throw error;
					} else {
						socket.emit("gameboardInfo", {"data": rows[0], "files": list});
						connection.end();
					}
				});
			}
		});
	});
	socket.on("updatescore", function(data) {
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		var row = {
			score: data.score
		};
		connection.connect();
		connection.query("UPDATE sessionplayer SET ? WHERE uid = ?",[row,sessioni.currentuser.email], function(err, results) {
			if(err) {
				connection.end();
				throw err;
			} else {
				connection.query("SELECT * FROM sessionplayer WHERE sid = ?", sessioni.currentgame, function(error, rows, fields){
					if(error) {
						connection.end();
						throw error;
					} else {
						socket.emit("updatelivescore", rows);
						connection.end();
					}
				});
			}
		});
	});
	socket.on('queryQuestion', function(data) {
		currentQuestion = gameSession[sessioni.currentgame].questions[gameSession[sessioni.currentgame].currentstage].shift();
		console.log(currentQuestion);
		gameSession[sessioni.currentgame].currentQuestion = currentQuestion;
		var tempanswer = (currentQuestion.answer / 1);
		var tempreason = currentQuestion.reason;
		currentQuestion.reason = "";
		currentQuestion.answer = -1;	//mask the answer
		socket.emit('sendQuestion', {'question': currentQuestion});
		currentQuestion.answer = tempanswer;
		currentQuestion.reason = tempreason;
		console.log(tempanswer);
	});
	socket.on('checkAnswer',function(data) {
		socket.emit("queryAnswer", { answer: gameSession[sessioni.currentgame].currentQuestion.answer});
		console.log(data.answer);
		console.log(currentQuestion);
	});
	socket.on('checkUser',function(data) {
		socket.emit("getUser", {obj:sessioni.currentuser});
		console.log(sessioni.currentuser);
	});
	socket.on("setUser",function(data) {
		/*console.log(currentUser);
		console.log(data);*/
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		console.log(sessioni);
		connection.connect();
		connection.query("UPDATE user SET ? WHERE email = ?",[data,sessioni.currentuser.email], function(err, results) {
			if(err) {
				connection.end();
				throw err;
			} else {
				userlog(connection, sessioni.currentuser.email, 3, JSON.stringify(data), function() {
					connection.end();
					socket.emit("donesetUser", data);
				});
			}
		});
	});
	socket.on("removeuser", function(data) {
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		connection.query("SELECT * FROM gameboard WHERE user = ?",[data.user],function(error, rows, fields){
			if(error) {
				connection.end();
				socket.emit('userdelError', {'error': true});
				throw error;
			} else {
				for(var i=0;i<rows.length;i++) {
					rimraf(dir+"/data/"+row[i].id, function(error) {
						socket.emit('userdelError', {'error': true});
						throw err;
					});
				}
				connection.query("DELETE FROM user WHERE email = ?",[data.user], function(err, results) {
					if(err) {
						connection.end();
						socket.emit('userdelError', {'error': true});
						throw err;
					} else {
						connection.query("DELETE FROM userlog WHERE user = ?",[data.user], function(err, results) {
							if(err) {
								connection.end();
								socket.emit('userdelError', {'error': true});
								throw err;
							} else {
								connection.query("DELETE FROM gameboard WHERE user = ?",[data.user], function(err, results) {
									if(err) {
										connection.end();
										socket.emit('userdelError', {'error': true});
										throw err;
									} else {
										socket.emit('userdeldone', {'user': data.user});
										connection.end();
									}
								});
							}
						});
					}
				});
			}
		});
	});
	socket.on('requestuserList',function(data) {
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		connection.connect();
		connection.query("SELECT * FROM user",function(error, rows, fields){
			if(error) {
				connection.end();
				throw error;
			} else {
				socket.emit("getuserList", rows);
			}
		});
	});
	socket.on('requestspecificUser',function(data) {
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		connection.connect();
		connection.query("SELECT * FROM user WHERE email = ?", data.user,function(error, rows, fields){
			if(error) {
				connection.end();
				throw error;
			} else {
				socket.emit("getspecificUser", rows);
			}
		});
	});
	socket.on('requestuserDetail',function(data) {
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		connection.connect();
		connection.query("SELECT * FROM userlog WHERE user = ?",[data.user],function(error, rows, fields){
			if(error) {
				connection.end();
				throw error;
			} else {
				socket.emit("getuserDetail", rows);
			}
		});
	});
	socket.on('requestboardList',function(data) {
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		connection.connect();
		connection.query("SELECT * FROM gameboard",function(error, rows, fields){
			if(error) {
				connection.end();
				throw error;
			} else {
				connection.end();
				console.log("board");
				socket.emit("getboardList", rows);
			}
		});
	});
	socket.on('requestsessionList',function(data) {
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		connection.connect();
		connection.query("SELECT * FROM gamesession",function(error, rows, fields){
			if(error) {
				connection.end();
				throw error;
			} else {
				socket.emit("getsessionList", rows);
			}
		});
	});
	socket.on('requestliveplayerList',function(data) {
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		connection.connect();
		connection.query("SELECT * FROM sessionplayer WHERE sid = ?", data.id, function(error, rows, fields){
			if(error) {
				connection.end();
				throw error;
			} else {
				socket.emit("getliveplayerList", {users: rows, hosted: data.host});
			}
		});
	});
});

function userlog(connection, user, action, comment, callback) {	//callback 要記得關閉連線
	var userdata = {
		user: user,
		date: moment().unix(),
		comment: comment,
		action: action
	}
	connection.query('INSERT INTO `userlog` SET ?', userdata, function(error){
		if(error){
			console.log('寫入用戶紀錄失敗！');
			throw error;
		}
		callback();
	});
}

/*var server = http.createServer(function(request, response) {
	var path = url.parse(request.url).pathname;
	fs.readFile(dir + path, function(error, data) {
	if (error){
	  response.writeHead(404);
	  response.write("opps this doesn't exist - 404");
	} else {
		response.writeHead(200, {"Content-Type": mime.lookup(path)});
		response.write(data, "utf8");
	}
	response.end();
	});
});
server.listen(80);*/