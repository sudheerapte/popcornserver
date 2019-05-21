"use strict";

const [log, err] = require('./logerr.js');
const Queries = require('../queries.js');
const Machine = require('../machine.js');

let queries = new Queries;
let machine;
let tokens;

machine = new Machine();
machine.interpret( [ 'P .a.b.c.d'] );

let result;
const testString = "{{EXISTS .a.b.c.d }}";

log(`------ test 1: tokenize ${testString}`);
result = queries.tokenize(null, testString);
err(result[0]);
if (queries.printTokens(result[1]) !== ' BEGIN EXISTS DOT "a" DOT "b" DOT "c" DOT "d" END') {
  console.log(result[1]);
  err(`bad result`);
}

log(`------ test 2: compose path .a.b.c.d`);
result = queries.tokenize(machine, '.a.b.c.d');
err(result[0]);
tokens = result[1];
log(`  ${queries.printTokens(tokens)}`);
let str = queries.composePath(result[1]);
if (str !== '.a.b.c.d') {
  err(`bad path composed: ${str}`);
}

log(`------ test 3: exists .a.b.c.d`);
result = queries.tokenize(machine, 'EXISTS .a.b.c.d');
tokens = result[1];
log(`  ${queries.printTokens(tokens)}`);
result = queries.evaluate(machine, tokens);
err(result[0]);
if (result[1].name !== 'NUMBER') {
  err(`bad result: expected NUMBER, got ${result[1].name}`);
}
if (result[1].value !== "1") {
  err(`bad result: ${result[1].value}`);
}

log(`------ test 4: CURRENT .a, tokenize and reuse`);
machine = new Machine();
result = machine.interpret(['P .a/foo', 'P .a/bar']);
err(result);
result = queries.tokenize(machine, 'CURRENT .a');
err(result[0]);
tokens = result[1];
log(`  ${queries.printTokens(tokens)}`);
result = queries.evaluate(machine, tokens);
err(result[0]);
log(`  output = |${queries.printTokens(result[1])}|`);
if (result[1].name !== 'WORD') {
  err(`bad result: ${result[1].name} - should have been "WORD"`);
}
if (result[1].value !== 'foo') {
  err(`bad result: ${result[1].value} - should have been "foo"`);
}
result = machine.interpret(['C .a bar']);
err(result);
result = queries.evaluate(machine, tokens);
err(result[0]);
log(`  output = |${queries.printTokens(result[1])}|`);
if (result[1].name !== 'WORD') {
  err(`bad result: ${result[1].name} - should have been "WORD"`);
}
if (result[1].value !== 'bar') {
  err(`bad result: ${result[1].value} - should have been "bar"`);
}

log(`------ test 5: DATA .a, non-leaf, data, change data, array data`);
result = queries.tokenize(machine, 'DATA .a');
err(result[0]);
tokens = result[1];
log(`  ${queries.printTokens(tokens)}`);
machine = new Machine();
result = machine.interpret(['P .a/foo', 'D .a fu-manchu']);
if (! result.match(/not a leaf/)) {
  err(`bad result: ${result} - should have been "not a leaf"`);
}
machine = new Machine();
result = machine.interpret(['P .a', 'D .a fu-manchu']);
err(result);
result = queries.evaluate(machine, tokens);
err(result[0]);
if (result[1].value !== 'fu-manchu') {
  err(`bad result: ${result[1].value} - should have been "fu-manchu"`);
}
result = machine.interpret(['D .a petrie']);
err(result);
result = queries.evaluate(machine, tokens);
err(result[0]);
if (result[1].value !== 'petrie') {
  err(`bad result: ${result[1].value} - should have been "petrie"`);
}
result = machine.interpret(['A .a karamaneh']);
err(result);
result = queries.evaluate(machine, tokens);
err(result[0]);
if (typeof result[1] !== 'object') {
  err(`bad result: ${result[1]} - should have been an array`);
}
if (result[1].length !== 2) {
  err(`expected array of 2 elements; got: |${result[1].length}|`);
}
if (result[1][0].value !== 'petrie') {
  err(`expected "petrie", got ${result[1][0].value}`);
}
if (result[1][1].value !== 'karamaneh') {
  err(`expected "karamaneh", got ${result[1][1].value}`);
}

let input;
input = "DATA .loc.{{CURRENT .fly1.pos}}.x";
log(`---- test 6: ${input}`);
machine = new Machine();
result = machine.interpret([
  'P .fly1.pos/a',
  'P .loc.a.x',
  'D .loc.a.x 500']);
err(result);
let tResult, eResult;
tResult = queries.tokenize(machine, input);
err(tResult[0]);
tokens = tResult[1];
eResult = queries.evaluate(machine, tokens);
err(eResult[0]);
if (eResult[1].name !== 'STRING') {
  err(`expecting STRING; got ${eResult[1].name}`);
}
if (eResult[1].value !== '500') {
  err(`expecting 500; got ${eResult[1].value}`);
}

log(`---- test 7: missing END in same input`);
tResult = queries.tokenize(machine, input.slice(0,-4));
err(tResult[0]);
tokens = tResult[1];
eResult = queries.evaluate(machine, tokens);
if (! eResult[0].match(/BEGIN\swithout\sEND/)) {
  err(`expecting BEGIN without END error; got ${eResult[0]}`);
}

log(`---- test 8: nested BEGIN..END`);
input = "{{DATA .loc.{{CURRENT .fly1.pos}}.x}}";
tResult = queries.tokenize(machine, input.slice(0,-4));
err(tResult[0]);
tokens = tResult[1];
eResult = queries.evaluate(machine, tokens);

log(`---- test 9: scanString`);
function checkScan(input, output) {
  let result = queries.scanString(input);
  if (result[0] !== output[0] || result[1] !== output[1]) {
    err(`input |${input}| should produce |${output}|, got |${result}|`);
  }
}

checkScan("foo bar", [-1, -1]);
checkScan("foo }}bar}}", [ -1, 4]);
checkScan("foo {{bar", [ 4, -1 ]);
checkScan("foo {{bar}}", [ 4, 9 ]);


