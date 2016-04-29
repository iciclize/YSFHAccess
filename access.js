var HOST = 'access.ysfh.black';
HOST = 'localhost';

var express = require('express');
var session = require('express-session');

var url = require('url');
var path = require('path');
var qs = require('querystring');
var request = require('request');
var http = require('http');
var URLValidator = require('valid-url');
var base64 = require('js-base64').Base64;
var cookie = require('cookie');

var HTMLCharset = require('html-charset');
var HTMLUrlConverter = require('./HTMLUrlConverter.js');
var CSSCharset = require('css-charset');
var CSSUrlConverter = require('./CSSUrlConverter.js');

var app = express();
var sessionValidator = require('ysfhcsine-validator')({
    noSession: function (req, res, next) {
        //res.redirect('http://csine.ysfh.black/login');
        next();
    },
    /*invalidSession: function (req, res, next) {
        
    }*/
});
var cookieParser = require('cookie-parser');

//app.use(cookieParser());
//app.use(sessionValidator);

app.all('/*', function (req, res) {
    var forwardURLPrefix = 'http://' + req.headers.host + '/';
    var proxyURL = req.url.substr(1);
	var forwardURL = getForwardURL(proxyURL, req, res);
    
    if (forwardURL) {
        bypass(req, res, forwardURLPrefix, forwardURL);
    } else {
        if (!res.headersSent) {
            res.writeHead(404);
            res.end('114514');
        }
    }
    
});

function getForwardURL(proxyURL, req) {
    var query = req.query;
    var referer = req.headers.referer;
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
    
    var forward = request({ uri: forwardURL, gzip: true});
    
    function allowAccess() {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Security-Policy', 'connect-src *');
    }
    
    function headerOverride(response) {
        for (var name in response.headers) {
            if (name.toLowerCase() == 'set-cookie') {
                var cookies = response.headers['set-cookie'] || [];
                cookies = cookies.map(function (item) {
                    
                    var pair = item.substring(0, item.indexOf(';')); 
                    var eq_idx = pair.indexOf('=');
                    if (eq_idx < 0) return;

                    var key = pair.substr(0, eq_idx).trim();
                    var val = pair.substr(++eq_idx, pair.length).trim();
                    if ('"' == val[0]) val = val.slice(1, -1);
                    val = decodeURIComponent(val);

                    var c = cookie.parse(item);
                    c.domain = HOST;
                    c.path = '/';
                    c.expires = null;
                    c.secure = false;
                    c.httpOnly = false;
                    c.firstPartyOnly = false;
                    
                    // TODO: keyに情報を持たせる
                    return cookie.serialize(key, val, c);
                });
                res.setHeader('set-cookie', cookies);
            } else {
                res.setHeader(name, response.headers[name]);
            }
        }
    }
    
    forward.on('response', function (response) {
        
        if (response.statusCode >= 300
        && response.statusCode < 400
        && response.headers.location) {
            console.log(JSON.stringify(response.headers));
            function convertToForwardURL(rawURL) {
                var _forwardURLObject = url.parse(forwardURL);
                if (URLValidator.isWebUri(rawURL)) return forwardURLPrefix + base64.encodeURI(rawURL);
                if (rawURL.substr(0, 2) == '//') return forwardURLPrefix + base64.encodeURI(_forwardURLObject.protocol + rawURL);
                
                return forwardURLPrefix + base64.encodeURI(url.resolve(_forwardURLObject.href, rawURL));
            }
            response.headers.location = convertToForwardURL(response.headers.location);
        }
        
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
            res.setHeader('Content-Type', documentRegexp[0] + '; charset=UTF-8');
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
