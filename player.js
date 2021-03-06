//角色模組
function player(name,icon,color,asset,board,initpost,local,htmlElement,destination,uid) {
	var oriobj = this;
	this.halt = false;
	this.frozen = 0;
	this.local = local;
	this.bricks = new Array();
	this.asset = asset;
	this.credit = 0;
	this.name = name;
	this.uid = uid
	this.icon = icon;
	this.mainColor = color;
	this.position = initpost;
	this.direction = true;
	this.board = board;
	this.iconElement = $("<i></i>").addClass("fa");
	this.iconElement.addClass("fa-5x");
	this.iconElement.addClass("fa-"+icon);
	this.tokenElement = $("<i></i>").addClass("fa");
	this.tokenElement.addClass("swiper-slide");
	this.tokenElement.addClass("fa-1x");
	this.tokenElement.addClass("fa-"+icon);
	this.tokenElement.css("color",this.mainColor);
	this.htmlElement = htmlElement;
	this.htmlElement.append($("<li id=\"playericon\"></li>"));
	this.htmlElement.append($("<li id=\"playername\" class=\"detaiil\"></li>"));
	this.htmlElement.append($("<li id=\"playercredit\" class=\"detaiil\">積分：<span class=\"playernum\"></span></li>"));
	this.htmlElement.append($("<li id=\"playerasset\" class=\"detaiil\"><span class=\"playerposition\"></span>$<span class=\"playernum\"></span></li>"));
	this.htmlElement.addClass("player");
	this.htmlElement.css("backgroundColor",this.mainColor);
	this.htmlElement.css("borderColor",this.mainColor);
	this.htmlElement.find("li#playericon").append(this.iconElement);
	this.htmlElement.on("click", function() {
		var oriColor = oriobj.position.htmlElement.css("backgroundColor");
		oriobj.position.htmlElement.animate({
			"backgroundColor": oriobj.mainColor
		},500, function() {
			oriobj.position.htmlElement.delay(1000).animate({
				"backgroundColor": oriColor
			},700);
		});
	});
	var displayname = this.local ? this.name+"(本機)" : this.name;
	this.htmlElement.find("li#playername").text(displayname);
	if(!this.local) {
		this.htmlElement.find("li#playercredit").css("visibility","hidden");
	}
	destination.append(this.htmlElement);
	this.assetCal(0,0);
	
}
player.prototype.refresh = function() {	//重整成績
	this.htmlElement.find("span.playernum").text(this.asset);
}
player.prototype.assetCal = function(credit, asset) {
	/*
	this.board.socket.emit("caculateAsset");*/
	var oldasset = this.asset;
	var oldcredit = this.credit;
	this.asset = asset;
	this.credit = credit;
	this.htmlElement.find("li#playerasset>span.playernum").prop('number', oldasset).animateNumber({number: this.asset });
	this.htmlElement.find("li#playercredit>span.playernum").prop('number', oldcredit).animateNumber({number: this.credit });
}
player.prototype.creditCal = function(value) {
	this.board.socket.emit("updatescore", {
		score: value
	});
	/*this.board.socket.off("playerscoreUpdated");
	this.board.socket.on("playerscoreUpdated", function() {
		this.board.socket.emit("caculateAsset");
	});*/
}
player.prototype.manualMove = function(manual) {
	var oriobj = this;
	this.board.diceThrowed = manual;
	if(this.board.detectMove(this)) {
		this.board.turnQueue();
	} else {
		this.board.diceElement.reset();
		this.board.scanPlayer(false);
	}
	/*this.board.detectMove(this);
	this.board.diceElement.reset();
	this.board.scanPlayer(false);*/
}
player.prototype.addBrick = function(brick) {
	var oriobj = this;
	this.board.socket.emit("addBrick", {
		player: {
			uid: oriobj.uid,
			credit: oriobj.credit
		}, 
		brick: {
			name: brick.name,
			index: brick.index,
			type: brick.type,
			active: brick.active,
			shortcut: brick.shortcut,
			price: brick.price,
			upgrades: brick.upgrades
		}
	});
}
player.prototype.removeBrick = function(brick) {
	var oriobj = this;
	this.board.socket.emit("removeBrick", {
		player: {
			uid: oriobj.uid,
			credit: oriobj.credit
		}, 
		brick: {
			name: brick.name,
			index: brick.index,
			type: brick.type,
			active: brick.active,
			shortcut: brick.shortcut,
			price: brick.price,
			upgrades: brick.upgrades
		}
	});
	/*if(this.bricks.indexOf(brick) >= 0) {
		this.bricks.splice(this.bricks.indexOf(brick),1);
		this.creditCal(this.credit + brick.getCurrentValue() * 0.8);
		brick.changeOwner(null);
		this.board.addturnLog(brick);
	}*/
}
player.prototype.constructor = function() {
	/*this.htmlElement = $("<div></div>");
	this.htmlElement.text(this.name);
	this.htmlElement.addClass("brick");*/
}