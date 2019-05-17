window.onload = boot;

let P = {          // minimize pollution of global namespace
  machine: "",     // name of machine
  mc: new Machine, // filled in by message handlers
  ws: null,        // websocket assigned by upgradeToWebsocket
  queries: new Queries,
};

function boot() {
  upgradeToWebsocket()
    .then( doFirstMessage ) // adds listener handleMessage() and unhides body
    .then( () => {
      console.log(`ready`);
    })
    .catch( errMsg => console.log(errMsg) );
}

// not a promise
function unhideBody() {
  const bodyElem = document.querySelector('body');
  if (bodyElem) {
    bodyElem.removeAttribute("hidden");
  } else {
    console.log(`failed to find bodyElem!`);
  }
}

function readInitScript() {
  const initScript = document.querySelector('script#init');
  if (initScript) {
    const str = initScript.textContent;
    const lines = str.split(/\n|\r\n/)
          .filter(line => ! line.match(/^\s*$/))
          .map(line => line.trim());
    console.log(`init script = ${lines.length} lines`);
    const result = P.mc.interpret(lines);
    if (result) {
      console.log(`interpret result = ${result}`);
    }
  } else {
    console.log(`initScript not found`);
  }
}

function generateXY() {
  const nodeList = document.querySelectorAll('svg use');
  console.log(`generateXY: nodeList length = ${nodeList.length}`);
  nodeList.forEach( useNode => {
    [ 'x', 'y' ].forEach( coord => {
      const formula = useNode.getAttribute(`data-${coord}`);
      if (formula) {
        console.log(`data-${coord}="${formula}"`);
        let result = P.queries.tokenize(P.mc, formula);
        if (result[0]) {
          console.log(`tokenize failure: ${result[0]}`);
        } else {
          let eResult = P.queries.evaluate(P.mc, result[1]);
          if (eResult[0]) {
            console.log(`eval failure: ${eResult[0]}`);
          } else {
            console.log(`eval=${JSON.stringify(eResult[1])}. Using value.`);
            useNode.setAttribute(coord, eResult[1].value);
          }
        }
      }
    });
  });
}

function upgradeToWebsocket() {
  return new Promise( (resolve, reject) => {
    const href = window.location.href;
    // replace http: with ws:
    const wsref = href.replace(/^[^:]+/, "ws");
    console.log(`upgrading to ${wsref}`);
    P.ws = new WebSocket(wsref);
    if (! P.ws) {
      return reject(`failed to create WebSocket(${wsref})`);
    }
    P.ws.addEventListener('open', function(ev) {
      console.log(`websocket is open`);
      return resolve();
    });
    P.ws.addEventListener('close', function(ev) {
      console.log('websocket closed by server');
    });
    P.ws.addEventListener('error', function(ev) {
      console.log(`websocket error: ${JSON.stringify(ev)}`);
    });
  });
}

/**
   @function(doFirstMessage) - get the URL machine and display it
*/

function doFirstMessage() {
  return new Promise( (resolve, reject) => {
    P.ws.addEventListener('message', handleFirstMessage);

    // Send the subscribe command for our URL machine
    let mcname = window.location.pathname;
    if (mcname.startsWith('/')) { mcname = mcname.slice(1); }
    console.log(`subscribing to machine ${mcname}`);
    try {
      if (P.ws) { P.ws.send(`subscribe ${mcname}`); }
    } catch (e) {
      console.log(`websocket send failed: ${e.code}`);
    }
    
    function handleFirstMessage(ev) {
      // the first message must be "provide machine"
      const data = ev.data;
      if (data.match(/^provide\s+/)) {
	const m = data.match(/^provide\s+([a-z]+)/);
	if (!m) {
	  console.log(`bad provide command: |${trunc(data)}|`);
	} else {
	  P.machine = m[1];
	  // console.log(`got provide ${P.machine}`);
	  const arr = data.split('\n');
	  if (! arr) {
            const msg = `bad machine payload for ${P.machine}`;
	    return rejectThis(()=> reject(msg));
	  } else {
	    // console.log(`provide command payload = |${arr.join(",")}|`);
	  }
	  const result = P.mc.interpret(arr.slice(1));
	  if (result) { return rejectThis(()=>reject(result)); }
          readInitScript();
          reflectMachine();
          addClickChgHandlers();
          addClickCmdHandlers();
          // console.log(`added all the handlers`);
	  return resolveThis(resolve);
	}
      } else if (data.match(/no\ssuch\smachine/)) {
        console.log(`No app--- proceeding with assets alone`);
        readInitScript();
        reflectMachine();
        addClickChgHandlers();
        addClickCmdHandlers();
      } else {
        console.log(`first message = ${data}`);
      }
      return resolveThis(resolve);
    }
    // resolveThis() and rejectThis() set up eventListeners first,
    // and also unhide the body.
    function resolveThis(resolve) {
      P.ws.removeEventListener('message', handleFirstMessage);
      P.ws.addEventListener('message', handleMessage);
      unhideBody();
      return resolve();
    }
    function rejectThis(rejector) {
      // when rejecting, we don't want to handle any more events
      P.ws.removeEventListener('message', handleFirstMessage);
      unhideBody();
      return rejector();
    }
  });
}

