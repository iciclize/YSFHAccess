var url = require('url');
var mongojs = require('mongojs');
var db = mongojs('YSFHcSINE', ['POST', 'session']);

function Forward(time, location, data) {
    return {
        timestamp: time,
        url: url.parse(location),
        data: data
    };
}

function savePost(req, forwardURL) {
    if (req.method != 'POST') return;

    var sine_id = null;

    db.session.findOne({session_id: req.cookies.session_id}, function (err, doc) {
        if (err) { console.error(err.stack); }
        if (!doc.sine_id) throw new Error('session_id: ' + req.cookies.session_id + 'に対するsine_idが見つかりません。');
        sine_id = doc.sine_id;
    });

    var bufs = []; // バッファを蓄えておく配列
    bufs.totalLength = 0; // 受け取ったバッファの合計サイズ
    req.on('data', function(chunk) {
        bufs.push(chunk);
        bufs.totalLength += chunk.length;
    });

    req.on('end', function () {
        if (bufs.totalLength == 0) return;
        var postData = decodeURIComponent(Buffer.concat(bufs, bufs.totalLength).toString('utf8'));
        var postForward = Forward(new Date(), forwardURL, postData);
        waitOrPost(postForward);
    });

    function waitOrPost(forward) {
        var parentFunc = arguments.callee;
        if (sine_id === null) {
            setTimeout(function () {
                parentFunc(forward);
            }, 4);
        } else {
            doSavePost(sine_id, forward);
        }
    }

    function doSavePost(sine_id, forward) {
        db.POST.update({sine_id: sine_id}, {
            $push: { posts: forward }
        }, {}, function (err, result) {
            if (err) console.error(err.stack);
        });
    }
}

module.exports = savePost;