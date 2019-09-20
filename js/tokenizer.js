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
     substVars - take a token array and expand any {VAR}s

     Returns [num, outArray], where:
        - num is the number of variables expanded successfully.
        - outArray is the result of the substitution.

     The function f() should take the "VAR" portion and return
     a token or array of tokens.
     If it does not have an expansion, it should return
     null. The expandVars function will keep the {VAR} string
     intact in the result, and not count that variable as
     successfully expanded.

     The caller might want to call this function again if there
     is a possibility that the expansion might contain more {VAR}
     occurrences, i.e., if num > 0.
   */

  substVars(inputArray, f) {
    let num = 0; // number of variables successfully looked up
    let outArray = [];
    for (let inPos = 0; inPos < inputArray.length; inPos++) {
      const tok = inputArray[inPos];
      if (tok.name === 'VARIABLE') {
        const lookup = f(tok.value);
        if (lookup) {
          num++;
          if (Array.isArray(lookup)) {
            lookup.forEach( t => outArray.push(t) );
          } else {
            outArray.push(lookup);
          }
        } else {
          outArray.push(tok);
        }
      } else {
        outArray.push(tok);
      }
    }
    return [num, outArray];
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
      { re: /^{{/,   type: 'BEGIN', useValue: false },
      { re: /^}}/,   type: 'END', useValue: false },
      { re: /^[A-Z]+[A-Z0-9_]*/, type: 'COMMAND', useValue: true },
      { re: /^[a-z]+[a-z0-9-]*/,type: 'WORD', useValue: true },
      { re: /^[+-]?[0-9]+/, type: 'WORD', useValue: true },
      { re: /^{\s*[A-Z]+[A-Z0-9_]*\s*}/, type: 'VARIABLE', useValue: true },
      { re: this.specialsRegex, type: 'SPECIAL', useValue: false },
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
          const varName = m[0].match(/[A-Z]+[A-Z0-9_]*/)[0];
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
        if (lastTok && lastTok.match(/WORD|COMMAND/)) {
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
      } else if (tok.name === 'COMMAND') {
        if (lastTok && lastTok === 'COMMAND') {
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

  /**
     splitSections() - take a script and return sections based on
     percent signs or [square brackets] like a Microsoft INI file.

     Based on this input, showing one example of each type:

       % SECTIONONE
       ...lines...
       ...lines...
       [ SECTIONTWO ]
       ...lines...
       ...lines...

     Return this output:
     [
         {section: "SECTIONONE", lines: [...] },
         {section: "SECTIONTWO", lines: [...] },
     ]
     
     Section name must be single contiguous string of non-whitespace.

     If the first line is not a section line, then we return null.
     If the last line looks like a section, then we return an error message.
  */
  splitSections(lines) {
    let arr = [];
    let i=0;
    for (; i<lines.length; i++) {
      if (lines[i].trim().length <= 0) { continue; }
      const result = matchSection(lines[i]);
      if (result) {
        let section = {section: result, lines: [] };
        if (i=== lines.length-1) {
          return `splitSections: last line has %`;
        }
        const sectionLines = accumulateSection(section, lines.slice(i+1));
        arr.push(section);
        i+= sectionLines;
      } else {
        return null;
      }
    }
    return arr;

    function matchSection(line) { // return null or section name
      let m;
      m = line.trim().match(/^\%\s*(\S+)$/);
      if (!m) {
        m = line.trim().match(/^\[\s*(\S+)\s*\]$/);
      }
      if (m) {
        return m[1];
      } else {
        return null;
      }
    }

    function accumulateSection(section, lines) {
      let j=0;
      for (; j<lines.length && ! matchSection(lines[j]); j++) {
        section.lines.push(lines[j]);
      }
      return j;
    }
  }

  // --------- utilities for parsing command arguments ---------------

  ifNextCommand(tokList, index, cmd) {
    if (tokList.length < index+1) { return false; }
    if (tokList[index].name !== 'COMMAND') { return false; }
    return cmd === tokList[index].value;
  }
  ifNext2Commands(tokList, index, cmd1, cmd2) {
    if (tokList.length < index+2) { return false; }
    return this.ifNextCommand(tokList, index, cmd1) &&
      this.ifNextCommand(tokList, index+1, cmd2);
  }
  getNextArg(tokList, index, argname, options) {
    if (options[argname].match(tokList[index].name)) {
      return tokList[index];
    } else if (options[argname] === 'PATH') {
      return null;
    }
  }
  findNextCommand(tokList, index, commandNames) {
    if (tokList.length < index) { return null; }
    if (tokList[index].name !== 'COMMAND') {
      return null;
    }
    for (let j=0; j<commandNames.length; j++) {
      if (tokList[index].value === commandNames[j]) {
        return commandNames[j];
      }
    }
    return null;
  }
  ifNextPair(tokList, index, cmd, tok) {
    if (ifNextCommand(tokList, index, cmd)) {
      if (tokList.length < index+2) { return false; }
      return this.equal(tokList[index+2], tok);
    } else {
      return false;
    }
  }

  /**
     parseRequiredTokens() - return [ null, args] on success

     The returned object "args" contains attributes whose names are
     the COMMANDS in the token list, and values are the subsequent
     next token.

     For example, if you define "options" like this:

         { ID: "WORD", NAME: "WORD", VALUE: "STRING or WORD" }

     And you tokenize the following string:

         ID foo NAME bar VALUE "some string baz"

     Then the token list can be parsed with with the above options.
     We return an "args" object like this:

     {
       ID: {name: WORD, value: "foo"},
       NAME: {name: WORD, value: "bar"},
       VALUE: {name: STRING, value: '"some string baz"'},
     }
     
     Moreover, every key in the "options" object must be
     represented once in the token list, otherwise we get an error.

     ==============   ====================================  =============
     option value     meaning                               value
     ==============   ====================================  =============
     WORD             a single word, [a-z][a-z0-9-]*        string
     COMMAND          a single COMMAND, [A-Z]+              string
     WORDS            a series of words                     array of str.
     PATH             a path, DOT WORD DOT/SLASH WORD ...   string
     COMMAND or WORD  either a COMMAND or a word            string
     ==============   ====================================  =============

   */

  parseRequiredTokens(tokList, options) {
    if (! tokList || tokList.length <= 0) {
      return ['empty token list', null];
    }
    let args = {};
    const keys = Object.keys(options);
    for (let i=0; i< tokList.length; i++) {
      let found = false;
      const cmd = this.findNextCommand(tokList, i, keys);
      if (cmd) {
        let [ num, value] = this.consumeArgs(tokList, i+1, cmd, options);
        if (num > 0) {
          found = true;
          args[cmd] = value;
          i += num;
          continue;
        } else {
          return [`bad arg for ${cmd}`, args];
        }
      } else {
        return [ `bad option: ${this.renderTokens(tokList[i])}`, args ];
      }
    }
    const opts = Object.keys(args);
    for (let i=0; i<keys.length; i++) {
      if (! args.hasOwnProperty(keys[i])) {
        return [`required option ${keys[i]} missing`, args];
      }
    }
    return [null, args];
  }

  // consumeArgs: consume as many tokens as possible; return [num, value]
  // "index" points to the first token after the COMMAND argname.
  consumeArgs(tokList, index, argname, options) {
    const opt = options[argname];
    const tok = tokList[index];
    if (opt === 'COMMAND') {
      return tok.name === 'COMMAND' ? [1, tok.value] : [0, 'not COMMAND'];
    } else if (opt === 'WORD') {
      return tok.name === 'WORD' ? [1, tok.value] : [0, 'not WORD'];
    } else if (opt === 'STRING') {
      return tok.name === 'STRING' ? [1, tok.value] : [0, 'not STRING'];
    } else if (opt === 'WORDS') {
      let num = 0;
      let arr = [];
      for (let i=index; i<tokList.length; i++) {
        const tok = tokList[i];
        if (tok.name === 'WORD') {
          num++;
          arr.push(tok.value);
        } else {
          return [num, arr];
        }
      }
      return [num, arr];
    } else if (opt === 'PATH') {
      const num = this.consumePath(tokList.slice(index));
      if (num <= 1) {
        return [0, 'not PATH'];
      } else {
        return [num, this.composePath(tokList.slice(index, index+num))];
      }
    } else if (opt.match(/WORD/) && opt.match(/STRING/)) {
      return tok.name.match(/WORD|STRING/) ? [1, tok.value] : [0, 'not found'];
    }
    console.log(`consumeArgs: bad option: ${opt}`);
    return 0;
  }

  // composePath - return a string. Input must be valid path sequence

  composePath(args) {
    if (args.length === 0) {
      return '';
    }
    if (args[0].name !== 'DOT') {
      return null;
    }
    let str = '.';
    let wantWord = true;
    for (let i = 1; i< args.length; i++) {
      if (wantWord) {
        if (args[i].name !== 'WORD') {
          return null;
        } else {
          str += args[i].value;
          wantWord = false;
        }
      } else {
        if (args[i].name === 'DOT') {
          str += '.';
          wantWord = true;
        } else if (args[i].name === 'SLASH') {
          str += '/';
          wantWord = true;
        } else {
          return null;
        }
      }
    }
    return str;
  }

  // consumePath - return number of tokens consumed from front.
  // Consumes as many tokens as possible to form a legal path.
  consumePath(args) {
    if (args.length === 0) {
      return 0;
    }
    if (args[0].name !== 'DOT') {
      return 0;
    }
    let wantWord = true;
    let numConsumed = 1;
    for (let i = 1; i< args.length; i++) {
      if (wantWord) {
        if (args[i].name !== 'WORD') {
          return numConsumed - 1;
        } else {
          numConsumed ++;
          wantWord = false;
        }
      } else {
        if (args[i].name === 'DOT') {
          numConsumed ++;
          wantWord = true;
        } else if (args[i].name === 'SLASH') {
          numConsumed ++;
          wantWord = true;
        } else {
          return numConsumed;
        }
      }
    }
    return numConsumed;
  }

}

module.exports = new Tokenizer;
