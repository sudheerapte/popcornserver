/**
   Copyright 2019 Sudheer Apte
*/

"use strict";

/**
  registry.js - register and maintain machines. Singleton.

  Usage: const registry = require('./registry.js');

  Each machine has a record:
  {
    name: string, the alphanumeric name of the machine.
    dir: string, the absolute filesystem path to the assets.
  }

  The dir for each machine is set by the admin.

  The records are indexed in the registry by machine name.

  Events:
    newmachine - somebody has registered a new machine.
      name - alphanumeric name of the machine
      dir - absolute path to assets directory

    lostmachine - an app has deregistered a machine.
      name - alphanumeric name of the machine.

  Methods:

    getAllMachines() - returns iterator for machine names
    getMachineDir(m) - returns path to assets directory, or null
    addMachine(m,d) -  add a new machine with indicated directory.
                       Returns true on success, else false.
    removeMachine(m) - Returns true on success, else false.
*/

const EventEmitter = require('events');

class Registry extends EventEmitter {
  constructor() {
    super();
    this._map = new Map();
  }
  getAllMachines() { return this._map.keys(); }
  getMachineDir(m) {
    return this._map.get(m);
  }
  addMachine(m, d) {
    if (m && d && ! this._map.has(m)) {
      this._map.set(m, d);
      this.emit('newmachine', m, d);
      return true;
    } else {
      console.log(`addMachine(${m}, ${d}) failed`);
      return false;
    }
  }
  removeMachine(m) {
    const result = this._map.delete(m);
    if (result) {
      this.emit('lostmachine', m);
    }
    return result;
  }
}

module.exports = new Registry();