function handleMessage(ev) { // handle subsequent messages
  // console.log(`handleMessage: |${trunc(ev.data)}|`);
  const data = ev.data;
  if (data.match(/^update\s+/)) {
    const m = data.match(/^update\s+([a-z]+)/);
    if (!m) {
      console.log(`ignoring bad update command: |${trunc(data)}|`);
    } else if (P.machine !== m[1]) {
      console.log(`|update ${m[1]}|: ignoring unknown machine`);
    } else {
      const arr = data.split('\n');
      if (!arr) {
	console.log(`bad payload for |${trunc(data)}|`);
      } else {
	const result = P.mc.interpret(arr.slice(1));
	if (result) {
	  console.log(`update failed: ${result}`);
	} else {
          reflectMachine();
	}
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
  if (! P.mc) { return; }
  generateXY();
  const DM = "data-alt";
  const machineElems = document.querySelectorAll(`[${DM}]`);
  //  console.log(`machineElems = ${machineElems.length} items`);
  // hide all non-current alt children and unhide all other paths
  machineElems.forEach( e => {
    const mPath = e.getAttribute(DM);
    if (mPath) {
      if (! P.mc.exists(mPath) && ! unknownPaths.has(mPath)) {
        console.log(`no such path: ${mPath}`);
        unknownPaths.set(mPath, true);
        return;
      }
      const toHide = isNonCurrAlt(mPath);
      if (toHide) {
        e.setAttribute("hidden", "");
      } else if (e.hasAttribute("hidden")) {
        e.removeAttribute("hidden");
      }
    }
  });
}

/**
   isNonCurrAlt(): is this path an alt-child that is not current?

   These are the guys we want to hide.
   The DOM rendering will automatically hide any child elements.
*/

function isNonCurrAlt(mPath) {
  const state = P.mc.getState(mPath);
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
  if (! P.mc) { return; }
  const mcCopy = P.mc.clone(); // create a copy to try the transactions on
  if (typeof mcCopy === 'string') {
    console.log(`failed to clone: ${mcCopy}`);
    return;
  }
  const DO = "data-chgclick";
  const machineElems = document.querySelectorAll(`[${DO}]`);
  machineElems.forEach( e => {
    const chStr = e.getAttribute(DO);
    if (chStr) {
      const arr = chStr.split(',').map( elem => elem.trim() );
      // console.log(`arr = ${arr.join(",")}`);
      const result = mcCopy.interpret(arr);
      if (result) {
        console.log(`${e.tagName} ${DO}=${chStr}: ${result}`);
      } else {
        e.addEventListener('click', ev => {
          if (! P.mc) { return; }
          const result = P.mc.interpret(arr);
          if (result) {
            console.log(`click failed: ${result}`);
          } else {
            //console.log(`clicked`);
            reflectMachine();
          }
        });
      }
    } else {
      console.log(`attribute ${DO} value not found`);
    }
  });
}

/**
   @function(addClickCmdHandlers) - set up data-cmdclick handlers
*/
function addClickCmdHandlers() {
  if (! P.mc) { return; }
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
        console.log(`clicked: sending ${chStr}`);
        try {
          if (P.ws) { P.ws.send(`command ${P.machine}\n${chStr}`); }
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
