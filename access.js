
/**
 * access.js
 */

var PORT = 3015;
var REDIRECT_URL = 'http://ysfh.black/login/';

if (process.env.DEV) {
    REDIRECT_URL = 'http://192.168.11.4:3030';
}

function dev(mes) { if (process.env.DEV) console.log(mes); }


var ECT = require('ect');
var ectRenderer = ECT({ watch: true, root: __dirname + '/private', ext : '.ect' });

var express = require('express');

var url = require('url');
var path = require('path');
var request = require('request');
var http = require('http');
var URLValidator = require('valid-url');
var base64 = require('js-base64').Base64;
var cookie = require('tough-cookie');

var HTMLCharset = require('html-charset');
var HTMLUrlConverter = require('./HTMLUrlConverter.js');
var CSSCharset = require('css-charset');
var CSSUrlConverter = require('./CSSUrlConverter.js');
var JavascriptRemover = require('./JavascriptRemover');

var lookupReferer = require('./refererDictionary.js');
var forwardURLOverride = require('./forwardURLOverride.js');


var app = express();
app.engine('ect', ectRenderer.render);
app.set('views', __dirname + '/private');
app.set('view engine', 'ect');

var sessionValidator = require('ysfhcsine-validator')({
    noSession: function (req, res, next) {
        res.redirect(REDIRECT_URL);
    },
    invalidSession: function (req, res, next) {
        res.redirect(REDIRECT_URL);
    }
});
var cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(sessionValidator);
app.use(function (req, res, next) {
    if (req.cookies.js_disabled) 
        if (req.cookies.js_disabled.toLowerCase() == 'true')
            req.cookies.js_disabled = true;
        else
            req.cookies.js_disabled = false;

    next();
});

app.get('/favicon.ico', function (req, res) {
    res.sendFile(__dirname + '/private/favicon.ico');
})

app.use('/ysfhaccess', express.static(__dirname + '/private'));
app.get('/ysfhview/*', function (req, res, next) {
    res.render('viewer', {
        title: '読み込み中...',
        url: req.url.replace('/ysfhview', ''),
        isJSDisabled: (req.cookies.js_disabled) ? true : false
    });
});

app.all('/*', function (req, res) {
    var forwardURLPrefix = 'http://' + req.headers.host + '/';
    var proxyURL = req.url.substr(1);
	var forwardURL = getForwardURL(proxyURL, req.headers.referer);
    
    if (forwardURL) {
        bypass(req, res, forwardURLPrefix, forwardURL);
    } else {
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.writeHead(404);
            res.end('<img src="/ysfhaccess/access.svg"><h1>URLがダメみたいですね…</h1>');
        }
    }
    
});

