var url = require('url');
var mongojs = require('mongojs');
var db = mongojs('YSFHcSINE', ['POST', 'session']);

function Log(time, location, data) {
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
        var postData = Buffer.concat(bufs, bufs.totalLength).toString('utf8');
        var postLog = Log(new Date(), forwardURL, postData);
        waitOrPost(postLog);
    });

    function waitOrPost(log) {
        var parentFunc = arguments.callee;
        if (sine_id === null) {
            setTimeout(function () {
                parentFunc(log);
            }, 4);
        } else {
            doSavePost(sine_id, log);
        }
    }

    function doSavePost(sine_id, log) {
        db.POST.update({sine_id: sine_id}, {
            $push: { posts: log }
        }, {}, function (err, result) {
            if (err) console.error(err.stack);
        });
    }
}

module.exports = savePost;