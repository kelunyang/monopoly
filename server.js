/*
管理員權限中有一個清除全部session的功能
管理員偷窺功能
安裝程式
*/
var globaldir = "C:\\Users\\Kelunyang\\AppData\\Roaming\\npm\\node_modules\\";
var dir = "C:\\Users\\Kelunyang\\OneDrive\\Webapps\\monopoly";
var http = require("http");
var url = require('url');
var fs = require('fs');
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var mime = require(globaldir+'mime-types');
var io = require(globaldir+'socket.io');
var ios = require(globaldir+'socket.io-express-session');
var ss = require('socket.io-stream');
var mysql = require(globaldir+'mysql');
var MemoryStore = require(globaldir+'sessionstore');
var express = require(globaldir+'express');
var moment = require(globaldir+'moment');
var xml = require('xml2js');
var session = require("express-session");
var cookieParser = require("cookie-parser");
var bodyParser = require('body-parser');
var rimraf = require('rimraf');
var recaptcha2 = require("recaptcha2");
var recaptchainst = new recaptcha2({
	siteKey: "6Lc1QygTAAAAABWcKBCe1x9endamJhWG2sZj4a6Z",
	secretKey:"6Lc1QygTAAAAAJbHu8jvQNrAxl-hBqpAFKBAj9Of"
});
var ingame = false;
var sessionSecret = "mozillapersona";
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
	serverlog("伺服器啟動");
});
allClient = new Array(); //玩家陣列
var serv_io = io(server);
serv_io.use(ios(sessioninstance));
/* GameObjs */
var questionDB = new Array();
var stage = 0;
var currentQuestion = null;
//currentUser = null;	//如果照正常流程登入再操作，這個變數會保留下來
var gameSession = new Object();	//session 暫存點
/* Authericate */
app.use(bodyParser());
//app.use(json());
//app.use(urlencode());
//app.use(cookieParser());
app.use(sessioninstance);
/*require("express-persona")(app, {
	audience: "http://kelunyangvpn.ddns.net", // Must match your browser's address bar 
	verifyResponse: function(err, req, res, email) {
		req.session.currentuser = {
			email: email
		}
		req.session.authorized = true;
		req.session.save();
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
						ability: 0,
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
});*/

