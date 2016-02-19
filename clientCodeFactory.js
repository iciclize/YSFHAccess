function overrideXHR(forwardUrlPrefix) {
    return '(function() {' + '\n' +
        'var proxied = window.XMLHttpRequest.prototype.open;' + '\n' +
        'window.XMLHttpRequest.prototype.open = function() {' + '\n' +
            'var anchorElement = document.createElement("a");' + '\n' +
            'anchorElement.href = arguments[1];' + '\n' +
            'if (arguments[1].substr(0, "' + forwardUrlPrefix + '".length) != "' + forwardUrlPrefix + '")' + '\n' +
            'arguments[1] = "' + forwardUrlPrefix + '" + encodeURIComponent(anchorElement.href);' + '\n' +
            'console.log( arguments );' + '\n' +
            'return proxied.apply(this, [].slice.call(arguments));' + '\n' +
        '};' + '\n' +
    '})();'
}

var YSFHResolveURLScript = require('fs').readFileSync(__dirname + '/clientCode/YSFHResolveURL.js', {encoding: 'utf8'});
var defineSetterScript = require('fs').readFileSync(__dirname + '/clientCode/defineSetter.js', {encoding: 'utf8'});

function YSFHResolveURL() {
    return YSFHResolveURLScript;
}


function defineSetter() {
    return defineSetterScript;
}

module.exports = {
    overrideXHR: overrideXHR,
    YSFHResolveURL: YSFHResolveURL,
    defineSetter: defineSetter
};