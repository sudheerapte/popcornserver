window.onload = boot;

let P = new Runtime( s => console.log(s) );
console.log(`created Runtime`);
P.setSingleton("machine", "");
P.setSingleton("mc",      new Machine);
P.setSingleton("wc",      null);
P.setSingleton("propagator", null);
P.setSingleton("tokenizer", new Tokenizer);
P.setSingleton("propagatorLogger", s => {});

function boot() {
  upgradeToWebsocket()
    .then( doFirstMessage ) // adds listener handleMessage() and unhides body
    .then( () => {
      console.log(`ready`);
    })
    .catch( errMsg => console.log(errMsg) );
}

// unhidebody() - make body visible after first message is processed
// not a promise
function unhideBody() {
  const bodyElem = document.querySelector('body');
  if (bodyElem) {
    bodyElem.removeAttribute("hidden");
  } else {
    console.log(`failed to find bodyElem!`);
  }
}

// sendProvide -- there is no app. Send our own machine using provide script.
function sendProvide() {
  const temp = new Machine;
  const provideScript = document.querySelector('script#provide');
  if (provideScript) {
    const str = provideScript.textContent;
    const lines = str.split(/\n|\r\n/)
          .filter(line => ! line.match(/^\s*$/))
          .map(line => line.trim());
    const propagator = new Propagator(temp, P.getSingleton("tokenizer"), P.getSingleton("propagatorLogger"));
    const result = propagator.runRenderScript(lines);
    if (result) {
      console.log(`provide script: ${result}`);
      console.log(`sending an empty machine.`);
    } 
  } else {
    console.log(`provide script not found; sending an empty machine.`);
  }
  // Send a client provide for our URL machine
  let mcname = window.location.pathname;
  if (mcname.startsWith('/')) { mcname = mcname.slice(1); }
  console.log(`sending client provide ${mcname}`);
  try {
    const ws = P.getSingleton("ws");
    if (ws) {
      ws.send(`provide ${mcname}\n${temp.getSerialization().join('\n')}\n`);
    } else {
      console.log(`ERROR: no websocket!`);
    }
  } catch (e) {
    console.log(`websocket send failed: ${e.code}`);
  }
}

function runScript(name) {
  let result = null;
  const script = document.querySelector(`script#${name}`);
  if (script) {
    const str = script.textContent;
    const lines = str.split(/\n|\r\n/)
          .filter(line => ! line.match(/^\s*$/))
          .map(line => line.trim());
    console.log(`script ${name}: ${lines.length} lines`);
    result = P.getSingleton("propagator").runRenderScript(lines);
    if (result) {
      console.log(`script ${name} error:\n${result}`);
    }
  } else {
    result = `script ${name} not found; continuing`;
  }
  return result;
}

function generateXY() {
  const nodeList = document.querySelectorAll(`svg use`);
  let numFormulas = 0;
  nodeList.forEach( useNode => {
    [ 'x', 'y', 'href' ].forEach( coord => {
      const formula = useNode.getAttribute(`data-${coord}`);
      if (formula) {
        numFormulas++;
        let result = P.getSingleton("propagator").process(formula);
        if (result[0]) {
          console.log(`use formula ${numFormulas}:
     ${formula}:
     ${result[0]}`);
        } else if (! result[1]) {
          console.log(`falsy result from use formula ${numFormulas}:
     ${formula}`);
        } else {
          const output = result[1];
          if (! output) { output = ""; }
          //console.log(`${formula}=|${output}|`);
          useNode.setAttribute(coord, output);
        }
      }
    });
  });
  console.log(`processed ${numFormulas} formulas`);
}

function upgradeToWebsocket() {
  return new Promise( (resolve, reject) => {
    const href = window.location.href;
    // replace http: with ws:
    const wsref = href.replace(/^[^:]+/, "ws");
    console.log(`upgrading to ${wsref}`);
    P.setSingleton("ws", new WebSocket(wsref));
    const ws = P.getSingleton("ws");
    if (! ws) {
      return reject(`failed to create WebSocket(${wsref})`);
    }
    ws.addEventListener('open', function(ev) {
      console.log(`websocket is open`);
      return resolve();
    });
    ws.addEventListener('close', function(ev) {
      console.log('websocket closed by server');
    });
    ws.addEventListener('error', function(ev) {
      console.log(`websocket error: ${JSON.stringify(ev)}`);
    });
  });
}

/**
   @function(doFirstMessage) - get the URL machine and display it
*/

