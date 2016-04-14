var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy(
    {
        usernameField: 'username',
        passwordField: 'password'
    },
    function(username, password, done) {
        validateUser(username, password, function(err, valid) {
            if (err) { return done(err); }
            if (!valid) {
                return done(null, false, { message: 'ユーザーIDかパスワードが間違っています。' });
            }
            return done(null, valid);
        });
    }
));

function validateUser(username, password, callback) {
    callback(null, true);
}

//認証した際のオブジェクトをシリアライズしてセッションに保存する。
passport.serializeUser(function(username, done) {
	done(null, username);
});


//認証時にシリアライズしてセッションに保存したオブジェクトをデシリアライズする。
//デシリアライズしたオブジェクトは各routerの req.user で参照できる。
passport.deserializeUser(function(username, done) {
	done(null, {name:username, msg:'my message'});
});

module.exports = passport;