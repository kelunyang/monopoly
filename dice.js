//骰子模組
function dice(htmlElement,player,board) {
	var oriobj = this;
	this.available = true;
	this.diceValue = -1;
	this.htmlElement = htmlElement;
	this.htmlElement.find("i").addClass("fa-cube");
	this.dicenum = new Array();
	this.diceRange = 6;
	this.anmiElement = $("<ul></ul>");
	this.htmlElement.find("div").append(this.anmiElement);
	this.board = board;
	this.player = player;
	for(var i=1;i<=this.diceRange;i++) {
		this.dicenum.push(i);
	}
	this.htmlElement.find("div").scrollbox({linear: true,delay: 0, speed: 10, infiniteLoop: false,onMouseOverPause: false, autoPlay: false, afterForward: function (data) {    
		oriobj.diceValue = data.currentFirstChild.data("value");
		//oriobj.diceValue = 6;	//test purpose
		$("aside nav div ul li.hidden").removeClass("hidden");
		$("aside nav div ul").animate({opacity:1},500,function(){
			oriobj.player.manualMove(true);
		})
	}});	//很神奇的是，他一次只會有一個物件動起來，不過也符合動畫的原則了
	this.htmlElement.on("click", function() {oriobj.throwDice();});
	$(document).on("keypress",function(event) {
		if(event.which == 32) {
			event.preventDefault();
			oriobj.throwDice();
		}
	});	//空白鍵和開始都會同時觸發骰子
}
dice.prototype.initial = function() {
	/*
	this.diceanmi = ;
	this.htmlElement.find("div").append(this.diceanmi);
	this.diceanmi.append(this.dicenum[0]);*/
}
dice.prototype.updateMax = function(value) {
	this.htmlElement.find("i").removeClass("fa-cube");
	this.htmlElement.find("i").removeClass("fa-cubes");
	this.diceRange = value;
	if(value <= 6) {
		this.htmlElement.find("i").addClass("fa-cube");
	} else {
		this.htmlElement.find("i").addClass("fa-cubes");
	}
	this.board.pushEvent("骰子數量增加！最高可用點數"+value);
}
dice.prototype.reset = function() {
	this.htmlElement.find("div").empty();
	this.htmlElement.find("div").text("開始");
	this.board.moveCounter(false);
}
dice.prototype.throwDice = function() {
	if(this.available) {
		this.available = false;
		this.dicenum = this.dicenum.sort(function(a,b) { return 0.5-Math.random();});
		this.htmlElement.find("div").empty();
		this.anmiElement.empty();
		this.htmlElement.find("div").append(this.anmiElement);
		for(var i=0;i<this.diceRange;i++) {
			var num = $("<li>"+this.dicenum[i]+"</li>");
			if(i==0) num.addClass("hidden");
			num.data("value",this.dicenum[i]);
			this.anmiElement.append(num);
		}
		this.htmlElement.find("div").trigger("forwardHover");
	}
}