//棋盤模組
function board(name,width,height,shortcuts,socket,stages,players,boardElement,titleElement,popElement,anmiblock,upgradeDB,incidentDB) {
	var oriobj = this;
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
	this.popElement = popElement;
	this.bricks = new Array();
	this.events = new Array();
	this.shortcuts = shortcuts;
	this.socket = socket;
	this.questionDB = new Array();
	this.currentQuestion = null;
	this.turn = 0;
	this.stage = 0;
	this.stages = stages;
	this.stageElement = $("<li><h2>"+this.stages[this.stage].name+"</h2></li>");
	this.turnElement = $("<li>第<span id=\"stagetitle\">"+this.turn+"</span>回合，剩餘<span id=\"stageturns\">"+this.stages[this.stage].duration+"</span>回合後升級</li>");
	this.titleElement.find("h1").text("大富翁："+this.name);
	this.titleElement.find("ul#gameinfo").append(this.stageElement);
	this.titleElement.find("ul#gameinfo").append(this.turnElement);
	this.boardElement.css("width",width*92+"px");
	this.boardElement.css("height",height*92+"px");
	this.messageElement = this.titleElement.find("div#bulletin");
	this.messageElement.scrollbox({delay: 0, speed: 100, infiniteLoop: false, onMouseOverPause: false, autoPlay: false, autoPlay: true});
	//this.sortingQuestion();
	this.moveCounter(false);
	this.socket.on('sendQuestion', function(data){
		console.log(data.question);
		oriobj.currentQuestion = data.question;
		oriobj.scanPlayer(false);
		oriobj.popElement.questionWindow(oriobj.currentQuestion.question,oriobj.currentQuestion.credit,oriobj.currentQuestion.answers,oriobj.players[0],oriobj);
		for(var i=0;i<oriobj.shortcuts.length;i++) {
			if(oriobj.turn == oriobj.shortcuts[i].startturn) {
				bricks = oriobj.shortcuts[i].bricks;
				oriobj.showShortcut(bricks,oriobj.shortcuts[i].name,oriobj.shortcuts[i].desc);
			}
			if(oriobj.turn == oriobj.shortcuts[i].endturn) {
				bricks = oriobj.shortcuts[i].bricks;
				oriobj.hideShortcut(bricks,oriobj.shortcuts[i].name);
			}
		}
		oriobj.popElement.dice = oriobj.diceElement;
		oriobj.popElement.board = oriobj;
		switch(oriobj.players[0].position.type) {	//踩到機會命運的機率
			case 1:
				var chance = [0];
				chance.sort(function(a,b) { return 0.5-Math.random(); });
				if(chance[0] == 0) {	//也就是說有四分之一的機率
					oriobj.popElement.chanceWindow(oriobj.players[0],oriobj.socket);
				}
			break;
			case 2:
				oriobj.popElement.chanceWindow(oriobj.players[0],oriobj.socket);	//100%機率
			break;
		}
	});
	this.socket.on('turnadded', function(data) {
		oriobj.turn = data.currentturn;
		oriobj.stage = data.currentstage;
		oriobj.stageElement.find("h2").text(oriobj.stages[oriobj.stage].name);
		oriobj.turnElement.find("span#stagetitle").text(oriobj.turn);
		oriobj.turnElement.find("span#stageturns").text(oriobj.stages[oriobj.stage].duration - oriobj.turn);
		var bricks = null;
		oriobj.sameUser = oriobj.localplayer.uid == data.currentplayer;
		oriobj.popElement.switchWindow(data.currentplayer);
	});
}
//所有的原件都需要load
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
	this.addTurn();
}

board.prototype.addTurn = function() {
	/*this.turn++;
	this.stages[this.stage].duration--;
	if(this.stages[this.stage].duration == 0) {
		this.stage++;
	}*/
	this.socket.emit("addTurn");
	this.socket.emit('queryQuestion', {
		'stage': this.stage
	});
}
board.prototype.pushEvent = function(message) {
	this.messageElement.find("ul").append($("<li><span class=\"stageicon\">"+this.stages[this.stage].name+"</span><span class=\"turnicon\">第"+this.turn+"回合</span>"+message+"</li>"));
	this.messageElement.trigger("forwardHover");
}
board.prototype.detectMove = function(player) {
	if(!this.interrupt) {
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
}
board.prototype.initBricks = function() {	//初始化
	this.upgradeDB.push({
		name: "交通要道",
		rent: 1.0,
		price: 750,
		icon:"code-fork ",
		stage: 0,
		desc: "騙學費",
		type: 1
	});	//地圖事件
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
board.prototype.showShortcut = function(shortcut,name,desc) {
	this.pushEvent("啟動"+name+"，連接"+this.bricks[shortcut[0]].name+"和"+this.bricks[shortcut[shortcut.length-1]].name);
	this.popElement.shortcutWindow(name,this.bricks[shortcut[0]].name,this.bricks[shortcut[shortcut.length-1]].name,desc);
	for(var s=0;s<shortcut.length;s++) {
		if(this.bricks[shortcut[s+1]] === undefined) {
			this.bricks[shortcut[s]].next.push(this.bricks[shortcut[s-1]]);
		} else {
			this.bricks[shortcut[s]].next.push(this.bricks[shortcut[s+1]]);
			if(this.bricks[shortcut[s-1]] !== undefined) this.bricks[shortcut[s]].next.push(this.bricks[shortcut[s-1]]);
		}
		if(this.bricks[shortcut[s-1]] === undefined) {
			this.bricks[shortcut[s]].previous.push(this.bricks[shortcut[s+1]]);
		} else {
			this.bricks[shortcut[s]].previous.push(this.bricks[shortcut[s-1]]);
			if(this.bricks[shortcut[s+1]] !== undefined) this.bricks[shortcut[s]].previous.push(this.bricks[shortcut[s+1]]);
		}
		if(s==0 || s==shortcut.length-1) {
			this.bricks[shortcut[s]].addUpgrade(this.upgradeDB[this.upgradeDB.length-1]);
			continue;
		}
		this.bricks[shortcut[s]].name = name+s;
		this.bricks[shortcut[s]].shortcut = true;
		this.bricks[shortcut[s]].shortcutElement();
	}
	//this.boardElement.find("div.shortcut").animate({opacity:1},100);
}
board.prototype.hideShortcut = function(shortcut,name) {
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
			this.bricks[shortcut[s]].removeUpgrade(this.upgradeDB[this.upgradeDB.length-1]);
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
	for(var i = 0;i<this.players.length;i++) {
		var player = this.players[i];
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
		if(player.local) {
			if(!first) {
				var localplayer = player;
				var usercontainer = player.position.tokenElement;
				var anmiblock = this.anmiblock;
				var newtop= player.tokenElement.offset().top;
				var newleft= player.tokenElement.offset().left;
				this.anmiblock.append(player.tokenElement);
				this.anmiblock.css("visibility","visible");
				this.anmiblock.animate({left:newleft,top:newtop,visibility:"hidden"},1000,"easeInQuint",function() {
					usercontainer.append(localplayer.tokenElement);
					anmiblock.css("visibility","hidden");
				});
			} else {
				this.anmiblock.css("top",(player.tokenElement.offset().top));
				this.anmiblock.css("left",(player.tokenElement.offset().left));
			}
		}
		player.creditCal(player.credit);
		if(player.position.tokenElement.children().length > 0) {
			player.position.playermenu.update(true);
		}
	}
}
board.prototype.upgradeBrick = function(brick,type) {
	this.bricks[brick].addUpgrade(type);
}