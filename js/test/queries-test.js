"use strict";

const [log, err] = require('./logerr.js');
const Queries = require('../queries.js');
const Machine = require('../machine.js');

const machine = new Machine();
machine.interpret( [ 'P .a.b.c.d'] );

const testString = "{{EXISTS .a.b.c.d }}";

let result;


console.log(`------ test 1: tokenize ${testString}`);
result = Queries.tokenize(null, testString);
if (result[0]) {
  console.log(`error: ${result[0]}`);
  process.exit(1);
}
console.log(Queries.printTokens(result[1]));

console.log(`------ test 2: compose path .a.b.c.d`);
result = Queries.tokenize(machine, '.a.b.c.d');
console.log(Queries.printTokens(result[1]));

if (result[0]) {
  console.log(`error: ${result[0]}`);
  process.exit(1);
}
let str = Queries.composePath(result[1]);
console.log(`path = |${str}|`);

console.log(`------ test 3: exists .a.b.c.d`);
result = Queries.tokenize(machine, 'EXISTS .a.b.c.d');
result = Queries.evaluate(machine, result[1]);
console.log(JSON.stringify(result));
if (result[0]) {
  console.log(`error: ${result[0]}`);
  process.exit(1);
}
console.log(`result = |${result[1]}|`);
