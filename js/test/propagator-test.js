"use strict";

const [log, err, errDiff] = require('./logerr.js');
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
  'P .tomove/spider',
  'P .tomove/fly1',
  'P .tomove/fly2',
  'P .tomove/fly3',
  'P .x.b.c/foo',
  'P .x.b.c/bar',
  'P .x.b.c/baz',
  'P .y.b.c/foo',
  'P .y.b.c/bar',
  'P .y.b.c/baz',
];

machine = new Machine();
machine.interpret(initScript);
log(machine.getSerialization().filter( s => s.match(/\.turn/)) );

log(`--- unify ALL and unify CURRENT`);
propagator = new Propagator(machine, t, (s) => log(s));
result = propagator.unify('.XORY.b.c/P', 'ALL');
errDiff(result.length, 6);
if (result.filter(e => e.P === 'bar').length !== 2) {
  err("unify result must contain two substitutions with X = bar");
}
result = propagator.unify('.XORY.b.c/P', 'CURRENT');
errDiff(result.length, 2);
if (result.filter(e => e.P === 'foo').length !== 2) {
  err("unify result must contain two substitutions with X = foo");
}
result = propagator.unify('.selectedfly/F', 'ALL');
errDiff(result.length, 3);
result = propagator.unify('.tomove/F', 'CURRENT');
errDiff(result.length, 1);
log(result);

log(`---- runRenderScript: .turn = spider`);

renderScript = [
  "ON .turn spider BEGIN",
  "D .img.{{CURRENT .selectedfly}} fly",
  "D .img.fly2 fly",
  "D .img.fly3 fly",
  "D .img.spider spider-selected",
  "C .tomove spider",
  "END",

  "ON .turn flies BEGIN",
  "D .img.{{CURRENT .selectedfly}} fly-selected",
  "D .img.spider spider",
  "C .tomove {{CURRENT .selectedfly}}",
  "END",
];

propagator = new Propagator(machine, t, (s) => log(s));
propagator.runRenderScript(renderScript);

checkProcess("{{DATA .img.fly1}}", "fly");
checkProcess("{{DATA .img.fly2}}", "fly");
checkProcess("{{DATA .img.spider}}", "spider-selected");
checkProcess("{{CURRENT .tomove}}", "spider");

log(`---- check for bad path syntax`);
result = propagator.process("{{CURRENT tomove}}");
errDiff(result[0], "CURRENT: bad syntax for path: tomove");
log(`   OK`);

log(`---- runRenderScript: .turn = flies`);
machine.interpret([ 'C .turn flies' ]);
log(machine.getSerialization().filter( s => s.match(/\.turn/)) );

propagator.runRenderScript(renderScript);

checkProcess("{{DATA .img.fly1}}", "fly-selected");
checkProcess("{{DATA .img.fly2}}", "fly");
checkProcess("{{DATA .img.spider}}", "spider");
checkProcess("{{CURRENT .tomove}}", "fly1");


log(`---- evalBlockVars`);
machine = new Machine();
machine.interpret(["P .board.a", "P .board.b", "P .board.c",]);

propagator = new Propagator(machine, t, (s) => log(s));
['a', 'b', 'c'].forEach(position => {
  const lines = propagator.evalBlockVars(["P .fly1.position/{{POS}}", "P .fly2.position/{{POS}}"], {POS: position});
  const result = machine.interpret(lines);
  err(result);
});

checkProcess("{{EXISTS .board.b}}", "1");
checkProcess("{{CURRENT .fly1.position}}", "a");
checkProcess("{{CURRENT .fly2.position}}", "a");

function checkProcess(input, output) {
  let tResult;
  tResult = propagator.process(input);
  err(tResult[0]);
  log(' '.repeat(40 - input.length)+`${input}| ==> |${tResult[1]}|`);
  if (tResult[1] !== output) {
    err(`expected |${output}|, but got |${JSON.stringify(tResult[1])}|`);
  }
}
