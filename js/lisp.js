"use strict";

class Lisp {
  constructor() {
    this.initialize();
  }
  initialize() {
    this._symbols = new Map();
    this._specialCharRe = /^[`'(),"\\@$]/;
  }

  hasSym(sym) { return this._symbols.has(sym); }
  getSym(sym) { return this._symbols.get(sym); }
  setSym(sym, value) { this._symbols.set(sym, value); }

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
    if (inputString.startsWith('"')) {
      for (let i=1; i<inputString.length; i++) {
        const ch = inputString[i];
        if (ch === '\\') { // must not be final character
          if (i === inputString.length-1) { return [-1, null]; }
          value += inputString[++i];
          continue;
        }
        if (ch === '"') {
          return [ i+1, value];
        } else {
          value += ch;
        }
      }
      // if we reached here, then we never saw the closing quote
      return [-1, null];
    } else {
      // if we reached here, then we never saw the opening quote
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
      if (typeof result === 'string') { // error message
        return result;
      } else {
        s = s.slice(result);
      }
    } while (true);
    return null;
  }

  // readToken - return length of inputString consumed.
  // Push any token read on to tokArr.
  readToken(inputString, tokArr) {
    if (! inputString || inputString.length <= 0) { return 0; }
    let n, s;
    // We first eat any spaces
    n = this.readSpace(inputString);
    if (n) {
      return n; // no token created for spaces
    }
    // then we try STRING, which must start with a quote
    [n, s] = this.readString(inputString);
    if (n > 0) {
      tokArr.push({name: 'STRING', value: s});
      return n;
    } else if (n < 0) {
      return `bad string token: ${inputString.slice(0,5)}...`;
    }
    // then we try single-char tokens
    if (this.readSingleCharToken(inputString)) {
      tokArr.push({name: inputString[0], value: null});
      return 1;
    }
    // finally, we try WORD
    n = this.readWord(inputString);
    if (n > 0) {
      tokArr.push({name: 'WORD', value: inputString.slice(0,n)});
      return n;
    } else if (n < 0) {
      return `bad word token: ${inputString.slice(5)}...`;
    }
  }

  renderToken(tok) {
    if (! tok.hasOwnProperty('name')) { // assume tok is an array
      let s = "";
      tok.forEach( t => s += this.renderToken(t) );
      return s;
    } else { // tok is a single token of the form {name, value}
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
    // can never happen
    return `growSexp: bad token: ${tok.name}`;
  }

  // buildSexp - we have seen '('. Consume contents of new sexp.
  // return number of consumed tokens including closing ')'
  // If we never get a closing paren, return negative number.
  buildSexp(tokArr, outArr) {
    if (! tokArr || tokArr.length <= 0) {
      return 0;
    }
    let consumed = 0;
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

  tokenizeSexp(sexp, tokArr) {
    if (Array.isArray(sexp)) {
      tokArr.push({name: '(', value: null});
      for (let i=0; i<sexp.length; i++) {
        const result = this.tokenizeSexp(sexp[i], tokArr);
        if (result !== null) {
          return result;
        }
      }
      tokArr.push({name: ')', value: null});
      return null;
    } else {
      return this.tokenize(sexp, tokArr);
    }
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
