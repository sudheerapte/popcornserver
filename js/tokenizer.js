"use strict";

/**
   See tokenizer-design in ddoc.
*/

class Tokenizer {
  constructor() {
    this.specials = {
      DOT: '.', SLASH: '/', PLUS: '+', EQUAL: '=', HYPHEN: '-', OPENPAREN: '(',
      CLOSEPAREN: ')', ASTERISK: '*', AMPERSAND: '&', PERCENT: '%',
      DOLLAR: '$', HASH: '#', AT: '@', BANG: '!', TILDE: '~',
      COLON: ':', SEMICOLON: ';', COMMA: ',', OPENBRACKET: '[',
      CLOSEBRACKET: ']', CIRCUMFLEX: '^', OPENCURLY: '{',
      CLOSECURLY: '}', QUOTE: "'",
    };
    this.MACRO_OPEN_RE = /^{{/;
    this.MACRO_CLOSE_RE = /^}}/;
    this.KEYWORD_RE = /^[A-Z]+[A-Z0-9_]*/;
    this.WORD_RE = /^[a-z]+[a-z0-9-]*[a-z0-9]+/;
    this.WORD_SINGLE_RE = /^[a-z]/;
    this.NUMBER_RE = /^[+-]?[0-9]+/;
    this.VARIABLE_RE = /^{\s*[A-Z]+[A-Z0-9_]*\s*}/;

    const names = Object.getOwnPropertyNames(this.specials);
    this.specialsMap = new Map();
    for (let i=0; i<names.length; i++) {
      const name = names[i];
      const value = this.specials[name];
      this.specialsMap.set(value, name);
    }
    let buf = "^[";
    names.forEach( name => buf += "\\" + this.specials[name] );
    buf += "]";
    this.specialsRegex = new RegExp(buf);
    // console.log(`specialsRegex = ${this.specialsRegex}`);
  }

  /**
     tokenizeArray - take array of lines and return a TLA.

     As a convenience, if you pass an array of lines to tokenize()
     below, it will call this function.
   */
  tokenizeArray(arr) {
    if (Array.isArray(arr)) {
      if (arr.length === 0) { return []; }
      let outArr = [];
      let continuation = false; // did we see a terminating HYPHEN?
      for (let i=0; i<arr.length; i++) {
        const result = this.tokenize(arr[i]);
        if (result[0]) { // error
          return result;
        }
        const tokArray = result[1];
        let len = tokArray.length;
        let termHyphen = (len > 0 && tokArray[len-1].name === 'HYPHEN');
        if (termHyphen) {
          tokArray.pop();
          len--;
        }
        if (continuation) {
          for (let j=0; j<len; j++) {
            outArr[outArr.length-1].push(tokArray[j]);
          }
        } else {
          outArr.push(tokArray);
        }
        continuation = termHyphen;
      }
      if (continuation) {
        return ['ends with continuation -', arr];
      }
      return [null, outArr];
    } else {
      return ['not an array', arr];
    }
  }


  /**
     tokenize - create an array of tokens from an input string

     See the renderTokens function below; it can take an array of
     tokens and create a string that, when read back by tokenize(),
     forms the original array.
   */
  tokenize(str) {
    if (Array.isArray(str)) {
      return this.tokenizeArray(str);
    } else if (typeof str !== 'string') {
      return ['not a string', str];
    }
    let arr = [];
    let s = str;
    let num = 0;
    let more;
    do {
      more = false;
      let [n, tok] = this.consumeOneToken(s);
      if (n > 0) {
        num += n;
        s = s.slice(n);
      }
      if (tok) {
        // console.log(`      ${n} |${s.slice(n)}`);
        arr.push(tok);
        more = true;
      }
    } while (more);
    if (num >= str.length) {
      return [null, arr];
    } else {
      return [`bad token at index ${num}`, arr ];
    }
  }

