"use strict";
var socket, recentReceived = false, iScrollObj;

function initApp(){
	socket = io.connect(null, {port: 14600});
	socket.on('connect', function(){
		if (geoInit()){
			connected();
			getLatestMsgs();
			connectedListeners();
		}
	});
	socket.on('disconnect', disconnected);
	
	$('div.messages').height(
		$(window).height() 
		- $('div.header').height() 
		- $('div.footer').height()
		- $('#sendMsg').height()
	);
	
	iScrollObj = new iScroll($('div.messages')[0], {vScrollbar: false, hScrollbar: false});
}

function connectedListeners(){
	socket.on('groupMsg', function(msg){
		if (Array.isArray(msg)){
			//If we have a group, sort with the oldest message at index 0
			msg.sort(function(m1, m2){return (new Date(m1.time)).getTime() - (new Date(m2.time)).getTime()});
			msg.forEach(postMessage);
		}
		else {
			postMessage(msg);
		}
	});
	socket.on('channelCount', updateChannelCount);
}

function connected(channelCount){
	channelCount = Number(channelCount) || 0;
	if (channelCount == 0){
		setLoc(false);
	}
	var status = $('#cStatus');
	status.removeClass('off');
	status.addClass('on');
	status.text('Online - ' + channelCount);
}

function disconnected(){
	var status = $('#cStatus');
	status.removeClass('on');
	status.addClass('off');
	status.text('Offline');
}

function geoInit(){
	if (!Geo.init()) return false;
	
	$('#sendMsg').bind('click', sendMessage);
	$('#msg').keyup(function(e){(e.which == 13) && sendMessage();});
	
	Geo.watchPosition(
		function(loc) {
			socket.emit('location', loc.coords);
			setLoc(loc);
		},
		function(e) {
			console.log("Error " + e.code + ": " + e.message);
		}
	);
	
	return true;
}

function setLoc(loc){
	if (!loc){
		if(!setLoc.msgBox){
			setLoc.msgBox = $('<span> - Location disabled, please enable</span>');
			$('div.header H1').append(setLoc.msgBox);
		}
		return;
	}
	
	if(setLoc.msgBox){
		setLoc.msgBox.remove();
		delete setLoc.msgBox;
	}
}

function sendMessage(){
	var msgBox = $('#msg');
	var msg = msgBox.val();
	if (!msg) return;
	
	socket.emit('msg', {msg: msg});
	msgBox.val('');
}

function postMessage(msgData){
	var li = $('<li>').text(msgData.msg);
	
	var postTime = new Date(msgData.time);
	var timeElm = $('<time>').attr('datetime', msgData.time);
	timeElm.text(postTime.toLocaleTimeString() + ' ' + postTime.toDateString());	
	li.append(timeElm);
	
	//TODO: Having id="messages" for UL and DIV.messages elsewhere is confusing.
	//Maybe make this an instace of an object and don't do $() lookups in arbitrary functions
	$('#messages').append(li).listview('refresh');
	iScrollObj.refresh();
	
	//Only scroll to last element if the messages box is overflowing
	if ($('#messages').height() > $('div.messages').height()){
		iScrollObj.scrollToElement(li[0]);
	}
}

function getLatestMsgs(){
	if (!recentReceived){
		socket.emit('getLatestMsgs');
	}
}

function updateChannelCount(channelData){
	connected(channelData.count);
}