var url = require('url');
var path = require('path');
var request = require('request');
var http = require('http');
var URLValidator = require('valid-url');
var base64 = require('js-base64').Base64;

var HTMLCharset = require('html-charset');
var HTMLUrlConverter = require('./HTMLUrlConverter.js');
var CSSCharset = require('css-charset');
var CSSUrlConverter = require('./CSSUrlConverter.js');

var server = http.createServer();

server.on('request', function (req, res) {
    var proxyHost = req.headers.host;
    var proxyURL = req.url;
	var forwardURL = getForwardURL(proxyURL, req.headers.referer);
    
    if (forwardURL) {
        bypass(req, res, proxyHost, forwardURL);
    } else {
        res.writeHead(404);
        res.end('114514');
    }
    
});

function getForwardURL(proxyURL, referer) {
    if (typeof proxyURL != 'string') return null;
    
    var forwardURL = (function () {
        var forwardURL = proxyURL.substr(1);
        if (forwardURL.match(/\./g)) return forwardURL;
        
        var exclamationIndex = forwardURL.indexOf('?');
        if (exclamationIndex == -1) return base64.decode(forwardURL);
        
        return base64.decode(forwardURL.substr(0, exclamationIndex)) + forwardURL.substr(exclamationIndex);
    })();
    
    if (referer) {
        if (forwardURL.substr(0, 4) != 'http') {
            var refererObject = url.parse(referer);
            var refererURL = base64.decode(refererObject.path.substr(1));
            refererObject = url.parse(refererURL);
            forwardURL = url.resolve(refererObject.protocol + '//' + refererObject.host, forwardURL);
        }
    }

    if (URLValidator.isWebUri(forwardURL)) return forwardURL;
    
    return null;
}

function bypass(req, res, proxyHost, forwardURL) {
    
    var forward = request({ uri: forwardURL, gzip: true });
    
    function initPiping() {
        res.removeHeader('Content-Length');
        res.removeHeader('Content-Encoding');
        res.setHeader('Transfer-Encoding', 'chunked');
    }
    
    function allowAccess() {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Security-Policy', 'connect-src *');
    }
    
    forward.on('response', function (response) {
        
        if (res.headersSent) {
            forwardResponse.pipe(res); return;
        }
        
        for (var name in response.headers) {
            res.setHeader(name, response.headers[name]);
        }
        
        allowAccess();
        
        var contentType = response.headers['content-type'] || '';
        
        if (contentType.match('text/html')) {
            initPiping();
            var charsetConverter = HTMLCharset(contentType);
            var urlConverter = HTMLUrlConverter(proxyHost, forwardURL);
            forward.pipe(charsetConverter).pipe(urlConverter).pipe(res);
        } else if (contentType.match('text/css')) {
            initPiping();
            var charsetConverter = CSSCharset(contentType);
            var urlConverter = CSSUrlConverter(proxyHost, forwardURL);
            forward.pipe(charsetConverter).pipe(urlConverter).pipe(res);
        } else {
            response.pipe(res);
        }
        
    });
    
    forward.on('error', function (err) {
        console.log(err);
    });
    
    req.pipe(forward);
}

server.listen(3015);
