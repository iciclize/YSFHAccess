var Transform = require('stream').Transform;
var util = require('util');
var ScanningStatus = {
    outOfTag: 0,
    startOfTagFound: 10,
    slashOfEndTagFound: 20,
    readingTagName: 30,
    endOfTagNameFound: 40,
    findingStartOfAttributeName: 50,
    readingAttributeName: 60,
    endOfAttributeNameFound: 70,
    startOfAttributeValueDetected: 80,
    readingAttributeValue: 90,
    startOfAttributeValueQuoteDetected: 100,
    endOfAttributeValueQuoteFound: 110,
    endOfTagFound: 120,
    startOfEndTagNameDetected: 130,
    endOfEndTagNameFound: 140,
    endOfEndTagFound: 150,
    startOfCommentTagDetected: 160,
    startOfCommentTagFound: 170,
    endOfCommentTagDetected: 180,
    endOfCOmmentTagFound: 190
};

var globalIndex = 0;
var sentIndex = 0;
var tagStartIndex = null;
var tagName = null;
var attributeNameStartIndex = null;
var attributeName = null;
var attributeValueQuote = null;
var attributeValueStartIndex = null;
var attributeValue = null;
var document = '';
var array = [];

function HTMLConverter(option) {
    Transform.call(this, option);
    this.scanState = ScanningStatus.outOfTag;
}

util.inherits(HTMLConverter, Transform);

HTMLConverter.prototype._transform = function (chunk, encoding, callback) {
    document += chunk;
    array.push(chunk);
    for (var i = 0; i < chunk.length; globalIndex++, i++) {
        var character = chunk[i];
        switch (this.scanState) {
            case ScanningStatus.outOfTag:
                if (character === '<') {
                    this.scanState = ScanningStatus.startOfTagFound;
                }
                break;

            case ScanningStatus.startOfTagFound:
                if (character === '>') {
                    resetTagData();
                    this.scanState = ScanningStatus.outOfTag;
                } else if (character === '/') {
                    this.scanState = ScanningStatus.slashOfEndTagFound;
                } else {
                    this.scanState = ScanningStatus.readingTagName;
                    tagStartIndex = globalIndex;
                }
                break;

            case ScanningStatus.readingTagName:
                if (character === '>') {
                    resetTagData();
                    this.scanState = ScanningStatus.outOfTag;
                    break;
                } else if (character === '/') {
                    this.scanState = ScanningStatus.slashOfEndTagFound;
                } else if (isWhiteSpace(character)) {
                    this.scanState = ScanningStatus.findingStartOfAttributeName;
                    tagName = document.substring(tagStartIndex, globalIndex);
                }
                break;

            case ScanningStatus.findingStartOfAttributeName:
                if (!isWhiteSpace(character)) {
                    attributeNameStartIndex = globalIndex;
                    this.scanState = ScanningStatus.readingAttributeName;
                } else if (character === '>') {
                    resetTagData();
                    this.scanState = ScanningStatus.outOfTag;
                } else if (character === '/') {
                    this.scanState = ScanningStatus.slashOfEndTagFound;
                }
                break;

            case ScanningStatus.readingAttributeName:
                if (character === '=') {
                    attributeName = document.substring(attributeNameStartIndex, globalIndex);
                    this.scanState = ScanningStatus.startOfAttributeValueDetected;
                    if (isAttributeURL(tagName, attributeName)) {
                        this.push(document.substring(sentIndex, globalIndex));
                        sentIndex = globalIndex;
                    }
                } else if (isWhiteSpace(character)) {
                    attributeName = document.substring(attributeNameStartIndex, globalIndex);
                    this.scanState = ScanningStatus.findingStartOfAttributeName;
                }
                break;

            case ScanningStatus.startOfAttributeValueDetected:
                if (isWhiteSpace(character)) {
                    this.scanState = ScanningStatus.findingStartOfAttributeName;
                } else if (character === '"') {
                    attributeValueQuote = true;
                    this.scanState = ScanningStatus.startOfAttributeValueQuoteDetected;
                }
                break;

            case ScanningStatus.startOfAttributeValueQuoteDetected:
                attributeValueStartIndex = globalIndex;
                this.scanState = ScanningStatus.readingAttributeValue;
                break;

            case ScanningStatus.readingAttributeValue:
                if (attributeValueQuote) {
                    if (character === '"') {
                        attributeValue = document.substring(attributeValueStartIndex, globalIndex);
                        if (isAttributeURL(tagName, attributeName)) {
                            this.push(document.substring(sentIndex, attributeValueStartIndex));
                            this.push(convertToForwardURL(attributeName));
                            sentIndex = i;
                        }
                        this.scanState = ScanningStatus.findingStartOfAttributeName;
                    }
                } else {
                    if (isWhiteSpace(character)) {
                        attributeValue = document.substring(attributeValueStartIndex, globalIndex);
                        if (isAttributeURL(tagName, attributeName)) {
                            this.push(document.substring(sentIndex, attributeValueStartIndex));
                            this.push(convertToForwardURL(attributeName));
                            sentIndex = i;
                        }
                        this.scanState = ScanningStatus.findingStartOfAttributeName;
                    }
                }
                break;

            case ScanningStatus.slashOfEndTagFound:
                if (character === '>') {
                    this.scanState = ScanningStatus.outOfTag;
                    resetTagData();
                    this.push(document.substring(sentIndex, globalIndex));
                }
                break;

            default:
                break;
        }
    }
    this.push(document.substring(sentIndex, globalIndex));
    callback();
};

HTMLConverter.prototype._flush = function (callback) {
    resetTagData();
    document = '';
    globalIndex = 0;
    callback();
};

function isWhiteSpace(character) {
    if (character === ' ') return true;
    if (character === '\t') return true;
    if (character === '\r') return true;
    if (character === '\n') return true;
    return false;
}

function resetTagData() {
    tagStartIndex = null;
    tagName = null;
    attributeNameStartIndex = null;
    attributeName = null;
    attributeValueQuote = null;
    attributeValueStartIndex = null;
    attributeValue = null;
}

function isAttributeURL(tagname, attributename) {
    /* something great */
    return true;
}

function convertToForwardURL(url) {
    return url;
}

module.exports = HTMLConverter;