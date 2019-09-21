"use strict";

class Runtime {
  constructor(logFunc) {
    this._singletonMap = new Map();
    this._queue = [];
    this.log = logFunc ? logFunc : console.log;
  }
  setSingleton(name, singleton) {
    this._singletonMap.set(name, singleton);
  }
  getSingleton(name) {
    return this._singletonMap.get(name);
  }

  enqueue(item) {
    this._queue.push(item);
    setImmediate(() => this.doOne());
  }
  doOne() {
    if (this._queue.length > 0) {
      const item = this._queue.unshift();
      item.execute();
    }
  }
  getNumItems() {
    return this._queue.length;
  }
}

module.exports = Runtime;
