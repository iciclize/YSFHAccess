var URLValidator = require('valid-url');
var url = require('url');
var base64 = require('js-base64').Base64;
var util = require('util');
var StringStream = require('stringstream');
var stringDecoder = require('string_decoder').StringDecoder;
var Transform = require('stream').Transform;
util.inherits(CSSParseStream, Transform);

var IN_SELECTOR = 0;
var IN_PROPERTY = 10;
var IN_VALUE = 20;
var IN_U = 25;
var IN_R = 26;
var IN_L = 27;
var IN_BRACKET_START = 28;
var IN_URL_VALUE = 31;
var IN_BRACKET_END = 34;

var codes = {
    curlyBracketLeft: '{'.charCodeAt(0),
    curlyBracketRight: '}'.charCodeAt(0),
    colon: ':'.charCodeAt(0),
    semicolon: ';'.charCodeAt(0),
    u: 'u'.charCodeAt(0),
    r: 'r'.charCodeAt(0),
    l: 'l'.charCodeAt(0),
    roundBracketLeft: '('.charCodeAt(0),
    roundBracketRight: ')'.charCodeAt(0),
    singleQuote: "'".charCodeAt(0),
    doubleQuote: '"'.charCodeAt(0)
};

function CSSParseStream(proxyHost, forwardURL) {
    if (!(this instanceof CSSParseStream)) return new CSSParseStream(proxyHost, forwardURL);
    Transform.call(this);
    
    this._scanState = IN_SELECTOR;
    this._quoteType = ''; // one of null character, single quote, double quote
    this._buffer = '';
    this._isBase64image = false;
    
    var _proxyHost = proxyHost;
    var _forwardURL = forwardURL;
    var _forwardURLObject = url.parse(_forwardURL);
    
    this.stringDecoder = new stringDecoder('utf8');

    this.convertToForwardURL = function convertToForwardURL(rawURL) {
        var forwardURLPrefix = 'http://' + _proxyHost + '/';
        if (URLValidator.isWebUri(rawURL)) return forwardURLPrefix + base64.encodeURI(rawURL);
        if (rawURL.substr(0, 2) == '//') return forwardURLPrefix + base64.encodeURI(_forwardURLObject.protocol + rawURL);
        
        return forwardURLPrefix + base64.encodeURI(url.resolve(_forwardURLObject.href, rawURL));
    }
    
    return this;
}

CSSParseStream.prototype._transform = function (chunk, encoding, callback) {
   chunk = this.stringDecoder.write(chunk);
   
   var bufferedIndex = 0;
    for (var i = 0; i < chunk.length; i++) {
        var character = chunk[i];
        switch (this._scanState) {
            case IN_SELECTOR:
                if (character === '{')
                    this._scanState = IN_PROPERTY;
                break;
                
            case IN_PROPERTY:
                if (character === ':') {
                    this._scanState = IN_VALUE;
                } else if (character === '}') {
                    this._scanState = IN_SELECTOR;
                } 
                break;
                
            case IN_VALUE:
                if (character.toLowerCase() === 'u') {
                    this._scanState = IN_U;
                } else if (character === ';') {
                    this._scanState = IN_PROPERTY;
                }
                break;
                
            case IN_U:
                if (character.toLowerCase() === 'r') {
                    this._scanState = IN_R;
                } else if (character === ';') {
                    this._scanState = IN_PROPERTY;
                } else {
                    this._scanState = IN_VALUE;
                }
                break;
                
            case IN_R:
                if (character.toLowerCase() === 'l') {
                    this._scanState = IN_L;
                } else if (character === ';') {
                    this._scanState = IN_PROPERTY;
                } else {
                    this._scanState = IN_VALUE;
                }
                break;
                
            case IN_L:
                if (character === '(') {
                    this._scanState = IN_BRACKET_START;
                } else if (character === ';') {
                    this._scanState = IN_PROPERTY;
                } else {
                    this._scanState = IN_VALUE;
                }
                break;
                
            case IN_BRACKET_START:
                if (character === '"') {
                    this._quoteType = '"';
                } else if (character === "'") {
                    this._quoteType = "'";
                } else {
                    this._quoteType = '';
                    i--;
                }
                this.push(chunk.substring(bufferedIndex, i + 1));
                bufferedIndex = i + 1;
                this._scanState = IN_URL_VALUE;
                break;
                
            case IN_URL_VALUE:
                if (character === this._quoteType) {
                    if (!this._isBase64image) {
                        this._buffer += chunk.substring(bufferedIndex, i);
                        this.push(this.convertToForwardURL(this._buffer));
                        bufferedIndex = i;
                    }
                    this._scanState = IN_BRACKET_END;
                } else if (this._quoteType === '') {
                    if (character === ')') {
                        if (!this._isBase64image) {
                            this._buffer += chunk.substring(bufferedIndex, i);
                            this.push(this.convertToForwardURL(this._buffer));
                            bufferedIndex = i;
                        }
                        this._scanState = IN_BRACKET_END;
                    }
                }
                
                if (this._buffer.length === 5) { 
                    if (this._buffer.substr(0, 5) === 'data:') {
                        this._isBase64image = true;
                        this._buffer = '';
                        this.push('data:');
                        bufferedIndex = i;
                        break;
                    }
                }
                    
                break;
                
            case IN_BRACKET_END:
                this._isBase64image = false;
                if (character === ';') {
                    this._scanState = IN_PROPERTY;
                } else if (character === '}') {
                    this._scanState = IN_SELECTOR;
                }
                break;
                 
        }
    }
    
    if (this._scanState === IN_URL_VALUE) {
        this._buffer += chunk.substring(bufferedIndex, chunk.length);
    } else {
        this.push(chunk.substring(bufferedIndex, chunk.length));
    }
    
    callback();    
};

CSSParseStream.prototype._flush = function (callback) {
    this.push(this.stringDecoder.end());
    callback();
};

module.exports = CSSParseStream;