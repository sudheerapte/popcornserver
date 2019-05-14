"use strict";

const [log, err] = require('./logerr.js');
const Queries = require('../queries.js');

const testString = "{{EXISTS some.words}}";

const result = Queries.tokenize(null, testString);

if (result[0]) {
  console.log(`error: ${result[0]}`);
  process.exit(1);
}

let str = '';
result[1].forEach( tok => {
  if (tok) {
    if (tok.name === 'WORD') {
      str += ` "${tok.value}"`;
    } else if (tok.name === 'COMMAND') {
      str += ` ${tok.value}`;
    } else {
      str += ' ' + tok.name;
    }
  } else {
    str += ' (null)';
  }
});

console.log(str);