function doFirstMessage() {
  return new Promise( (resolve, reject) => {
    P.getSingleton("ws").addEventListener('message', handleFirstMessage);

    // Send the subscribe command for our URL machine
    let mcname = window.location.pathname;
    if (mcname.startsWith('/')) { mcname = mcname.slice(1); }
    console.log(`subscribing to machine ${mcname}`);
    P.setSingleton("machine", mcname);
    const ws = P.getSingleton("ws");
    try {
      if (ws) { ws.send(`subscribe ${mcname}`); }
      else { return reject(`ERROR: no websocket!`); }
    } catch (e) {
      return reject(`websocket send failed: ${e.code}`);
    }
    
    function handleFirstMessage(ev) {
      // the first message must be "provide machine" or "no such machine"
      const data = ev.data;
      if (data.match(/^provide\s+(\w+)/)) {
	const m = data.match(/^provide\s+(\w+)/);
	if (P.getSingleton("machine") === m[1]) {
	  console.log(`got provide ${P.getSingleton("machine")}`);
	  const arr = data.split('\n');
	  if (! arr) {
            const msg = `bad machine payload for ${P.getSingleton("machine")}`;
            return reject(msg);
	  }
          P.setSingleton("mc", new Machine);
          const propagator =
                new Propagator(P.getSingleton("mc"),
                               P.getSingleton("tokenizer"),
                               P.getSingleton("propagatorLogger"));
          P.setSingleton("propagator", propagator);
	  const result = P.getSingleton("mc").interpret(arr.slice(1));
	  if (result) {
            console.log(`failed to interpret provided machine: ${result}`);
          }
          return proceedPastFirstMessage(resolve);
        } else {
          console.log(`ignoring unknown machine ${m[1]}`);
          // we cannot resolve until we get provide cmd
        }
      } else if (data.match(/no\ssuch\smachine/)) {
        console.log(`No app--- providing our own machine using assets`);
        sendProvide();
        // we cannot resolve until we get provide cmd
      } else {
        console.log(`first message = ${data}`);
        // we cannot resolve until we get provide cmd
      }
    }
    function proceedPastFirstMessage(resolve) {
      runScript('init');
      reflectMachine();
      addClickChgHandlers();
      addClickCmdHandlers();
      const ws = P.getSingleton("ws");
      ws.removeEventListener('message', handleFirstMessage);
      ws.addEventListener('message', handleMessage);
      unhideBody();
      return resolve();
    }
  });
}

function handleMessage(ev) { // handle subsequent messages
  console.log(`handleMessage: |${trunc(ev.data)}|`);
  const data = ev.data;
  if (data.match(/^update\s+/)) {
    const m = data.match(/^update\s+(\w+)/);
    if (!m) {
      console.log(`ignoring bad update command: |${trunc(data)}|`);
    } else if (P.getSingleton("machine") !== m[1]) {
      console.log(`|update ${m[1]}|: ignoring unknown machine`);
    } else {
      const arr = data.split('\n');
      if (!arr) {
	console.log(`bad payload for |${trunc(data)}|`);
      } else {
	const result = P.getSingleton("mc").interpret(arr.slice(1));
	if (result) {
	  console.log(`update failed: ${result}`);
	} else {
          reflectMachine();
	}
      }
    }
  } else if (data.match(/^provide\s+\w+/)) {
    const m = data.match(/^provide\s+(\w+)/);
    if (!m) {
      console.log(`ignoring bad provide command: |${trunc(data)}|`);
    } else if (P.getSingleton("machine") !== m[1]) {
      console.log(`|provide ${m[1]}|: ignoring unknown machine`);
    } else {
      const arr = data.split('\n');
      if (! arr) {
        const msg = `bad machine payload for ${P.getSingleton("machine")}`;
        return;
      } else {
        P.setSingleton("mc", new Machine);
        const mc = P.getSingleton("mc");
        const propagator = new Propagator(mc, P.getSingleton("tokenizer"),
                                      console.log)
        P.setSingleton("propagator", propagator);
	const result = P.getSingleton("mc").interpret(arr.slice(1));
	if (result) {
          console.log(`failed to interpret provided machine: ${result}`);
          return;
        }
        console.log(`new machine ${P.getSingleton("machine")} provided`);
        runScript('init');
        reflectMachine();
        return;
      }
    }
  } else {
    console.log(`unknown command: |${trunc(ev.data)}|`);
  }
}

/**
   @function(reflectMachine) - generate, unhide elements based on machine
*/
let unknownPaths = new Map(); // suppress repeated "no such path" errors