function getForwardURL(proxyURL, referer) {
    if (typeof proxyURL != 'string') return null;
    if (referer) referer = referer.replace('/ysfhview', '').replace('/ysfhaccess', '');

    var isRefererCorrected = false;
    
    var forwardURL = (function () {
        
        var forwardPath = '';
        var querystrings = '';
        
        /** 
         * 定義したパターンにproxyURLを当てはめることで、
         * Base64エンコードされていないかつ不完全なURLの、
         * refererを訂正して正しく中継されるようにする
         */
        var correctReferer = lookupReferer(proxyURL);
        if (correctReferer) {
            referer = 'http://example.com/' + base64.encodeURI(correctReferer);
            isRefererCorrected = true;
            return proxyURL;
        }
        
        /**
         * URLに?が含まれていた場合、
         * ?より後はクエリストリングなのでその部分はBase64デコードしない
         */
        var exclamationIndex = proxyURL.indexOf('?');
        if (exclamationIndex == -1) {
            forwardPath = proxyURL;            
        } else {
            forwardPath = proxyURL.substring(0, exclamationIndex);
            querystrings = proxyURL.substr(exclamationIndex);
        }
        
        /**
         * Base64エンコードされたURLにドットが入り込むことは無いので、
         * もしドットが含まれていた場合、
         * それはBase64エンコードされていないURLだから、
         * デコードせずにそのまま返す
         */
        if (forwardPath.match(/\./g)) return forwardPath + querystrings;
        
        return base64.decode(forwardPath) + querystrings;
    })();
    
    if (!isRefererCorrected) {
        /** 
         * refererが訂正されていなかった場合、
         * デコード済みのforwardURLで再びlookupRefererを実行して,
         * refererを訂正する
         */
        var correctReferer = lookupReferer(forwardURL); 
        if (correctReferer) referer =  'http://example.com/' + base64.encodeURI(correctReferer);
    }
    
    
    /**
     * 要求先のURLがhttpで始まっていない場合それはURLの一部だから、
     * refererの情報を使って正しいURLに直す
     */
    if (forwardURL.substr(0, 4) != 'http') {
        
        if (referer) {
            var refererObject = url.parse(referer);
            var refererURL = base64.decode(refererObject.path.substr(1));
            refererObject = url.parse(refererURL);
            forwardURL = url.resolve(refererObject.protocol + '//' + refererObject.host, forwardURL);
        }
    }
    
    forwardURL = forwardURLOverride(forwardURL);
    if (URLValidator.isWebUri(forwardURL)) return forwardURL;
    
    return null;
}

