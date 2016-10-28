//棋盤模組
function board(name,width,height,shortcuts,socket,stages,players,boardElement,titleElement,popElement,anmiblock,upgradeDB,incidentDB,nextElement,exitElement) {
	var oriobj = this;
	this.boardinfo = null;
	this.diceElement = null;
	this.sameUser = true;
	this.remainmoves = 0;
	this.interrupt = false;
	this.diceThrowed = false;
	this.incidentDB = incidentDB;
	this.upgradeDB = upgradeDB;
	this.anmiblock = anmiblock;
	this.players = players;
	this.step = 0;
	this.name = name;
	this.width = width;
	this.height = height;
	this.num = width * height;
	this.boardElement = boardElement;
	this.titleElement = titleElement;
	this.nextElement = nextElement;
	this.exitElement = exitElement;
	this.popElement = popElement;
	this.bricks = new Array();
	this.events = new Array();
	this.shortcuts = shortcuts;
	this.socket = socket;
	this.questionDB = new Array();
	this.currentQuestion = null;
	this.turn = 0;
	this.turnLog = {
		bricks : new Object(),
		shortcut : new Object()
	}
	this.stage = 0;
	this.stages = stages;
	this.stageElement = $("<li><h2>"+this.stages[this.stage].name+"</h2></li>");
	this.turnElement = $("<li>第<span id=\"stagetitle\">"+this.turn+"</span>回合，剩餘<span id=\"stageturns\">"+this.stages[this.stage].duration+"回合後升級</span></li>");
	this.titleElement.find("h1").text(this.name);
	this.titleElement.find("ul#gameinfo").append(this.stageElement);
	this.titleElement.find("ul#gameinfo").append(this.turnElement);
	this.boardElement.css("width",width*92+"px");
	this.boardElement.css("height",height*92+"px");
	this.nextElement.on("click", function() {
		oriobj.addTurn();
	});
	this.exitElement.on("click" ,function() {
		oriobj.endGame();
	});
	this.messageElement = this.titleElement.find("div#bulletin");
	this.messageElement.scrollbox({delay: 0, speed: 100, infiniteLoop: false, onMouseOverPause: false ,autoPlay: true});
	//this.sortingQuestion();
	this.moveCounter(false);
	this.socket.on('sendQuestion', function(data){
		console.log(data.question);
		oriobj.currentQuestion = data.question;
		oriobj.scanPlayer(false);
		oriobj.popElement.questionWindow(oriobj.currentQuestion.question,oriobj.currentQuestion.credit,oriobj.currentQuestion.answers,oriobj.localplayer,oriobj);
		Object.keys(oriobj.shortcuts).forEach(function(key) {
			var shortcut = oriobj.shortcuts[key];
			if(oriobj.turn == shortcut.startturn) {
				bricks = shortcut.bricks;
				oriobj.showShortcut(shortcut.name);
				oriobj.turnLog.shortcut = {
					name: shortcut.name,
					enable: true
				}
			}
			if(oriobj.turn == shortcut.endturn) {
				bricks = shortcut.bricks;
				oriobj.hideShortcut(shortcut.name);
				oriobj.turnLog.shortcut = {
					name: shortcut.name,
					enable: false
				}
			}
		});
		oriobj.popElement.dice = oriobj.diceElement;
		oriobj.popElement.board = oriobj;
		switch(oriobj.localplayer.position.type) {	//踩到機會命運的機率
			case 1:
				var chance = [0];
				chance.sort(function(a,b) { return 0.5-Math.random(); });
				if(chance[0] == 0) {	//也就是說有四分之一的機率
					oriobj.popElement.chanceWindow(oriobj.localplayer,oriobj.socket);
				}
			break;
			case 2:
				oriobj.popElement.chanceWindow(oriobj.localplayer,oriobj.socket);	//100%機率
			break;
		}
	});
	this.socket.on('workingturn', function(data) {	//進入目前玩家的回合
		/*oriobj.sameUser = true;
		oriobj.diceElement.available = true;*/
		/*if(data.currentplayer.id == oriobj.localplayer.uid) {
		}*/
		/*for(var k=0;k<oriobj.players.length;k++) {
			if(oriobj.players[k].uid == data.players[i].uid) {
				oriobj.players[k].credit = data.players[i].credit;
				for(var b=0;b<data.players[i].bricks.length;b++) {
					for(var bo=0;bo<oriobj.bricks.length;bo++) {
						if(data.players[i].bricks[b].index == oriobj.bricks[bo].index) {
							oriobj.players[k].addBrick(oriobj.bricks[bo]);
						}
					}
				}
				/*
				* position 也就是得把遠端的位置存回棋盤上，關鍵在於scanplayer
				* 讓手動移動歸給scanplayer，自動報位置歸給新函式
				
				oriobj.players[k].position = data.players[i].position;
			}
		}*/
		oriobj.turn = data.currentturn;
		oriobj.stage = data.currentstage;
		oriobj.stageElement.find("h2").text(oriobj.stages[oriobj.stage].name);
		var bricks = null;
		var output = {
			playerid: oriobj.localplayer.uid,
			currentsession: data.currentsession,
			currentstage: data.currentstage,
			currentturn: data.currentturn,
			newstage: data.newstage
		};
		socket.emit("responseTurn", output);
	});
	this.socket.on("boardcastturn", function(data) {
		if(data.newstage) {
			oriobj.popElement.stageWindow(oriobj.stages[data.currentstage].name,oriobj.stages[data.currentstage].desc,oriobj.stages[data.currentstage].effecttype,oriobj.stages[data.currentstage].effectvalue,data.roadDB);
		}
		oriobj.turn = data.currentturn;
		oriobj.stage = data.currentstage;
		oriobj.stageElement.find("h2").text(oriobj.stages[oriobj.stage].name);
		Object.keys(data.brickLog.bricks).forEach(function(brickserial) {
			var brick = data.brickLog.bricks[brickserial];
			if(brick.owner == null) {
				if(oriobj.bricks[brick.index].owner != null) {
					oriobj.bricks[brick.index].owner.removeBrick(oriobj.bricks[brick.index]);
				}
			} else {
				if(oriobj.bricks[brick.index].owner != brick.owner) {
					if(oriobj.bricks[brick.index].owner != null) {
						oriobj.bricks[brick.index].owner.removeBrick(oriobj.bricks[brick.index]);
					}
				}
				oriobj.players[brick.owner].addBrick(oriobj.bricks[brick.index]);
			}
			if(brick.upgrades.length > 0) {
				brick.upgrades.forEach(function(upgrade) {
					if(oriobj.bricks[brick.index].upgrades.indexOf(upgrade) == -1) {
						oriobj.bricks[brick.index].addUpgrade(oriobj.upgradeDB[upgrade]);
					} else {
						oriobj.bricks[brick.index].removeUpgrade(oriobj.upgradeDB[upgrade]);
					}
				});
			}
		});
		if(data.brickLog.shortcut.hasOwnProperty("enable")) {
			if(data.brickLog.shortcut.enable) {
				oriobj.showShortcut(data.brickLog.shortcut.name);
			} else {
				oriobj.hideShortcut(data.brickLog.shortcut.name);
			}
		}
		/*oriobj.turnElement.find("span#stagetitle").text(oriobj.turn);
		oriobj.turnElement.find("span#stageturns").text(oriobj.stages[oriobj.stage].duration - oriobj.turn);*/
		socket.emit("updateturn", {
			currentplayer:data.currentplayer,
			currentstage:oriobj.stage,
			currentturn:oriobj.turn,
			newstage:data.newstage
		});
	});
	this.socket.on("gamesettled", function(data) {
		oriobj.popElement.settleWindow(data);
	});
	this.socket.on("playerout", function(data) {
		oriobj.socket.emit("exitsession", {
			uid: oriobj.localplayer.uid,
			sid: data
		});
	});
	this.socket.on("wrongturn", function(data) {
		oriobj.popElement.errorWindow(data.msg,0);
	});
	this.socket.on("sessionleaved", function(data) {
		oriobj.popElement.messageWindow("已退出遊戲","您已退出遊戲",{
			ok:{
				enable: true,
				func: function() {
					oriobj.popElement.closeWindow("popMessage");
				}
			},
			yes:{
				enable: false,
				func: function() {
					oriobj.popElement.endPseudo();
				}
			},
			no:{
				enable: false,
				func: function() {
					oriobj.popElement.endPseudo();
				}
			},
			custombuttons: new Array()
		},"sign-out");
	});
	socket.on("updateplayerinfo", function(data) {
		if(data.current != oriobj.localplayer.uid) {
			oriobj.sameUser = false;
			oriobj.diceElement.availablity(false);
		} else {
			oriobj.sameUser = true;
			oriobj.diceElement.availablity(true);
		}
		oriobj.turnElement.find("span#stagetitle").text(oriobj.turn);
		if(oriobj.stage != oriobj.stages.length - 1) {
			var remain = oriobj.stages[oriobj.stage].duration - oriobj.turn;
			oriobj.turnElement.find("span#stageturns").text(remain+"回合後升級");
		} else {
			oriobj.turnElement.find("span#stageturns").text((oriobj.boardinfo.maxround - oriobj.turn)+"回合後結束");
		}
		data.other.forEach(function(item) {
			oriobj.players[item.uid].credit = item.score;
			oriobj.players[item.uid].position = oriobj.bricks[item.position];
			oriobj.players[item.uid].frozen = item.frozen;
		});
		oriobj.scanPlayer(false);
		if(oriobj.localplayer.frozen > 0) {
			oriobj.popElement.messageWindow("遊戲鎖定","你還有"+oriobj.localplayer.frozen+"次才能擲骰子",{
				ok:{
					enable: true,
					func: function() {
						oriobj.localplayer.frozen--;
						oriobj.diceElement.availablity(false);
						oriobj.popElement.closeWindow("popMessage");
					}
				},
				yes:{
					enable: false,
					func: function() {
						oriobj.popElement.endPseudo();
					}
				},
				no:{
					enable: false,
					func: function() {
						oriobj.popElement.endPseudo();
					}
				},
				custombuttons: new Array()
			},"ban");
		}
		oriobj.popElement.switchWindow(data.current);
	});
}
//結束遊戲
board.prototype.endGame = function() {
	var oriobj = this;
	this.popElement.messageWindow("退出遊戲？","退出遊戲並結算成績？確認嗎",{
		ok:{
			enable: false,
			func: function() {
				oriobj.popElement.endPseudo();
			}
		},
		yes:{
			enable: true,
			func: function() {
				oriobj.socket.emit("endgame", oriobj.localplayer.uid);
				oriobj.popElement.endPseudo();
			}
		},
		no:{
			enable: true,
			func: function() {
				oriobj.popElement.endPseudo();
			}
		},
		custombuttons: new Array()
	},"exclamation-triangle");
}
//所有的元件都需要load
board.prototype.moveCounter = function(move) {
	if(!move) {
		$("span#remainstep").css("display","none");
		$("span#keytip").css("display","block");
	} else {
		$("span#keytip").css("display","none");
		$("span#remainstep").css("display","block");
		$("span#remainstep>span#diceCounter").prop('number',this.diceElement.diceValue).animateNumber({ number: this.remainmoves });
	}
}
board.prototype.turnQueue = function() {
	//wait server response
	//this.addTurn();
	var oriobj = this;
	this.socket.emit('queryQuestion', {
		'stage': oriobj.stage
	});
}

