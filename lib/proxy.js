"use strict";

var http      = require('http')
  , io        = require('socket.io')
  , config    = require('config-url')
  , _         = require('lodash')
  , Promise   = require('bluebird')
  , SlackAPI  = require('slackbotapi')
  ;

class SlackAPISpy extends SlackAPI {
  constructor(options) {
    super(options);
    this.p$data = new Promise((res, rej) => {
      this.p$data_res = res;
    });
  }

  emit() {
    let args = _.toArray(arguments);
    super.emit.apply(this, args);

    if (_.size(args) !== 1) {
      let wild = ['*'].concat(_.tail(args));
      super.emit.apply(this, wild);
    }
  }

  reqAPI() {
    let args = _.toArray(arguments);
    let cb = _.last(args);

    let spy = (data) => {
      this.p$data_res(data);
      cb(data);
    };

    let spy_args = _.dropRight(args).concat([spy]);
    super.reqAPI.apply(this, spy_args);
  }
}

class BotProxy {
  constructor() {
    this.app = http.createServer((req, res) => { res.end(); })
    this.io = io(this.app);

    this.io.on('connection', function (socket) {
      socket.on('/connect', function (options) {
        var bot = BotProxy.instances[options.token];

        if (!bot) {
          bot = new SlackAPISpy({
              'token'         : options.token
            , 'logging'       : true
            , 'autoReconnect' : true
          });
          
          BotProxy.instances[options.token] = bot;
        }

        bot.p$data.then((data) => {
          socket.emit('/rtm.start', data);
        });

        bot.on('*', (msg) => {
          socket.emit('/message', msg);
        });

        socket.on('/send', (data) => {
          switch(data.type) {
            case 'message':
            bot.sendMsg.apply(bot, data.args);
            break;
            case 'pm':
            bot.sendPM.apply(bot, data.args);
            break;
          }
        });
      });
    });
  }

  listen() {
    return Promise.fromCallback((cb) => {
      this.app.listen(config.getUrlObject('api.slackbot').port, cb);
    });
  }
}

BotProxy.instances = { };

module.exports = BotProxy;