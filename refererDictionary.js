var REFERER_STORE = [
    [
        [
            'search?q=',
            'xjs/_/js/',
            'images/nav_logo242.png',
            'gen_204?',
            'imghover?',
            'async/irc?',
            'imgrc?',
            'ajax/pi/imgdisc?',
            'imgevent?',
            'url?sa=',
            'client_204?&atyp',
            'complete/search?',
            //'s?sclient' // これはオンにしてはいけない。URLが動的に切り替わってしまう(戒め) ,
            '/images/branding/googlelogo/1x/googlelogo'
        ],
        'https://www.google.co.jp/'
    ],
    [
        [
            'intern/common/referer_frame.php'
        ],
        'https://s-static.ak.facebook.com/'
    ]
];


function lookupReferer(wholePath) {
    for (var i = 0; i < REFERER_STORE.length; i++) {
        var store = REFERER_STORE[i];
        for (var j = 0; j < store[0].length; j++) {
            var partOfPath = store[0][j];
            if (wholePath.indexOf(partOfPath) >= 0) {
                return store[1];
            }
        }
    }
    
    return null;
}

module.exports = lookupReferer;