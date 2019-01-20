window.onload = boot;

// let machine = new Machine;

function boot() {
  upgradeToWebsocket();
}

function upgradeToWebsocket() {
  const urlPath = window.location.pathname;
  console.log(`urlPath=${urlPath}`);
  let ws = new WebSocket(`ws://localhost:8000${urlPath}`);
  ws.addEventListener('open', function(ev) {
    console.log(`websocket is open; sending hello`);
    ws.send('hello');
  });
  ws.addEventListener('close', function(ev) {
    console.log('websocket closed by server');
  });
  ws.addEventListener('error', function(ev) {
    console.log(`websocket error: ${JSON.stringify(ev)}`);
  });
  ws.addEventListener('message', function(ev) {
    console.log(`websocket message: ${ev.data}`);
  });
}