board.prototype.addTurn = function() {
	/*this.turn++;
	this.stages[this.stage].duration--;
	if(this.stages[this.stage].duration == 0) {
		this.stage++;
	}*/
	var players = new Array();
	var oriobj = this;
	Object.keys(oriobj.players).forEach(function(key) {
		var item = oriobj.players[key];
		players.push({
			asset: item.asset,
			credit: item.credit,
			uid: item.uid,
			position: item.position.index,
			frozen: item.frozen
		});
	})
	var oriobj = this;
	this.socket.emit("addTurn", {
		"uid": oriobj.localplayer.uid,
		"asset": oriobj.localplayer.asset,
		"credit": oriobj.localplayer.credit,
		"position": oriobj.localplayer.position.index,
		"brickLog": oriobj.turnLog,
		"players":players
	});	//用戶資訊打包送上去
}
board.prototype.pushEvent = function(message) {
	this.messageElement.find("ul").append($("<li><span class=\"stageicon\">"+this.stages[this.stage].name+"</span><span class=\"turnicon\">第"+this.turn+"回合</span>"+message+"</li>"));
	this.messageElement.trigger("forwardHover");
}
board.prototype.detectMove = function(player) {
	if(!player.halt) {
		if(!this.interrupt) {
			this.popElement.closeWindow("popMessage");	//必須先關閉提示視窗，不然叉路口會跳出來
			this.remainmoves = this.diceThrowed ? this.diceElement.diceValue : this.remainmoves;
			this.diceThrowed = false;
			var currentLoc = player.position.index;
			this.moveCounter(true);
			while(this.remainmoves > 0) {
				if(player.direction) {
					if(player.position.next[0]) {
						if(player.position.next.length > 1) {
							var oriobj = this;
							this.interrupt = true;
							var custombuttons = new Array();
							for(var i=0;i<player.position.next.length;i++) {
								var button = $("<li></li>");
								button.text("去"+player.position.next[i].name);
								button.data("brick",player.position.next[i]);
								button.on("click",function() {
									oriobj.interrupt = false;
									player.position = $(this).data("brick");
									oriobj.remainmoves--;
									oriobj.diceElement.diceValue--;
									player.manualMove(false);
								});
								custombuttons.push(button);
							}
							this.popElement.messageWindow("遇到岔路",player.position.name+"有"+player.position.next.length+"條岔路，選哪一條呢？",{
								ok:{
									enable: false,
									func: function() {
										oriobj.popElement.endPseudo();
									}
								},
								yes:{
									enable: false,
									func: function() {
										oriobj.popElement.endPseudo();
									}
								},
								no:{
									enable: false,
									func: function() {
										oriobj.popElement.endPseudo();
									}
								},
								custombuttons: custombuttons
							},"code-fork");
							return false;
						} else {
							player.position = player.position.next[0];
						}
					} else {
						player.direction = !player.direction;
						if(!this.detectMove(player)) {
							return false;
						}
					}
				} else {
					if(player.position.previous[0]) {
						if(player.position.previous.length > 1) {
							var oriobj = this;
							this.interrupt = true;
							var custombuttons = new Array();
							for(var i=0;i<player.position.previous.length;i++) {
								var button = $("<li></li>");
								button.text("去"+player.position.previous[i].name);
								button.data("brick",player.position.previous[i]);
								button.on("click",function() {
									oriobj.interrupt = false;
									player.position = $(this).data("brick");
									oriobj.remainmoves--;
									oriobj.diceElement.diceValue--;
									player.manualMove(false);
								});
								custombuttons.push(button);
							}
							this.popElement.messageWindow("遇到岔路",player.position.name+"前方有"+player.position.previous.length+"條岔路，選哪一條呢？",{
								ok:{
									enable: false,
									func: function() {
										oriobj.popElement.endPseudo();
									}
								},
								yes:{
									enable: false,
									func: function() {
										oriobj.popElement.endPseudo();
									}
								},
								no:{
									enable: false,
									func: function() {
										oriobj.popElement.endPseudo();
									}
								},
								custombuttons: custombuttons
							},"code-fork");
							return false;
						} else {
							player.position = player.position.previous[0];
						}
					} else {
						player.direction = !player.direction;
						if(!this.detectMove(player)) {
							return false;
						}
					}
				}
				console.log("move:"+this.remainmoves+"/currentloc:"+player.position.index+"/locationname:"+player.position.name+"/Next:"+player.position.next.length+"/previous:"+player.position.previous.length);
				this.diceElement.diceValue--;
				this.remainmoves--;
			}
			this.moveCounter(true);
		}
		return true;
	} else {
		player.halt = false;
		this.moveCounter(false);
		return false;
	}
}
board.prototype.initBricks = function() {	//初始化
	this.upgradeDB["交通要道"] = {
		name: "交通要道",
		rent: 1.0,
		price: 750,
		icon:"code-fork",
		stage: 0,
		desc: "騙學費",
		type: 1
	};	//地圖事件
	for(var i=0;i<this.num;i++) {
		var emptyBrick = new brick(this.upgradeDB,i);
		emptyBrick.startWindow(this.popElement);
		this.boardElement.append(emptyBrick.htmlElement);
		this.bricks.push(emptyBrick);
		for(var c=0;c<this.incidentDB.length;c++) {
			if(this.incidentDB[c].brick == i || this.incidentDB[c].brick == -1) {
				emptyBrick.incident.push(this.incidentDB[c]);
			}
		}
	}
}
board.prototype.loadRoads = function(roadDB) {
	for(var i=0;i<roadDB.length;i++) {
		if(roadDB[i].stage != this.stage) continue;
		this.bricks[roadDB[i].brick].setBrick(roadDB[i],1);
		this.bricks[roadDB[i].brick].next.push(this.bricks[roadDB[i].next]);
		this.bricks[roadDB[i].brick].previous.push(this.bricks[roadDB[i].previous]);
		if(roadDB[i].previous > -1) {
			if(this.bricks[roadDB[i].previous].next.indexOf(undefined) != -1) {
				this.bricks[roadDB[i].previous].next.splice(this.bricks[roadDB[i].previous].next.indexOf(undefined),1);
			}
			if(this.bricks[roadDB[i].previous].next.indexOf(this.bricks[roadDB[i].brick]) == -1) {
				this.bricks[roadDB[i].previous].next.push(this.bricks[roadDB[i].brick]);
			}
		}
		if(roadDB[i].next > -1) {
			if(this.bricks[roadDB[i].next].type == 1) {
				if(this.bricks[roadDB[i].next].previous.indexOf(undefined) != -1) {
					this.bricks[roadDB[i].next].previous.splice(this.bricks[roadDB[i].next].previous.indexOf(undefined),1);
				}
				if(this.bricks[roadDB[i].next].previous.indexOf(this.bricks[roadDB[i].brick]) == -1) {
					this.bricks[roadDB[i].next].previous.push(this.bricks[roadDB[i].brick]);
				}
			}
		}
		this.bricks[roadDB[i].brick].active = true;
		this.bricks[roadDB[i].brick].activeElement();
	}
	var oriobj = this;
	/*this.boardElement.find("div.brick").animate({opacity:0},300, function() {
		oriobj.activeBricks();
	});*/
}
board.prototype.activeBricks = function() {
	//this.boardElement.find("div.active").animate({opacity:1},300);
}
board.prototype.showShortcut = function(name) {
	var shortcut = this.shortcuts[name].bricks;
	var desc = this.shortcuts[name].desc;
	this.pushEvent("啟動"+name+"，連接"+this.bricks[shortcut[0]].name+"和"+this.bricks[shortcut[shortcut.length-1]].name);
	this.popElement.shortcutWindow(name,this.bricks[shortcut[0]].name,this.bricks[shortcut[shortcut.length-1]].name,desc);
	for(var s=0;s<shortcut.length;s++) {
		if(this.bricks[shortcut[s+1]] === undefined) {
			if(this.bricks[shortcut[s]].next.indexOf(this.bricks[shortcut[s-1]]) == -1) {
				this.bricks[shortcut[s]].next.push(this.bricks[shortcut[s-1]]);
			}
		} else {
			if(this.bricks[shortcut[s]].next.indexOf(this.bricks[shortcut[s+1]]) == -1) {
				this.bricks[shortcut[s]].next.push(this.bricks[shortcut[s+1]]);
			}
			if(this.bricks[shortcut[s-1]] !== undefined) {
				if(this.bricks[shortcut[s]].next.indexOf(this.bricks[shortcut[s-1]]) == -1) {
					this.bricks[shortcut[s]].next.push(this.bricks[shortcut[s-1]]);
				}
			}
		}
		if(this.bricks[shortcut[s-1]] === undefined) {
			if(this.bricks[shortcut[s]].previous.indexOf(this.bricks[shortcut[s+1]]) == -1) {
				this.bricks[shortcut[s]].previous.push(this.bricks[shortcut[s+1]]);
			}
		} else {
			if(this.bricks[shortcut[s]].previous.indexOf(this.bricks[shortcut[s-1]]) == -1) {
				this.bricks[shortcut[s]].previous.push(this.bricks[shortcut[s-1]]);
			}
			if(this.bricks[shortcut[s+1]] !== undefined) {
				if(this.bricks[shortcut[s]].previous.indexOf(this.bricks[shortcut[s+1]]) == -1) {
					this.bricks[shortcut[s]].previous.push(this.bricks[shortcut[s+1]]);
				}
			}
		}
		if(s==0 || s==shortcut.length-1) {
			this.upgradeBrick(shortcut[s],this.upgradeDB["交通要道"]);
			continue;
		}
		this.bricks[shortcut[s]].name = name+s;
		this.bricks[shortcut[s]].shortcut = true;
		this.bricks[shortcut[s]].shortcutElement();
	}
	//this.boardElement.find("div.shortcut").animate({opacity:1},100);
}
board.prototype.hideShortcut = function(name) {
	var shortcut = this.shortcuts[name].bricks;
	this.pushEvent("關閉"+name+"，連接"+this.bricks[shortcut[0]].name+"和"+this.bricks[shortcut[shortcut.length-1]].name+"，所有在上面的玩家回到捷徑起點");
	for(var s=0;s<shortcut.length;s++) {
		if(this.bricks[shortcut[s+1]] === undefined) {
			this.bricks[shortcut[s]].next.splice(this.bricks[shortcut[s]].next.indexOf(this.bricks[shortcut[s-1]]),1);
		} else {
			this.bricks[shortcut[s]].next.splice(this.bricks[shortcut[s]].next.indexOf(this.bricks[shortcut[s+1]]),1);
			if(this.bricks[shortcut[s-1]] !== undefined) this.bricks[shortcut[s]].next.splice(this.bricks[shortcut[s]].next.indexOf(this.bricks[shortcut[s-1]]),1);
		}
		if(this.bricks[shortcut[s-1]] === undefined) {
			this.bricks[shortcut[s]].previous.splice(this.bricks[shortcut[s]].previous.indexOf(this.bricks[shortcut[s+1]]),1);
		} else {
			this.bricks[shortcut[s]].previous.splice(this.bricks[shortcut[s]].previous.indexOf(this.bricks[shortcut[s-1]]),1);
			if(this.bricks[shortcut[s+1]] !== undefined) this.bricks[shortcut[s]].previous.splice(this.bricks[shortcut[s]].previous.indexOf(this.bricks[shortcut[s+1]]),1);
		}
		if(s==0 || s==shortcut.length-1) {
			this.degradeBrick(shortcut[s],this.upgradeDB["交通要道"]);
			continue;
		}
		this.bricks[shortcut[s]].name = "";
		this.bricks[shortcut[s]].shortcut = false;
		this.bricks[shortcut[s]].normalElement();
		if(this.bricks[shortcut[s]].players.length > 0) {	// send everyone home
			for(var i=0;i<this.bricks[shortcut[s]].players.length;i++) {
				if(shortcut.indexOf(shortcut[s]) <= Math.round(shortcut.length / 2)) {
					this.bricks[shortcut[s]].players[i].position = this.bricks[shortcut[0]];
				} else {
					this.bricks[shortcut[s]].players[i].position = this.bricks[shortcut[this.bricks[shortcut[s]].players.length-1]];
				}
			}
		}
		console.log(shortcut[s]);
	}
	//this.boardElement.find("div.shortcut").animate({opacity:0},100);
}
board.prototype.scanPlayer = function(first) {
	var oriobj = this;
	var oritop = 0;
	var orileft = 0;
	for(var i=0;i<this.bricks.length;i++) {
		this.bricks[i].players.length = 0;	//empty array;
	}
	Object.keys(this.players).forEach(function(key) {
		var player = this.players[key];
		if(player.local) {
			oritop = player.tokenElement.offset().top;
			orileft = player.tokenElement.offset().left;
		}
		var parent = player.tokenElement.parent();
		player.tokenElement.detach();
		if(player.tokenElement.data("lastPos") != undefined) {
			if(player.tokenElement.data("lastPos").tokenElement.children().length == 0) { 
				player.tokenElement.data("lastPos").tokenElement.parent().css("display","none"); 
			}
		}
		player.position.players.push(player);
		player.position.tokenElement.append(player.tokenElement);
		player.tokenElement.data("lastPos",player.position);
		player.position.tokenElement.parent().css("display","block");
		var anmiblock = $(this.anmiblock);
		if(player.local) {
			if(!first) {
				var localplayer = player;
				var usercontainer = player.position.tokenElement;
				var newtop= player.tokenElement.offset().top;
				var newleft= player.tokenElement.offset().left;
				anmiblock.append(player.tokenElement);
				anmiblock.css("visibility","visible");
				anmiblock.animate({left:newleft,top:newtop,visibility:"hidden"},1000,"easeInQuint",function() {
					usercontainer.append(localplayer.tokenElement);
					anmiblock.css("visibility","hidden");
				});
			} else {
				anmiblock.css("top",(player.tokenElement.offset().top));
				anmiblock.css("left",(player.tokenElement.offset().left));
			}
		}
		player.creditCal(player.credit);
		if(player.position.tokenElement.children().length > 0) {
			player.position.playermenu.update(true);
		}
	})
}
board.prototype.upgradeBrick = function(brick,type) {
	this.bricks[brick].addUpgrade(type);
	this.addturnLog(this.bricks[brick]);
}
board.prototype.degradeBrick = function(brick,type) {
	this.bricks[brick].removeUpgrade(type);
	this.addturnLog(this.bricks[brick]);
}
board.prototype.addturnLog = function(brick) {
	var tmpBrick = new Object();
	tmpBrick.index = brick.index;
	tmpBrick.upgrades = new Array();
	brick.upgrades.forEach(function(upgrade) {
		tmpBrick.upgrades.push(upgrade.name);
	});
	tmpBrick.owner = brick.owner == null ? null : brick.owner.uid;
	this.turnLog.bricks[brick.index] = tmpBrick;	//列入更新清單
}