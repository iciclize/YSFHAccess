var url = require('url');
var path = require('path');
var request = require('request');
var http = require('http');
var URLValidator = require('valid-url');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');
var characterDetector = require('jschardet');
var base64 = require('js-base64').Base64;

var server = http.createServer();

server.on('request', function (req, res) {
    var proxyHost = req.headers.host;
    var proxyURL = req.url;
	var forwardURL = getForwardURL(req, proxyURL);
    if (forwardURL == null) {
        res.writeHead(404);
        res.end('114514');
    } else {
        bypassResource(req, res, forwardURL);
    }
});

function getForwardURL(req, proxyURL) {
    if (typeof proxyURL != 'string') return null;
    var forwardURL = (function () {
        var forwardURL = proxyURL.substr(1);
        if (forwardURL.match(/\./g)) return forwardURL;
        var exclamationIndex = forwardURL.indexOf('?');
        if (exclamationIndex == -1) {
            return base64.decode(forwardURL);
        } else {
            return base64.decode(forwardURL.substr(0, exclamationIndex)) + forwardURL.substr(exclamationIndex);
        }
    })();
    if (req.headers.referer) {
        if (forwardURL.substr(0, 4) != 'http') {
            var refererObject = url.parse(req.headers.referer);
            var refererURL = base64.decode(refererObject.path.substr(1));
            refererObject = url.parse(refererURL);
            forwardURL = url.resolve(refererObject.protocol + '//' + refererObject.host, forwardURL);
        }
    }
    
    if (URLValidator.isWebUri(forwardURL)) {
		return forwardURL;
	} else {
		return null; // Error('The parameter "' + forwardURL  + '" is not web uri.');
	}
}

function mustBeReplaced(contentType) {
    if (typeof contentType != 'string') return false;
    return [
        contentType.match('text/html'),
        contentType.match('text/css')
    ].some(function (match) {
        return match != null;
    });
}

function bypassResource(req, res, forwardURL) {
    /*
    var options = {
		method: req.method,
		uri: forwardURL,
        encoding: null,
        headers: {
            'Content-Type': req.headers['content-type'],
            'User-Agent': req.headers['user-agent'],
            'cookie': req.headers['cookie']
        },
        body: req
	};
	var forward = request(options, function onResponseEnd(error, response, body) {
        if (error) { console.error(error); return }
        var convertedText = '';
        var contentType = response.headers['content-type'] || '';
        if (contentType.match('text/html')) {
            body = iconv.decode(body, characterDetector.detect(body).encoding || 'utf-8');
            convertedText = convertURLOnHTML(req.headers.host, url.parse(forwardURL), body);
        } else if (contentType.match('text/css')) {
            body = iconv.decode(body, characterDetector.detect(body).encoding || 'utf-8');
            convertedText = convertURLOnCSS(req.headers.host, url.parse(forwardURL), body);
        }
        
        if (convertedText) {
            if (!res.headersSent) {
                res.setHeader('Content-Length', Buffer.byteLength(convertedText, 'binary'));
            }
			res.end(convertedText);
		}
    });
    
	forward.on('response', function onReceiveResponse(response) {
		var contentType = response.headers['content-type'] || '';
        for (var name in response.headers) res.setHeader(name, response.headers[name]);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Security-Policy', 'connect-src *');
        
        if (!mustBeReplaced(contentType)) {
            forward.pipe(res);
        }
	});
    */
    var forward = request({uri: forwardURL});
    forward.on('request', function () {
        console.log('request: ', arguments);
    });
    forward.on('response', function () {
        console.log('response: ', arguments);
    });
    forward.on('data', function () {
        console.log('data: ', arguments);
    });
    forward.on('end', function () {
        console.log('DONE');
    });
    forward.on('error', function () {
        console.log('error: ', arguments);
    });
    
    req.pipe(forward).pipe(res);
    
}

var clientCodes = require('./clientCodeFactory');


