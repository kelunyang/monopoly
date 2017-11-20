/*
管理員權限中有一個清除全部session的功能
管理員偷窺功能
安裝程式
不在回合中不可以擲骰子
動畫應該要用css3 animation
*/
var globaldir = "C:\\Users\\Kelunyang\\AppData\\Roaming\\npm\\node_modules\\";
var http = require("http");
var url = require('url');
var fs = require(globaldir+'fs-extra');
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var mime = require(globaldir+'mime-types');
var io = require(globaldir+'socket.io');
var ios = require(globaldir+'express-socket.io-session');
var ss = require('socket.io-stream');
var mysql = require(globaldir+"promise-mysql");
var MemoryStore = require(globaldir+'sessionstore');
var express = require(globaldir+'express');
var moment = require(globaldir+'moment');
var xml = require('xml2js');
var session = require("express-session");
var bodyParser = require('body-parser');
var recaptcha2 = require("recaptcha2");
var recaptchainst = null;
var pool = null;
var session_store = MemoryStore.createSessionStore();
var sessioninstance = session({
	secret: 'IOUJGB(UG*(&R',
	resave: true,
	saveUninitialized: true,
	store: session_store,
	cookie: {maxAge: 1800000}
})
var api = {
	recaptcha: {
		key: undefined,
		secret: undefined
	},
	mysql: {
		host: undefined,
		user: undefined,
		password: undefined,
		dbname: undefined
	}
}

var app = express();
app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
  })); 
var server = http.Server(app);
app.use(express.static(__dirname));
server.listen(80,function() {
	serverlog("伺服器啟動");
	fs.readFile(__dirname+'/apikeys.json', (err, data) => {
		api = JSON.parse(data);
		pool = mysql.createPool({
			host: api.mysql.host,
			user: api.mysql.user,
			password: api.mysql.password,
			database: api.mysql.dbname,
			connectionLimit: 10,
			multipleStatements: true
		});
		recaptchainst = new recaptcha2({
			siteKey: api.recaptcha.key,
			secretKey: api.recaptcha.secret
		});
		serverlog("程式載入完成！");
	});
});
allClient = new Array(); //玩家陣列
var serv_io = io(server);
serv_io.use(ios(sessioninstance));
/* GameObjs */
var questionDB = new Array();
var stage = 0;
var currentQuestion = null;
var gameSession = new Object();	//session 暫存點
app.use(sessioninstance);