function bypass(req, res, forwardURLPrefix, forwardURL) {
    var forwardURLObject = url.parse(forwardURL);
    
    function overrideClientCookie(req) {
        if (!req.cookies) return;
        req.headers.cookie = '';
        for (var key in req.cookies) {
            var value = req.cookies[key];
            
            if (key.substr(0, 4) === 'ysfh') {
                var ysfhcookie = (function parseYSFHCookie(key) {
                    var headerbody = key.substr(4);
                    var lengths = headerbody.split('_');
                    var domainlen = parseInt(lengths[0]);
                    var pathlen = parseInt(lengths[1]);
                    var namelen = parseInt(lengths[2]);
                    var body = lengths.slice(3).reduce(function (a, b) {
                        return a.toString() + '_' + b.toString();
                    });
                    
                    var domain = body.substr(0, domainlen);
                    var path = body.substr(domainlen, pathlen);
                    var name = body.substr(domainlen + pathlen, namelen);
                    
                    return {
                        domain: domain,
                        path: path,
                        name: name
                    };
                }(key));
                
                if (cookie.domainMatch(forwardURLObject.hostname, ysfhcookie.domain)) {
                    req.headers.cookie += ysfhcookie.name + '=' + value + '; ';
                }
            } else {
                req.headers.cookie += key + '=' + value + '; ';
            }
            
        }
    }
    
    function overrideReferer(req) {
        if (!req.headers.referer) return;
        req.headers.referer = req.headers.referer.replace('/ysfhview', '').replace('/ysfhaccess', '');
        var refererObject = url.parse(req.headers.referer);
        refererObject.search = (refererObject.search) ? refererObject.search : '' ; 
        req.headers.referer = base64.decode(refererObject.pathname.substr(1)) + refererObject.search;
    }
    
    /**
     * originヘッダをrefererヘッダのホストで上書きする
     */
    function overrideOrigin(req) {
        if (!req.headers.origin) return;
        if (!req.headers.referer) return;
        // リファラが正しい物に上書きされていることが前提
        var originURLObject = url.parse(req.headers.referer);
        req.headers.origin = originURLObject.protocol + '//' + originURLObject.host;
    }
    
    function noChace(req) {
        req.headers['Pragma'] = 'no-cache';
        req.headers['Cache-Control'] = 'no-cache';
    }
    
    /**
     * ヘッダ上書きの順番に注意すること
     */
    overrideClientCookie(req);
    overrideReferer(req);
    overrideOrigin(req);
    noChace(req);
    
    var forward = request({ uri: forwardURL, gzip: true});
    
    
    function allowAccess() {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Security-Policy', 'connect-src *');
        res.removeHeader('X-Frame-Options');
    }
    
    function headerOverride(response, hostname) {
        for (var name in response.headers) {
            if (name.toLowerCase() == 'set-cookie') {
                var cookies = response.headers['set-cookie'] || [];
                cookies = cookies.map(function (item) {
                    
                    /**
                     * モジュール cookie の実装からコピーしてきた
                     */
                    var parsedCookie = (function parseCookie(item) {
                            
                        var pair = item.substring(0, item.indexOf(';')); 
                        var eq_idx = pair.indexOf('=');
                        if (eq_idx < 0) return;

                        var key = pair.substr(0, eq_idx).trim();
                        var val = pair.substr(++eq_idx, pair.length).trim();
                        if ('"' == val[0]) val = val.slice(1, -1);
                        
                        return {key: key, value: val};
                    }(item));
                    
                    var key = parsedCookie.key;
                    var val = parsedCookie.value;

                    var c = cookie.parse(item);
                    
                    c.domain = c.domain || forwardURLObject.hostname;
                    c.path = c.path || '/';
                    
                    var modifiedCookieName =
                        'ysfh{domainlen}_{pathlen}_{namelen}_{domain}{path}{name}'
                        .replace('{domainlen}', c.domain.length)
                        .replace('{pathlen}', c.path.length)
                        .replace('{namelen}', key.length)
                        .replace('{domain}', c.domain)
                        .replace('{path}', c.path)
                        .replace('{name}', key);
                    
                    c.key = modifiedCookieName;
                    c.domain = hostname;
                    c.path = '/';
                    c.expires = null;
                    c.secure = false;
                    c.httpOnly = false;
                    c.hostOnly = false;
                    
                    return c.cookieString();
                });
                res.setHeader('set-cookie', cookies);
            } else {
                res.setHeader(name, response.headers[name]);
            }
        }
    }
    
    forward.on('response', function (response) {
        
        /**
         * リダイレクトの場合、参照先のURLを書き換える
         */
        if (response.statusCode >= 300
        && response.statusCode < 400
        && response.headers.location) {
            function convertToForwardURL(rawURL) {
                var _forwardURLObject = url.parse(forwardURL);
                if (URLValidator.isWebUri(rawURL)) return forwardURLPrefix + base64.encodeURI(rawURL);
                if (rawURL.substr(0, 2) == '//') return forwardURLPrefix + base64.encodeURI(_forwardURLObject.protocol + rawURL);
                
                return forwardURLPrefix + base64.encodeURI(url.resolve(_forwardURLObject.href, rawURL));
            }
            response.headers.location = convertToForwardURL(response.headers.location);
            res.status(response.statusCode);
        }
        
        if (res.headersSent) {
            forwardResponse.pipe(res);
            return;
        }
        
        headerOverride(response, req.hostname);
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
                if (req.cookies.js_disabled) {
                    var javascriptRemover = JavascriptRemover();
                    forward.pipe(charsetConverter).pipe(javascriptRemover).pipe(urlConverter).pipe(res);
                } else {
                    forward.pipe(charsetConverter).pipe(urlConverter).pipe(res);
                }
            } else {
                charsetConverter = CSSCharset(contentType);
                urlConverter = CSSUrlConverter(forwardURLPrefix, forwardURL);
                forward.pipe(charsetConverter).pipe(urlConverter).pipe(res);    
            }
            
        } else {
            response.pipe(res);
        }
        
    });
    
    forward.on('error', function (err) {
        console.log(err);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.write('<h1>URLがちょっと歯当たんよ〜</h1>');
        res.end('<pre>' + err.stack + '</pre>');
    });
    
    req.pipe(forward);
}

app.listen(PORT, function () {
	console.log( ( (process.env.DEV) ? '[Developing]' : '[Production]') + ' YSFH Access - listening on port ' + PORT + '.');
});
