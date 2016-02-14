// 土地（磚塊）模組
function brick(upgrade,index) {
	this.type = 0;	//0:normal, 1:road, 2:shortcut
	this.price = 0;
	this.incident = new Array();
	this.next = new Array();
	this.previous = new Array();
	this.owner = null;
	this.ability = new Array();
	this.upgrades = new Array();
	this.upgradeDB = upgrade;
	this.name = name;
	this.htmlElement = $("<div></div>");
	this.players = new Array();
	this.tokenElement = null;
	this.upgradeElement = null;
	this.active = false;
	this.shortcut = false;
	this.index = index;
	this.upgradeElement = $("<div></div>");
	this.upgradeElement.addClass("upgrades");
	this.htmlElement.append(this.upgradeElement);
	this.title = $("<h1></h1>");
	this.htmlElement.append(this.title);
	var container = $("<ul></ul>");
	container.addClass("brickplayerContainer");
	container.addClass("swiper-container");
	var slider = $("<li></li>");
	slider.addClass("swiper-scrollbar");
	var upbutton = $("<li></li>");
	upbutton.addClass("brickplayerUB");
	var upicon = $("<i></i>");
	upicon.addClass("fa");
	upicon.addClass("fa-arrow-left");
	upicon.addClass("fa-1x");
	upbutton.append(upicon);
	var downbutton = $("<li></li>");
	downbutton.addClass("brickplayerDB");
	var downicon = $("<i></i>");
	downicon.addClass("fa");
	downicon.addClass("fa-arrow-right");
	downicon.addClass("fa-1x");
	downbutton.append(downicon);
	this.tokenElement = $("<li></li>");
	this.tokenElement.addClass("tokenzone");
	this.tokenElement.addClass("swiper-wrapper");
	this.tokenElement.data("lastPos",undefined);
	container.append(this.tokenElement);
	container.append(slider);
	container.append(upbutton);
	container.append(downbutton);
	this.htmlElement.append(container);
	//this.htmlElement.append(this.tokenElement);
	this.normalElement();
	this.playermenu = new Swiper(container, {
		scrollbar: slider,
		nextButton: downbutton,
		prevButton: upbutton,
		slidesPerView:2,
		height:20,
		width:40,
		loop:true
	});
}
brick.prototype.activeElement = function() {
	if(this.active) {
		this.htmlElement.addClass("active");
		this.type = 1;
	}
	this.htmlElement.animate({opacity:1},300);
}
brick.prototype.shortcutElement = function() {
	if(this.shortcut) {
		this.htmlElement.addClass("shortcut");
		this.type = 2;
	}
	this.htmlElement.animate({opacity:1},300);
}
brick.prototype.normalElement = function() {
	this.type = 0;
	this.htmlElement.removeClass();
	this.htmlElement.addClass("brick");
	this.htmlElement.animate({opacity:0},300);
}
brick.prototype.getChance = function(stage) {
	var incidents = new Array();
	for(var i=0;i<this.incident.length;i++) {
		if(this.incident[i].stage == stage) {
			incidents.push(this.incident[i]);
		}
	}
	incidents.sort(function(a,b) {return 0.5-Math.random();});
	return incidents[0];
}
brick.prototype.getCurrentValue = function() {
	var rentsum = 0;
	for(var i=0;i<this.upgrades.length;i++) {
		rentsum += this.upgrades[i].rent;
	}
	return this.price + (this.price*rentsum);
}
brick.prototype.getRent = function() {
	return Math.round(this.getCurrentValue() * 0.2);
}
brick.prototype.startWindow = function(window) {
	var oriobj = this;
	this.upgradeElement.on("click",function() {
		if(oriobj.htmlElement.hasClass("active")) {
			window.infoWindow(oriobj.upgradeDB,0,oriobj.owner,oriobj,1);
		}
	});
}
brick.prototype.setBrick = function(data,type) {
	this.name = data.name;
	this.price = data.price;
	this.title.text(this.name);
	this.type = type;
}
brick.prototype.changeOwner = function(owner) {
	var color = owner == null ? "#CCC" : owner.mainColor;
	this.htmlElement.animate({borderTopColor:color},{ duration: 200, queue: false });
	this.htmlElement.animate({borderLeftColor:color},{ duration: 200, queue: false });
	this.htmlElement.animate({borderRightColor:color},{ duration: 200, queue: false });
	this.htmlElement.animate({borderBottomColor:color},{ duration: 200, queue: false });
	this.upgradeElement.animate({backgroundColor:color},{ duration: 200, queue: false });
	this.owner = owner;
}
brick.prototype.addUpgrade = function(obj) {
	if(this.upgrades.indexOf(obj) == -1) {
		this.upgrades.push(obj);
		this.renderUpgrade();
	}
}
brick.prototype.removeUpgrade = function(obj) {
	if(this.upgrades.indexOf(obj) >= 0) {
		this.upgrades.splice(this.upgrades.indexOf(obj),1);
		this.renderUpgrade();
	}
}
brick.prototype.renderUpgrade = function() {
	this.upgradeElement.empty();
	for(var i=0;i<this.upgrades.length;i++) {
		var upgrade = $("<i></i>");
		upgrade.addClass("fa");
		upgrade.addClass("fa-"+this.upgrades[i].icon);
		this.upgradeElement.append(upgrade);
	}
}