  consumeOneToken(str) { // return [num, tok] or [num, null]
    // RULES - parsing rules for different types of tokens
    const RULES = [
      { re: this.MACRO_OPEN_RE,  type: 'MACRO_OPEN', useValue: false },
      { re: this.MACRO_CLOSE_RE, type: 'MACRO_CLOSE', useValue: false },
      { re: this.KEYWORD_RE,     type: 'KEYWORD',   useValue: true },
      { re: this.WORD_RE,        type: 'WORD',      useValue: true },
      { re: this.WORD_SINGLE_RE, type: 'WORD',      useValue: true },
      { re: this.NUMBER_RE,      type: 'NUMBER',    useValue: true },
      { re: this.VARIABLE_RE,    type: 'VARIABLE',  useValue: true },
      { re: this.specialsRegex,  type: 'SPECIAL',   useValue: false },
    ];

    let num = 0;
    const spaces = str.match(/^\s+/);
    if (spaces) {
      //console.log(`skipping ${spaces[0].length} spaces.`);
      num = spaces[0].length;
      str = str.slice(num);
    }
    if (str.length <= 0) { return [num, null]; }
    if (str[0] === '"') {
      // console.log(`consuming string...`);
      let [n, s] = this.consumeStringToken(str.slice(1));
      // console.log(`[ ${n}, ${s}]: |${str.slice(n+1)}`);
      if (n < 0) {
        return [-1, null];
      } else {
        num += n+2;
        return [num, {name: 'STRING', value: s}];
      }
    }
    for (let j=0; j<RULES.length; j++) {
      const rec = RULES[j];
      const m = str.match(rec.re);
      if (m) {
        // console.log(`matched ${rec.re}. length = ${m[0].length}`);
        num += m[0].length;
        let toktype = rec.type;
        if (rec.type === 'SPECIAL') {
          toktype = this.specialsMap.get(m[0]);
          return [num, {name: toktype, value: null}];
        } else if (rec.type === 'VARIABLE') {
          const varName = m[0].slice(1).match(this.KEYWORD_RE)[0];
          return [num, {name: 'VARIABLE', value: varName}];
        }
        
        return [num, {name: toktype, value: (rec.useValue ? m[0] : null)}];
      }
    }
    return [num, null];
  }

  /**
     consumeStringToken - we found a quote. Consume rest of string.

     Call with first char past the quote. Returns two things:
     - the number of chars before the next matching quote, and
     - the actual string.

     The above two might be different because any backslashed chars
     need to be preserved as a single char in the string value.
     
     If we find an un-terminated string, or one ending in a backslash,
     we return [-1, null].

   */
  consumeStringToken(str) {
    let num = 0;
    let s = "";
    for (let i=0; i<str.length; i++) {
      if (str[i] === '"') {
        return [ num, s ];
      } else if (str[i] === '\\') {
        if (i === str.length -1) {
          return [-1, null];
        } else {
          i++;
          s += str[i];
          num += 2;
        }
      } else {
        s += str[i];
        num++;
      }
    }
    return [-1, null];
  }

  renderTokens(arr) {
    if (! arr) { return ""; }

    const me = this;
    if (arr.hasOwnProperty('length')) {
      let str = '';
      let lastTok = 'NONE';
      arr.forEach( (tok,i) => {
        str += this.renderTok(tok, lastTok);
        lastTok = tok.name;
      });
      return str;
    } else {
      return this.renderTok(arr, 'NONE');
    }
  }

  renderTok(tok, lastTok) {
    if (tok) {
      if (tok.name === 'STRING') {
        return '"' + renderString(tok.value) + '"';
      } else if (tok.name === 'NUMBER') {
        if (lastTok && lastTok.match(/WORD|KEYWORD/)) {
          return " " + tok.value;
        } else {
          return tok.value;
        }
      } else if (tok.name === 'VARIABLE') {
        return "{" + tok.value + "}";
      } else if (tok.name === 'WORD') {
        if (lastTok && lastTok === 'WORD') {
          return " " + tok.value;
        } else {
          return tok.value;
        }
      } else if (tok.name === 'KEYWORD') {
        if (lastTok && lastTok === 'KEYWORD') {
          return " " + tok.value;
        } else {
          return tok.value;
        }
      } else if (this.specials[tok.name]) {
        return this.specials[tok.name];
      } else {
        return ` (${tok.name})`;
      }
    }

    function renderString(s) {
      let buf = "";
      for (let i=0; i<s.length; i++) {
        if (s[i] === '"') {
          buf += '\\"';
        } else if (s[i] === '\\') {
          buf += '\\\\';
        } else {
          buf += s[i];
        }
      }
      return buf;
    }
  }

  // equal(tok1, tok2) - used in tests
  equal(tok1, tok2) {
    if (tok1.hasOwnProperty('length')) {
      if (tok2.hasOwnProperty('length')) {
        if (tok1.length === tok2.length) {
          let diff = false;
          for(let i=0; i<tok1.length && !diff; i++) {
            if (! this.equal(tok1[i], tok2[i])) {
              diff = true;
            }
          }
          return ! diff;
        }
      }
      return false;
    }

    if (tok1 && tok2) {
      return tok1.name === tok2.name && tok1.value === tok2.value;
    } else {
      return false;
    }
  }

}

module.exports = Tokenizer;
