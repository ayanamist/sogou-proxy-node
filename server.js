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
var http = require("http");
var path = require("path");
var url = require("url");

var sogou = require(path.resolve(__dirname, "./sogou"));

var localAddr = '0.0.0.0',
    localPort = 8083,
    sogouAuthStr = sogou.newAuthStr(),
    sogouServerAddr = sogou.newServerAddr("edu"),
    proxyServer = http.createServer();

var newProxyRequest = function (request) {
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

    requestOptions.headers['X-Sogou-Auth'] = sogouAuthStr;
    requestOptions.headers['X-Sogou-Timestamp'] = timestamp;
    requestOptions.headers['X-Sogou-Tag'] = sogou_tag;

    var proxyRequest = http.request(requestOptions);
    proxyRequest.on("error", function (err) {
        console.error('Proxy Error: ' + err.message);
    });

    return proxyRequest;
};

proxyServer.on('error', function (err) {
    if (err.code == 'EADDRINUSE') {
        console.warn('Address in use, retrying...');
        setTimeout(function () {
            proxyServer.close();
            proxyServer.listen(localPort, localAddr);
        }, 1000);
    }
});

proxyServer.on("request", function (cltRequest, cltResponse) {
    var srvRequest = newProxyRequest(cltRequest);

    srvRequest.on("response", function (srvResponse) {
        cltResponse.on("close", function () {
            srvResponse.end();
        });
        cltResponse.writeHead(srvResponse.statusCode, srvResponse.headers);
        srvResponse.pipe(cltResponse);
    });
    cltRequest.pipe(srvRequest);
});

proxyServer.on("connect", function (cltRequest, cltSocket) {
    var srvRequest = newProxyRequest(cltRequest);

    srvRequest.end();
    srvRequest.on("connect", function (srvResponse, srvSocket) {
        cltSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        srvSocket.pipe(cltSocket);
        cltSocket.pipe(srvSocket);
    });
});

http.globalAgent.maxSockets = 128;
proxyServer.listen(localPort, localAddr);

