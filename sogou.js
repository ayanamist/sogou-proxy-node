var serverTypes = {
    "edu": 16,
    "dxt": 16,
    "cnc": 4,
    "ctc": 4
};

var newAuthStr = function () {
    var authStr = "";
    for (var i = 0; i < 8; i += 1) {
        authStr += ("0000" + Math.floor(Math.random() * 65536).toString(16)).slice(-4).toUpperCase();
    }
    authStr += "/30/853edc6d49ba4e27";
    return authStr;
};

var newServerAddr = function (provider) {
    var totalServerNum = serverTypes[provider];
    if (typeof totalServerNum !== "number") {
        console.error("Unknown provider: " + provider);
    }
    return "h" + Math.floor(Math.random() * totalServerNum) + "." + provider + ".bj.ie.sogou.com";
};

var computeSogouTag = function (timestamp, hostname) {
    var s = timestamp + hostname + 'SogouExplorerProxy',
        sLen = s.length,
        numIter = Math.floor(sLen / 4),
        numRemain = sLen % 4,
        hash = sLen,  // output hash tag
        numLow,
        numHigh;

    for (var i = 0; i < numIter; i += 1) {
        numLow = s.charCodeAt(4 * i + 1) * 256 + s.charCodeAt(4 * i);  // right most 16 bits in little-endian
        numHigh = s.charCodeAt(4 * i + 3) * 256 + s.charCodeAt(4 * i + 2);  // left most

        hash += numLow;
        hash %= 0x100000000;
        hash ^= hash << 16;

        hash ^= numHigh << 11;
        hash += hash >>> 11;
        hash %= 0x100000000;
    }

    switch (numRemain) {
        case 3:
            hash += (s.charCodeAt(sLen - 2) << 8) + s.charCodeAt(sLen - 3);
            hash %= 0x100000000;
            hash ^= hash << 16;
            hash ^= s.charCodeAt(sLen - 1) << 18;
            hash += hash >>> 11;
            hash %= 0x100000000;
            break;
        case 2:
            hash += (s.charCodeAt(sLen - 1) << 8) + s.charCodeAt(sLen - 2);
            hash %= 0x100000000;
            hash ^= hash << 11;
            hash += hash >>> 17;
            hash %= 0x100000000;
            break;
        case 1:
            hash += s.charCodeAt(sLen - 1);
            hash %= 0x100000000;
            hash ^= hash << 10;
            hash += hash >>> 1;
            hash %= 0x100000000;
            break;
    }

    hash ^= hash << 3;
    hash += hash >>> 5;
    hash %= 0x100000000;

    hash ^= hash << 4;
    hash += hash >>> 17;
    hash %= 0x100000000;

    hash ^= hash << 25;
    hash += hash >>> 6;
    hash %= 0x100000000;

    // learnt from http://goo.gl/oRJ0o
    hash = hash >>> 0;

    return ('00000000' + hash.toString(16)).slice(-8);
};

var exports = exports || {};
exports.newAuthStr = newAuthStr;
exports.newServerAddr = newServerAddr;
exports.computeSogouTag = computeSogouTag;
