"use strict";

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
    if (! this.isAltParent(p)) { return [`not an alt parent: ${p}`, null]; }
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

  // ------------- data encoding
  // All data is held as binary, at most 512 bits (64 bytes).
  // For convenience, it can be stored and extracted in these ways:
  // B = Binary: String (Javascript 16-bit Unicode)
  // W = Word: String of space separated words [a-z][a-z0-9-]*
  // N = Number: String of space-separated numbers [+-]?[0-9]+

  getDataWords(p) {
    return this.getData(p);
  }

  getDataNumbers(p) {
    return this.getData(p);
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
    if (! undos) { undos = []; }
    if (! this._paths.has(p)) {
      return `no such path: ${p}`;
    }
    if (! c || ! c.match(this.WORDPAT)) {
      return `bad word format: |${c}|`;
    }
    if (! sep || ! sep.match(/^[/.]$/)) {
      return `bad separator: |${sep}|`;
    }
    const path = p + sep + c;
    if (this._paths.has(path)) {
      return `child exists: ${path}`;
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
    if (! undos) { undos = []; }
    if (! this.isParent(p)) {
      return `no such parent: |${p}|`;
    }
    const node = this.getState(p);
    const lastChild = node.cc[node.cc.length-1];
    const sep = node.hasOwnProperty("curr") ? "/" : ".";
    const childPath = p + sep + lastChild;
    if (! this.isLeaf(childPath)) {
      return `last child is not a leaf: ${childPath}`;
    }
    if (node.hasOwnProperty("curr") && node.curr >= node.cc.length-1) {
      node.curr --;
      undos.unshift(`setCurrent ${p} ${lastChild}`);
    }
    const childState = this._paths.get(childPath);
    let childData = childState.data;
    if (childData && childData.length > 0) {
      undos.unshift(`setData ${childPath} ${childData}`);
    }
    this._paths.delete(childPath);
    node.cc.pop();
    undos.unshift(`addLeaf ${p} ${sep} ${lastChild}`);
    // if no children left, convert parent to a leaf
    if (node.cc.length <= 0) {
      delete node.cc;
      delete node.curr;
    }
    return null;
  }

  setCurrent(p, c, undos) {
    if (! undos) { undos = []; }
    if (! this.isAltParent(p)) { return `not an alt parent: ${p}`; }
    if (! c.match(this.WORDPAT)) {
      return `bad word format: ${c}`;
    }
    const node = this.getState(p);
    const newCurr = node.cc.indexOf(c);
    if (newCurr < 0) { return `no such child: ${c}`; }
    const oldCurr = node.curr;
    if (newCurr === oldCurr) { return null; } // already done
    node.curr = newCurr;
    undos.unshift(`setCurrent ${p} ${oldCurr}`);
    return null;
  }
  setData(p, d, undos) {
    if (! undos) { undos = []; }
    if (! this.isLeaf(p)) { return `not a leaf: ${p}`; }
    if (typeof d !== 'string') { return `not a string: ${d}`; }
    const node = this.getState(p);
    if (node.hasOwnProperty("data") && node.data.length > 0) {
      if (node.data === d) {
        return null;
      } else {
        undos.unshift(`setData ${p} ${node.data}`);
        node.data = d;
      }
    } else {
      node.data = d;
      undos.unshift(`setData ${p}`);
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

    // addLeaf
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

    // deleteLastLeaf
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

    // setData
    args = getArgs(str, "setData");
    let spacePos;
    if (args && args.length !== 0) {
      spacePos = args.indexOf(' ');
      if (spacePos < 0) {
        if (! args.match(this.PATHPAT)) {
          return `setData: bad path: |${args}|`;
        }
        return this.setData(args, "", undos);
      }
      const p = args.slice(0, spacePos);
      const data = args.slice(spacePos+1);
      return this.setData(p, data, undos);
    }

    // setCurrent
    args = getArgs(str, "setCurrent");
    if (args && args.length !== 0) {
      spacePos = args.indexOf(' ');
      if (spacePos < 0) {
        return `setCurrent needs two args`;
      }
      const argArray = args.split(/\s+/);
      const p = argArray[0];
      if (! p.match(this.PATHPAT)) {
        return `bad path: ${p}`;
      }
      const word = argArray[1];
      if (! word.match(this.WORDPAT)) {
        return `bad current: ${p}`;
      }
      return this.setCurrent(p, word, undos);
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
