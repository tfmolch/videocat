var WebSocketServer = require("ws").Server
var http = require("http")
var express = require("express")
var app = express()
var port = process.env.PORT || 5000

app.use(express.static(__dirname + "/"))

var server = http.createServer(app)
server.listen(port)

console.log("http server listening on %d", port)

var wss = new WebSocketServer({server: server})
console.log("websocket server created")

var connectionList = [];

wss.on("connection", function(ws) {
    console.log("connection");
  connectionList.push(ws);
})

wss.on("message", function(data, id) {
    var mes = server.unmaskMessage(data);
    var str = server.convertToString(mes.message);
    console.log(str);
    var i;
    for(i = 0; i < connectionList.lenth; i++) {
         wss.sendMessage(one, str, connectionList[i]);
    }
});
