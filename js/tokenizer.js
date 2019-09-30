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
    this.WORD_RE = /^[a-z]+[a-z0-9-]*/;
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
     expand - process the given string, expanding macros inside-first.
     Returns [errMsg, newString].

     The function "f" should take an array of tokens and produce
     another array of tokens. The output of "f" should be [errMsg, tokList],
     where "errMsg" is null if no errors.

  */
  expand(input, f) {
    let tResult = [ null, input];
    let more = true;
    let loopsDone = 10; // catch infinite recursion
    while (more) {
      const str = tResult[1];
      tResult = this.expandOnce(str, f);
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
     expandOnce - expand the first macro enclosed by BEGIN/END

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
  expandOnce(str, f) {
    let result;
    if (! str || str.length <= 0) { return [null, str]; }
    let [ b, e ] = this.scanString(str);
    //console.log(`        expandOnce |${str}| b=${b} e=${e}`);
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
    if (Array.isArray(str)) {
      if (str.length === 0) { return []; }
      let errMsg = "";
      const tla = str.map( line => {
        if (typeof line !== 'string') {
          errMsg += "\nnot a string";
          return [];
        }
        const pair = this.tokenize(line);
        if (pair[0]) {
          errMsg += `\n${pair[0]}`;
          return [];
        } else {
          return pair[1];
        }
      });
      if (errMsg.length <= 0) { errMsg = null;}
      return [errMsg, tla];
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