/* configure */
app.post("/login",function(req,res) {
	/*req.session.currentuser = false;	//初始化
	req.session.save();
	res.send("done");*/
	recaptchainst.validateRequest(req).then(function(){
		var ipaddress = req.ips.length == 0 ? req.ip : req.ips ;
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
				pool.getConnection().then(async (connection) => {
					await connection.query("INSERT INTO user SET ?", record);
					return connection;
				}).then(async(connection) => {
					await connection.query("SELECT * FROM user WHERE email = ?", req.body.account).then((rows) => {
						if(rows.length > 0) {
							serverlog(req.body.account+"已建立 \n"+req.headers['user-agent'],ipaddress);
							var user = rows[0];
							res.json({
								status: true,
								level: rows[0].level,
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
					}).catch((error) => {
						res.json({
							status: false,
							msg: error.code
						});
						serverlog(req.body.account+"帳號建立失敗 \n"+req.headers['user-agent'],ipaddress);
					});
					pool.releaseConnection(connection);
				})
				.catch((error) => {
					res.json({
						status: false,
						msg: error.code
					});
				});
			break;
			case "login":
				pool.getConnection().then(async (connection) => {
					await connection.query("SELECT * FROM user WHERE email = ?", req.body.account)
					.then((rows) => {
						if(rows.length > 0) {
							var user = rows[0];
							if(user.password == crypto.pbkdf2Sync(req.body.pass,user.salt,100000,512,"sha512").toString("hex")) {
								res.json({
									status: true,
									level: rows[0].level,
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
								serverlog(req.body.account+"已登入 \n"+req.headers['user-agent'],ipaddress);
							} else {
								serverlog(req.body.account+"登入失敗 \n"+req.headers['user-agent'],ipaddress);
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
					});
					pool.releaseConnection(connection);
				})
				.catch((error) => {
					res.json({
						status: false,
						msg: error.code
					});
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
			level: req.session.currentuser.level,
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
	fs.readFile(__dirname+'/index.htm', function(err, data){
		res.send(data.toString());
	});
});
serv_io.of("/fileupload").on("connection", function(socket) {
	var sessioni = socket.handshake.session;
	var ipaddress = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
	ss(socket).on("mapConfigs", function(stream, data) {
		try {
			//if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			stream.pipe(fs.createWriteStream(__dirname+"/data/"+data.boardid+"/"+data.type+".xml"));	//fs.createWriteStream opintion default set to override
		} catch(e) {
			serverlog("在fileupload操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
});
serv_io.sockets.on('connection', function(socket) {
	var ipaddress = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
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
		try {
			if(sessioni.hasOwnProperty("currentgame")) {	//Offline Broadcast
				serv_io.to("room"+sessioni.currentgame).emit('userEcho',{ user: sessioni.currentuser.email });
			}
		} catch(e) {
			serverlog("在teamOnline操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("disconnect", function(data) {
		try {
			if(sessioni.hasOwnProperty("currentgame")) {	//Offline Broadcast
				serv_io.to("room"+sessioni.currentgame).emit('userOffline',{ user: sessioni.currentuser.email });
			}
		} catch(e) {
			serverlog("在disconnect操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("endgame", function(data) {
		try {
			if(sessioni.hasOwnProperty("currentgame")) {	//Offline Broadcast
				var game = sessioni.gameSession[sessioni.currentgame];
				serv_io.to("room"+sessioni.currentgame).emit('gamesettled',{ 
						message: "第"+game.currentturn+"回合，"+data+"退出遊戲，遊戲結束",
						leaderboard: game.players
				});
				socket.emit("playerout", sessioni.currentgame);
				delete game.players[game.email];
				sessioni.save();
			}
		} catch(e) {
			serverlog("在endgame操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("addTurn", function(data) {
		try {
			if(sessioni.gameSession[sessioni.currentgame].currentplayer.id == sessioni.currentuser.email) {
				var newstage = sessioni.gameSession[sessioni.currentgame].currentstage;
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
								var newrecord = new Array();
								newstage = i;
								pool.getConnection().then(async (connection) => {
									await connection.query("SELECT * FROM sessionplayer WHERE sid = ?",sessioni.currentgame)
									.then((rows) => {
										rows.forEach(function(item) {
											var currentstage = sessioni.gameSession[sessioni.currentgame].stages[i];
											switch(currentstage.effecttype) {
												case 1:
													item.score += currentstage.effectvalue;
												break;
												case 2:
													item.score -= currentstage.effectvalue;
												break;
											}
											sessioni.gameSession[sessioni.currentgame].players[item.uid].credit = item.score;
											sessioni.gameSession[sessioni.currentgame].players[item.uid].position = item.position;
										});
									})
									.catch((error) => {
										socket.emit('updateplayerinfoerror');
									})
									pool.releaseConnection(connection);	
								});
							}
							sessioni.gameSession[sessioni.currentgame].currentstage = i;
							break;
						}
					}
					pool.getConnection().then(async (connection) => {
						var querystring = new Array();
						await connection.query("UPDATE gamesession SET ? WHERE id = ?",[
							{
								currentstage: newstage,
								currentturn: sessioni.gameSession[sessioni.currentgame].currentturn
							},
							sessioni.currentgame
						]).then((rows) => {
							var players = sessioni.gameSession[sessioni.currentgame].players;
							Object.keys(players).forEach(function(key) {
								var item = players[key];
								querystring.push("UPDATE sessionplayer SET turn="+sessioni.gameSession[sessioni.currentgame].currentturn+", position="+item.position+", frozen="+item.frozen+" WHERE sid="+sessioni.currentgame+" AND uid='"+key+"'");
							});
						});
						return {
							querystring: querystring,
							connection: connection
						}
					}).then(async (obj) => {
						await obj.connection.query(obj.querystring.join(";"))
						.then((rows) => {
							Object.keys(serv_io.sockets.adapter.rooms["room"+sessioni.currentgame].sockets).forEach((key) => {
								var lock = false;
								var nextsession = null;
								var sessioncount = 0;
								var firstsession = null;
								Object.keys(serv_io.sockets.adapter.rooms["room"+sessioni.currentgame].sockets).forEach((key) => {
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
									currentsession: socket.id
								});
								serv_io.to("room"+sessioni.currentgame).emit('mapUpdated');
							});
						});
						sessioni.save();
						pool.releaseConnection(obj.connection);
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
		} catch(e) {
			serverlog("在addTurn操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("responseTurn", function(data) {
		try {
			sessioni.gameSession[sessioni.currentgame].currentplayer = sessioni.gameSession[sessioni.currentgame].players[data.playerid];
			sessioni.save();
			pool.getConnection().then(async (connection) => {
				await connection.query("UPDATE gamesession SET ? WHERE id = ?",[{currentplayer: data.playerid},sessioni.currentgame])
				serv_io.to("room"+sessioni.currentgame).emit('boardcastturn', {
					currentplayer: data.playerid
				});
				pool.releaseConnection(connection);	
			})
			//serv_io.sockets.connected[gameSession[sessioni.currentgame].players[i].socketid].emit('messagein', sessioni.email+"結束，現在輪到"+gameSession[sessioni.currentgame].currentplayer.id);
		} catch(e) {
			serverlog("在responseTurn操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
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
		try {
			serv_io.to("room"+sessioni.currentgame).emit('messagein',{
				"name":sessioni.currentuser.nickname,
				"email":sessioni.currentuser.email,
				"msg":data,
				"time": moment().unix()
			});
		} catch(e) {
			serverlog("在sendroommsg操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("preparemapbackend", function(data) {	//這裡的data就是session id，棋局編號, type 是只要針對什麼進行讀取，先讀sql，再讀xml
		try {
			if(!sessioni.hasOwnProperty("currentgame")) throw "currentgame未設定";
			allClient[sessioni.email] = socket.id;
			type = data.type;
			data = sessioni.currentgame;
			sessioni.gameSession[data] = sessioni.gameSession.hasOwnProperty(data) ? sessioni.gameSession[data] : new Object();
			var obj = sessioni.gameSession[data];
			if(type == 1) {
				pool.getConnection().then(async (connection) => {
					var currentplayer = null;
					await connection.query("SELECT * FROM gamesession WHERE id = ?", [data])
					.then((rows) => {
						bid = rows[0].bid;
						id = rows[0].id;
						currentplayer = rows[0].currentplayer;
						obj.maxround = rows[0].maxround;
						obj.hosteduser = rows[0].hosteduser;
						obj.currentstage = rows[0].currentstage;
						obj.currentturn = 0;
						obj.players = new Object();
					});
					return {
						connection: connection,
						currentplayer: currentplayer
					};
				}).then(async(retobj) => {
					if(type == 1) {
						await retobj.connection.query("SELECT * FROM sessionplayer WHERE sid = ?", data)
						.then((rows) => {
							if(rows.length == 0) {
								socket.emit('gameboardreadingError', {'error': true});
								throw "已登出的用戶企圖存取遊戲";
							}
							for(var i=0;i<rows.length;i++) {
								obj.players[rows[i].uid] = {
									id:rows[i].uid,
									order: i,
									asset: new Array(),
									credit: 0,
									score: rows[i].score,
									position: 132
								};
								if(rows[i].uid == retobj.currentplayer) {
									obj.currentplayer = obj.players[rows[i].uid];
								}
							}
						});
					}
					return retobj.connection;
				}).then(async(connection) => {
					if(type == 1) {
						await connection.query("SELECT * FROM gameboard WHERE id = ?",[bid])
						.then((rows) => {
							obj.boardinfo = new Object();
							obj.boardinfo.name = rows[0].name;
							obj.boardinfo.desc = rows[0].comment;
							obj.boardinfo.maxround = obj.maxround;
							obj.boardinfo.sid = sessioni.currentgame;
							sessioni.save();
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
								info: obj.boardinfo,
								type: 1
							});
						})
						.catch((error) => {
							socket.emit('gameboardreadingError', {'error': true});
						});
					}
					pool.releaseConnection(connection);	
				});
			} else if(type == 2) {
				fs.readFile(__dirname+"/data/"+bid+"/stages.xml",function(err,data) {
					obj.stages = new Array();
					var xmldata = xml.parseString(data, function(err, result) {
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
					});
					sessioni.save();
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
						info: obj.boardinfo,
						type: 2
					});
					var boardname = ["incidents", "questions", "roads", "shortcuts", "upgrades"];
					for(var i=0;i<boardname.length;i++) {
						fs.readFile(__dirname+"/data/"+bid+"/"+boardname[i]+".xml",function(err, data) {
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
									//問題一定要比回合多，所以把maxround拿來，全部問題deepclone一次，再打散
										var tempquestions = new Array();	//問題庫
										obj.questions = new Array();
										for(var i=0;i<result.Workbook.Worksheet.length;i++) {
											var stagequestion = new Array();
											for(var c=0;c<result.Workbook.Worksheet[i].Table[0].Row.length;c++) {
												var answers = new Array();
												for(var a=4;a<result.Workbook.Worksheet[i].Table[0].Row[c].Cell.length;a++) {
													answers.push(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[a].Data[0]._);
												}
												var qobj = {
													stage: i,
													question:result.Workbook.Worksheet[i].Table[0].Row[c].Cell[0].Data[0]._,
													credit:parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[1].Data[0]._,10),
													answer:parseInt(result.Workbook.Worksheet[i].Table[0].Row[c].Cell[2].Data[0]._,10),
													reason:result.Workbook.Worksheet[i].Table[0].Row[c].Cell[3].Data[0]._,
													answers:answers
												};
												stagequestion.push(qobj);
												tempquestions.push(qobj);
											}
										}
										for(var i=obj.questions.length;i<obj.stages.length;i++) {
											scount = obj.questions.length-1;
											var stagequestion = new Array();
											for(var s=0;s<tempquestions.length;s++) {	//deepclone
												var answers = new Array();
												for(var a=0;a<tempquestions[s].answers.length;a++) {
													answers.push(tempquestions[s].answers[a]);
												}
												stagequestion.push({
													stage: scount,
													question:tempquestions[s].question,
													credit:tempquestions[s].credit,
													answer:tempquestions[s].answer,
													reason:tempquestions[s].reason,
													answers:answers
												});
											}
											obj.questions.push(stagequestion);
										}
										for(var i=0;i<obj.questions.length;i++) {	//extend questions
											var stagequestion = obj.questions[i];
											if(stagequestion.length < obj.maxround) {
												var remain = obj.maxround - stagequestion.length;
												for(var r=0;r<remain;r++) {
													var answers = new Array();
													for(var a=0;a<stagequestion[r % stagequestion.length].answers.length;a++) {
														answers.push(stagequestion[r % stagequestion.length].answers[a]);
													}
													stagequestion.push({
														stage: i,
														question:stagequestion[r % stagequestion.length].question,
														credit:stagequestion[r % stagequestion.length].credit,
														answer:stagequestion[r % stagequestion.length].answer,
														reason:stagequestion[r % stagequestion.length].reason,
														answers:answers
													});
												}
											}
											stagequestion.sort(function(a,b) {return 0.5-Math.random();});
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
												if(result.Workbook.Worksheet[i].Table[0].Row[c].hasOwnProperty("Cell")) {
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
										obj.upgrades["交通要道"] = {
											name: "交通要道",
											rent: 1.0,
											price: 750,
											icon:"code-fork",
											stage: 0,
											desc: "騙學費",
											type: 1
										}
									break;
								}
								sessioni.save();
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
									info: obj.boardinfo,
									type: 2
								});
							});
						});
					}
				});
			}
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在preparegamebackend操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("removeBrick", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			var record = [
				data.brick.index,
				sessioni.currentgame
			];
			pool.getConnection().then(async (connection) => {
				var action = null;
				await connection.query("SELECT rid, owner FROM sessionblocks WHERE rid = ? AND sid = ?",record)
				.then((rows) => {
					var uDB = new Array();
					data.brick.upgrades.forEach(function(item) {
						uDB.push(item.name);
					});
					newrecord = {
						owner:null
					};
					if(rows.length > 0) {
						if(rows[0].owner == data.player.uid) {
							action = 1;
						} else {
							socket.emit('brickRemoveFailed', {'failed': true});
						}
					} else {
						socket.emit('blockmanageError', {'error': true});
						throw error;
					}
				})
				.catch((error) => {
					socket.emit('blockmanageError', {'error': true});
				});
				return connection;
			}).then(async(connection) => {
				await connection.query("UPDATE sessionblocks SET ? WHERE rid = ? AND sid = ?",[newrecord,record])
				.then(() => {
					serv_io.to("room"+sessioni.currentgame).emit('playerscoreUpdated');
					serv_io.to("room"+sessioni.currentgame).emit('mapUpdated');
				})
				.catch((error) => {
					socket.emit('blockmanageError', {'error': true});
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在removeBrick操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("upgradeBrick", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			var record = [
				sessioni.currentgame,
				data.brick.index
			];
			pool.getConnection().then(async (connection) => {
				record = null;
				await connection.query("SELECT rid, owner, upgrades FROM sessionblocks WHERE sid = ? AND rid = ?",record)
				.then((rows) => {
					if(rows.length > 0) {
						if(rows[0].owner == data.player.uid) {
							var upgrades = rows[0].upgrades == "" ? new Array() : rows[0].upgrades.split(",");
							if(upgrades.indexOf(data.upgrade) == -1) {
								upgrades.push(data.upgrade.name);
							}
							record = [
								{
									upgrades: upgrades.join()
								},
								record[0],
								record[1]
							]
						} else {
							throw error;
						}
					} else {
						throw error;
					}
				})
				.catch((error) => {
					throw error
				});
				return {
					record: record,
					connection: connection
				}
			})
			.then(async (obj) => {
				await obj.connection.query("UPDATE sessionblocks SET ? WHERE sid = ? AND rid = ?",obj.record)
				.then(() => {
					serv_io.to("room"+sessioni.currentgame).emit('playerscoreUpdated');
					serv_io.to("room"+sessioni.currentgame).emit('mapUpdated');
				});
			}).catch((error) => {
				socket.emit('blockmanageError', {'error': true});
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在upgradeBrick操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("addBrick", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			var record = [
				data.brick.index,
				sessioni.currentgame
			];
			pool.getConnection().then(async (connection) => {
				var record = null;
				var action = null;
				await connection.query("SELECT rid, owner FROM sessionblocks WHERE sid = ? AND rid = ?",record)
				.then((rows) => {
					var uDB = new Array();
					data.brick.upgrades.forEach(function(item) {
						uDB.push(item.name);
					});
					var newrecord = {
						rid:data.brick.index,
						sid:sessioni.currentgame,
						owner:data.player.uid,
						type:data.brick.type,
						active:data.brick.active ? 1 : 0,
						shortcut:data.brick.shortcut ? 1 : 0,
						upgrades:uDB.join()
					}
					record = [
						newrecord,
						record[0],
						record[1]
					]
					if(data.player.credit > data.brick.price) {
						if(rows.length > 0) {
							if(rows[0].owner == null) {
								action = 0;
							} else {
								throw {
									id: 'brickAddFailed',
									msg: {'failed': true}
								}
							}
						} else {
							action = 1;
						}
					} else {
						throw {
							id: 'pricelowError',
							msg: "你的現金太少，無法購買"+data.brick.name
						}
					}
				}).catch((error) => {
					throw error;
				});
				return {
					connection: connection,
					action: action,
					record: record
				}
			}).then(async (obj) => {
				if(obj.action == 0) {
					await obj.connection.query("UPDATE sessionblocks SET ? WHERE sid = ? AND rid = ?",obj.record)
					.then(() => {
						serv_io.to("room"+sessioni.currentgame).emit('playerscoreUpdated');
						serv_io.to("room"+sessioni.currentgame).emit('mapUpdated');
					}).catch((error) => {
						throw error
					});
				} else if(obj.action == 1) {
					await obj.connection.query("INSERT INTO sessionblocks SET ?", obj.record[0])
					.then(() => {
						serv_io.to("room"+sessioni.currentgame).emit('playerscoreUpdated');
						serv_io.to("room"+sessioni.currentgame).emit('mapUpdated');
					}).catch((error) => {
						throw error
					})
				}
				pool.releaseConnection(obj.connection);
			}).catch((error) => {
				if(error.id == "pricelowError") {
					socket.emit('pricelowError', error.msg);
				} else {
					socket.emit('blockmanageError', {'error': true});
				}
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在addBrick操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("requestBricklog", function() {
		if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
		var record = [
			sessioni.currentgame
		];
		pool.getConnection().then(async (connection) => {
			var blockrows = null;
			await connection.query("SELECT * FROM sessionblocks WHERE sid = ?",record)
			.then((rows) => {
				blockrows.forEach(function(b) {
					var brick = null;
					sessioni.gameSession[sessioni.currentgame].roads.forEach(function(r) {
						if(r.brick == b.rid) {
							brick = r;
						}
					});
					b.type = b.type == 1 ? true : false;
					b.active = b.active == 1 ? true : false;
					b.shortcut = b.shortcut == 1 ? true : false;
					b.desc = brick != null ? brick.desc : "";
					b.name = brick != null ? brick.name : "";
					b.price = brick != null ? brick.price : 0;
				});
			})
			.catch((error) => {
				socket.emit('assetmanageError', {'error': true});
			})
			return {
				connection: connection,
				blockrows: blockrows
			}
		}).then(async (obj) => {
			var action = null;
			var querystring = null;
			var returnrows = null;
			var roadDB = null;
			var shortcutstatus = null;
			await obj.connection.query("SELECT * FROM gamesession WHERE id = ?",sessioni.currentgame)
			.then((rows) => {
				returnrows = rows;
				sessioni.gameSession[sessioni.currentgame].currentturn = rows[0].currentturn;
				sessioni.gameSession[sessioni.currentgame].currentstage = rows[0].currentstage;
				roadDB = new Array();
				sessioni.gameSession[sessioni.currentgame].roads.forEach(function(item) {
					if(item.stage <= sessioni.gameSession[sessioni.currentgame].currentstage) {
						roadDB.push(item);
					}
				});
				var shortcuts = sessioni.gameSession[sessioni.currentgame].shortcuts;
				var players = sessioni.gameSession[sessioni.currentgame].players;
				shortcutstatus = false;
				Object.keys(shortcuts).forEach(function(key) {
					var shortcut = shortcuts[key];
					if(sessioni.gameSession[sessioni.currentgame].currentturn == shortcut.startturn) {	//開始捷徑
						shortcutstatus = {
							name: shortcut.name,
							status: true
						}
					}
					if(sessioni.gameSession[sessioni.currentgame].currentturn == shortcut.endturn) {	//關閉捷徑
						shortcutstatus = {
							name: shortcut.name,
							status: false
						}
						Object.keys(players).forEach(function(key) {
							var item = players[key];
							if(shortcut.bricks.indexOf(item.position.toString()) > 0) {	// 玩家在捷徑中
								if(shortcut.bricks.indexOf(item.position.toString()) <= Math.round(shortcut.bricks.length / 2)) {
									item.position = parseInt(shortcut.bricks[0],10);
								} else {
									item.position = parseInt(shortcut.bricks[shortcut.bricks.length - 1],10);
								}
							}
						});
					}
				});
				querystring = new Array();
				Object.keys(players).forEach(function(key) {
					var item = players[key];
					querystring.push("UPDATE sessionplayer SET position="+item.position+" WHERE sid="+sessioni.currentgame+" AND uid='"+key+"'");
				});
			});
			return {
				connection: obj.connection,
				rows: returnrows,
				querystring: querystring,
				roadDB: roadDB,
				shortcutstatus: shortcutstatus,
				blockrows: obj.blockrows
			};
		}).then(async(obj) => {
			await obj.connection.query(obj.querystring.join(";"))
			.then(() => {
				socket.emit('getBricklog', {
					info: {
						currentturn: obj.rows[0].currentturn,
						currentstage: obj.rows[0].currentstage
					},
					log: obj.blockrows,
					roadDB: obj.roadDB,
					shortcut: obj.shortcutstatus
				});
			});
			pool.releaseConnection(obj.connection);	
		});
	});
	socket.on("caculateAsset", function(data) {
		if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
		var record = [
			sessioni.currentgame
		];
		pool.getConnection().then(async (connection) => {
			blockrows = null;
			await connection.query("SELECT rid, owner, upgrades FROM sessionblocks WHERE sid = ?",record)
			.then((rows) => {
				blockrows = rows;
			})
			.catch((error) => {
				throw error;
			})
			return {
				connection: connection,
				blockrows: blockrows
			};
		}).then(async(obj) => {
			await obj.connection.query("SELECT uid, score FROM sessionplayer WHERE sid = ?",record)
			.then((playerrows) => {
				var players = new Object();
				playerrows.forEach(function(player) {
					players[player.uid] = new Object();
					players[player.uid].credit = player.score;
					players[player.uid].asset = player.score;
					obj.blockrows.forEach(function(blockrow) {
						var rent = 0.2;
						if(obj.blockrow.owner == player.uid) {
							if(blockrow.upgrades != null) {
								var upgrades = obj.blockrow.upgrades == "" ? new Array() : obj.blockrow.upgrades.split(",");
								upgrades.forEach(function(up) {
									rent += sessioni.gameSession[sessioni.currentgame].upgrades[up].rent;
								});
							}
							sessioni.gameSession[sessioni.currentgame].roads.forEach(function(r) {
								if(r.index == blockrow.rid) {
									players[player.uid].asset += r.price * (1+rent);
								}
							});
						}
					});
				});
				socket.emit('playerAssets', players);
			})
			.catch((error) => {
				throw error;
			})
			pool.releaseConnection(obj.connection);	
		}).catch((error) => {
			socket.emit('assetmanageError', {'error': true});
		})
	});
	socket.on("updateturn", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentgame")) throw "currentgame未設定";
			sessioni.gameSession[sessioni.currentgame].currentplayer = sessioni.gameSession[sessioni.currentgame].players[data.currentplayer];
			/*sessioni.gameSession[sessioni.currentgame].currentturn = data.currentturn;
			sessioni.gameSession[sessioni.currentgame].currentstage = data.currentstage;*/
			pool.getConnection().then(async (connection) => {
				await connection.query("SELECT * FROM sessionplayer WHERE sid = ?",sessioni.currentgame)
				.then((rows) => {
					rows.forEach(function(item) {
						sessioni.gameSession[sessioni.currentgame].players[item.uid].credit = item.score;
						sessioni.gameSession[sessioni.currentgame].players[item.uid].position = item.position;
					});
					socket.emit('updateplayerinfo', {
						current: sessioni.gameSession[sessioni.currentgame].currentplayer.id, 
						other: rows
					});
					sessioni.save();
				})
				.catch((error) => {
					socket.emit('updateplayerinfoerror');
				})
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在updateturn操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("startgame", function(data) {
		try {
			sessioni.currentgame = data.sid;
			sessioni.save();
			socket.emit("gamestarted", {status: true});
		} catch(e) {
			serverlog("在startgame操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("removemap", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			pool.getConnection().then(async (connection) => {
				await connection.query("DELETE FROM sessionplayer WHERE bid = ?",[data.id]);
				return connection;
			}).then(async(connection) => {
				await connection.query("DELETE FROM gamesession WHERE bid = ?",[data.id]);
				return connection;
			}).then(async(connection) => {
				await connection.query("DELETE FROM gameboard WHERE id = ?",[data.id]);
				userlog(connection, sessioni.currentuser.email, 4, JSON.stringify(data), function() {
					fs.remove(__dirname+"/data/"+data.id).then(() => {
						socket.emit("gameboardRemoved", data);
					});
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在removemap操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("removesession", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			var sid = undefined;
			if(data.sid == false) {
				if(sessioni.gameSession[sessioni.currentgame].hosteduser == sessioni.currentuser.email) {
					sid = sessioni.currentgame;
					delete sessioni.currentgame;
				}
			} else {
				sid = data.sid;
			}
			if(sid != undefined) {
				pool.getConnection().then(async (connection) => {
					await connection.query("DELETE FROM sessionplayer WHERE sid = ?", sid);
					return connection;
				}).then(async(connection) => {
					await connection.query("DELETE FROM sessionblocks WHERE sid = ?", sid);
					return connection;
				}).then(async(connection) => {
					await connection.query("DELETE FROM gamesession WHERE id = ?", sid);
					data.sid = sid;	//為了log寫回去
					userlog(connection, sessioni.currentuser.email, 4, JSON.stringify(data), function() {
						Object.keys(serv_io.sockets.connected).forEach(function(key) {
							serv_io.sockets.connected[key].emit('sessionRemoved', data);
						});
					});
					pool.releaseConnection(connection);	
				});
			}
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在removesession操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("exitsession", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentgame")) throw "currentgame未設定";
			pool.getConnection().then(async (connection) => {
				await connection.query("DELETE FROM sessionplayer WHERE uid = ? AND sid = ?", [data.uid, data.sid]);
				userlog(connection, sessioni.currentuser.email, 4, JSON.stringify(data), function() {
					socket.leave("room"+sessioni.currentgame);
					//delete sessioni.currentgame;
					Object.keys(serv_io.sockets.connected).forEach(function(key) {
						serv_io.sockets.connected[key].emit('socket.requestuestsessionUsers', data.sid);
					});
					socket.emit("sessionleaved", data);
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在exitsession操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("joinsession", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			var record = {
				sid: data.sid,
				uid: sessioni.currentuser.email,
				bid: data.bid,
			};
			pool.getConnection().then(async (connection) => {
				await connection.query("INSERT INTO sessionplayer SET ?", record)
				.then(() => {
					socket.emit('gamesessionjoined', data.sid);
					sessioni.currentgame = data.sid;
					socket.join("room"+sessioni.currentgame);
					Object.keys(serv_io.sockets.connected).forEach(function(key) {
						serv_io.sockets.connected[key].emit('requestsessionUsers', data.sid);
					});
					sessioni.save();
				})
				.catch((error) => {
					socket.emit('joinsessionerror', {'error': true});
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在joinsession操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("createsession", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			var record = {
				bid: data.bid,
				createdate: moment().unix(),
				hosteduser: sessioni.currentuser.email,
				currentplayer: sessioni.currentuser.email,
				maxplayer: data.maxplayer,
				maxround: data.maxround,
				currentstage: 0,
				currentturn: 0
			};
			var action = 0;
			var createdate = record.createdate;
			pool.getConnection().then(async (connection) => {
				await connection.query("INSERT INTO gamesession SET ?", record);
				return connection;
			}).then(async (connection) => {
				var returnrows = null;
				await connection.query("SELECT * FROM gamesession WHERE createdate = ?",createdate)
				.then((rows) => {
					returnrows = rows;
					record = {
						sid: rows[0].id,
						uid: rows[0].hosteduser,
						bid: rows[0].bid,
					}
				}).catch((error) => {
					throw error;
				})
				return {
					connection: connection,
					rows: returnrows
				}
			}).then(async(obj) => {
				await obj.connection.query("INSERT INTO sessionplayer SET ?", record)
				.then(() => {
					sessioni.currentgame = obj.rows[0].id;
					socket.join("room"+sessioni.currentgame);
					Object.keys(serv_io.sockets.connected).forEach(function(key) {
						serv_io.sockets.connected[key].emit('gamesessioncreated');
					});
				})
				.catch((error) => {
					action = error.code;
				})
				return obj.connection;
			}).then(async(connection) => {
				if(action != 0) {
					await connection.query("DELETE FROM gamesession WHERE createdate = ?", createdate).then(() => {
						socket.emit('gamesessionmanageerror', {'error': action});
					});
				}
				pool.releaseConnection(connection);	
			}).catch((error) => {
				socket.emit('gamesessionmanageerror', {'error': true});
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在createsession操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("uploadmap", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			var record = {
				name: data.name,
				comment: data.comment,
				createdate: moment().unix(),
				user: sessioni.currentuser.email
			};
			if(data.type == 0) {
				pool.getConnection().then(async (connection) => {
					await connection.query("INSERT INTO gameboard SET ?", record)
					.catch((error) => {
						socket.emit('gameboardmanageError', {'error': true});
					})
					return connection;
				}).then(async(connection) => {
					await connection.query("SELECT * FROM gameboard WHERE createdate = ?",[record.createdate])
					.then((rows) => {
						mkdirp(__dirname+"/data/"+rows[0].id,function(err) {
							socket.emit('gameboardModified', rows[0]);
						});
					})
					.catch((error) => {
						socket.emit('gameboardmanageError', {'error': true});
					})
					pool.releaseConnection(connection);	
				});
			} else {
				pool.getConnection().then(async (connection) => {
					await connection.query("UPDATE gameboard SET ? WHERE id = ?",[record,data.type])
					.then(() => {
						userlog(connection, sessioni.currentuser.email, 3, JSON.stringify(data), function() {
							socket.emit("gameboardModified", data);
						});
					});
					pool.releaseConnection(connection);	
				});
			}
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在uploadmap操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("querymap", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			pool.getConnection().then(async (connection) => {
				await connection.query("SELECT * FROM gameboard WHERE id = ?", [data])
				.then((rows) => {
					fs.readdir(__dirname+"/data/"+data, function(error, list) {
						if(error) {
							socket.emit('gameboardmanageError', {'error': true});
						} else {
							socket.emit("gameboardInfo", {"data": rows[0], "files": list});
						}
					});
				})
				.catch((error) => {
					socket.emit('gameboardmanageError', {'error': true});
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在querymap操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("updatescore", function(data) {
		var row = {
			score: data.score
		};
		pool.getConnection().then(async (connection) => {
			await connection.query("UPDATE sessionplayer SET ? WHERE uid = ? AND sid = ?",[row,sessioni.currentuser.email, sessioni.currentgame])
			serv_io.to("room"+sessioni.currentgame).emit('playerscoreUpdated');
			pool.releaseConnection(connection);	
		})
	});
	socket.on('queryQuestion', function(data) {	//問題按照回合重建
		try {
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
		} catch(e) {
			serverlog("在queryQuestion操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress+"\n currentQuestion是："+currentQuestion);
			socket.disconnect();
		}
	});
	socket.on('checkAnswer',function(data) {
		try {
			socket.emit("queryAnswer", { 
				answer: sessioni.gameSession[sessioni.currentgame].currentQuestion.answer,
				reason: sessioni.gameSession[sessioni.currentgame].currentQuestion.reason
			});
		} catch(e) {
			serverlog("在checkAnswer操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on('checkUser',function(data) {
		try {
			if(!sessioni.currentuser) {
				socket.emit("getUser", false);
			} else {
				socket.emit("getUser", {obj:sessioni.currentuser});
			}
		} catch(e) {
			serverlog("在checkUser操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("checkPrivilege", function(data) {
		try {
			if(!sessioni.currentuser) {
				socket.emit("getUser", false);
			} else {
				socket.emit("userPrivilege", {check: sessioni.currentuser.level == 1});
			}
		} catch(e) {
			serverlog("在checkPrivilege操作失敗 \n"+socket.request.headers['user-agent']+"\n"+e.message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("setUser",function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			pool.getConnection().then(async (connection) => {
				await connection.query("UPDATE user SET ? WHERE email = ?",[data,sessioni.currentuser.email])
				.then(() => {
					userlog(connection, sessioni.currentuser.email, 3, JSON.stringify(data), function() {
						socket.emit("donesetUser", data);
					});
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在setUser操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("removeuser", function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			pool.getConnection().then(async (connection) => {
				await connection.query("SELECT * FROM gameboard WHERE user = ?",[data.user])
				.then((rows) => {
					for(var i=0;i<rows.length;i++) {
						fs.remove(__dirname+"/data/"+row[i].id)
						.catch(() => {
							socket.emit('userdelError', {'error': true});
							throw err;
						});
					}
				})
				.catch((error) => {
					socket.emit('userdelError', {'error': true});
				});
				return connection;
			}).then(async(connection) => {
				await connection.query("DELETE FROM user WHERE email = ?",[data.user])
				.catch((error) => {
					socket.emit('userdelError', {'error': true});
				})
				return connection;
			}).then(async(connection) => {
				await connection.query("DELETE FROM userlog WHERE user = ?",[data.user])
				.catch((error) => {
					socket.emit('userdelError', {'error': true});
				})
				return connection;
			}).then(async(connection) => {
				await connection.query("DELETE FROM gameboard WHERE user = ?",[data.user])
				.then(() => {
					socket.emit('userdeldone', {'user': data.user});
				})
				.catch((error) => {
					socket.emit('userdelError', {'error': true});
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在removeUser操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on('requestuserList',function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			pool.getConnection().then(async (connection) => {
				await connection.query("SELECT * FROM user")
				.then((rows) => {
					socket.emit("getuserList", rows);
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在requestuserList操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack);
			socket.disconnect();
		}
	});
	socket.on("onlineBroadcast", function(data) {	//這個和另外一個的差異是，這個是等到遊戲初始化之後才發出更新通知，第一次上線要和時代同步
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
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
			pool.getConnection().then(async (connection) => {
				await connection.query("UPDATE sessionplayer SET score=? WHERE sid=? AND uid=?",[currentuser.score, sessioni.currentgame, currentuser.id])
				.then(() => {
					serv_io.to("room"+sessioni.currentgame).emit('userOnline',{ user: sessioni.currentuser.email });
					sessioni.save();
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在onlineBroadcast操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on("retrivesessionaliveUsers", function(data) {	//線上用戶名單, filter代表要不要過濾
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			var sid = !data.sid ? sessioni.currentgame : data.sid; 
			var output = new Object();
			pool.getConnection().then(async (connection) => {
				await connection.query("SELECT * FROM sessionplayer WHERE sid = ?", sid)
				.then((rows) => {
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
				});
				sessioni.save();
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在retrivesessionaliveUsers操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on('requestspecificUser',function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentgame")) throw "currentgame未設定";
			pool.getConnection().then(async (connection) => {
				var user = null;
				await connection.query("SELECT * FROM user WHERE email = ?", data.user)
				.then((rows) => {
					user = rows[0];
				});
				return {
					user: user,
					connection: connection
				}
			}).then(async(obj) => {
				await obj.connection.query("SELECT * FROM sessionplayer WHERE uid = ? AND sid = ?", [data.user,sessioni.currentgame])
				.then((rows) => {
					socket.emit('getspecificUser', {
						email: obj.user.email,
						nickname: obj.user.nickname,
						color: obj.user.color,
						icon: obj.user.icon,
						asset: rows[0].asset,
						position: rows[0].position
					});
				});
				pool.releaseConnection(obj.connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在requestspecificUser操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on('requestuserDetail',function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			pool.getConnection().then(async (connection) => {
				await connection.query("SELECT * FROM userlog WHERE user = ?",[data.user])
				.then((rows) => {
					socket.emit("getuserDetail", rows);
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在requestuserDetail操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack);
			socket.disconnect();
		}
	});
	socket.on('requestboardList',function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			pool.getConnection().then(async (connection) => {
				await connection.query("SELECT * FROM gameboard")
				.then((rows) => {
					socket.emit("getboardList", rows);
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在requestboardList操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on('requestsessionList',function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			pool.getConnection().then(async (connection) => {
				var srows = null;
				await connection.query("SELECT * FROM gamesession").then((rows) => {
					srows = rows;
				});
				return {
					connection: connection,
					srows: srows
				}
			}).then(async(obj) => {
				await obj.connection.query("SELECT * FROM gameboard").then((rows) => {
					socket.emit("getsessionList", {
						sessions: obj.srows,
						boards: rows
					});
				});
				pool.releaseConnection(obj.connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在requestsessionList操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on('requestsessionDetail',function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentuser")) throw "currentuser未設定";
			pool.getConnection().then(async (connection) => {
				var srows = null;
				await connection.query("SELECT * FROM gamesession WHERE id = ?",data.sid)
				.then((rows) => {
					srows = rows;
				})
				return {
					connection: connection,
					srows: srows
				}
			}).then(async(obj) => {
				var prows = null;
				await obj.connection.query("SELECT * FROM sessionplayer WHERE sid = ?",data.sid).then((rows) => {
					prows = rows;
				})
				return {
					connection: obj.connection,
					srows: obj.srows,
					prows: prows
				}
			}).then(async(obj) => {
				var urows = null;
				await obj.connection.query("SELECT * FROM user").then((rows) => {
					urows = rows;
				});
				socket.emit("getsessionDetail", {
					session: obj.srows,
					sessionplayers: obj.prows,
					players: urows
				});
				pool.releaseConnection(obj.connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在requestsessionDetail操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
	socket.on('requestplayerList',function(data) {
		try {
			if(!sessioni.hasOwnProperty("currentgame")) throw "currentgame未設定";
			pool.getConnection().then(async (connection) => {
				await connection.query("SELECT * FROM sessionplayer WHERE sid = ?", data.id)
				.then((rows) => {
					for(var i=0;i<rows.length;i++) {
						rows[i].email = rows[i].uid;
					}
					serv_io.to("room"+sessioni.currentgame).emit('getplayerList',{users: rows, hosted: sessioni.gameSession[sessioni.currentgame].hosteduser});
				});
				pool.releaseConnection(connection);	
			});
		} catch(e) {
			if(!e.hasOwnProperty("stack")) e.stack = "";
			var message = e.hasOwnProperty("message") ? e.message : e;
			serverlog("在requestplayerList操作失敗 \n"+socket.request.headers['user-agent']+"\n"+message+"\n"+e.stack,ipaddress);
			socket.disconnect();
		}
	});
});

function userlog(connection, user, action, comment, callback) {	//callback 要記得關閉連線
	var userdata = {
		user: user,
		date: moment().unix(),
		comment: comment,
		action: action
	}
	pool.getConnection().then(async (connection) => {
		await connection.query('INSERT INTO `userlog` SET ?', userdata)
		.then(() => {
			callback();
			pool.releaseConnection(connection);	
		})
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

function serverlog(message,ipaddress) {	//display message with date in console.log
	var ipaddress = ipaddress == undefined ? "" : "["+ipaddress+"]";
	var data = "["+moment().format("YYYY/MM/DD HH:mm:SS")+"]"+ipaddress+message+"\n";
	fs.appendFile("C:\\Users\\Kelunyang\\Documents\\sitelog.txt",data,function(error){ //把資料寫入檔案
		if(error){ //如果有錯誤，把訊息顯示並離開程式
			console.log('檔案寫入錯誤');
		}
	});
	console.log("["+moment().format("YYYY/MM/DD HH:mm:SS")+"][monopoly]"+ipaddress+message);
}