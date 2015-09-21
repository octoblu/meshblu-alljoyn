var _ = require('lodash');
var util = require('util');
var debug = require('debug')('meshblu-alljoyn');
var alljoyn = require('alljoyn');
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
  var self = this;
  self.options = getDefaultOptions();
  self.messageSchema = MESSAGE_SCHEMA;
  self.optionsSchema = OPTIONS_SCHEMA;
  self.sessions = [];
  return self;
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

Plugin.prototype.onConfig = function(device){
  var self = this;

  self.setOptions(device.options);
};

Plugin.prototype.setOptions = function(options){
  var self = this;
  self.options = options || {};
  debug('set options', self.options);
  if(self.bus){
    debug('bus is already created');
    return;
  }
  self.createAllJoynBus();
};

Plugin.prototype.createAllJoynBus = function(){
  var self = this;

  if(!self.options.interfaceName){
    console.error('Missing Interface Name');
    return;
  }

  if(!self.options.signalMemberName){
    console.error('Missing Signal Member Name');
    return;
  }

  debug('create alljoyn bus');
  self.bus = alljoyn.BusAttachment('skynet-alljoyn');
  self.inter = alljoyn.InterfaceDescription();

  function onFound(name){
    debug('on found');
    var sessionId = self.bus.joinSession(name, 27, 0);
    self.sessions = _.union([sessionId], self.sessions);
  }

  function onLost(name){
    debug('on lost');
  }

  function onChanged(name){
    debug('on changed');
  }

  var listener = alljoyn.BusListener(onFound, onLost, onChanged);

  self.bus.createInterface(self.options.interfaceName, self.inter);
  self.bus.registerBusListener(listener);

  self.bus.start();

  function onAcceptSessionJoiner(port, joiner){
    //TODO possibly be more selective
    return true;
  }

  function onSessionJoined(port, sId, joiner){
    self.sessions = _.union([sId], self.sessions);
  }

  self.bus.connect();

  if(self.options.advertisedName){
    var portListener = alljoyn.SessionPortListener(onAcceptSessionJoiner, onSessionJoined);
    var fullName = self.options.interfaceName + '.' + self.options.advertisedName;
  }

  var notificationService = self.notificationService = alljoyn.NotificationService("skynet-alljoyn", self.bus, 0);
  self.inter.addSignal(self.options.signalMemberName, "s", "msg");
  var messageObject = self.messageObject = alljoyn.BusObject(self.options.messageServiceName);
  messageObject.addInterface(self.inter);

  function onSignalReceived(msg, info){
    self.emit('message', {
      devices: self.options.relayUuid,
      payload: {
        msg: msg,
        info: info
      }
    });
  }
  if(self.options.relayUuid){
    self.bus.registerSignalHandler(messageObject, onSignalReceived, self.inter, self.options.signalMemberName);
  }

  self.bus.registerBusObject(messageObject);

  if(self.options.findAdvertisedName){
    self.bus.findAdvertisedName(self.options.findAdvertisedName);
  }
};

Plugin.prototype.destroy = function(){
  var self = this;
  if(!self.bus){
    debug('no bus');
    return;
  }
  self.bus.disconnect();
  self.bus.stop();
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
