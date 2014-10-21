var util = require('util');
var EventEmitter = require('events').EventEmitter;

var MESSAGE_SCHEMA = {
  type: 'object',
  properties: {
    method: {
      type: 'string',
      required: true,
      default: 'notify'
    },
    message: {
      type: 'string',
      required: true
    }
  }
};

var OPTIONS_SCHEMA = {
  type: 'object',
  properties: {
    advertisedName: {
      type: 'string',
      required: true,
      default: "test"
    },
    interfaceName: {
      type: 'string',
      required: true,
      default: "org.alljoyn.bus.samples.chat",
    },
    findAdvertisedName: {
      type: 'string',
      required: true,
      default: "org.alljoyn.bus.samples.chat"
    },
    signalMemberName: {
      type: 'string',
      required: true,
      default: "Chat",
    },
    messageServiceName: {
      type: 'string',
      required: true,
      default: "/chatService"
    },
    relayUuid: {
      type: 'string',
      required: true,
      default: "*",
    }
  }
};

function Plugin(){
  this.options = {};
  this.messageSchema = MESSAGE_SCHEMA;
  this.optionsSchema = OPTIONS_SCHEMA;
  var self = this; 
  self.sessions = []; 

	function onFound(name){
	  console.log('FoundAdvertisedName', name);
	  var sessionId = bus.joinSession(name, 27, 0);
	  console.log('JoinSession ' + sessionId);
	  self.sessions = _.union([sessionId], self.sessions);
	}

	function onLost(name){
	  console.log('LostAdvertisedName', name);
	}

	function onChanged(name){
	  console.log('NameOwnerChanged', name);
	}

	var bus = this.bus = alljoyn.BusAttachment('skynet-alljoyn');
	var inter = this.inter = alljoyn.InterfaceDescription();
	var listener = alljoyn.BusListener(onFound, onLost, onChanged);

	bus.createInterface(this.options.interfaceName, inter);
	bus.registerBusListener(listener);

	bus.start();

	function onAcceptSessionJoiner(port, joiner){
	  console.log("AcceptSessionJoiner", port, joiner);
	  //TODO possibly be more selective
	  return true;
	}

	function onSessionJoined(port, sId, joiner){
	  self.sessions = _.union([sId], self.sessions);
	  console.log("SessionJoined", port, sId, joiner);
	}

	bus.connect();

	if(this.options.advertisedName){
	  var portListener = alljoyn.SessionPortListener(onAcceptSessionJoiner, onSessionJoined);
	  var fullName = this.options.interfaceName + '.' + this.options.advertisedName;
	  console.log("RequestName " + bus.requestName(fullName));
	  console.log("AdvertiseName " + bus.advertiseName(fullName));
	  console.log("BindSessionPort " + bus.bindSessionPort(27, portListener));
	}

	var notificationService = this.notificationService = alljoyn.NotificationService("skynet-alljoyn", bus, 0);
	inter.addSignal(this.options.signalMemberName, "s", "msg");
	var messageObject = this.messageObject = alljoyn.BusObject(this.options.messageServiceName);
	messageObject.addInterface(inter);

	function onSignalReceived(msg, info){
	  console.log("Signal received: ", msg, info);
	  messenger.send({
	    devices: self.options.relayUuid,
	    payload: {
	      msg: msg,
	      info: info
	    }
	  });
	}
	if(this.options.relayUuid){
	  bus.registerSignalHandler(messageObject, onSignalReceived, inter, this.options.signalMemberName);
	}

	bus.registerBusObject(messageObject);

	if(this.options.findAdvertisedName){
	  bus.findAdvertisedName(this.options.findAdvertisedName);
	}

  return this;
}
util.inherits(Plugin, EventEmitter);

Plugin.prototype.onMessage = function(message){
	  console.log('skynet-alljoyn message received: ', message);
	  var self = this;

	  if(!message.payload){ return; }

	  if(message.payload.method === 'send' && message.payload.message){
	    self.sessions.forEach(function(sessionId){
	      console.log('sending from skynet to session', sessionId, self.options.signalMemberName);
	      self.messageObject.signal(null, sessionId, self.inter, self.options.signalMemberName, message.payload.message);
	    });
	  }

	  if(message.payload.method === 'notify' && message.payload.message){
	    self.notificationService.notify(message.payload.message, 300);
	  }
};

Plugin.prototype.setOptions = function(options){
  this.options = options;
};

Plugin.prototype.destroy = function(){
  this.bus.disconnect();
  this.bus.stop();
};

module.exports = {
  messageSchema: MESSAGE_SCHEMA,
  optionsSchema: OPTIONS_SCHEMA,
  Plugin: Plugin
};
