"use strict";

/**
   Four actions:

   addLeaf P sep C
   deleteLastLeaf P
   setCurrent P C
   setData P D

   Each action accumulates an undo record (or not).

   Queries:

   exists P      => true/false
   isParent P    => true/false
   isAltParent P => true/false
   isConParent P => true/false
   isLeaf P      => true/false
   isAltChild P  => true/false
   isConChild P  => true/false
   getParent P   => P
   getCurrent P  => C
   getChildren P => <list of C>
   getNonCurrent P => <list of C>
   isCurrent P C => true/false
   getData P     => <string>

   isEqual(machine) = true or false
*/

class Machine {
  constructor() {
    this._root = {name: "", parent: "", cc: []};
    this._paths = new Map();
    this._paths.set("", this._root);
    this.WORDPAT = /^[a-z][a-z0-9-]*$/;
    this.PATHPAT = /^\.[a-z][a-z0-9-/.]*$/;
  }
  getState(p) { return this._paths.get(p); }
  exists(p) { return this._paths.has(p);  }
  isLeaf(p) {
    if (! this.exists(p)) { return false; }
    return ! this.getState(p).hasOwnProperty("cc");
  }
  isParent(p) {
    if (! this.exists(p)) { return false; }
    return this.getState(p).hasOwnProperty("cc");
  }
  isAltParent(p) {
    if (! this.exists(p)) { return false; }
    const state = this.getState(p);
    return state.hasOwnProperty("cc") && state.hasOwnProperty("curr");
  }
  isConParent(p) {
    if (! this.exists(p)) { return false; }
    const state = this.getState(p);
    return state.hasOwnProperty("cc") && ! state.hasOwnProperty("curr");
  }
  isCurrent(p, c) {
    if (! this.isAltParent(p)) { return false; }
    const node = this.getState(p);
    return c === node.cc[node.curr];
  }
  // The getXXX() functions return an array of two elements.
  // The first element is null iff no errors.
  getParent(p) {
    if (! this.exists(p)) {
      return [`no such path: ${p}`, null];
    }
    const dotPos = p.lastIndexOf(".");
    const slashPos = p.lastIndexOf("/");
    if (dotPos < 0 && slashPos < 0) {
      return [`has no parent: ${p}`, null];
    }
    let pos = dotPos;
    if (pos < slashPos) { pos = slashPos; }
    const ppath = p.slice(0, pos);
    if (! this.exists(ppath)) {
      return [`no such parent: ${ppath}`, null];
    }
    return [null, ppath];
  }
  getCurrent(p) {
    if (! isAltParent(p)) { return [`not an alt parent: ${p}`, null]; }
    const node = this.getState(p);
    return [null, node.cc[node.curr] ];
  }
  getChildren(p) {
    if (! isParent(p)) { return [`not a parent: ${p}`, null]; }
    const node = this.getState(p);
    return [null, node.cc];
  }
  getNonCurrent(p) {
    if (! this.isAltParent(p)) { return [`not an alt parent: ${p}`, null]; }
    const node = this.getState(p);
    let nc = [];
    for (let i=0; i<node.cc.length; i++) {
      if (i !== node.curr) { nc.push(node.cc[i]); }
    }
    return [null, nc ];
  }
  getData(p) {
    if (! this.isLeaf(p)) { return [`not a leaf: ${p}`, null]; }
    let value = "";
    let node = this.getState(p);
    if (node.hasOwnProperty("data")) { value = node.data; }
    return [null, value];
  }

  isAltChild(c) {
    if (! this.exists(c)) { return false; }
    const child = this.getState(c);
    return c.parent.hasOwnProperty("curr");
  }
  isConChild(c) {
    if (! this.exists(c)) { return false; }
    const child = this.getState(c);
    return ! c.parent.hasOwnProperty("curr");
  }
  isCurrent(p) {
    if (! this.exists(p)) { return false; }
    if (p.length() === 0) { // root state is always current
      return true;
    }
    if (this.isConChild(p)) { // concurrent child is always current
      return ;//// TODO
    }
    const child = this.getState(c);
    return c.parent.hasOwnProperty("curr");
  }
  
