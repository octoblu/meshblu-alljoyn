var util = require('util');
var EventEmitter = require('events').EventEmitter;
var alljoyn = require('alljoyn'); 
var _ = require('lodash');
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
  this.options = getDefaultOptions(); 
  this.messageSchema = MESSAGE_SCHEMA;
  this.optionsSchema = OPTIONS_SCHEMA;
  var self = this; 
  self.sessions = []; 

	
  return this;
}
util.inherits(Plugin, EventEmitter);

Plugin.prototype.onMessage = function(message){
	  var self = this;

	  if(!message.payload){ return; }

	  if(message.payload.method === 'send' && message.payload.message){
	    self.sessions.forEach(function(sessionId){
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

Plugin.prototype.createAllJoynBus = function(){
	var self = this; 
	var bus = self.bus = alljoyn.BusAttachment('skynet-alljoyn');
	var inter = self.inter = alljoyn.InterfaceDescription();
	
	
	function onFound(name){
	  var sessionId = bus.joinSession(name, 27, 0);
	  self.sessions = _.union([sessionId], self.sessions);
	}

	function onLost(name){
	}

	function onChanged(name){
	}


	var listener = alljoyn.BusListener(onFound, onLost, onChanged);

	bus.createInterface(this.options.interfaceName, inter);
	bus.registerBusListener(listener);

	bus.start();

	function onAcceptSessionJoiner(port, joiner){
	  //TODO possibly be more selective
	  return true;
	}

	function onSessionJoined(port, sId, joiner){
	  self.sessions = _.union([sId], self.sessions);
	}

	bus.connect();

	if(self.options.advertisedName){
	  var portListener = alljoyn.SessionPortListener(onAcceptSessionJoiner, onSessionJoined);
	  var fullName = self.options.interfaceName + '.' + self.options.advertisedName;
	}

	var notificationService = self.notificationService = alljoyn.NotificationService("skynet-alljoyn", bus, 0);
	inter.addSignal(self.options.signalMemberName, "s", "msg");
	var messageObject = self.messageObject = alljoyn.BusObject(self.options.messageServiceName);
	messageObject.addInterface(inter);

	function onSignalReceived(msg, info){
	  messenger.send({
	    devices: self.options.relayUuid,
	    payload: {
	      msg: msg,
	      info: info
	    }
	  });
	}
	if(self.options.relayUuid){
	  bus.registerSignalHandler(messageObject, onSignalReceived, inter, this.options.signalMemberName);
	}

	bus.registerBusObject(messageObject);

	if(self.options.findAdvertisedName){
	  bus.findAdvertisedName(this.options.findAdvertisedName);
	}
}; 

Plugin.prototype.destroy = function(){
  this.bus.disconnect();
  this.bus.stop();
};

function getDefaultOptions(){
    return {
      advertisedName: 'test',
      interfaceName: 'org.alljoyn.bus.samples.chat',
      findAdvertisedName: 'org.alljoyn.bus.samples.chat',
      signalMemberName: 'Chat',
      messageServiceName: '/chatService',
      relayUuid: '*'
    };
}
module.exports = {
  messageSchema: MESSAGE_SCHEMA,
  optionsSchema: OPTIONS_SCHEMA,
  Plugin: Plugin,
  getDefaultOptions: getDefaultOptions	
};
