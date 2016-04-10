var URLValidator = require('valid-url');
var trumpet = require('trumpet');
var url = require('url');
var base64 = require('js-base64').Base64;
var clientCodes = require('./clientCodeFactory');

function URLConverter(forwardURLPrefix, forwardURL) {
    var _forwardURL = forwardURL;
    var _forwardURLObject = url.parse(_forwardURL);
    
    var tr = trumpet();
    
    tr.select('head', function (elem) {
        var first = true;
        var headStream = elem.createStream();
        headStream.on('data', function (data) {
            if (first) {
                headStream.write('<script>'
                    + clientCodes.overrideXHR(forwardURLPrefix)
                    + clientCodes.base64URLEncoder()
                    + clientCodes.defineSetter()
                    + '</script>\n'
                    + data);
                first = false;
            } else {
                headStream.write(data);
            }
        });
        headStream.on('end', function () {
            headStream.end();
        })
    });
    
    tr.selectAll(
        'a,area,base,link,button,script,embed,iframe,frame,img,input,form,body,blockquote,q,ins,del,object,applet,head',
        function (elem) {
            getURLPropertyNames(elem.name).forEach(function (prop) {
                elem.getAttribute(prop, function (rawURL) {
                    if (!rawURL) return;
                    if (rawURL.substr(0, 5) === 'data:') return;
                    elem.setAttribute(prop, convertToForwardURL(rawURL));
                });
            });
        });

    tr.on('error', function (err) {
        console.dir(err);
    });
    
    return tr;
    
    function convertToForwardURL(rawURL) {
        if (URLValidator.isWebUri(rawURL)) return forwardURLPrefix + base64.encodeURI(rawURL);
        if (rawURL == '#') return rawURL;
        if (rawURL.substr(0, 10) == 'javascript') return rawURL;
        if (rawURL.substr(0, 2) == '//') return forwardURLPrefix + base64.encodeURI(_forwardURLObject.protocol + rawURL);
        
        return forwardURLPrefix + base64.encodeURI(url.resolve(_forwardURLObject.href, rawURL));
    }

    function getURLPropertyNames(tagName) {
        switch (tagName) {
            case 'a':
            case 'area':
            case 'base':
            case 'link':
            case 'button':
                return ['href'];

            case 'script':
            case 'embed':
                return ['src'];

            case 'iframe':
            case 'frame':
                return ['src', 'longdsec'];

            case 'img':
                return ['src', 'longdesc', 'usemap'];

            case 'input':
                return ['usemap'];

            case 'form':
                return ['action'];

            case 'body':
                return ['background'];

            case 'blockquote':
            case 'q':
            case 'ins':
            case 'del':
                return ['cite'];

            case 'object':
                return ['classid', 'codebase', 'data', 'usemap'];

            case 'applet':
                return ['code', 'codebase'];

            case 'head':
                return ['profile'];

            default:
                return [];
        }
    }
}

module.exports = URLConverter;