  addLeaf(p, sep, c, undos) {
    if (! this._paths.has(p)) {
      return `no such path: ${p}`;
    }
    if (! c || ! c.match(this.WORDPAT)) {
      return `bad child: |${c}|`;
    }
    if (! sep || ! sep.match(/^[/.]$/)) {
      return `bad separator: |${sep}|`;
    }
    const path = p + sep + c;
    if (this._paths.has(path)) {
      return `path exists: ${path}`;
    }
    const parent = this._paths.get(p);
    const newState = {name: c, parent: parent};
    if (parent.hasOwnProperty("data")) {
      return `parent has data: ${p}`;
    }
    if (! parent.hasOwnProperty("cc")) {
      parent.cc = [];
      if (sep === '/') {
        parent.curr = 0;
      }
    }
    if (sep === '.' && parent.hasOwnProperty("curr")) {
      return `not a con parent: ${p}`;
    } else if (sep === '/' && ! parent.hasOwnProperty("curr")) {
      return `not an alt parent: ${p}`;
    }
    parent.cc.push(c);
    this._paths.set(path, newState);
    undos.unshift(`deleteLastLeaf ${p}`);
    return null;
  }
  deleteLastLeaf(p, undos) {
    if (! this.isParent(p)) {
      return `no such parent: |${p}|`;
    }
    const node = this.getState(p);
    const lastChild = node.cc[node.cc.length-1];
    const sep = node.hasOwnProperty("curr") ? "/" : ".";
    const childPath = p + sep + lastChild;
    if (! this.isLeaf(childPath)) {
      return `child is not leaf: ${childPath}`;
    }
    this._paths.delete(childPath);
    node.cc.pop();
    undos.unshift(`addLeaf ${p} ${sep} ${lastChild}`);
    if (node.hasOwnProperty("curr") && node.curr >= node.cc.length) {
      node.curr --;
      undos.unshift(`setCurrent ${p} ${lastChild}`);
    }
    // if no children left, convert parent to a leaf
    if (node.cc.length <= 0) {
      delete node.cc;
      delete node.curr;
    }
    return null;
  }

  setCurrent(p, c) {
    if (! this.isAltParent(p)) { return `not an alt parent: ${p}`; }
    if (! c.match(this.WORDPAT)) {
      return `bad child format: ${c}`;
    }
    const node = this.getState(p);
    const newCurr = p.cc.indexOf(c);
    if (newCurr < 0) { return `not a child state: ${c}`; }
    if (newCurr === node.curr) { return null; } // already done
    const oldCurr = node.curr;
    node.curr = newCurr;
    undos.unshift(`setCurrent ${p} ${oldCurr}`);
    return null;
  }
  setData(p, d) {
    if (! this.isLeaf(p)) { return `not a leaf: ${p}`; }
    if (typeof d !== 'string') { return `not a string: ${d}`; }
    const node = this.getState(p);
    if (node.hasOwnProperty("data"))

    if (d.length > 0) {
      node.data = d;
    }
    return null;
  }

  // --------------------- queries: getAllPaths, getCurrentPaths
  getAllPaths() {
    let result = [];
    this._paths.forEach( (s,p) => result.push(p) );
    return result;
  }
  getCurrentPaths() {
    let result = [];
    const me = this;
    this._paths.forEach( (s,p) => {
      if (s.parent.hasOwnProperty("curr")) {
        if (s.name === s.parent.cc[s.parent.curr]) {
          result.push(p);
        }
      } else {
        result.push(p);
      }
    });
    return result;
  }

  isEqual(machine) {
    this._paths.forEach( (s,p) => {
      if (! machine.exists(p)) {
        return false;
      }
    });
    machine._paths.forEach( (s,p) => {
      if (! this.exists(p)) {
        return false;
      }
    });
    return true;
  }

  clone() {
    const copy = new Machine();
    // First, make copies of all our states, then fix parent pointers.
    this._paths.forEach( (s, p) => {
      let newState = {};
      Object.assign(newState, s);
      copy._paths.set(p, newState);
    });
    this._paths.forEach( (s, p) => {
      let parent = copy._paths.get(this.getParent(p));
      (copy._paths.get(p)).parent = parent;
    });
    return copy;
  }

  // --------------------- doCommand -----------------
  doCommand(str, undos) {
    if (! str || str.length <= 0) { return `interpret: empty string`; }
    str = str.trim();
    let args;
    args = getArgs(str, "addLeaf");
    if (args) {
      let m2 = args.match(/^(\S+)\s+([/.])\s+(\S+)$/);
      if (m2) {
        return this.addLeaf(m2[1], m2[2], m2[3], undos);
      }
      let m1 = args.match(/^([/.])\s+(\S+)$/);
      if (m1) {
        return this.addLeaf("", m1[1], m1[2], undos);
      }
      return `addLeaf needs three args`;
    }
    args = getArgs(str, "deleteLastLeaf");
    if (args !== null) {
      if (args === '') {
        return this.deleteLastLeaf("", undos);
      }
      let m2 = args.match(this.PATHPAT);
      if (m2) {
        return this.deleteLastLeaf(args, undos);
      } else {
        return `deleteLastLeaf: not a path: ${args}`;
      }
    }
    return `bad command: ${str}`;

    // getArgs() - match the given command followed by args.
    function getArgs(str, command) {
      const pat = new RegExp(`^${command}\\s+(.+)$`);
      // console.log(`pat = ${pat}`);
      let m = str.match(pat);
      if (m) {
        return m[1];
      } else {
        const noargspat = new RegExp(`^${command}$`);
        // console.log(`noargspat = |${noargspat}|`);
        if (str.match(noargspat)) {
          return "";
        } else {
          return null;
        }
      }
    }

  }

}

module.exports = Machine;
