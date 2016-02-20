var url = require('url');
var path = require('path');
var request = require('request');
var http = require('http');
var urlValidator = require('valid-url');
var cheerio = require('cheerio');

var server = http.createServer();

server.on('request', function (req, res) {
    var proxyHost = req.headers.host;
    var proxyUrl = req.url;
	var forwardUrl = getForwardUrl(req, proxyUrl);
    if (forwardUrl == null) {
        res.writeHead(404);
        res.end('114514');
    } else {
        respondResource(req, res, forwardUrl);
    }
});

function getForwardUrl(req, proxyUrl) {
    if (typeof proxyUrl != 'string') return null; // Error('The first parameter must be string.');
    if (proxyUrl[0] != '/') return null; // Error('The first letter must be "/".');
    var forwardUrl = '';
    if (proxyUrl.substr(0, 5) == '/http') {
	   forwardUrl = decodeURIComponent(unescape(proxyUrl.substr(1)));
    } else if (req.headers.referer) {
        var refererObject = url.parse(req.headers.referer);
        var refererUrl = decodeURIComponent(refererObject.path.substr(1));
        refererObject = url.parse(refererUrl);
        forwardUrl = url.resolve(refererObject.protocol + '//' + refererObject.host, proxyUrl);
    }
    
    if (urlValidator.isWebUri(forwardUrl)) {
		return forwardUrl;
	} else {
		return null; // Error('The parameter "' + forwardUrl  + '" is not web uri.');
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

function respondResource(req, res, forwardUrl) {
    req.setEncoding('utf8');
	var forward = request({
		method: req.method,
		uri: forwardUrl
	}, function onResponseEnd(error, response, body) {
        if (error) { console.error(error); return }
        var convertedText = '';
        var contentType = response.headers['content-type'] || '';
        if (contentType.match('text/html')) {
            convertedText = convertURLOnHTML(req.headers.host, url.parse(forwardUrl), body);
        } else if (contentType.match('text/css')) {
            convertedText = convertURLOnCSS(req.headers.host, url.parse(forwardUrl), body);
        }
        
        if (convertedText) {
            if (!res.headersSent) {
                res.setHeader('Content-Length', Buffer.byteLength(convertedText, 'utf8'));
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
}

var clientCodes = require('./clientCodeFactory');

function getURLPropertyName(tagName) {
    if (tagName == 'a' || tagName == 'link' || tagName == 'button') {
        return 'href';
    } else if (tagName == 'script' || tagName == 'img' || tagName == 'iframe' || tagName == 'frame') {
        return 'src';
    } else if (tagName == 'form') {
        return 'action';
    } else if (tagName == 'body') {
        return 'background';
    }
}

function convertURLOnHTML(proxyHost, forwardUrlObject, html) {
	var forwardUrlPrefix = 'http://' + proxyHost + '/';
    var clientScript = clientCodes.defineSetter + clientCodes.overrideXHR(forwardUrlPrefix);
    
    var $ = cheerio.load(html);
    $('head').prepend($('<script>').text(clientScript));
    $('a, link, button, script, img, iframe, frame, form, body').each(function () {
        var prop = getURLPropertyName(this.tagName);
        if (!this.attribs[prop]) return;
        var value = this.attribs[prop].trim();
        if (!urlValidator.isWebUri(value)) {
            if (value[0] == '#') return;
            if (value.substr(0, 10) == 'javascript') return;
			if (value.substr(0, 2) == '//') {
				this.attribs[prop] = forwardUrlPrefix + encodeURIComponent(forwardUrlObject.protocol + value);
			} else {
				this.attribs[prop] = forwardUrlPrefix + encodeURIComponent(url.resolve(forwardUrlObject.href, value));
			}
		} else {
            this.attribs[prop] = forwardUrlPrefix + encodeURIComponent(value);
        }
    });
    
	return $.html();
}

function convertURLOnCSS(proxyHost, forwardURLObject, css) {
    var reg = /url\(['"]?([^\)'"][^:\)'"]+)['"]?\)/g;
    css.replace(reg, function (cssUrl) {
        console.log(cssUrl.match(/url\((.+)\)/i));
        return '114514';
    });
    
    return css;
}

server.listen(3015);