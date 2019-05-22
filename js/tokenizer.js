"use strict";

/**
   Tokens are of these six types: BEGIN END COMMAND WORD STRING, plus
   one type each for the special characters ./+=()*&%$#@!~:;,[]^{}
     
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
    const BEGIN=/(?<!\\){{/; const END=/(?<!\\)}}/;
    const EITHER=/(?<!\\){{|(?<!\\)}}/g;
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
      if (++loopsDone < 0) { break; }
    }
    return [null, tResult[1]];
  }

  /**
     processOnce - process the tokens in the innermost BEGIN-END pair.

     Given "blah {{foo bar}} blah", we return "blah xyz blah",
     where "xyz" is the evaluation of "foo bar".

     Return [errorString, remainderString].
     If there is any error, then remainderString will be null.

     If there is no error, then call the function 'f' with the
     token array parsed from the BEGIN-END pair. The function 'f' should
     return [ errString, tokenlist ]. If it works, then the token
     output will be substituted in the original string to form
     the remainderString.

     If no function 'f' is passed in, then the remainderString will
     be the tokens printed into string form.

     If the string might have more expressions to be evaluated, then
     a third element is returned as "true".

  */
  processOnce(str, f) {
    let result;
    let [ b, e ] = this.scanString(str);
    if (b < 0 && e < 0) {  // Simple case -- evaluate entire string
      result = this.tokenize(str);
      if (result[0]) {
        return [ result[0], null ];
      }
      const tokens = result[1];
      if (f) {
        const pResult = f(tokens);
        if (pResult[0]) {
          return [ pResult[0], this.printTokens(tokens) ];
        } else {
          return [ null, this.printTokens(pResult[1])];
        }
      } else {
        return [ null, this.printTokens(tokens) ];
      }
    }
    if (b < 0) { return ["No BEGIN found", null]; }
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
                 this.printTokens(pResult[1]) +
                 str.slice(e+2,str.length),
                 true
               ];
      }
    } else {
      return [ null, this.printTokens(result[1]) ];
    }
  }

  /**
     tokenize - create an array of tokens from an input string

     As a special rule, if the input string starts with a quote
     character '"', then the rest of the input string is put into a
     single STRING token.

     See the scanString function above for how to terminate input
     strings in the middle.

     See the printTokens function below; it can take an array of
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
      { re: /^\./,    type: 'DOT',     makeToken: true, useValue: false },
      { re: /^\//,    type: 'SLASH',   makeToken: true, useValue: false },
    ];
    let arr = [];
    if (str === null || typeof str === 'undefined') {
      return [ "string is null", arr ];
    }
    // special rule for forcing the whole string into a STRING token
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
      RULES.forEach( rec => {
        if (found) { return; }
        m = s.match(rec.re);
        if (m) {
          // console.log(`i = ${i}: matched ${rec.re}`);
          found = true;
          i += m[0].length - 1;
          if (rec.makeToken) {
            arr.push({name: rec.type, value: (rec.useValue ? m[0] : null)});
          }
        }
      });
      if (! found) {
        arr.push({name: 'STRING', value: s});
        i += s.length;
      }
    }
    return [ null, arr];
  }

  printTokens(arr) {
    if (! arr) { return null; }

    if (arr.hasOwnProperty('length')) {
      let str = '';
      arr.forEach( (tok,i) => {
        if (tok.name === 'STRING' && i < arr.length-1) {
          str += printTok(tok);
          str += "\n";
        } else {
          str += printTok(tok);
        }
      });
      return str;
    } else {
      return printTok(arr);
    }

    function printTok(tok) {
      if (tok) {
        if (tok.name === 'STRING') {
          return '"'+tok.value;
        } else if (tok.name === 'WORD') {
          return ` ${tok.value}`;
        } else if (tok.name === 'COMMAND') {
          return ` ${tok.value}`;
        } else if (tok.name === 'STRING') {
          return ` tok.value`;
        } else if (tok.name === 'DOT') {
          return '.' ;
        } else if (tok.name === 'SLASH') {
          return '/' ;
        }
      } else {
        return ' (null)';
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

Tokenizer.SPECIALCHAR = /[./+=()*&%$#@!~:;,\[\]\^{}]/;

module.exports = new Tokenizer;
