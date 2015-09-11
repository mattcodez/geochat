/*************************
Geochat
Copyright Matthew Molnar 2012-2013
Matthew.Molnar@gmail.com
*************************/

"use strict";
var io = require('socket.io').listen(14600);
var activeUsers = {}; //TODO: Can probably use something in manager class for this
var allMessages = [];
var msgRadius = 15; //km distance for user message circles
var toRad = (Math.PI / 180);

io.set('log level', process.argv[2] || 1); //If no parameter, set to low

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

io.sockets.on('connection', function (socket) {
	console.log(socket.id + ' connected on ' + Date());
	
	var getLatestMsgs_primed = false; //Did getLatestMsgs want to run client but couldn't?
	
	socket.join(socket.id);
	
	socket.on('location', function(location){
		activeUsers[socket.id] = socket; //TODO: Try socket.manager.sockets.socket
		
		location.radLat = location.latitude * toRad;
		location.radLon = location.longitude * toRad;
		if (!isNumber(location.radLat) || !isNumber(location.radLon)){
			console.log('Bad location data: ');
			console.log(location);
			return;
		}
		
		socket.geoProps = {location:location};
		
		addToUserChannel(socket);
		
		socket.on('msg', function(msgData){receiveMsg(msgData, socket);});
		
		if (getLatestMsgs_primed){
			getLatestMsgs();
		}
	});
	
	socket.on('disconnect', function(){
		console.log(socket.id + ' disconnected on ' + Date());
		delete activeUsers[socket.id];
		
		//Get all the rooms that this user belonged to
		var rooms = socket.manager.roomClients[socket.id];
		
		//Change member count for all room owners from above list
		for (var roomID in rooms){
			//room name -> 'namespace/name' where name is socket.id for this app and namespace is ''
			roomID = roomID.split('/')[1];
			
			//Don't need to update count to disconnecting socket and sometimes rooms has junk in it like ''
			if (socket.id == roomID || !roomID) continue;
			
			//Socket.io apparently considers the socket to exist while still in the disconnect handler, so defer
			setTimeout(updateUserCount, 0, socket.manager.sockets.socket(roomID));
		}
	});
	
	socket.on('getLatestMsgs', getLatestMsgs);
	function getLatestMsgs(){
		if (socket.geoProps){
			var msgs = getRecentMessages(socket);
			if (msgs.length > 0){
				socket.emit('groupMsg', msgs);
				getLatestMsgs_primed = false;
			}
		}
		else {
			//Have to wait for location, might need jQuery deffereds here if we do this a lot
			getLatestMsgs_primed = true;
		}
	};
});

function receiveMsg(msgData, socket){
	if (!msgData.msg) return;
	
	var time = new Date();
	allMessages.push({msg:msgData.msg, loc:socket.geoProps.location, time:time, timeJSON:time.toUTCString()});
	
	//Send message to everyone in the user's radius group
	io.sockets.in(socket.id).emit('groupMsg', {msg: msgData.msg, time:time.toUTCString()});
	//TODO: abstract out io.sockets.in(socket.id) so we don't do full broadcast by accident
}

//Add other users to a given user's channel based on location distance
function addToUserChannel(newUser){
	var newLoc = newUser.geoProps.location;
	
	//Check newUser's distance against all active users
	for (var userID in activeUsers){
		var user = activeUsers[userID];
		if (user === newUser) continue;
		
		var userLoc = user.geoProps.location;
		var distance = pointDistance(newLoc.radLat, newLoc.radLon, userLoc.radLat, userLoc.radLon);

		if (distance < msgRadius){
			user.join(newUser.id); //Add user to new user's channel
			newUser.join(user.id); //Add new user to other user channel
			updateUserCount(user); //Update user's channel count since we just added the new user there
		}
	}
	
	updateUserCount(newUser);
}

function updateUserCount(socket){
	if(!socket){console.log('In updateUserCount, no valid socket supplied.');return;}
	
	var channel = socket.manager.rooms['/' + socket.id];
	var count = (channel && channel.length) || 0; //0 should be impossible as user is always a member of their room
	socket.emit('channelCount', {count:count});
}

//Return recent messages based on user distance to them
function getRecentMessages(user){
	var userMsgCount = 0;
	var messages = [];
	var userLat = user.geoProps.location.radLat;
	var userLon = user.geoProps.location.radLon;
	
	for (var i = allMessages.length - 1; i >= 0; i--){
		var msg = allMessages[i];
		var distance = pointDistance(msg.loc.radLat, msg.loc.radLon, userLat, userLon);
		
		if (distance < msgRadius){
			messages.push({msg:msg.msg, time:msg.timeJSON});
			if (messages.length >= 15) break;
		}
	}
	
	return messages;
}

//Get the distance on earth (km) between two points provided in radians
function pointDistance(lat_1, lon_1, lat_2, lon_2){
	return Math.acos(
		Math.sin(lat_1) * Math.sin(lat_2) + 
		Math.cos(lat_1) * Math.cos(lat_2) *
		Math.cos(lon_2 - lon_1)
	) * 6371; // mean radius of earth (km)
}