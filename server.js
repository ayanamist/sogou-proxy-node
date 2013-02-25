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
var url = require("url");

var sogou = require("./sogou");

var localAddr = '0.0.0.0',
    localPort = 8083,
    sogouAuthStr = sogou.newAuthStr(),
    sogouServerAddr = sogou.newServerAddr("edu");

var proxyServer = http.createServer();

var newProxyRequestOptions = function(request) {
    var reqHost = request.headers.host;
    if (typeof reqHost === "undefined") {
        if (request.method.toUpperCase() === "CONNECT") {
            reqHost = url.parse("http://" + request.url).host;
        }
        else {
            reqHost = url.parse(request.url).host;
        }
        if (typeof reqHost === "undefined") {
            return {};
        }
        request.headers.host = reqHost;
    }

    var requestOptions = {
            hostname: sogouServerAddr,
            host: reqHost,
            port: 80,
            path: request.url,
            method: request.method,
            headers: request.headers
        },
        timestamp = Math.round((new Date()).getTime() / 1000).toString(16),
        sogou_tag = sogou.computeSogouTag(timestamp, reqHost);

    requestOptions.headers['X-Sogou-Auth'] = sogouAuthStr;
    requestOptions.headers['X-Sogou-Timestamp'] = timestamp;
    requestOptions.headers['X-Sogou-Tag'] = sogou_tag;
    return requestOptions;
};

proxyServer.on("request", function (cltRequest, cltResponse) {
    var srvRequestOptions = newProxyRequestOptions(cltRequest);
    if ( ! Object.keys(srvRequestOptions).length) {
        cltResponse.writeHead(400);
        cltResponse.end("Request HTTP Header \"Host\" missing!");
        return;
    }

    var srvRequest = http.request(srvRequestOptions);
    srvRequest.on("error", function(err){
        console.error('Proxy Error: ' + err.message);
    });
    srvRequest.on("response", function (srvResponse) {
        cltResponse.writeHead(srvResponse.statusCode, srvResponse.headers);
        srvResponse.pipe(cltResponse);
    });
    cltRequest.pipe(srvRequest);
});

proxyServer.on("connect", function(cltRequest, cltSocket){
    var srvRequestOptions = newProxyRequestOptions(cltRequest);
    if ( ! Object.keys(srvRequestOptions).length) {
        cltSocket.end("HTTP/1.1 400 Bad Request\r\n\r\nRequest HTTP Header \"Host\" missing!");
        return;
    }
    var srvRequest = http.request(srvRequestOptions);
    srvRequest.end();
    srvRequest.on("error", function(err){
        console.error('Proxy Error: ' + err.message);
    });
    srvRequest.on("connect", function(srvResponse, srvSocket){
        cltSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        srvSocket.pipe(cltSocket);
        cltSocket.pipe(srvSocket);
    });
});

proxyServer.listen(localPort, localAddr);

