/*虛擬視窗控制模組*/
function pseudoWindow(htmlElement) {
	this.htmlElement = htmlElement;
	this.dice = null;
	this.board = null;
	this.opacityValue = 0;
	this.placeArray = null;
	this.placeMap = null;
}
pseudoWindow.prototype.setupgradeLayout = function(upgradeCount) {
	for(var i=0;i<upgradeCount;i++) {
		this.htmlElement.find("ul#popInfo").find("li#uSets>ul#upgradeRoll").append($("<li class=\"item\"></li>"));
	}
}
pseudoWindow.prototype.loadWindows = function() {
	var oriobj = this;
	this.htmlElement.find("div#popBackground").css("opacity",0);
	this.htmlElement.css("display","block");
	this.htmlElement.find("div#popBackground").animate({opacity: oriobj.opacityValue},200);
}
pseudoWindow.prototype.closeWindow = function(name) {
	this.htmlElement.find("ul#"+name).css("display","none");
	var windowcount = $("ul.popWindow").filter(function() { return $(this).css("display") == "block"; }).length;
	if(windowcount == 0) {
		this.endPseudo();
	}
}
pseudoWindow.prototype.resetWindows = function() {
	this.htmlElement.find("ul.popWindow").css("display","none");
}
pseudoWindow.prototype.endPseudo = function() {
	this.resetWindows();
	this.htmlElement.css("display","none");
	if(this.board != null) {
		if(this.board.localplayer.uid == this.board.currentplayer) {
			this.controllerWindow();
		}
	}
}
pseudoWindow.prototype.loadingWindow = function(msg) {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popLoading");
	window.find("li#lmessage").text(msg);
	this.loadWindows();
	window.css("display","block");
}
pseudoWindow.prototype.iconchooserWindow = function(socket) {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popChooser");
	window.find("li#cbutton>ul>li").off();
	window.find("li#cbutton>ul>li#logoutbtn").on("click",function() {
		navigator.id.logout();
		window.css("display","none");
	})
	window.find("li#cbutton>ul>li#enter").on("click",function() {
		socket.emit('setUser', {
			nickname: $("input#name").val(),
			icon: $("li#iconsRoll>i.selectedIcon").data("token"),
			color: $("ul.palette li.selectedColor").data("color"),
		});
		socket.on('donesetUser', function(data){
			oriobj.endPseudo();
		});
	})
	this.loadWindows();
	window.css("display","block");
	playerIcon = new Swiper('#iconscontainer', {
		scrollbar: '#iconscrollbar',
		nextButton: '#iconsdown',
		prevButton: '#iconsup',
		slidesPerView:4,
		loop:true
	});
}
pseudoWindow.prototype.chanceWindow = function(player, socket) {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popChance");
	var chance = player.position.getChance(this.board.stage);
	window.find("li#ctitle").text(chance.name);
	var resultword = "";
	var descword = "";
	window.find("li#cicon>i").removeClass();
	window.find("li#cicon>i").addClass("fa");
	window.find("li#cicon>i").addClass("fa-5x");
	switch(chance.type) {
		case 0:	//加扣點
			if(chance.effect > 0) {
				window.find("li#cicon>i").addClass("fa-usd");
				resultword = chance.effect % 1 == 0 ? "獲得點數："+chance.effect : "點數增長："+chance.effect+"倍";
			} else {
				window.find("li#cicon>i").addClass("fa-bomb");
				resultword = chance.effect % 1 == 0 ? "失去點數："+chance.effect : "點數縮水："+chance.effect+"倍";
			}
			descword = chance.desc;
			var credit = chance.effect % 1 == 0 ? player.credit+chance.effect : player.credit + (player.credit*chance.effect);
			player.creditCal(credit);
		break;
		case 1:	//傳送門
			this.placeArray = new Array();
			this.placeMap = new Object();
			for(var i=0;i<this.board.bricks.length;i++) {
				if(this.board.bricks[i].type == 1) {
					this.placeArray.push(this.board.bricks[i]);	//deep clone, only road
					this.placeMap[this.board.bricks[i].index] = this.board.bricks[i];
				}
			}
			window.find("li#cicon>i").addClass("fa-map-signs");
			if(chance.effect == -1) {
				this.placeArray.sort(function(a,b) { return 0.5-Math.random(); });
				resultword = "不小心到了"+this.placeArray[0].name;
				descword = chance.desc+this.placeArray[0].name;
				player.position = this.placeArray[0];

			} else {
				this.dice.diceValue = 0;
				resultword = "不小心到了"+this.placeMap[chance.effect].name;
				descword = chance.desc;
				player.position = this.placeMap[chance.effect];
			}
			this.board.remainmoves = 0;
			player.halt = true;
			player.manualMove(false);
		break;
		case 2:	//鎖定
			window.find("li#cicon>i").addClass("fa-ban");
			resultword = "被鎖定"+chance.effect+"回合";
			descword = chance.desc;
			player.frozen = chance.effect;
			this.board.remainmoves = 0;
			player.halt = true;
			player.manualMove(false);
		break;
	}
	window.find("li#ccontent").text(descword);
	window.find("li#cresult").text(resultword);
	window.find("li#cbutton>ul>li").off();
	window.find("li#cbutton>ul>li").on("click",function() {
		oriobj.closeWindow("popChance");
	})
	this.loadWindows();
	window.css("display","block");
}
pseudoWindow.prototype.shortcutWindow = function(name,start,end,desc) {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popShortcut");
	window.find("li#stitle").text(name);
	window.find("li#sconnection").text("連接"+start+"和"+end);
	window.find("li#sdesc").text(desc);
	window.find("li#sbutton>ul>li").off();
	window.find("li#sbutton>ul>li").on("click",function() {
		oriobj.closeWindow("popShortcut");
	})
	this.loadWindows();
	window.css("display","block");
}
pseudoWindow.prototype.stageWindow = function(name,desc,type,val,player) {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popStageupdate");
	window.find("li#sutitle").text("進入下一個時代："+name);
	var effect = "";
	switch(type) {
		case 0:
			effect = "";
		break;
		case 1:
			effect = "現金增加"+val;
		break;
		case 2:
			effect = "現金減少"+val;
		break;
	}
	player.creditCal(player.credit + val);
	window.find("li#suconnection").text(effect);
	window.find("li#sudesc").text(desc);
	window.find("li#subutton>ul>li").off();
	window.find("li#subutton>ul>li").on("click",function() {
		/*oriobj.board.loadRoads(DB);
		if(shortcut != undefined) {
			oriobj.board.showShortcut(shortcut);
		}*/
		oriobj.closeWindow("popStageupdate");
	})
	this.loadWindows();
	window.css("display","block");
}
pseudoWindow.prototype.welcomeWindow = function() {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popWelcome");
	window.find("li#wbutton>ul>li").off();
	window.find("li#wbutton>ul>li:nth-child(1)").on("click",function() {
		if(localStorage.hasOwnProperty("tutorial")) {
			if(JSON.parse(localStorage.tutorial)) {
				oriobj.tutorialWindow(function() {
					localStorage.tutorial = JSON.stringify(false);
				});
			}
		} else {
			localStorage.tutorial = JSON.stringify(true);
			oriobj.tutorialWindow(function() {
				localStorage.tutorial = JSON.stringify(false);
			});
		}	
		oriobj.closeWindow("popWelcome");
	});
	this.loadWindows();
	window.css("display","block");
}
pseudoWindow.prototype.controllerWindow = function() {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popController");
	window.find("ul#closecontrollers").off();
	window.find("ul#closecontrollers").on("click", function() {
		oriobj.endPseudo();
	});
	this.loadWindows();
	window.css("display","block");
}
pseudoWindow.prototype.switchWindow = function(message) {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popSwitchuser");
	window.find("li#udesc").text("現在輪到"+message+"的回合囉！");
	window.find("li#ubutton>ul>li").off();
	window.find("li#ubutton>ul>li:nth-child(1)").on("click",function() {
		oriobj.closeWindow("popSwitchuser");
	});
	this.loadWindows();
	window.css("display","block");
}
pseudoWindow.prototype.tutorialWindow = function(commandlet) {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popTutorial");
	window.find("li#tbutton>ul>li").off();
	window.find("li#tbutton>ul>li:nth-child(1)").on("click",function() {
		if(commandlet != undefined) commandlet();
		oriobj.closeWindow("popTutorial");
	});
	this.loadWindows();
	window.css("display","block");
	tutorialSwiper = new Swiper('#tutorialcontainer', {
		pagination: '#tutorialpagination',
		nextButton: '#tutorialdown',
		prevButton: '#tutorialup',
		paginationType: 'progress',
        paginationClickable: true,
        spaceBetween: 30,
        centeredSlides: true,
        autoplay: 2500,
        autoplayDisableOnInteraction: false,
		autoplayStopOnLast: true
	});
	$(".tutorialController").hide();
	$("#tutorialcontainer").on("mouseenter", function() {
		$(".tutorialController").show();
	});
	$("#tutorialcontainer").on("mouseleave", function() {
		$(".tutorialController").hide();
	});
}
pseudoWindow.prototype.settleWindow = function(message,socket) {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popSettle");
	$("ul#popSettle>li#secontent>ol#seleaderboard").empty();
	window.find("li#semessage").text(message.message);
	var leaderboard = new Array();
	Object.keys(message.leaderboard).forEach(function(key) {	//主機轉送下來的asset是錯的，必須檢查
		leaderboard.push({
			asset: message.leaderboard[key].asset,
			credit: message.leaderboard[key].credit,
			id: message.leaderboard[key].id,
			order: message.leaderboard[key].order,
			position: message.leaderboard[key].position,
			score: message.leaderboard[key].score
		});
	});
	leaderboard.sort(function(a,b) {
		return b.asset - a.asset;
	})
	leaderboard.forEach(function(item) {
		var li = $("<li></li>");
		li.addClass("leaderboarditem");
		var name = $("<span></span>");
		name.text(item.id);
		name.addClass("leaderboarditemid");
		var asset = $("<span></span>");
		var asseticon = $("<i></i>");
		asseticon.addClass("fa");
		asseticon.addClass("fa-usd");
		asset.append(asseticon);
		asset.append(item.asset)
		li.append(asseticon);
		li.append(asset);
		li.append(name);
		$("ul#popSettle>li#secontent>ol#seleaderboard").append(li);
	});
	window.find("li#sebutton>ul>li").off();
	window.find("li#sebutton>ul>li:nth-child(1)").on("click",function() {
		socket.emit("removesession",{
			sid: false
		});
		oriobj.closeWindow("popSettle");
	});
	window.find("li#sebutton>ul>li:nth-child(2)").on("click",function() {
		oriobj.closeWindow("popSettle");
	});
	this.loadWindows();
	window.css("display","block");
}
pseudoWindow.prototype.errorWindow = function(message,type) {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popError");
	window.find("li#emessage").text(message);
	window.find("li#ebutton>ul>li").off();
	window.find("li#ebutton>ul>li:nth-child(1)").on("click",function() {
		oriobj.endPseudo();
	});
	window.find("li#ebutton>ul>li:nth-child(2)").on("click",function() {
		location.href = "index.htm";
	});
	window.find("li#ebutton>ul>li").css("display","none");
	if(type == 0) window.find("li#ebutton>ul>li:nth-child(1)").css("display","block");
	if(type == 1) window.find("li#ebutton>ul>li:nth-child(2)").css("display","block");
	if(type == 2) window.find("li#ebutton>ul>li").css("display","block");
	this.loadWindows();
	window.css("display","block");
}
pseudoWindow.prototype.messageWindow = function(title,message,control,icon,type,stackicon) {
	var oriobj = this;
	var showeffect = type == undefined ? "fade" : type;
	var window = this.htmlElement.find("ul#popMessage");
	window.find("li#ptitle").text(title);
	window.find("li#pcontent").empty();
	window.find("li#pcontent").append(message);
	window.find("li#picon").empty();
	window.find("li#picon").append($("<i></i>"));
	window.find("li#picon>i").addClass("fa");
	window.find("li#picon>i").addClass("fa-5x");
	window.find("li#picon>i").addClass("fa-"+icon);
	if(stackicon != undefined) {
		window.find("li#picon").addClass("fa-stack fa-2x");
		window.find("li#picon>i").removeClass("fa-5x");
		window.find("li#picon>i").addClass("fa-stack-2x");
		var sicon = $("<i></i>");
		sicon.addClass("fa");
		sicon.addClass("fa-stack-1x");
		sicon.css("left","20px");
		sicon.css("top","20px");
		if(stackicon.emphasis) sicon.css("color","red");
		sicon.addClass("fa-"+stackicon.icon);
		window.find("li#picon").append(sicon);
	} else {
		window.find("li#picon").removeClass("fa-stack fa-lg");
	}
	window.find("li#pbutton>ul>li").css("display","none");
	window.find("li#pbutton>ul>li:nth-child(1)").text("確定");
	window.find("li#pbutton>ul>li").off();
	if(control.ok.enable) {
		window.find("li#pbutton>ul>li:nth-child(1)").css("display","block");
		window.find("li#pbutton>ul>li:nth-child(1)").text(control.ok.customtext);
		window.find("li#pbutton>ul>li:nth-child(1)").on("click", function() {
			control.ok.func();
		})
	}
	if(control.yes.enable) {
		window.find("li#pbutton>ul>li:nth-child(2)").css("display","block");
		window.find("li#pbutton>ul>li:nth-child(2)").on("click", function() {
			control.yes.func();
		})
	}
	if(control.no.enable) {
		window.find("li#pbutton>ul>li:nth-child(3)").css("display","block");
		window.find("li#pbutton>ul>li:nth-child(3)").on("click", function() {
			control.no.func();
		})
	}
	window.find("li#pbutton>ul>li:nth-child(4)>ul").empty();
	for(var i=0;i<control.custombuttons.length;i++) {
		control.custombuttons[i].addClass("button");
		window.find("li#pbutton>ul>li:nth-child(4)>ul").append(control.custombuttons[i]);
	}
	this.loadWindows();
	window.show(showeffect)
	if(control.custombuttons.length > 0) {
		window.find("li#pbutton>ul>li:nth-child(4)").css("display","block");
		var custombuttonwidth = 0;
		for(var i=0;i<control.custombuttons.length;i++) {
			custombuttonwidth += $(window.find("li#pbutton>ul>li:nth-child(4)>ul>li.button")[i]).outerWidth()+10;
		}
		window.find("li#pbutton>ul>li:nth-child(4)").css("width",custombuttonwidth);
	}
}
pseudoWindow.prototype.questionWindow = function(question,credit,answers,player,board) {
	var oriobj = this;
	var window = this.htmlElement.find("ul#popQuestion");
	//this.resetWindows();
	window.find("li#qcredit").text("本題積分："+credit);
	window.find("li#qcontent").text(question);
	window.find("li#qanswers>ul").empty();
	for(var i=0;i<answers.length;i++) {	//如果要做各答案積分，要修改這裡，以及server端
		var answer = $("<li>"+answers[i]+"</li>");
		answer.data("serial",i);
		window.find("li#qanswers>ul").append(answer);
		answer.on("click",function() {
			var selectedObj = $(this);
			board.socket.emit('checkAnswer', { answer: $(this).data("serial") });
			board.socket.on('queryAnswer', function(data) {
				if(data.answer == selectedObj.data("serial")) {
					oriobj.messageWindow("答對啦",data.reason,{
						ok:{
							customtext: "取得積分"+credit,
							enable: true,
							func: function() {
								player.creditCal(player.credit + credit);
								//oriobj.dice.reset();
								oriobj.infoWindow(board.upgradeDB,board.stage,player,player.position,0);
							}
						},
						yes:{
							enable: false,
							func: function() {
								oriobj.endPseudo();
							}
						},
						no:{
							enable: false,
							func: function() {
								oriobj.endPseudo();
							}
						},
						custombuttons: new Array()
					},"check");
				} else {
					oriobj.messageWindow("答錯啦",data.reason,{
						ok:{
							customtext: "好吧，下一題",
							enable: true,
							func: function() {
								player.creditCal(player.credit - credit);
								//oriobj.dice.reset();
								oriobj.infoWindow(board.upgradeDB,board.stage,player,player.position,0);
							}
						},
						yes:{
							enable: false,
							func: function() {
								oriobj.endPseudo();
							}
						},
						no:{
							enable: false,
							func: function() {
								oriobj.endPseudo();
							}
						},
						custombuttons: new Array()
					},"times");
				}
				board.socket.off('queryAnswer');
			});
		});
	}
	this.loadWindows();
	window.css("display","block");
}
pseudoWindow.prototype.infoWindow = function(upgradeDB,stage,player,brick,mode) {
	var oriobj=this;
	var window = this.htmlElement.find("ul#popInfo");
	this.resetWindows();
	window.find("li#iownericon").empty();
	window.find("li#eSets>ul").empty();
	window.find("li#buyBrick>ul>li").css("display","none");
	window.find("li#buyBrick>ul>li").off();
	var icon = $("<i></i>");
	icon.addClass("fa");
	icon.addClass("fa-5x");
	window.find("li#iownericon").append(icon);
	window.find("li#iInfo>h1").text(brick.name);
	window.find("li#iInfo>p#iDesc").text(brick.desc);
	window.find("li#uSets").css("display","none");
	window.find("li#eSets").css("display","none");
	var viewmode = false;
	window.find("li#iInfo>p#iPlayer").empty();
	if(brick.players.length > 0) {
		window.find("li#iInfo>p#iPlayer").text("現有玩家：");
		brick.players.forEach(function(p) {
			var token = $("<i></i>");
			token.attr("title",p.name);
			token.addClass("fa");
			token.addClass("fa-"+p.icon);
			token.css("color","#"+p.mainColor);
			window.find("li#iInfo>p#iPlayer").append(token);
		});
	} else {
		window.find("li#iInfo>p#iPlayer").text("目前無玩家在此");
	}
	if(mode == 0) {
		if(brick.owner == player) {
			viewmode = true;
		}
	} else {
		viewmode = false;
	}
	if(brick.owner == null) {
		window.find("li#iInfo>h2").text("無主地");
		icon.addClass("fa-question");
		if(brick.upgrades.length > 0) {
			window.find("li#eSets").css("display","block");
			window.find("li#eSets>ul").empty();
			for(var i=0;i<brick.upgrades.length;i++) {
				var item = $("<li></li>");
				var title = $("<span></span>");
				title.text(brick.upgrades[i].name);
				var rent = $("<span></span>");
				rent.addClass("renttip");
				rent.text("租金加成："+brick.upgrades[i].rent+"倍");
				var uicon = $("<i></i>");
				uicon.addClass("fa");
				uicon.addClass("fa-1x");
				uicon.addClass("fa-"+brick.upgrades[i].icon);
				item.append(uicon);
				item.append(title);
				item.append(rent);
				window.find("li#eSets>ul").append(item);
			}
		}
		if(mode == 0) {
			window.find("li#buyBrick").css("display","block");
			window.find("li#buyBrick>ul>li#cinfoButton").css("display","block");
			window.find("li#buyBrick>ul>li#cinfoButton").on("click",function() {
				//oriobj.dice.available = true;
				oriobj.endPseudo();
			}); 
			if(brick.type == 1) {
				window.find("li#buyBrick>ul>li#buyButton").css("display","block");
				window.find("li#buyBrick>ul>li#buyButton").on("click",function() {
					player.addBrick(brick);
						//oriobj.dice.available = true;
						/*
						1. 底下的回應都要改成socket.on
						2. server端要會算錢 this.creditCal(this.credit - brick.getCurrentValue());*/
					oriobj.endPseudo();
				}); 
			}
		} else {
			window.find("li#buyBrick").css("display","block");
			window.find("li#buyBrick>ul>li#cinfoButton").css("display","block");
			window.find("li#buyBrick>ul>li#cinfoButton").on("click",function() {
				//oriobj.dice.available = true;
				oriobj.endPseudo();
			}); 
		}
		window.find("li#iInfo>h3").text("過路費："+brick.getRent()+"/現值："+brick.getCurrentValue());
		oriobj.loadWindows();
		window.css("display","block");
	} else {
		window.find("li#iInfo>h2").text("所有者："+brick.owner.name);
		icon.addClass("fa-"+brick.owner.icon);
		if(viewmode) {
			window.find("li#uSets").css("display","block");
			Object.keys(upgradeDB).forEach(function(ukey) {
				var upgrade = upgradeDB[ukey];
				if(upgrade.type != 1) {
					var item = $("<span></span>");
					item.addClass("item");
					var ability = $("<span class=\"rent\"></span>");
					ability.text("過路費加乘："+upgrade.rent);
					item.data("upgradeItem",upgrade);
					if(Object.keys(brick.upgrades).indexOf(upgrade.name) >= 0) {
						if(!item.hasClass("unavaiableUpgrade")) {
							item.addClass("unavaiableUpgrade");
							ability.text("已購買");
						}
					}
					if(upgrade.price > player.credit) {
						if(!item.hasClass("unavaiableUpgrade")) {
							item.addClass("unavaiableUpgrade");
							ability.text("點數不足");
						}
					}
					if(upgrade.stage > stage) {
						if(!item.hasClass("unavaiableUpgrade")) {
							item.addClass("unavaiableUpgrade");
							ability.text("尚未開啟");
						}
					}
					if(!item.hasClass("unavaiableUpgrade")) {
						item.addClass("avaiableUpgrade");
						item.on("click", function() {
							var itemObj = $(this);
							oriobj.messageWindow("小知識："+itemObj.data("upgradeItem").name,itemObj.data("upgradeItem").desc,{
								ok:{
									customtext: "完成購買",
									enable: true,
									func: function() {
										$("div#upanblock").empty();
										$("div#upanblock").css("top",itemObj.offset().top);
										$("div#upanblock").css("left",itemObj.offset().left);
										$("div#upanblock").append($(itemObj.children()[2]));
										$("div#upanblock").css("visibility","visible");
										$("div#upanblock").css("opacity",1);
										$("div#upanblock").animate({top: brick.htmlElement.offset().top, left: brick.htmlElement.offset().left,opacity: 0.3},500,function() {
											$("div#upanblock").css("visibility","hidden");
											//brick.addUpgrade(itemObj.data("upgradeItem"));
											oriobj.board.socket.emit("upgradeBrick", {
												player: {
													uid: player.uid,
													credit: player.credit
												}, 
												brick: {
													name: brick.name,
													index: brick.index,
													type: brick.type,
													active: brick.active,
													shortcut: brick.shortcut,
													price: brick.price,
													upgrades: brick.upgrades
												},
												upgrade: {
													name: itemObj.data("upgradeItem").name
												}
											});
											//player.creditCal(player.credit - itemObj.data("upgradeItem").price);
										});
										//oriobj.dice.available = true;
										oriobj.endPseudo();
									}
								},
								yes:{
									enable: false,
									func: function() {
										oriobj.endPseudo();
									}
								},
								no:{
									enable: false,
									func: function() {
										oriobj.endPseudo();
									}
								},
								custombuttons: new Array()
							},"pencil");
						});
					}
					var name = $("<h1></h1>");
					name.text(upgrade.name);
					var uicon = $("<i></i>");
					uicon.addClass("fa");
					uicon.addClass("fa-"+upgrade.icon);
					uicon.addClass("fa-5x");
					var price = $("<h2></h2>");
					price.text("價格："+upgrade.price);
					item.append(name);
					item.append(price);
					item.append(uicon);
					item.append(ability);
					item.addClass("swiper-slide");
					//window.find("li#uSets>ul#upgradeRoll").slick('slickAdd',item);
					//oriobj.upgrademenu.appendSlide(item);
					window.find("li#uSets>ul#upgradecontainer>li#upgradeRoll").append(item);
				}
			});
			var upgradeindicator = 0;
			var i = 0;
			window.find("li#uSets>ul#upgradecontainer>li#upgradeRoll").children().each(function(item) {
				if(upgradeindicator == 0) {
					if($(item).hasClass("avaiableUpgrade")) {
						upgradeindicator = i;
					}
				}
				i++;
			});
			window.find("li#iInfo>h3").text("過路費："+brick.getRent()+"/現值："+brick.getCurrentValue());
			oriobj.loadWindows();
			window.css("display","block");
			var upgrademenu = new Swiper('#upgradecontainer', {
				scrollbar: '#upgradescrollbar',
				nextButton: '#upgradedown',
				prevButton: '#upgradeup',
				slidesPerView:4,
				height:150,
				width:480,
				loop:true,
				initialSlide:upgradeindicator
			});
			//window.find("li#uSets>ul#upgradeRoll").slick("slickNext");
			/*for(var i=0;i<upgradeDB.length;i++) {	//這是一個workaround，不讓動畫上下跑一跑，繪製會發生width=0，但當動畫項目太少時會跑不起來，因此廢物件等到跑完再砍
				if(upgradeDB[i].type == 1) continue;
				leadermenu.appendSlide(slide);
				window.find("li#uSets>ul#upgradeRoll").slick('slickRemove',0);
			}*/
			$("ul#upgradeRoll button.slick-arrow").text("");
			var arrowup = $("<i class=\"fa fa-arrow-circle-o-left fa-1x\"></i>");
			$("ul#upgradeRoll button.slick-prev").append(arrowup);
			var arrowdown = $("<i class=\"fa fa-arrow-circle-o-right fa-1x\"></i>");
			$("ul#upgradeRoll button.slick-next").append(arrowdown);
			window.find("li#buyBrick>ul>li#cinfoButton").css("display","block");
			window.find("li#buyBrick>ul>li#cinfoButton").on("click",function() {
				//oriobj.dice.available = true;
				oriobj.endPseudo();
			}); 
			window.find("li#buyBrick>ul>li#sellButton").css("display","block");
			window.find("li#buyBrick>ul>li#sellButton").on("click",function() {
				player.removeBrick(brick);
				//oriobj.dice.available = true;
				oriobj.endPseudo();
			}); 
		} else {
			if(brick.upgrades.length > 0) {
				window.find("li#eSets").css("display","block");
				window.find("li#eSets>ul").empty();
				for(var i=0;i<brick.upgrades.length;i++) {
					var item = $("<li></li>");
					var title = $("<span></span>");
					title.text(brick.upgrades[i].name);
					var rent = $("<span></span>");
					rent.addClass("renttip");
					rent.text("租金加成："+brick.upgrades[i].rent+"倍");
					var icon = $("<i></i>");
					icon.addClass("fa");
					icon.addClass("fa-1x");
					icon.addClass("fa-"+brick.upgrades[i].icon);
					item.append(icon);
					item.append(title);
					item.append(rent);
					window.find("li#eSets>ul").append(item);
				}
			}
			if(viewmode) {
				window.find("li#buyBrick>ul>li#cinfoButton").css("display","block");
				window.find("li#buyBrick>ul>li#cinfoButton").on("click",function() {
					//oriobj.dice.available = true;
					oriobj.endPseudo();
				}); 
				window.find("li#buyBrick>ul>li#buyButton").css("display","block");
				window.find("li#buyBrick>ul>li#buyButton").on("click",function() {
					if(player.addBrick(brick)) {
						//oriobj.dice.available = true;
						oriobj.endPseudo();
					} else {
						oriobj.messageWindow("無法購買","你手上點數不足，無法購買"+brick.name,{
							ok:{
								enable: true,
								func: function() {
									//oriobj.dice.reset();
									//oriobj.dice.available = true;
									oriobj.endPseudo();
								}
							},
							yes:{
								enable: false,
								func: function() {
									oriobj.endPseudo();
								}
							},
							no:{
								enable: false,
								func: function() {
									oriobj.endPseudo();
								}
							},
							custombuttons: new Array()
						},"exclamation-triangle");
					}
				}); 
				window.find("li#buyBrick>ul>li#feeButton").css("display","block");
				window.find("li#buyBrick>ul>li#feeButton").on("click",function() {
					//oriobj.dice.available = true;
					oriobj.endPseudo();
				}); 
			} else {
				window.find("li#buyBrick").css("display","block");
				window.find("li#buyBrick>ul>li#cinfoButton").css("display","block");
				window.find("li#buyBrick>ul>li#cinfoButton").on("click",function() {
					//oriobj.dice.available = true;
					oriobj.endPseudo();
				}); 
			}
			window.find("li#iInfo>h3").text("過路費："+brick.getRent()+"/現值："+brick.getCurrentValue());
			this.loadWindows();
			window.css("display","block");
		}
	}
}