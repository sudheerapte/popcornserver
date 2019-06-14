"use strict";

class Lisp {
  constructor() {
    this.initialize();
  }
  read(string) {  // returns [errMsg, array of tokens]
    if (! string || string.trim().length === 0) {
      return [ null, null]; // no error, but no result
    }
    let arr = [];
    let consumed = 0;
    let more = true;
    let s = string;
    while (more) {
      const result = this.consumeOne(s);
      if (result.hasOwnProperty('name')) {
        if (result.name.match(/\(|\)/)) {
          arr.push(result);
          consumed = 1;
        } else if (result.name === 'SPACE') {
          consumed = result.value;
        } else if (result.name === 'SYMBOL') {
          arr.push(result);
          consumed = result.value.length;
        }
      } else {
        return [ result, arr];
      }
      s = s.slice(consumed);
      more = s.length > 0;
    }
    return [ null, arr];
  }

  consumeOne(string) {
    let m;
    m = string.match(/^\s+/);
    if (m) {
      return { name: 'SPACE', value: m[0].length };
    }
    m = string.match(/^\(/);
    if (m) {
      return { name: '(', value: null };
    }
    m = string.match(/^\)/);
    if (m) {
      return { name: ')', value: null };
    }
    m = string.match(/^[^()\s]+/);
    if (m) {
      return { name: 'SYMBOL', value: m[0] };
    }
    return `consumeOne: bad string: ${s}`;
  }

  renderToken(tok) {
    if (tok.hasOwnProperty('length')) {
      let s = "";
      tok.forEach( t => s += this.renderToken(t) );
      return s;
    }

    if (tok.name.match(/^\(|\)/)) {
      return tok.name;
    } else if (tok.name === 'SYMBOL') {
      return " " + tok.value;
    } else {
      console.log(`renderToken: bad token: ${JSON.stringify(tok)}`);
    }
  }

  readSingleCharToken(inputString) {
    if(inputString.match(this._specialCharRe)) {
      return 1;
    } else {
      return 0;
    }
  }

  readSpace(inputString) {
    const m = inputString.match(/^\s+/);
    if (m) {
      return m[0].length;
    } else {
      return 0;
    }
  }

  // readString returns [numConsumed, stringValue]
  readString(inputString) {
    let value = "";
    let backslashSeen = false;
    if (inputString.startsWith('"')) {
      for (let i=1; i<inputString.length; i++) {
        const ch = inputString[i];
        if (ch === '\\') {
          if (backslashSeen) {
            value += ch;
            backslashSeen = false;
            continue;
          } else {
            backslashSeen = true;
          }
          if (i === inputString.length-1) {
            return [-1, null];
          } else {
            continue;
          }
        } else {
          if (backslashSeen) {
            value += ch;
            backslashSeen = false;
            continue;
          }
          if (ch === '"') {
            return [ i, value];
          } else {
            value += ch;
          }
        }
      }
      return [-1, null];
    } else {
      return [0, null];
    }
  }

  readWord(inputString) {
    for (let i=0; i<inputString.length; i++) {
      const ch = inputString[i];
      if (ch.match(/\s/) || ch.match(this._specialCharRe)) {
        return i;
      }
    }
    return inputString.length;
  }

  // tokenize - return null or error message
  tokenize(inputString, tokArr) {
    let s = inputString;
    do {
      const result = this.readToken(s, tokArr);
      if (! result) {
        break;
      }
      if (result.hasOwnProperty("length")) {
        return result;
      } else {
        s = s.slice(result);
      }
    } while (true);
    return null;
  }

  // readToken - return length of inputString consumed
  readToken(inputString, tokArr) {
    let n, s;
    n = this.readSpace(inputString);
    if (n) {
      return n;
    }
    [n, s] = this.readString(inputString);
    if (n > 0) {
      tokArr.push({name: 'STRING', value: s});
      return n+1;
    } else if (n < 0) {
      return `bad string token: ${inputString.slice(5)}...`;
    }
    if (this.readSingleCharToken(inputString)) {
      tokArr.push({name: inputString[0], value: null});
      return 1;
    }
    n = this.readWord(inputString);
    if (n > 0) {
      tokArr.push({name: 'WORD', value: inputString.slice(0,n)});
      return n;
    } else if (n < 0) {
      return `bad word token: ${inputString.slice(5)}...`;
    }
  }

  initialize() {
    this._atoms = new Map();
    this._specialCharRe = /^[`'(),"\\]/;
    this._symbols = []; // { name, value }
  }

}



module.exports = new Lisp();
