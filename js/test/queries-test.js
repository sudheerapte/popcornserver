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
  let tResult = [ null, input];
  let more = true;
  while (more) {
    const str = tResult[1];
    log(` processing |${str}|`);
    tResult = t.processOnce(str, evalFunc);
    err(tResult[0]);
    log(`             |${tResult[1]}|`);
    more = tResult[2];
  }
  if (tResult[1] !== output) {
    err(`expected |${output}|, but got |${tResult[1]}|`);
  }
}

checkProcess("DATA .loc.{{CURRENT .fly1.pos}}.x", "\"500");
    
