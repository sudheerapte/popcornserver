"use strict";

class Lisp {
  constructor() {
    this.initialize();
  }
  hasSym(sym) { return this._symbols.has(sym); }
  getSym(sym) { return this._symbols.get(sym); }
  setSym(sym, value) { this._symbols.set(sym, value); }

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
    if (! tok.hasOwnProperty('name')) {
      let s = "(";
      tok.forEach( t => s += this.renderToken(t) );
      return s + ")";
    } else {
      if (tok.name.match(this._specialCharRe)) {
        return tok.name;
      } else if (tok.name === 'WORD') {
        return " " + tok.value;
      } else if (tok.name === 'STRING') {
        return ' "' + this.stringEscape(tok.value) + '"';
      } else {
        console.log(`renderToken: bad token: ${JSON.stringify(tok)}`);
      }
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
      if (result.hasOwnProperty("length")) { // error message
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
    this._symbols = new Map();
    this._specialCharRe = /^[`'(),"\\@$]/;
  }


  // appendSexp - add elements till ')'; return number of tokens consumed
  appendSexp(tokArr, outArr) {
    if (! tokArr || tokArr.length < 1) { return 0; }
    let i = 0;
    while (tokArr.length > 0 && tokArr[0].name !== ')') {
      i++;
      const num = this.makeAtomicSexp(tokArr, outArr);
      if (num === 0) {
        return `appendSexp: tokens ended`;
      }
      tokArr = tokArr.slice(num);
    }
    

    if (tokArr[0].name === '(') {
      let subArr = [];
      const num = this.makeAtomicSexp(tokArr.slice(1), subArr);
      
    } else {
      
      for (let i=1; i<tokArr.length; i++) {
        const name = tokArr[i].name;
        if (name === ')') {
          outArr.push(this.makeListSexp(tokArr.slice(1,i)));
          return i+1;
        } else {
          outArr.push(this.makeAtomicSexp(tokArr[i]));
          return 1;
        }
      }
    }
  }

  // growSexp - grow by 1 element.
  // return number of tokens consumed, or -1 if we encountered ')'
  // if we encountered a non-terminating sub-sexp, then return 0.
  growSexp(tokArr, outArr) {
    if (! tokArr || tokArr.length <= 0) {
      return 0;
    }
    const tok = tokArr[0];
    if (tok.name === 'WORD') {
      outArr.push(tok.value);
      return 1;
    }
    if (tok.name === 'STRING') {
      tokArr.push( ' "' + this.stringEscape(tok.value) + '"' );
      return 1;
    }
    if (tok.name === '(') {
      const subArr = [];
      const num = this.buildSexp(tokArr.slice(1), subArr);
      if (num < 0) {
        return 0;
      } else {
        outArr.push(subArr);
        return 1+num;
      }
    }
    if (tok.name === ')') {
      return -1;
    }
    return `makeAtomicSexp: bad token: ${tok.name}`;
  }

  // buildSexp - consume contents of new sexp.
  // return number of consumed tokens including closing ')'
  // If we never get a closing paren, return negative number.
  buildSexp(tokArr, outArr) {
    let consumed = 0; // how many tokens consumed
    for (let i=0; i<tokArr.length; i++) {
      const num = this.growSexp(tokArr.slice(i), outArr);
      if (num > 0) {
        consumed += num;
        i+= (num-1);
      } else if (num < 0) { // encountered close paren
        return consumed+1;
      } else {    // non-terminating sub-expr
        return -1;
      }
    }
    return -1;
  }

  stringEscape(str) {
    let out = "";
    for (let i=0; i<str.length; i++) {
      const ch = str[i];
      if (ch !== '"' && ch !== '\\') {
        out += ch;
      } else {
        out += '\\' + ch;
      }
    }
    return out;
  }
}

module.exports = new Lisp();
