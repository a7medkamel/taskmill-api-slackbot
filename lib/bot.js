"use strict";

var io            = require('socket.io-client')
  , _             = require('lodash')
  , config        = require('config-url')
  ;

const EventEmitter = require('events');

class Bot extends EventEmitter {
  constructor(options) {
    super();

    this.options = options;

    this.socket = io(config.getUrl('api.slackbot'));

    this.socket.on('connect', () => { 
      this.socket.emit('/connect', { token : options.token });
    });

    this.socket.on('disconnect', () => { this.emit('disconnect', { type : 'disconnect' }); });
    this.socket.on('error', (err) => { this.emit('error', { type : 'error', error : err }); });

    this.socket.on('/message', (data) => {
      if (_.isObject(data)) {
        this.emit(data.type, data);
      }
    });

    this.socket.on('/rtm.start', (data) => {
      this.data = data;
    });
  }

  send(data) {
    this.socket.emit('/send', {
        type : arguments[0]
      , args : _.tail(arguments)
    });
  }
}

module.exports = Bot;