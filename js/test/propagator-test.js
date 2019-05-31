"use strict";

const [log, err] = require('./logerr.js');
const Propagator = require('../propagator.js');
const t = require('../tokenizer.js');
const Machine = require('../machine.js');

let propagator;
let machine;
let tokens;
let evalFunc;

let result;
let input;
let initScript, renderScript;

log(`---- runRenderScript: .turn = spider`);

initScript = [
  'P .turn/spider',
  'P .turn/flies',
  'P .selectedfly/fly1',
  'P .selectedfly/fly2',
  'P .selectedfly/fly3',
  'P .img.fly1',
  'P .img.fly2',
  'P .img.fly3',
  'P .img.spider',
];

machine = new Machine();
machine.interpret(initScript);
log(machine.getSerialization().filter( s => s.match(/\.turn/)) );

renderScript = [
  "ON .turn spider BEGIN",
  "D .img.{{CURRENT .selectedfly}} fly",
  "D .img.fly2 fly",
  "D .img.fly3 fly",
  "D .img.spider spider-selected",
  "END",

  "ON .turn flies BEGIN",
  "D .img.{{CURRENT .selectedfly}} fly-selected",
  "D .img.spider spider",
  "END",
];

propagator = new Propagator(machine, t, (s) => log(s));
propagator.runRenderScript(renderScript);

checkProcess("{{DATA .img.fly1}}", "fly");
checkProcess("{{DATA .img.fly2}}", "fly");
checkProcess("{{DATA .img.spider}}", "spider-selected");

log(`---- runRenderScript: .turn = flies`);
machine.interpret([ 'C .turn flies' ]);
log(machine.getSerialization().filter( s => s.match(/\.turn/)) );

propagator.runRenderScript(renderScript);

checkProcess("{{DATA .img.fly1}}", "fly-selected");
checkProcess("{{DATA .img.fly2}}", "fly");
checkProcess("{{DATA .img.spider}}", "spider");


function checkProcess(input, output) {
  let tResult;
  tResult = propagator.process(input);
  err(tResult[0]);
  log(' '.repeat(40 - input.length)+`${input}| ==> |${tResult[1]}|`);
  if (tResult[1] !== output) {
    err(`expected |${output}|, but got |${tResult[1]}|`);
  }
}
