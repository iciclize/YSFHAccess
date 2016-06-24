var trumpet = require('trumpet');

function JavascriptRemover(forwardURLPrefix, forwardURL) {
    var tr = trumpet();
    
    tr.selectAll('*', function (elem) {
        if (elem.name == 'script') {
            elem.createWriteStream({outer: true}).end();
            return;
        } else if (elem.name == 'noscript') {
            var readWriteStream = elem.createStream({outer: true});
            var noscriptTrumpet = trumpet();
            noscriptTrumpet.select('noscript', function (noscript) {
                var noscriptStream = noscript.createReadStream();
                noscriptStream.on('data', function (data) {
                    readWriteStream.write(data);
                });
                noscriptStream.on('end', function () {
                    readWriteStream.end();
                });
            });

            readWriteStream.on('data', function (data) {
                noscriptTrumpet.write(data);
            });
            readWriteStream.on('end', function () {
                noscriptTrumpet.end();
            });
            return;
        }
        elem.removeAttribute('onblur');
        elem.removeAttribute('onfocus');
        elem.removeAttribute('onchange');
        elem.removeAttribute('onselect');
        elem.removeAttribute('onsubmit');
        elem.removeAttribute('onreset');
        elem.removeAttribute('onabort');
        elem.removeAttribute('onerror');
        elem.removeAttribute('onload');
        elem.removeAttribute('onunload');
        elem.removeAttribute('onclick');
        elem.removeAttribute('ondblclick');
        elem.removeAttribute('onkeypress');
        elem.removeAttribute('onkeydown');
        elem.removeAttribute('onkeyup');
        elem.removeAttribute('onmouseout');
        elem.removeAttribute('onmouseover');
        elem.removeAttribute('onmousedown');
        elem.removeAttribute('onmouseup');
        elem.removeAttribute('onmousemove');
    });

    tr.on('error', function (err) {
        console.dir(err);
    });
    
    return tr;
}

module.exports = JavascriptRemover;