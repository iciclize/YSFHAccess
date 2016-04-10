var express = require('express');
var cookieParser = require('cookie-parser');

var url = require('url');
var path = require('path');
var qs = require('querystring');
var request = require('request');
var http = require('http');
var URLValidator = require('valid-url');
var base64 = require('js-base64').Base64;

var HTMLCharset = require('html-charset');
var HTMLUrlConverter = require('./HTMLUrlConverter.js');
var CSSCharset = require('css-charset');
var CSSUrlConverter = require('./CSSUrlConverter.js');

var app = express();
app.use(cookieParser());
app.get('/yjsnpi', function (req, res) {
    res.end('ERR_IKISUGI');
});
app.all('/:url', function (req, res) {
    var forwardURLPrefix = 'http://' + req.headers.host + '/';
    var proxyURL = req.params.url;
	var forwardURL = getForwardURL(proxyURL, req.query, req.headers.referer);
    
    if (forwardURL) {
        bypass(req, res, forwardURLPrefix, forwardURL);
    } else {
        res.writeHead(404);
        res.end('114514');
    }
    
});

function getForwardURL(proxyURL, query, referer) {
    if (typeof proxyURL != 'string') return null;
    
    var forwardURL = (function () {
        var forwardURL = proxyURL;
        if (forwardURL.match(/\./g)) return forwardURL;
        forwardURL = base64.decode(forwardURL);
        if (URLValidator.isWebUri(forwardURL)) return forwardURL;
        return proxyURL;
    })();
    
    var querystrings = qs.stringify(query);
    forwardURL += (querystrings) ? '?' + querystrings : '';
    
    if (referer) {
        if (forwardURL.substr(0, 4) != 'http') {
            var refererObject = url.parse(referer);
            var refererURL = base64.decode(refererObject.pathname.substr(1)) + ((refererObject.query) ? '?' + refererObject.query : '');
            refererObject = url.parse(refererURL);
            forwardURL = url.resolve(refererObject.protocol + '//' + refererObject.host, forwardURL);
        }
    }

    if (URLValidator.isWebUri(forwardURL)) return forwardURL;
    
    return null;
}

function bypass(req, res, forwardURLPrefix, forwardURL) {
    
    var forward = request({ uri: forwardURL, gzip: true });
    
    function allowAccess() {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Security-Policy', 'connect-src *');
    }
    
    function headerOverride(response) {
        for (var name in response.headers)
            res.setHeader(name, response.headers[name]);
    }
    
    forward.on('response', function (response) {
        
        if (res.headersSent) {
            forwardResponse.pipe(res);
            return;
        }
        
        headerOverride(response);
        allowAccess();
        
        var contentType = response.headers['content-type'] || '';
        
        var documentRegexp = /(text\/html|text\/css)/.exec(contentType);
        if (documentRegexp) {
            res.removeHeader('Content-Length');
            res.removeHeader('Content-Encoding');
            res.setHeader('Transfer-Encoding', 'chunked');
            
            var charsetConverter, urlConverter;
            
            if (documentRegexp[0] == 'text/html') {
                charsetConverter = HTMLCharset(contentType);
                urlConverter = HTMLUrlConverter(forwardURLPrefix, forwardURL);
            } else {
                charsetConverter = CSSCharset(contentType);
                urlConverter = CSSUrlConverter(forwardURLPrefix, forwardURL);    
            }
            
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

app.listen(3015);
