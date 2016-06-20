var uglify = require('uglify-js');

var defineSetterScript = uglify.minify(__dirname + '/clientCode/defineSetter.js');
var base64URLEncodingScript = uglify.minify(__dirname + '/clientCode/base64.min.js');
var resolveURLScript = uglify.minify(__dirname + '/clientCode/resolveURL.js');

function overrideXHR(forwardUrlPrefix) {
    return '(function() {' +
        'var forwardUrlPrefix = "' + forwardUrlPrefix + '";' +
        'var proxied = window.XMLHttpRequest.prototype.open;' +
        'window.XMLHttpRequest.prototype.open = function() {' +
            'arguments[1] = new ysfhResolve(arguments[1], location.href).href;' +
            'if (arguments[1].substr(0, forwardUrlPrefix.length) == forwardUrlPrefix) {' +
            'arguments[1] = forwardUrlPrefix + Base64.encodeURI(arguments[1].substr(forwardUrlPrefix.length));' +
            '} else {' +
            'arguments[1] = forwardUrlPrefix + Base64.encodeURI(arguments[1]); }' +
            'console.log( arguments );' +
            'return proxied.apply(this, [].slice.call(arguments));' +
        '};' +
    '})();'
}

function defineSetter() {
    return defineSetterScript.code;
}

function base64URLEncoder() {
    return base64URLEncodingScript.code;
}

function urlResolver() {
    return resolveURLScript.code;
}

module.exports = {
    base64URLEncoder: base64URLEncoder,
    defineSetter: defineSetter,
    overrideXHR: overrideXHR,
    urlResolver: urlResolver
};