function convertURLOnHTML(proxyHost, forwardURLObject, htmlDoc) {
    
    function replaceURLAnyway(html) {
        var document = '';
        var currentIndex = 0;
        while (currentIndex < html.length) {
            var tagStartIndex = html.indexOf('<', currentIndex);
            if (tagStartIndex != -1) {
                document += html.substring(currentIndex, tagStartIndex);
                currentIndex = tagStartIndex + 1;
                var tag = '';
                var tagEndIndex = html.indexOf('>', currentIndex);
                if (tagEndIndex != -1) {
                    tag = html.substring(tagStartIndex, tagEndIndex + 1);
                    currentIndex = tagEndIndex + 1;
                    document += tag.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g, function (value) {
                        return forwardURLPrefix + base64.encodeURI(value);
                    });
                } else {
                    document += html.substr(currentIndex);
                }
            } else {
                document += html.substr(currentIndex);
                currentIndex = html.length;
            }
        }
        return document;
    }
    
    function getURLPropertyName(tagName) {
        switch (tagName) {
            case 'a':
            case 'area':
            case 'base':
            case 'link':
            case 'button':
                return ['href'];
                break;
                
            case 'script':
            case 'embed':
                return ['src'];
                break;
                
            case 'iframe':
            case 'frame':
                return ['src', 'longdsec'];
                break;
                
            case 'img':
                return ['src', 'longdesc', 'usemap'];
                break;
                
            case 'input':
                return ['usemap'];
                break;
                
            case 'form':
                return ['action'];
                break;
                
            case 'body':
                return ['background'];
                break;
                
            case 'blockquote':
            case 'q':
            case 'ins':
            case 'del':
                return ['cite'];
                break;
                
            case 'object':
                return ['classid', 'codebase', 'data', 'usemap'];
                break;
                
            case 'applet':
                return ['code', 'codebase'];
                break;
                
            case 'head':
                return ['profile'];
                break;
             
             default:
                return [];
                break;
        }
    }
    
	var forwardURLPrefix = 'http://' + proxyHost + '/';
    var clientScript = clientCodes.defineSetter + '\n' + clientCodes.base64URLEncoder + '\n' + clientCodes.overrideXHR(forwardURLPrefix);
    var html = replaceURLAnyway(htmlDoc);
    
    var $ = cheerio.load(html);
    $('head').prepend($('<script>').text(clientScript));
    $('a, link, button, embed, script, img, iframe, frame, form, body').each(function () {
        var props = getURLPropertyName(this.tagName);
        for (var i = 0; i < props.length; i++) {
            var prop = props[i];
            if (!this.attribs[prop]) return;
            var value = this.attribs[prop].trim();
            if (URLValidator.isWebUri(value)) {
                this.attribs[prop] = forwardURLPrefix + base64.encodeURI(value);
            } else {
                if (value[0] == '#') return;
                if (value.substr(0, 10) == 'javascript') return;
                if (value.substr(0, 2) == '//')
                    this.attribs[prop] = forwardURLPrefix + base64.encodeURI(forwardURLObject.protocol + value);
                else
                    this.attribs[prop] = forwardURLPrefix + base64.encodeURI(url.resolve(forwardURLObject.href, value));
            }
        }
    });
    $('style').each(function () {
        $(this).text(convertURLOnCSS(proxyHost, forwardURLObject, $(this).text()));
    });
    
	return $.html();
}

function convertURLOnCSS(proxyHost, forwardURLObject, css) {
    var forwardURLPrefix = 'http://' + proxyHost + '/';
    var reg = /url\((['"])?([^']*?)(['"])?\)/g;
    css = css.replace(reg, function (entireCssURL, quoteStart, cssURL, quoteEnd) {
        quoteStart = quoteStart || '';
        quoteEnd = quoteEnd || '';
        var forwardCssURL = '';
        if (URLValidator.isWebUri(cssURL)) {
            forwardCssURL = 'url(' + quoteStart + forwardURLPrefix + base64.encodeURI(cssURL) + quoteEnd + ')';
        } else {
            if (cssURL.substr(0, 5) == 'data:') {
                forwardCssURL = 'url(' + quoteStart + cssURL + quoteEnd + ')';  
            } else if (cssURL.substr(0, 2) == '//') {
				forwardCssURL = 'url(' + quoteStart + forwardURLPrefix + base64.encodeURI(forwardURLObject.protocol + cssURL) + quoteEnd + ')';
			} else {
				forwardCssURL = 'url(' + quoteStart + forwardURLPrefix + base64.encodeURI(url.resolve(forwardURLObject.href, cssURL)) + quoteEnd + ')';
			}
        }
        return forwardCssURL;
    });
    return css;
}

server.listen(3015);
