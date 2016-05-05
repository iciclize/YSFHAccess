var url = require('url');

function override(forwardURL) {
    var forwardURLObject = url.parse(forwardURL);
    
    if (!forwardURLObject.host) return forwardURL;
    
    if (forwardURLObject.host.match('google')) {
        return forwardURL.replace(/amp;/g, '');
    }
    
    return forwardURL;
}

module.exports = override;