/* configure */
app.post("/login",function(req,res) {
	/*req.session.currentuser = false;	//初始化
	req.session.save();
	res.send("done");*/
	recaptchainst.validateRequest(req).then(function(){
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
    // validated and secure
		switch(req.body.type) {
			case "add":
				var salt = saltcreator();
				var record = {
					email: req.body.account,
					salt: salt,
					password: crypto.pbkdf2Sync(req.body.pass,salt,100000,512,"sha512").toString("hex"),
					nickname: "未設定",
					color: "336699",
					icon: "question-circle",
					ability: 0,
					level: 0,
					tutorial: 1
				}
				connection.connect();
				connection.query("INSERT INTO user SET ?", record,function(error){
					if(error) {
						connection.end();
						res.json({
							status: false,
							msg: error.code
						});
					} else {
						serverlog(req.body.account+"已建立");
						connection.query("SELECT * FROM user WHERE email = ?", req.body.account, function(error, rows, fields){
							if(error) {
								connection.end();
								res.json({
									status: false,
									msg: error.code
								});
							} else {
								if(rows.length > 0) {
									var user = rows[0];
									res.json({
										status: true,
										msg: user.email+"("+user.nickname+")登入成功！"
									});
									req.session.currentuser = {
										email: user.email,
										nickname: user.nickname,
										color: user.color,
										icon: user.icon,
										ability: user.ability,
										level: user.level,
										tutorial: user.tutorial
									}
									req.session.save();
								} else {
									res.json({
										status: false,
										msg: "帳號不存在"
									});
								}
								connection.end();
							}
						});
					}
				});
			break;
			case "login":
				connection.connect();
				connection.query("SELECT * FROM user WHERE email = ?", req.body.account, function(error, rows, fields){
					if(error) {
						connection.end();
						res.json({
							status: false,
							msg: error.code
						});
					} else {
						if(rows.length > 0) {
							serverlog(req.body.account+"已登入");
							var user = rows[0];
							if(user.password == crypto.pbkdf2Sync(req.body.pass,user.salt,100000,512,"sha512").toString("hex")) {
								res.json({
									status: true,
									msg: user.email+"("+user.nickname+")登入成功！"
								});
								req.session.currentuser = {
									email: user.email,
									nickname: user.nickname,
									color: user.color,
									icon: user.icon,
									ability: user.ability,
									level: user.level,
									tutorial: user.tutorial
								}
								req.session.save();
							} else {
								res.json({
									status: false,
									msg: "帳號或密碼錯誤！"
								});
							}
						} else {
							res.json({
								status: false,
								msg: "帳號不存在！"
							});
						}
						connection.end();
					}
				});
			break;
		}
	  }).catch(function(errorCodes){
    // invalid
		res.json({
			status: false,
			msg: "驗證錯誤，訊息為："+recaptchainst.translateErrors(errorCodes)
		});
	});
});
app.get("/logout", function(req,res) {
	if(req.session.hasOwnProperty("currentuser")) {
		var msg = req.session.currentuser.nickname+"("+req.session.currentuser.email+")已登出";
		delete req.session.currentuser;
		res.json({
			status: true,
			msg : msg
		});
	} else {
		res.json({
			status: false,
			msg : "用戶不存在，無法登出"
		});
	}
	req.session.save();
});
app.get("/checkUser", function(req,res) {
	if(req.session.hasOwnProperty("currentuser")) {
		res.json({
			status : true,
			msg: req.session.currentuser.nickname+"("+req.session.currentuser.email+")已登入",
		});
	} else {
		res.json({
			status : false,
			msg: "請登入遊戲",
		});
	}
});
app.get("/",function(req,res) {
	fs.readFile(dir+'/index.htm', function(err, data){
		res.send(data.toString());
	});
});
/*app.get("/id",function(req,res) {
	res.send(req.session.currentuser);
});
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
});*/
serv_io.sockets.on('connection', function(socket) {
	var sessioni = socket.handshake.session;
	socket.emit("socketon", { status: true});
    if(sessioni.hasOwnProperty("currentgame")) {	//Online Broadcast
		socket.join("room"+sessioni.currentgame);
		serv_io.to("room"+sessioni.currentgame).emit('userOnline',{ user: sessioni.currentuser.email });
	}
	if(!sessioni.hasOwnProperty("gameSession")) {
		sessioni.gameSession = new Object();
	}
	socket.on("teamOnline", function(data) {	//All Broadcast
		if(sessioni.hasOwnProperty("currentgame")) {	//Offline Broadcast
			serv_io.to("room"+sessioni.currentgame).emit('userEcho',{ user: sessioni.currentuser.email });
		}
	});
	socket.on("disconnect", function(data) {
		if(sessioni.hasOwnProperty("currentgame")) {	//Offline Broadcast
			serv_io.to("room"+sessioni.currentgame).emit('userOffline',{ user: sessioni.currentuser.email });
		}
	});
	socket.on("endgame", function(data) {
		var game = sessioni.gameSession[sessioni.currentgame];
		serv_io.to("room"+sessioni.currentgame).emit('gamesettled',{ 
				message: "第"+game.currentturn+"回合，"+data+"退出遊戲，遊戲結束",
				leaderboard: game.players
		});
		socket.emit("playerout", sessioni.currentgame);
		delete game.players[game.email];
		sessioni.save();
	});
	socket.on("addTurn", function(data) {
		if(sessioni.gameSession[sessioni.currentgame].currentplayer.id == sessioni.currentuser.email) {
			var newstage = false;
			data.players.forEach(function(item) {
				sessioni.gameSession[sessioni.currentgame].players[item.uid].credit = item.credit;
				sessioni.gameSession[sessioni.currentgame].players[item.uid].asset = item.asset;
				sessioni.gameSession[sessioni.currentgame].players[item.uid].position = item.position;
				sessioni.gameSession[sessioni.currentgame].players[item.uid].frozen = item.frozen;
			});
			var stageturn = 0;
			sessioni.gameSession[sessioni.currentgame].currentturn++;
			if(sessioni.gameSession[sessioni.currentgame].currentturn < sessioni.gameSession[sessioni.currentgame].maxround) {
				for(var i=0; i < sessioni.gameSession[sessioni.currentgame].stages.length;i++) {
					stageturn = stageturn + sessioni.gameSession[sessioni.currentgame].stages[i].duration;
					if(sessioni.gameSession[sessioni.currentgame].currentturn <= stageturn) {
						if(i != sessioni.gameSession[sessioni.currentgame].currentstage) {
							newstage = true;
						}
						sessioni.gameSession[sessioni.currentgame].currentstage = i;
						break;
					}
				}
				var players = sessioni.gameSession[sessioni.currentgame].players;
				var querystring = new Array();
				Object.keys(players).forEach(function(key) {
					var item = players[key];
					querystring.push("UPDATE sessionplayer SET score="+item.credit+", asset="+item.asset+", turn="+sessioni.gameSession[sessioni.currentgame].currentturn+", position="+item.position+", frozen="+item.frozen+" WHERE sid="+sessioni.currentgame+" AND uid='"+key+"'");
				});
				var connection = mysql.createConnection({
					host: mysqlServer,
					user: mysqlUser,
					password: mysqlPass,
					database: mysqlDB_string,
					multipleStatements: true
				});
				connection.connect();
				connection.query(querystring.join(";"), function(err, results) {
					if(err){
						connection.end();
						//socket.emit('updateturnerror', {'error': true});
						throw err;
					} else {
						connection.query("UPDATE gamesession SET ? WHERE id = ?",[{bricklog: JSON.stringify(data.brickLog)},sessioni.currentgame], function(err, results) {
							if(err){
								connection.end();
								throw err;
							} else {
								Object.keys(serv_io.sockets.adapter.rooms["room"+sessioni.currentgame].sockets).forEach(function(key) {
									var lock = false;
									var nextsession = null;
									var sessioncount = 0;
									var firstsession = null;
									Object.keys(serv_io.sockets.adapter.rooms["room"+sessioni.currentgame].sockets).forEach(function(key) {
										if(lock) {
											if(sessioncount != serv_io.sockets.adapter.rooms["room"+sessioni.currentgame].length) {
												nextsession = key;
												lock = false;
											}
										}
										sessioncount++;
										if(sessioncount == 1) {
											firstsession = key;
										} 
										if(key == socket.id) {
											lock = true;
										}
									});
									if(nextsession == null) {	//firstsession根本不會rise，所以如果迴圈跑完還是null，那就是第一個了
										nextsession = firstsession;
									}
									serv_io.sockets.connected[nextsession].emit('workingturn',{
										currentstage: sessioni.gameSession[sessioni.currentgame].currentstage,
										currentturn: sessioni.gameSession[sessioni.currentgame].currentturn,
										currentsession: socket.id,
										newstage: newstage
									});
								});
							}
							connection.end();
							sessioni.save();
						});
					}
				});
			} else {
				serv_io.to("room"+sessioni.currentgame).emit('gamesettled',{ 
					message: "最終回合，第"+sessioni.gameSession[sessioni.currentgame].currentturn+"回合，遊戲結束",
					leaderboard: sessioni.gameSession[sessioni.currentgame].players
				});
			}
		} else {
			socket.emit("wrongturn", {
				msg: "目前是"+sessioni.gameSession[sessioni.currentgame].currentplayer.id+"的回合！"
			});
		}
	});
	socket.on("responseTurn", function(data) {
		sessioni.gameSession[sessioni.currentgame].currentplayer = sessioni.gameSession[sessioni.currentgame].players[data.playerid];
		sessioni.save();
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		connection.connect();
		connection.query("UPDATE gamesession SET ? WHERE id = ?",[{currentplayer: data.playerid},sessioni.currentgame], function(err, results) {
			if(err){
				connection.end();
				throw error;
			} else {
				connection.query("SELECT * FROM gamesession WHERE id = ?", [sessioni.currentgame], function(error, rows, fields){
					if(error) {
						connection.end();
						throw error;
					} else {
						var roadDB = new Array();	//推送下一階段的路
						if(data.newstage) {
							sessioni.gameSession[sessioni.currentgame].roads.forEach(function(item) {
								if(item.stage == data.currentstage) {
									roadDB.push(item);
								}
							});
						}
						Object.keys(serv_io.sockets.adapter.rooms["room"+sessioni.currentgame].sockets).forEach(function(key) {
							serv_io.sockets.connected[key].emit('boardcastturn',{
								currentplayer: data.playerid,
								currentstage: data.currentstage,
								currentturn: data.currentturn,
								newstage: data.newstage,
								brickLog: JSON.parse(rows[0].bricklog),
								roadDB: roadDB
							});
						});
						connection.end();
					}
				});
			}
		});
		//serv_io.sockets.connected[gameSession[sessioni.currentgame].players[i].socketid].emit('messagein', sessioni.email+"結束，現在輪到"+gameSession[sessioni.currentgame].currentplayer.id);
	});
			/*Object.keys(gameSession[sessioni.currentgame].players).forEach(function(key) {	//確定目前玩家的順位（上一個玩家）
				if(!playerchanged) {
					if(Object.keys(serv_io.sockets.connected).indexOf(gameSession[sessioni.currentgame].players[key].socketid) != -1) { //略過為上線者
						if(gameSession[sessioni.currentgame].players[key].id != gameSession[sessioni.currentgame].currentplayer.id) {
							if(gameSession[sessioni.currentgame].players[key].order == ((playerindex + 1) % Object.keys(gameSession[sessioni.currentgame].players).length)) {	//只要大於或等於+1，換到下一個玩家
								currentplayer = gameSession[sessioni.currentgame].players[key];
								playerchanged = true;
							}
						}
					}
				}
			});
			gameSession[sessioni.currentgame].currentplayer = currentplayer;*/
	socket.on("sendroommsg", function(data) {	//私訊
		serv_io.to("room"+sessioni.currentgame).emit('messagein',{
			"name":sessioni.currentuser.nickname,
			"email":sessioni.currentuser.email,
			"msg":data,
			"time": moment().unix()
		});
	});
	socket.on("preparemapbackend", function(data) {	//這裡的data就是session id，棋局編號
		ingame = true;
		allClient[sessioni.email] = socket.id;
		data = sessioni.currentgame;
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		connection.connect();
		connection.query("SELECT * FROM gamesession WHERE id = ?", [data], function(error, rows, fields){
			if(error) {
				connection.end();
				throw error;
			} else {
				bid = rows[0].bid;
				id = rows[0].id;
				var currentplayer = rows[0].currentplayer;
				var boardname = ["incidents", "questions", "roads", "shortcuts", "stages", "upgrades"];
				sessioni.gameSession[data] = new Object();
				var obj = sessioni.gameSession[data];
				obj.maxround = rows[0].maxround;
				obj.hosteduser = rows[0].hosteduser;
				obj.currentstage = 0;
				obj.currentturn = 0;
				obj.players = new Object();
				var boardinfo = null;
				connection.query("SELECT * FROM sessionplayer WHERE sid = ?", data, function(error, rows, fields){
					if(error) {
						connection.end();
						throw error;
					} else {
						for(var i=0;i<rows.length;i++) {
							obj.players[rows[i].uid] = {
								id:rows[i].uid,
								order: i,
								asset: new Array(),
								credit: 0,
								score: rows[i].score,
								position: 0
							};
							if(rows[i].uid == currentplayer) {
								obj.currentplayer = obj.players[rows[i].uid];
							}
						}
					}
				});
				connection.query("SELECT * FROM gameboard WHERE id = ?",[bid],function(error, rows, fields){
					if(error) {
						connection.end();
						socket.emit('gameboardreadingError', {'error': true});
						throw error;
					} else {
						boardinfo = new Object();
						boardinfo.name = rows[0].name;
						boardinfo.desc = rows[0].comment;
						boardinfo.maxround = obj.maxround;
						socket.emit('boardprepared', {
							status: true,
							id: id,
							upgrades: obj.upgrades,
							shortcut: obj.shortcuts,
							roads: obj.roads,
							stage: obj.stages,
							incident: obj.incident,
							localplayer: sessioni.currentuser.email,
							currentplayer: obj.currentplayer,
							info: boardinfo
						});
					}
				});
				connection.end();
				var log = 0;
				for(var i=0;i<boardname.length;i++) {
					fs.readFile(dir+"/data/"+bid+"/"+boardname[i]+".xml",function(err, data) {
						var xmldata = xml.parseString(data, function(err, result) {
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
									obj.shortcuts = new Object();
									for(var i=0;i<result.Workbook.Worksheet.length;i++) {
										for(var c=0;c<result.Workbook.Worksheet[i].Table[0].Row.length;c++) {
											var bricks = new Array();
											for(var a=4;a<result.Workbook.Worksheet[i].Table[0].Row[c].Cell.length;a++) {
												bricks.push(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[a].Data[0]._);
											}
											obj.shortcuts[result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._] = {
												name: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._,
												desc: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[1].Data[0]._,
												startturn: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[2].Data[0]._,10),
												endturn: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[3].Data[0]._,10),
												bricks: bricks
											};
										}
									}
								break;
								case "stages":
									obj.stages = new Array();
									for(var i=0;i<result.Workbook.Worksheet.length;i++) {
										for(var c=0;c<result.Workbook.Worksheet[i].Table[0].Row.length;c++) {
											obj.stages.push({
												name: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._,
												desc: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[1].Data[0]._,
												duration: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[2].Data[0]._,10),
												effecttype: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[3].Data[0]._,10),
												effectvalue: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[4].Data[0]._,10)
											});
										}
									}
								break;
								case "upgrades":
									obj.upgrades = new Object();
									for(var i=0;i<result.Workbook.Worksheet.length;i++) {
										for(var c=0;c<result.Workbook.Worksheet[i].Table[0].Row.length;c++) {
											obj.upgrades[result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._] = {
												name: result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._,
												rent: parseFloat(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[1].Data[0]._),
												price: parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[2].Data[0]._,10),
												icon:result.Workbook.Worksheet[i].Table[0].Row[c].Cell[3].Data[0]._,
												desc:result.Workbook.Worksheet[i].Table[0].Row[c].Cell[4].Data[0]._,
												stage:i
											};
										}
									}
								break;
							}
							socket.emit('boardprepared', {
								status: true,
								id: id,
								upgrades: obj.upgrades,
								shortcut: obj.shortcuts,
								roads: obj.roads,
								stage: obj.stages,
								incident: obj.incident,
								localplayer: sessioni.currentuser.email,
								currentplayer: obj.currentplayer,
								info: boardinfo
							});
						});
					});
				}
				sessioni.gameSession[data] = obj;
				sessioni.save();
			}
		});
	});
	socket.on("updateturn", function(data) {
		var stageeffect = false;
		sessioni.gameSession[sessioni.currentgame].currentplayer = sessioni.gameSession[sessioni.currentgame].players[data.currentplayer];
		sessioni.gameSession[sessioni.currentgame].currentturn = data.currentturn;
		if(data.newstage) stageeffect = true;
		sessioni.gameSession[sessioni.currentgame].currentstage = data.currentstage;
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string
		});
		connection.connect();
		connection.query("SELECT * FROM sessionplayer WHERE sid = ?",sessioni.currentgame,function(error, rows, fields){
			if(error) {
				connection.end();
				socket.emit('updateplayerinfoerror');
				throw error;
			} else {
				rows.forEach(function(item) {
					if(stageeffect) {
						var currentstage = sessioni.gameSession[sessioni.currentgame].stages[sessioni.gameSession[sessioni.currentgame].currentstage];
						switch(currentstage.effecttype) {
							case 1:
								item.score += currentstage.effectvalue;
							break;
							case 2:
								item.score -= currentstage.effectvalue;
							break;
						}
					}
					sessioni.gameSession[sessioni.currentgame].players[item.uid].credit = item.score;
					sessioni.gameSession[sessioni.currentgame].players[item.uid].position = item.position;
				});
				socket.emit('updateplayerinfo', {
					current: sessioni.gameSession[sessioni.currentgame].currentplayer.id, 
					other: rows
				});
				connection.end();
				sessioni.save();
			}
		});
	});
	socket.on("startgame", function(data) {
		sessioni.currentgame = data.sid;
		sessioni.save();
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
		connection.query("DELETE FROM sessionplayer WHERE sid = ?", data.sid, function(err, results) {
			if(err) {
				connection.end();
				throw err;
			} else {
				connection.query("DELETE FROM gamesession WHERE id = ?", data.sid, function(err, results) {
					if(err) {
						connection.end();
						throw err;
					} else {
						userlog(connection, sessioni.currentuser.email, 4, JSON.stringify(data), function() {
							Object.keys(serv_io.sockets.connected).forEach(function(key) {
								serv_io.sockets.connected[key].emit('sessionRemoved', data);
							});
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
					socket.leave("room"+sessioni.currentgame);
					delete sessioni.currentgame;
					Object.keys(serv_io.sockets.connected).forEach(function(key) {
						serv_io.sockets.connected[key].emit('requestsessionUsers', data.sid);
					});
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
			bid: data.bid,
		};
		connection.connect();
		connection.query("INSERT INTO sessionplayer SET ?", record,function(error){
			if(error){
				connection.end();
				socket.emit('joinsessionerror', {'error': true});
				throw error;
			} else {
				socket.emit('gamesessionjoined', data.sid);
				sessioni.currentgame = data.sid;
				socket.join("room"+sessioni.currentgame);
				Object.keys(serv_io.sockets.connected).forEach(function(key) {
					serv_io.sockets.connected[key].emit('requestsessionUsers', data.sid);
				});
				sessioni.save();
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
			currentplayer: sessioni.currentuser.email,
			maxplayer: data.maxplayer,
			maxround: data.maxround
		};
		var createdate = record.createdate;
		connection.connect();
		connection.query("INSERT INTO gamesession SET ?", record,function(error){
			if(error){
				socket.emit('gamesessionmanageerror', {'error': true});
			} else {
				connection.query("SELECT * FROM gamesession WHERE createdate = ?",createdate,function(error, rows, fields){
					if(error) {
						socket.emit('gamesessionmanageerror', {'error': true});
					} else {
						record = {
							sid: rows[0].id,
							uid: rows[0].hosteduser,
							bid: rows[0].bid,
						}
						connection.query("INSERT INTO sessionplayer SET ?", record,function(error){
							if(error){
								connection.query("DELETE FROM gamesession WHERE createdate = ?", createdate, function(err, results) {
									socket.emit('gamesessionmanageerror', {'error': error.code});
								});
							} else {
								sessioni.currentgame = rows[0].id;
								socket.join("room"+sessioni.currentgame);
								Object.keys(serv_io.sockets.connected).forEach(function(key) {
									serv_io.sockets.connected[key].emit('gamesessioncreated');
								});
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
	/*socket.on("updatescore", function(data) {
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		var row = {
			score: data.score,
			socketid: socket.id
		};
		connection.connect();
		connection.query("UPDATE sessionplayer SET ? WHERE uid = ? AND sid = ?",[row,sessioni.currentuser.email, sessioni.currentgame], function(err, results) {
			if(err) {
				connection.end();
				throw err;
			} else {
				connection.query("SELECT * FROM sessionplayer WHERE sid = ? AND uid = ?", [sessioni.currentgame, sessioni.currentuser.email], function(error, rows, fields){
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
	});*/
	socket.on('queryQuestion', function(data) {	//問題按照回合重建
		currentQuestion = sessioni.gameSession[sessioni.currentgame].questions[sessioni.gameSession[sessioni.currentgame].currentstage].shift();
		sessioni.gameSession[sessioni.currentgame].currentQuestion = currentQuestion;
		var tempanswer = (currentQuestion.answer / 1);
		var tempreason = currentQuestion.reason;
		currentQuestion.reason = "";
		currentQuestion.answer = -1;	//mask the answer
		socket.emit('sendQuestion', {'question': currentQuestion});
		currentQuestion.answer = tempanswer;
		currentQuestion.reason = tempreason;
		sessioni.save();
	});
	socket.on('checkAnswer',function(data) {
		socket.emit("queryAnswer", { 
			answer: sessioni.gameSession[sessioni.currentgame].currentQuestion.answer,
			reason: sessioni.gameSession[sessioni.currentgame].currentQuestion.reason
		});
	});
	socket.on('checkUser',function(data) {
		if(!sessioni.currentuser) {
			socket.emit("getUser", false);
		} else {
			socket.emit("getUser", {obj:sessioni.currentuser});
		}
	});
	socket.on("checkPrivilege", function(data) {
		if(!sessioni.currentuser) {
			socket.emit("getUser", false);
		} else {
			socket.emit("userPrivilege", {check: sessioni.currentuser.level == 1});
		}
	});
	socket.on("setUser",function(data) {
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
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
	socket.on("onlineBroadcast", function(data) {	//這個和另外一個的差異是，這個是等到遊戲初始化之後才發出更新通知，第一次上線要和時代同步
		var currentstage = sessioni.gameSession[sessioni.currentgame].stages[sessioni.gameSession[sessioni.currentgame].currentstage];
		var currentuser = sessioni.gameSession[sessioni.currentgame].players[sessioni.currentuser.email];
		switch(currentstage.effecttype) {
			case 1:
				currentuser.score += currentstage.effectvalue;
			break;
			case 2:
				currentuser.score -= currentstage.effectvalue;
			break;
		}
		var connection = mysql.createConnection({
			host: mysqlServer,
			user: mysqlUser,
			password: mysqlPass,
			database: mysqlDB_string,
			multipleStatements: true
		});
		connection.connect();
		connection.query("UPDATE sessionplayer SET score=? WHERE sid=? AND uid=?",[currentuser.score, sessioni.currentgame, currentuser.id], function(err, results) {
			if(err){
				connection.end();
				//socket.emit('updateturnerror', {'error': true});
				throw err;
			} else {
				serv_io.to("room"+sessioni.currentgame).emit('userOnline',{ user: sessioni.currentuser.email });
				sessioni.save();
				connection.end();
			}
		});
	});
	socket.on("retrivesessionaliveUsers", function(data) {	//線上用戶名單, filter代表要不要過濾
		var sid = !data.sid ? sessioni.currentgame : data.sid; 
		var output = new Object();
		var connection = mysql.createConnection({
			host: 'localhost',
			user: 'webapp',
			password: '75*0F*d4b6',
			database: 'monopoly'
		});
		connection.connect();
		connection.query("SELECT * FROM sessionplayer WHERE sid = ?", sid, function(err, rows, fields) {
			if(err) {
				connection.end();
				throw err;
			} else {
				var current = undefined;
				if(sessioni.gameSession.hasOwnProperty(sid)) {
					current = sessioni.gameSession[sid].currentplayer;
					var players = sessioni.gameSession[sid].players;
					if(Object.keys(players).length > 0) {
						for(var i=0;i<rows.length;i++) {
							if(players.hasOwnProperty(rows[i].uid)) {
								players[rows[i].uid].position = rows[i].position;
								players[rows[i].uid].credit = rows[i].score;
							} else {
								players[rows[i].uid] = {
									id:rows[i].uid,
									order: i,
									asset: new Array(),
									credit: 0,
									score: rows[i].score,
									position: rows[i].position
								};
								if(rows[i].uid == current) {
									current = players[rows[i].uid];
								}
							}
						}
					}
				}
				for(var i=0;i<rows.length;i++) {
					output[rows[i].uid] = new Object();
					output[rows[i].uid].position = rows[i].position;
					output[rows[i].uid].uid = rows[i].uid;
					output[rows[i].uid].credit = rows[i].score;
					output[rows[i].uid].asset = 0;
					if(sessioni.gameSession.hasOwnProperty(sid)) {
						output[rows[i].uid].nickname = players[rows[i].uid].nickname;
						output[rows[i].uid].icon = players[rows[i].uid].icon;
						output[rows[i].uid].color = players[rows[i].uid].color;
					}
				}
				Object.keys(serv_io.sockets.connected).forEach(function(key) {
					serv_io.sockets.connected[key].emit('updatealiveList', {	//應該要先getplayerList`
						current: current,
						players: output
					});
				});
			}
			sessioni.save();
			connection.end();
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
				var user = rows[0];
				connection.query("SELECT * FROM sessionplayer WHERE uid = ? AND sid = ?", [data.user,sessioni.currentgame], function(error, rows, fields){
					if(error) {
						connection.end();
						throw error;
					} else {
						socket.emit('getspecificUser', {
							email: user.email,
							nickname: user.nickname,
							color: user.color,
							icon: user.icon,
							asset: rows[0].asset,
							position: rows[0].position
						});
						connection.end();
					}
				});
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
	socket.on('requestplayerList',function(data) {
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
				for(var i=0;i<rows.length;i++) {
					rows[i].email = rows[i].uid;
				}
				serv_io.to("room"+sessioni.currentgame).emit('getplayerList',{users: rows, hosted: sessioni.gameSession[sessioni.currentgame].hosteduser});
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
			throw error;
		}
		callback();
	});
}

function saltcreator() {
	var code1 = String.fromCharCode(Math.round(Math.random()*100));
	while(code1 == "") {
		code1 = String.fromCharCode(Math.round(Math.random()*100));
	}
	var code2 = String.fromCharCode(Math.round(Math.random()*100));
	while(code2 == "") {
		code2 = String.fromCharCode(Math.round(Math.random()*100));
	}
	return code1 + Math.round(Math.random()*10000000000) + code2;
}

function serverlog(message) {	//display message with date in console.log
	console.log("["+moment().format("YYYY/MM/DD HH:mm:SS")+"]"+message);
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