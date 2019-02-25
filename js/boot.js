window.onload = boot;

let machine = ""; // name of machine
let mc = new Machine; // filled in by messageHandlers
let ws;          // websocket assigned by upgradeToWebsocket

function boot() {
  upgradeToWebsocket()
    .then( doFirstMessage ) // which adds listener handleMessage()
    .then( () => console.log(`ready`))
    .catch( errMsg => console.log(errMsg) );
}

function upgradeToWebsocket() {
  return new Promise( (resolve, reject) => {
    const href = window.location.href;
    // replace http: with ws:
    const wsref = href.replace(/^[^:]+/, "ws");
    console.log(`upgrading to ${wsref}`);
    ws = new WebSocket(wsref);
    if (!ws) {
      return reject(`failed to create WebSocket(${urlPath})`);
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

function doFirstMessage() {
  return new Promise( (resolve, reject) => {
    ws.addEventListener('message', handleFirstMessage);

    // Send the subscribe command for our URL machine
    let mcname = window.location.pathname;
    if (mcname.startsWith('/')) { mcname = mcname.slice(1); }
    console.log(`subscribing to machine ${mcname}`);
    try {
      if (ws) { ws.send(`subscribe ${mcname}`); }
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
	  machine = m[1];
	  // console.log(`got provide ${machine}`);
	  const arr = data.split('\n');
	  if (! arr) {
            const msg = `bad machine payload for ${machine}`;
	    return rejectThis(()=> reject(msg));
	  } else {
	    // console.log(`provide command payload = |${arr.join(",")}|`);
	  }
	  const result = mc.interpret(arr.slice(1));
	  if (result) { return rejectThis(()=>reject(result)); }
          reflectMachine();
          addClickChgHandlers();
          addClickCmdHandlers();
          // console.log(`added all the handlers`);
	  return resolveThis(resolve);
	}
      }
    }
    // resolveThis() and rejectThis() set up eventListeners first
    function resolveThis(resolve) {
      ws.removeEventListener('message', handleFirstMessage);
      ws.addEventListener('message', handleMessage);
      return resolve();
    }
    function rejectThis(rejector) {
      // when rejecting, we don't want to handle any more events
      ws.removeEventListener('message', handleFirstMessage);
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
    } else if (machine !== m[1]) {
      console.log(`|update ${m[1]}|: ignoring unknown machine`);
    } else {
      const arr = data.split('\n');
      if (!arr) {
	console.log(`bad payload for |${trunc(data)}|`);
      } else {
	const result = mc.interpret(arr.slice(1));
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
   @function(reflectMachine) - hide and unhide elements based on machine
*/
let unknownPaths = new Map(); // suppress repeated "no such path" errors

function reflectMachine() {
  if (! mc) { return; }
  const DM = "data-alt";
  const machineElems = document.querySelectorAll(`[${DM}]`);
  //  console.log(`machineElems = ${machineElems.length} items`);
  // hide all non-current alt children and unhide all other paths
  machineElems.forEach( e => {
    const mPath = e.getAttribute(DM);
    if (mPath) {
      if (! mc.exists(mPath) && ! unknownPaths.has(mPath)) {
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
  const state = mc.getState(mPath);
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
      const arr = chStr.split(',').map( elem => elem.trim() );
      // console.log(`arr = ${arr.join(",")}`);
      const result = mcCopy.interpret(arr);
      if (result) {
        console.log(`${e.tagName} ${DO}=${chStr}: ${result}`);
      } else {
        e.addEventListener('click', ev => {
          if (! mc) { return; }
          const result = mc.interpret(arr);
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
  if (! mc) { return; }
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
          if (ws) { ws.send(`command ${machine}\n${chStr}`); }
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
