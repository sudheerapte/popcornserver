"use strict";

/**
   Tokens are either one of these six types:

            BEGIN END COMMAND WORD STRING

   or one-character types for each of the special characters below.
     
   They are represented as objects: {name: 'COMMAND', value: 'CURRENT'}

   The STRING token is treated specially. If the input string
   contains any character not recognized as a token, then the entire
   input string from that character on is put into a STRING token.
   
   WORD is a popcorn machine path segment, [a-z][a-z0-9-]*.
   COMMAND is any all-capitals word. Their value fields have the
   actual string value.

   Spaces are always ignored and can be used to separate adjacent
   tokens that might otherwise be merged (really, only WORD WORD or
   COMMAND COMMAND).

   BEGIN and END are {{ and }} respectively. (You can escape them
   with a backslash if you want to hide them).

   DOT and SLASH are the single-character path components.
*/

class Tokenizer {
  constructor() {
    this.specials = {
      DOT: '.', SLASH: '/', PLUS: '+', EQUAL: '=', OPENPAREN: '(',
      CLOSEPAREN: ')', ASTERISK: '*', AMPERSAND: '&', PERCENT: '%',
      DOLLAR: '$', HASH: '#', AT: '@', BANG: '!', TILDE: '~',
      COLON: ':', SEMICOLON: ';', COMMA: ',', OPENBRACKET: '[',
      CLOSEBRACKET: ']', CIRCUMFLEX: '^', OPENCURLY: '{',
      CLOSECURLY: '}'
    };
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
     scanString - scan the string to find BEGIN/END escapes.
  
     This function does not tokenize the input. It can be used to
     peer inside arbitrary strings to find {{ and }}.

     return [-1 -1] if no BEGIN or END.
     return [B, E] where E = first END and B = last BEGIN before it.
     return [-1, E] if END was found before BEGIN
     return [B, -1] if BEGIN was found but no END was found.
  */
  scanString(str) {
    // const BEGIN=/(?<!\\){{/; const END=/(?<!\\)}}/;
    // const EITHER=/(?<!\\){{|(?<!\\)}}/g;
    // TODO lookbehind matches are not supported in Firefox
    // TODO https://bugzilla.mozilla.org/show_bug.cgi?id=1225665
    const BEGIN=/{{/; const END=/}}/;
    const EITHER=/{{|}}/g;
    if (!str) { return [-1, -1]; }
    const m = str.match(EITHER);
    if (!m) { return [-1, -1]; }
    // console.log(`|${str}| ${JSON.stringify(m)}`);
    let foundEnd = -1;
    let foundBegin = -1;
    let offset = 0; // starting point of remainingStr
    for (let i=0; i<m.length; i++) {
      if (m[i].match(BEGIN)) {
        const remainingStr = str.slice(offset);
        const index = remainingStr.search(BEGIN);
        if (index < 0) {
          throw(new Error(`internal error! impossible`));
        }
        foundBegin = index+offset;
        offset = foundBegin+2;
      } else {
        const remainingStr = str.slice(offset);
        const index = remainingStr.search(END);
        if (index < 0) {
          throw(new Error(`internal error! impossible`));
        }
        foundEnd = index+offset;
        offset = foundEnd+2;
        break;
      }
    }
    if (foundBegin < 0) {
      return [-1, foundEnd];
    }
    if (foundEnd < 0) {
      return [foundBegin, -1];
    }
    return [ foundBegin, foundEnd ];
  }

  /**
     process - process the given string, expanding macros inside-first.
     Returns [errMsg, newString].

     The function "f" should take an array of tokens and produce
     another array of tokens. The output of "f" should be [errMsg, tokList],
     where "errMsg" is null if no errors.

  */
  process(input, f) {
    let tResult = [ null, input];
    let more = true;
    let loopsDone = 10; // catch infinite recursion
    while (more) {
      const str = tResult[1];
      tResult = this.processOnce(str, f);
      if (tResult[0]) {
        return [ tResult[0], str ];
      }
      more = tResult[2];
      if (--loopsDone < 0) { break; }
    }
    if (more) {
      return ["too many recursive expansions", tResult[1]];
    } else {
      return [null, tResult[1]];
    }
  }

  /**
     processOnce - process the tokens in the string, respecting BEGIN/END

     Given "blah {{foo bar}} blah", we compute "blah xyz blah",
     where "xyz" is the evaluation of "foo bar".

     Return an array [errorString, outString].
     If there is any error, then outString will be null.

     If there is no error, then call the function 'f' with the token
     array parsed from the portion between the BEGIN-END pair. The
     function 'f' should return [ errString, tokenlist ]. If it works,
     then the token output will be substituted in the original string
     to form the outString.

     If no function 'f' is passed in, then the outString will
     contain the tokens printed into string form.

     We do not evaluate outString for more nested pairs of BEGIN-END.

     If the outString might have more expressions to be evaluated, then
     we return a third array element as "true".

  */
  processOnce(str, f) {
    let result;
    if (! str || str.length <= 0) { return [null, str]; }
    let [ b, e ] = this.scanString(str);
    //console.log(`        processOnce |${str}| b=${b} e=${e}`);
    if (b < 0) {  // Simple case -- return original string
      return [null, str];
    }
    if (e < 0) { return ["No END found", null]; }
    result = this.tokenize(str.slice(b+2, e));
    if (result[0]) {
      return [ result[0], null ];
    }
    if (f) {
      const pResult = f(result[1]);
      if (pResult[0]) {
        return [ pResult[0], result[1] ];
      } else {
        return [ null, 
                 str.slice(0,b) +
                 this.renderTokens(pResult[1]) +
                 str.slice(e+2,str.length),
                 true
               ];
      }
    } else {
        return [ null, 
                 str.slice(0,b) +
                 this.renderTokens(result[1]) +
                 str.slice(e+2,str.length),
                 true
               ];
    }
  }

  /**
     tokenize - create an array of tokens from an input string

     See the renderTokens function below; it can take an array of
     tokens and create a string that, when read back by tokenize(),
     forms the original array.
   */
  tokenize(str) {
    // RULES - parsing rules for different types of tokens
    const RULES = [
      { re: /^{{/,   type: 'BEGIN',   makeToken: true, useValue: false },
      { re: /^}}/,   type: 'END',     makeToken: true, useValue: false },
      { re: /^\s+/,  type: 'SPACES',  makeToken: false, useValue: false },
      { re: /^[A-Z]+/, type: 'COMMAND', makeToken: true, useValue: true },
      { re: /^[a-z]+[a-z0-9-]*/,type: 'WORD',makeToken: true,useValue: true },
      { re: this.specialsRegex, type: 'SPECIAL', makeToken: true, useValue: false },
      { re: /^\./,   type: 'DOT',     makeToken: true, useValue: false },
      { re: /^\//,   type: 'SLASH',     makeToken: true, useValue: false },
    ];
    let arr = [];
    if (str === null || typeof str === 'undefined') {
      return [ "string is null", arr ];
    }
    if (str.length === 0) {
      return [ null, {name: 'STRING', value: ''} ];
    }
    if (str.match(/^"/)) {
      return [null, {name: 'STRING', value: str.slice(1)}];
    }
    let ch;
    for (let i=0; i<str.length; i++) {
      const s = str.slice(i);
      let m;
      let found = false;
      for (let j=0; j<RULES.length; j++) {
        const rec = RULES[j];
        m = s.match(rec.re);
        if (m) {
          // console.log(`i = ${i}: matched ${rec.re}`);
          found = true;
          i += m[0].length - 1;
          if (rec.makeToken) {
            let toktype = rec.type;
            if (rec.type === 'SPECIAL') {
              toktype = this.specialsMap.get(m[0]);
            }
            arr.push({name: toktype, value: (rec.useValue ? m[0] : null)});
          }
          break;
        }
      }
      if (! found) {
        arr.push({name: 'STRING', value: s});
        i += s.length;
      }
    }
    return [ null, arr];
  }

  renderTokens(arr) {
    if (! arr) { return ""; }

    const me = this;
    if (arr.hasOwnProperty('length')) {
      let str = '';
      arr.forEach( (tok,i) => {
        str += renderTok(tok);
      });
      return str;
    } else {
      return renderTok(arr);
    }

    function renderTok(tok) {
      if (tok) {
        if (tok.name.match(/STRING|WORD|COMMAND|NUMBER/)) {
          return tok.value;
        } else if (me.specials[tok.name]) {
          return me.specials[tok.name];
        } else {
          return ` (${tok.name})`;
        }
      }
    }
  }

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

    return tok1.name === tok2.name && tok1.value === tok2.value;
  }
}

module.exports = new Tokenizer;
