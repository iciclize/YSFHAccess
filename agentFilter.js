/**
 * agentFilter
 * 
 * TODO: m.facebook.comとmobile.twitter.comのときIE9のUAを返す
 * google.co.jp/?site=imghpのときもIE9
 */

var UserAgent = {
    'IE9': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.1; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; InfoPath.2; .NET4.0C; .NET4.0E; Tablet PC 2.0)'
};

function proxyURLFilter(forwardURL, userAgent) {
    if (/https:\/\/facebook.com/.test(forwardURL)) {
        return proxiedURL('https://m.facebook.com', referer, UserAgent.IE9);
    } else if (/https:\/\/twitter.com/.test(forwardURL)) {
        return proxiedURL('https://mobile.twitter.com')
    }
}

function proxiedURL(forward, referer, useragent) {
    return {
        forwardURL: forward,
        referer: referer,
        userAgent: useragent
    };
}

module.exports = proxyURLFilter;