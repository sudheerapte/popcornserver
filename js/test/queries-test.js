"use strict";

const [log, err] = require('./logerr.js');
const Queries = require('../queries.js');
const Machine = require('../machine.js');

let machine;
let tokens;

machine = new Machine();
machine.interpret( [ 'P .a.b.c.d'] );

let result;
const testString = "{{EXISTS .a.b.c.d }}";

log(`------ test 1: tokenize ${testString}`);
result = Queries.tokenize(null, testString);
err(result[0]);
if (Queries.printTokens(result[1]) !== ' BEGIN EXISTS DOT "a" DOT "b" DOT "c" DOT "d" END') {
  console.log(result[1]);
  err(`bad result`);
}

log(`------ test 2: compose path .a.b.c.d`);
result = Queries.tokenize(machine, '.a.b.c.d');
err(result[0]);
let str = Queries.composePath(result[1]);
if (str !== '.a.b.c.d') {
  err(`bad path composed: ${str}`);
}

log(`------ test 3: exists .a.b.c.d`);
result = Queries.tokenize(machine, 'EXISTS .a.b.c.d');
result = Queries.evaluate(machine, result[1]);
err(result[0]);
if (result[1] !== 1) {
  err(`bad result: ${result[1]}`);
}

log(`------ test 4: CURRENT .a, tokenize and reuse`);
machine = new Machine();
result = machine.interpret(['P .a/foo', 'P .a/bar']);
err(result);
result = Queries.tokenize(machine, 'CURRENT .a');
err(result[0]);
tokens = result[1];
result = Queries.evaluate(machine, tokens);
err(result[0]);
if (result[1] !== 'foo') {
  err(`bad result: ${result[1]} - should have been "foo"`);
}
result = machine.interpret(['C .a bar']);
err(result);
result = Queries.evaluate(machine, tokens);
err(result[0]);
if (result[1] !== 'bar') {
  err(`bad result: ${result[1]} - should have been "bar"`);
}

log(`------ test 5: DATA .a, non-leaf, data, change data, array data`);
result = Queries.tokenize(machine, 'DATA .a');
err(result[0]);
tokens = result[1];
machine = new Machine();
result = machine.interpret(['P .a/foo', 'D .a fu-manchu']);
if (! result.match(/not a leaf/)) {
  err(`bad result: ${result} - should have been "not a leaf"`);
}
machine = new Machine();
result = machine.interpret(['P .a', 'D .a fu-manchu']);
err(result);
result = Queries.evaluate(machine, tokens);
err(result[0]);
if (result[1] !== 'fu-manchu') {
  err(`bad result: ${result[1]} - should have been "fu-manchu"`);
}
result = machine.interpret(['D .a petrie']);
err(result);
result = Queries.evaluate(machine, tokens);
err(result[0]);
if (result[1] !== 'petrie') {
  err(`bad result: ${result[1]} - should have been "petrie"`);
}
result = machine.interpret(['A .a karamaneh']);
err(result);
result = Queries.evaluate(machine, tokens);
err(result[0]);
if (result[1].length !== 2) {
  err(`expected array of 2 elements; got: |${result[1]}|`);
}
if (result[1][0] !== 'petrie') {
  err(`expected "petrie", got ${result[1][0]}`);
}
if (result[1][1] !== 'karamaneh') {
  err(`expected "karamaneh", got ${result[1][0]}`);
}
