"use strict";

const [log, err] = require('./logerr.js');
const Queries = require('../queries.js');
const t = require('../tokenizer.js');
const Machine = require('../machine.js');

let queries = new Queries;
let machine;
let tokens;

machine = new Machine();
machine.interpret( [ 'P .a.b.c.d'] );

let result;
let input;

log(`---- test 6: checkProcess`);

machine = new Machine();
result = machine.interpret([
  'P .fly1.pos/a',
  'P .loc.a.x',
  'D .loc.a.x 500']);
err(result);
const evalFunc =  queries.getEvalFunc(machine);

function checkProcess(input, output) {
  let tResult;
  tResult = t.process(input, evalFunc);
  err(tResult[0]);
  log(' '.repeat(40 - input.length)+`${input}| ==> |${tResult[1]}|`);
  if (tResult[1] !== output) {
    err(`expected |${output}|, but got |${tResult[1]}|`);
  }
}

checkProcess("{{DATA .loc.{{CURRENT .fly1.pos}}.x}}", "500");
checkProcess("{{CURRENT .fly1.pos}}", "a");

result = machine.interpret(["D .loc.a.x CURRENT .fly1.pos"]);
err(result);
log(`           .fly.pos/ = |a|`);
log(`           .loc.a.x = |CURRENT .fly1.pos|`);
checkProcess("{{DATA .loc.a.x}}", "CURRENT .fly1.pos");
checkProcess("{{{{DATA .loc.a.x}}}}", "a");
checkProcess("{{{{{{DATA.loc.a.x}}}}}}", "a");
checkProcess("{{{{{{{{DATA.loc.a.x}}}}}}}}", "a");

result = machine.interpret(["D .loc.a.x DATA .loc.a.x"]);
err(result);
log(`           .loc.a.x = |DATA .loc.a.x|`);
checkProcess("{{DATA .loc.a.x}}", "DATA .loc.a.x");
checkProcess("{{{{DATA .loc.a.x}}}}", "DATA .loc.a.x");
checkProcess("{{{{{{DATA.loc.a.x}}}}}}", "DATA .loc.a.x");
checkProcess("{{{{{{{{DATA.loc.a.x}}}}}}}}", "DATA .loc.a.x");


