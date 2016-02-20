var uglify = require('uglify-js');

function overrideXHR(forwardUrlPrefix) {
    return '(function() {' +
        'var proxied = window.XMLHttpRequest.prototype.open;' +
        'window.XMLHttpRequest.prototype.open = function() {' +
            'arguments[1] = new URL(arguments[1], location.href).href;' +
            'if (arguments[1].substr(0, "' + forwardUrlPrefix + '".length) != "' + forwardUrlPrefix + '")' +
            'arguments[1] = "' + forwardUrlPrefix + '" + encodeURIComponent(arguments[1]);' +
            'console.log( arguments );' +
            'return proxied.apply(this, [].slice.call(arguments));' +
        '};' +
    '})();'
}

var defineSetterScript = uglify.minify(__dirname + '/clientCode/defineSetter.js');

module.exports = {
    overrideXHR: overrideXHR,
    defineSetter: defineSetterScript.code
};