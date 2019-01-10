function boot() {
  const urlPath = window.location.pathname;
  console.log(`urlPath=${urlPath}`);
  let ws = new WebSocket(`ws://localhost:8000${urlPath}`);
  ws.addEventListener('open', function(ev) {
    console.log(`websocket is open: protocol = ${ws.protocol}`);
  });
  ws.addEventListener('close', function(ev) {
    console.log('websocket closed by server');
  });
  ws.addEventListener('error', function(ev) {
    console.log(`websocket error: ${JSON.stringify(ev)}`);
  });
  ws.addEventListener('message', function(ev) {
    console.log(`websocket message: ${JSON.stringify(ev)}`);
  });
}
window.onload = boot;
