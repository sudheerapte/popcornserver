"use strict";

const [log, err] = require('./logerr.js');
const Queries = require('../queries.js');
const Machine = require('../machine.js');

const machine = new Machine();
machine.interpret( [ 'P .a.b.c.d'] );

const testString = "{{EXISTS .a.b.c.d }}";

const result = Queries.tokenize(null, testString);

if (result[0]) {
  console.log(`error: ${result[0]}`);
  process.exit(1);
}

console.log(Queries.printTokens(result[1]));