function reflectMachine() {
  const mc = P.getSingleton("mc");
  if (! mc) { return; }
  runScript('render');
  generateXY();
  const DM = "data-alt";
  const machineElems = document.querySelectorAll(`[${DM}]`);
  // console.log(`machineElems = ${machineElems.length} items`);
  // hide all non-current alt children and unhide all other paths
  machineElems.forEach( e => hideUnhide(e) );
  runScript('debug');

  function hideUnhide(e) {
    const mPath = e.getAttribute(DM);
    if (mPath) {
      if (! mc.exists(mPath) && ! unknownPaths.has(mPath)) {
        console.log(`no such path: ${mPath}`);
        unknownPaths.set(mPath, true);
        return;
      }
      const toHide = isNonCurrAlt(mPath);
      if (toHide) {
        if (e.tagName.match(/^g|svg|use/i)) {
          e.setAttribute("visibility", "hidden");
          console.log(`hiding ${e.getAttribute("id")}`);
        } else {
          e.setAttribute("hidden", "");
        }
      } else {
        if (e.tagName.match(/^g|svg|use/i)) {
          e.setAttribute("visibility", "visible");
          console.log(`making visible ${e.getAttribute("id")}`);
        } else {
          e.removeAttribute("hidden");
        }
      }
    }
  }
}

/**
   isNonCurrAlt(): is this path an alt-child that is not current?

   These are the guys we want to hide.
   The DOM rendering will automatically hide any child elements.
*/

function isNonCurrAlt(mPath) {
  const state = P.getSingleton("mc").getState(mPath);
  if (state) { // check if state is a non-current alternative child
    const parent = state.parent;
    if (parent.hasOwnProperty("curr") && parent.hasOwnProperty("cc")) {
      if (parent.cc[parent.curr] === state.name) {
        return false;
      } else {
        return true;
      }
    }
  }
  return false;
}

/**
   @function(addClickChgHandlers) - set up data-chgclick handlers
*/
function addClickChgHandlers() {
  const mc = P.getSingleton("mc");
  if (! mc) { return; }
  const mcCopy = mc.clone(); // create a copy to try the transactions on
  if (typeof mcCopy === 'string') {
    console.log(`failed to clone: ${mcCopy}`);
    return;
  }
  const DO = "data-chgclick";
  const machineElems = document.querySelectorAll(`[${DO}]`);
  machineElems.forEach( e => {
    const chStr = e.getAttribute(DO);
    if (chStr) {
      e.addEventListener('click', ev => {
        const propagator = P.getSingleton("propagator");
        const result = propagator.process(chStr.trim());
        if (result[0]) {
          console.log(`chgclick failed for ${chStr}: ${result[0]}`);
        } else {
          console.log(`click result: ${result[1]}`);
          const iresult = mc.interpret(result[1].split(','));
          if (iresult) {
            console.log(`interpret result: ${iresult}`);
          } else {
            reflectMachine();
          }
        }
      });
    } else {
      console.log(`attribute ${DO} value not found`);
    }
  });
}

/**
   @function(addClickCmdHandlers) - set up data-cmdclick handlers
*/
function addClickCmdHandlers() {
  const mc = P.getSingleton("mc");
  const machine = P.getSingleton("machine");
  if (! mc) { return; }
  const mcCopy = mc.clone(); // create a copy to try the transactions on
  if (typeof mcCopy === 'string') {
    console.log(`failed to clone: ${mcCopy}`);
    return;
  }
  const DC = "data-cmdclick";
  const machineElems = document.querySelectorAll(`[${DC}]`);
  machineElems.forEach( e => {
    const chStr = e.getAttribute(DC);
    if (chStr) {
      e.addEventListener('click', ev => {
        const propagator = P.getSingleton("propagator");
        const result = propagator.process(chStr.trim());
        if (result[0]) {
          console.log(`cmdclick failed for ${chStr}: ${result[0]}`);
          return;
        }
        console.log(`clicked: sending ${result[1]}`);
        try {
          const ws = P.getSingleton("ws");
          if (ws) { ws.send(`command ${machine}\n${result[1]}`); }
        } catch (e) {
          console.log(`websocket send failed: ${e.code}`);
        }
      });
    } else {
      console.log(`attribute ${DC} value not found`);
    }
  });
}

function trunc(logmsg) {
  if (! logmsg) { return 'null'; }
  logmsg = logmsg.replace(/\r|\n/g, " ");
  if (logmsg.length > 30) {
    return logmsg.substr(0,30) + '...';
  } else {
    return logmsg;
  }
}
