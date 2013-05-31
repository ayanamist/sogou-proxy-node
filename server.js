#!/usr/bin/env node

/*
 * Allow you smoothly surf on many websites blocking non-mainland visitors.
 * Copyright (C) 2012 Bo Zhu http://zhuzhu.org
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
var fs = require("fs"),
    http = require("http"),
    path = require("path"),
    url = require("url"),
    util = require("util"),

    sogou = require(path.resolve(__dirname, "./sogou"));

var localAddr = "0.0.0.0",
    localPort = 8083,
    sogouAuthStr = sogou.newAuthStr(),
    sogouServerAddr = sogou.newServerAddr("edu"),
    logFile = fs.createWriteStream(__dirname + "/error.log", {flags: "a"}),
    proxyServer = http.createServer();


var patchIncomingMessage = function (prototype) {
    var _addHeaderLine = prototype._addHeaderLine;

    //Patch ServerRequest to save unmodified copy of headers
    prototype._addHeaderLine = function (field, value) {
        var list = this.complete ?
            (this.allTrailers || (this.allTrailers = [])) :
            (this.allHeaders || (this.allHeaders = []));
        list.push(field + ': ' + value);
        _addHeaderLine.call(this, field, value);
    };
};

var newProxyRequest = function (request, response) {
    console.log(request.method + " " + request.url);

    var reqHost = request.headers.host;
    if (typeof reqHost === "undefined") {
        if (request.method.toUpperCase() === "CONNECT") {
            reqHost = url.parse("http://" + request.url).host;
        }
        else {
            reqHost = url.parse(request.url).host;
        }
        if (typeof reqHost === "undefined") {
            reqHost = "";
        }
        else {
            request.headers.host = reqHost;
        }
    }

    var requestOptions = {
            hostname: sogouServerAddr,
            host: reqHost,
            port: 80,
            path: request.url,
            method: request.method,
            headers: request.headers
        },
        timestamp = Date.now().toString(16),
        sogou_tag = sogou.computeSogouTag(timestamp, reqHost);

    requestOptions.headers["X-Sogou-Auth"] = sogouAuthStr;
    requestOptions.headers["X-Sogou-Timestamp"] = timestamp;
    requestOptions.headers["X-Sogou-Tag"] = sogou_tag;

    var proxyRequest = http.request(requestOptions);
    proxyRequest.on("error", function (err) {
        if (err.code === "ETIMEDOUT") {
        }
        else {
            console.error("proxyRequest:" + err.stack);
        }
        response.emit("end");
    });

    return proxyRequest;
};

proxyServer.on("error", function (err) {
    if (err.code === "EADDRINUSE") {
        console.error("Address in use, retrying...");
        setTimeout(function () {
            proxyServer.emit("end");
            proxyServer.listen(localPort, localAddr);
        }, 1000);
    }
    else {
        throw err;
    }
});

proxyServer.on("request", function (cltRequest, cltResponse) {
    var srvRequest = newProxyRequest(cltRequest, cltResponse);

    srvRequest.on("response", function (srvResponse) {
        cltResponse.on("error", function (err) {
            if (err.code === "ECONNRESET" || err.code === "ECONNABORTED") {
            }
            else {
                console.error("cltResponse:" + err.stack);
            }
            cltResponse.emit("close");
        });

        srvResponse.on("error", function (err){
            if (err.code === "ECONNRESET" || err.code === "ECONNABORTED") {
            }
            else {
                console.error("srvResponse:" + err.stack);
            }
            cltResponse.emit("close");
        });
        cltResponse.on("close", function () {
            // srvResponse.end method does not exist!
            srvResponse.emit("end");
        });
        srvResponse.on("close", function () {
            cltResponse.emit("end");
        });
        // nodejs will make all names of http headers lower case, which breaks many old clients.
        // Should not directly manipulate socket, because cltResponse.socket will sometimes become null.
        var rawHeader = {};
        srvResponse.allHeaders.map(function (header) {
            // We don't need to validate split result, since nodejs has guaranteed by valid srvResponse.headers.
            var key = header.split(":")[0].trim();
            rawHeader[key] = srvResponse.headers[key.toLowerCase()];
        });
        cltResponse.writeHead(srvResponse.statusCode, rawHeader);
        srvResponse.pipe(cltResponse);
    });
    cltRequest.pipe(srvRequest);
});

proxyServer.on("connect", function (cltRequest, cltSocket) {
    var srvRequest = newProxyRequest(cltRequest, cltSocket);

    srvRequest.end();
    srvRequest.on("connect", function (srvResponse, srvSocket) {
        cltSocket.on("error", function (err) {
            if (err.code === "ECONNRESET" || err.code === "ECONNABORTED") {
            }
            else {
                console.error("cltSocket:" + err.stack);
            }
            cltSocket.emit("close");
        });
        srvSocket.on("error", function (err) {
            if (err.code === "ECONNRESET" || err.code === "ECONNABORTED") {
            }
            else {
                console.error("srvSocket:" + err.stack);
            }
            srvSocket.emit("close");
        });
        cltSocket.on("close", function () {
            srvSocket.emit("end");
        });
        srvSocket.on("close", function () {
            cltSocket.emit("end");
        });
        cltSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        srvSocket.pipe(cltSocket);
        cltSocket.pipe(srvSocket);
    });
});

process.__defineGetter__("stderr", function () {
        return logFile;
    }
);
process.on("uncaughtException", function (err) {
    var errMsg = "Uncaught:" + err.stack + "\n" + util.inspect(err);
    console.log(errMsg);
    console.error(errMsg);
});


http.globalAgent.maxSockets = 128;
patchIncomingMessage(http.IncomingMessage.prototype);

proxyServer.listen(localPort, localAddr);

