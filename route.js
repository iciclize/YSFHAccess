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
        passResource(req, res, forwardUrl);
    }
});

function getForwardUrl(req, proxyUrl) {
    if (typeof proxyUrl != 'string') return null; // Error('The first parameter must be string.');
    if (proxyUrl[0] != '/') return null; // Error('The first letter must be "/".');
    var forwardUrl = '';
    if (proxyUrl.substr(0, 5) == '/http') {
	   forwardUrl = decodeURIComponent(unescape(proxyUrl.substr(1)));
    } else {
        if (req.headers.referer) {
            var refererObject = url.parse(req.headers.referer);
            var refererUrl = decodeURIComponent(refererObject.path.substr(1));
            refererObject = url.parse(refererUrl);
            forwardUrl = url.resolve(refererObject.protocol + '//' + refererObject.host, proxyUrl);
        }
    }
    
    if (urlValidator.isWebUri(forwardUrl)) {
		return forwardUrl;
	} else {
		return null; // Error('The parameter "' + forwardUrl  + '" is not web uri.');
	}
}

function passResource(req, res, forwardUrl) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Security-Policy', 'connect-src *');
    
	var contentType = '';
	var html = '';
	var forward = request({
		method: req.method,
		uri: forwardUrl
	});
	forward.on('response', function (response) {
		contentType = response.headers['content-type'];
        if (typeof contentType !== 'string') contentType = '';
        for (var name in response.headers) {
            res.setHeader(name, response.headers[name]);
        }
        if (contentType.match('text/html') && req.url.slice(-3) != '.js') {
            forward.on('data', function (chunk) {
                html += chunk;
            });
        } else {
            forward.pipe(res);
        }
	}).on('end', function () {
		if (contentType.match('text/html')) {
            var convertedHtml = convertHref(req.headers.host, url.parse(forwardUrl), html);
            if (!res.headersSent) {
                res.setHeader('Content-Length', Buffer.byteLength(convertedHtml, 'utf8'));
            }
			res.end(convertedHtml);
		}
	});
}

var clientCodes = require('./clientCodeFactory');
var clientStaticScript = clientCodes.defineSetter() + '\n';

function convertHref(proxyHost, forwardUrlObject, html) {
	var forwardUrlPrefix = 'http://' + proxyHost + '/';
    
    var clientScript = clientStaticScript + clientCodes.overrideXHR(forwardUrlPrefix);
    
    var $ = cheerio.load(html);
    
    $('head').prepend($('<script>').text(clientScript));
    
    $('a, link').each(function () {
        if (!this.attribs.href) return;
        var href = this.attribs.href.trim();
        if (!urlValidator.isWebUri(href)) {
            if (href[0] == '#') return;
            if (href.substr(0, 10) == 'javascript') return;
			if (href.substr(0, 2) == '//') {
				this.attribs.href = forwardUrlPrefix + encodeURIComponent(forwardUrlObject.protocol + href);
			} else {
				this.attribs.href = forwardUrlPrefix + encodeURIComponent(url.resolve(forwardUrlObject.href, href));
			}
		} else {
            this.attribs.href = forwardUrlPrefix + encodeURIComponent(href);
        }
    });
    
    $('script, img, iframe, frame').each(function () {
        if (!this.attribs.src) return;
        var src = this.attribs.src.trim();
        if (!urlValidator.isWebUri(src)) {
			if (src.substr(0, 2) == '//') {
				this.attribs.src = forwardUrlPrefix + encodeURIComponent(forwardUrlObject.protocol + src);
			} else {
				this.attribs.src = forwardUrlPrefix + encodeURIComponent(url.resolve(forwardUrlObject.href, src));
			}
		} else {
            this.attribs.src = forwardUrlPrefix + encodeURIComponent(src);
        }
    });
    
    $('form').each(function () {
        if (!this.attribs.action) return;
        var action = this.attribs.action.trim();
        if (!urlValidator.isWebUri(action)) {
			if (action.substr(0, 2) == '//') {
				this.attribs.action = forwardUrlPrefix + encodeURIComponent(forwardUrlObject.protocol + action);
			} else {
				this.attribs.action = forwardUrlPrefix + encodeURIComponent(url.resolve(forwardUrlObject.href, action));
			}
		} else {
            this.attribs.action = forwardUrlPrefix + encodeURIComponent(action);
        }
    });
    
    $('body').each(function () {
        if (!this.attribs.background) return;
        var background = this.attribs.background.trim();
        if (!urlValidator.isWebUri(background)) {
			if (background.substr(0, 2) == '//') {
				this.attribs.background = forwardUrlPrefix + encodeURIComponent(forwardUrlObject.protocol + background);
			} else {
				this.attribs.background = forwardUrlPrefix + encodeURIComponent(url.resolve(forwardUrlObject.href, background));
			}
		} else {
            this.attribs.background = forwardUrlPrefix + encodeURIComponent(background);
        }
    });
    
	return $.html();
}

server.listen(3015);