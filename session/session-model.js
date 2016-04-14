var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var UserSchema   = new Schema({
    session_id : String,
    name: String,
    age: Number
});

module.exports = mongoose.model('User', UserSchema);