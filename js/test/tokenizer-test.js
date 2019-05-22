"use strict";

const [log, err] = require('./logerr.js');
const t = require('../tokenizer.js');

let tokens;
let result;

function testTokenize(input, output) {
  log(`${' '.repeat(30-input.length)}|${input}|     ${JSON.stringify(output)}`);
  let result = t.tokenize(input);
  if (result[0] !== output[0]) {
    err(`result should be ${output[0]}, but got: ${result[0]}`);
  }
  if (! result[0]) {
    const str = t.printTokens(result[1]);
    if (str !== output[1]) {
      err(`expected |${output[1]}|, got |${str}|`);
    }
  }
}

testTokenize("DUMMY foo.bar", [null, " DUMMY foo. bar"]);
testTokenize("\"DUMMY foo.bar", [null, "\"DUMMY foo.bar"]);
testTokenize("\"DUMMY\nfoo\n.bar", [null, "\"DUMMY\nfoo\n.bar"]);

log(`---- test 2: scanString suite`);
function checkScan(input, output) {
  log(`${' '.repeat(30-input.length)}|${input}|     ${JSON.stringify(output)}`);
  let result = t.scanString(input);
  if (result[0] !== output[0] || result[1] !== output[1]) {
    err(`input |${input}| should produce |${output}|, got |${result}|`);
  }
}
checkScan("foo bar", [-1, -1]);
checkScan("foo }}bar}}", [ -1, 4]);
checkScan("foo {{bar", [ 4, -1 ]);
checkScan("foo {{bar}}", [ 4, 9 ]);
checkScan("foo {{bar}}}}", [ 4, 9 ]);
checkScan("foo {{{{bar}}", [ 6, 11 ]);
checkScan("foo {{{{bar}}}}", [ 6, 11 ]);
checkScan("foo \\{{bar}}", [ -1, 10 ]);
checkScan("foo {{bar\\}}", [ 4, -1 ]);
checkScan("foo {bar}}", [ -1, 8 ]);
checkScan("foo \"{bar}}", [ -1, 9 ]);
checkScan("foo {{bar\"}}", [ 4, 10 ]);

log(`---- test 10: process suite`);
function checkProcess(input, output) {
  log(`${' '.repeat(30-input.length)}|${input}| |${JSON.stringify(output)}|`);
  let result = t.processOnce(input);
  if (result[0] !== output[0]) {
    err(`expected ${output[0]}, got ${result[0]}`);
  }
  if (result[1] !== output[1]) {
    err(`expected |${output[1]}|, got |${result[1]}|`);
  }
}
checkProcess("foo bar", ["No BEGIN found", null]);
checkProcess("{{foo bar}}", [null, " foo bar"]);
checkProcess("{{foo {{bar}}", [null, " bar"]);
checkProcess("foo {{bar}}}}", [null, " bar"]);
checkProcess("foo {{\"bar}}}}", [null, "\"bar"]);

