//角色模組
function player(name,icon,color,asset,board,initpost,local,htmlElement,destination,uid) {
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
	this.htmlElement.append($("<li id=\"playerasset\" class=\"detaiil\">總財產：<span class=\"playernum\"></span></li>"));
	this.htmlElement.addClass("player");
	this.htmlElement.css("backgroundColor",this.mainColor);
	this.htmlElement.css("borderColor",this.mainColor);
	this.htmlElement.find("li#playericon").append(this.iconElement);
	var displayname = this.local ? this.name+"(本機)" : this.name;
	this.htmlElement.find("li#playername").text(displayname);
	if(!this.local) {
		this.htmlElement.find("li#playercredit").css("visibility","hidden");
	}
	destination.append(this.htmlElement);
	this.creditCal(0);
	
}
player.prototype.refresh = function() {	//重整成績
	this.htmlElement.find("span.playernum").text(this.asset);
}
player.prototype.assetCal = function() {
	var oldasset = this.asset;
	var asset = 0;
	for(var i=0;i<this.bricks.length;i++) {
		asset += this.bricks[i].getCurrentValue();
	}
	this.asset = this.credit + asset;
	this.htmlElement.find("li#playerasset>span.playernum").prop('number',oldasset).animateNumber({ number: this.asset });
}
player.prototype.creditCal = function(value) {
	var oldcredit = this.credit;
	this.credit = value;
	this.htmlElement.find("li#playercredit>span.playernum").prop('number',oldcredit).animateNumber({ number: this.credit });
	this.assetCal();
}
player.prototype.manualMove = function(manual) {
	this.board.diceThrowed = manual;
	if(this.board.detectMove(this)) {
		this.board.turnQueue();
	} else {
		this.board.scanPlayer(false);
	}
}
player.prototype.addBrick = function(brick) {
	if(this.bricks.indexOf(brick) == -1) {
		if(this.credit - brick.getCurrentValue() >= 0) {
			this.bricks.push(brick);
			this.creditCal(this.credit - brick.getCurrentValue());
			brick.changeOwner(this);
			return true;
		}
	}
	return false;
}
player.prototype.removeBrick = function(brick) {
	if(this.bricks.indexOf(brick) >= 0) {
		this.bricks.splice(this.bricks.indexOf(brick),1);
		this.creditCal(this.credit + brick.getCurrentValue() * 0.8);
		brick.changeOwner(null);
	}
}
player.prototype.constructor = function() {
	/*this.htmlElement = $("<div></div>");
	this.htmlElement.text(this.name);
	this.htmlElement.addClass("brick");*/
}