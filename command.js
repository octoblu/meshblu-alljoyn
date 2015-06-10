var Plugin = require('./index').Plugin;
var meshblu = require('meshblu');
var config = require('./meshblu.json');

var conx = meshblu.createConnection({
  server : config.server,
  port   : config.port,
  uuid   : config.uuid,
  token  : config.token
});

conx.on('notReady', console.error);
conx.on('error', console.error);

var plugin = new Plugin();

conx.on('ready', function(){
  conx.whoami({uuid: config.uuid}, function(device){
	var pluginOptions = device.options || Plugin.options;

    plugin.setOptions(pluginOptions);
	plugin.createAllJoynBus();
  });
  conx.update({
    uuid: config.uuid,
    token: config.token,
    messageSchema: plugin.messageSchema,
    optionsSchema: plugin.optionsSchema,
    options:       plugin.options
  });
});

conx.on('message', function(){
  try {
    plugin.onMessage.apply(plugin, arguments);
  } catch (error){
    console.error(error.message);
    console.error(error.stack);
  }
});

plugin.on('message', function(message){
  conx.message(message);
});

plugin.on('error', console.error);
