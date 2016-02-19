(function () {
    // Element のプロトタイプに innerHTML Setter を取得する
    var nativeLinkHref = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href').setter;

    // Element のプロトタイプに innerHTML Setter を設定する
    Object.defineProperty(HTMLLinkElement.prototype, 'href', {
        setter: function(html) {
            console.log(this.tagName + 'の href が設定されました！');
            return nativeLinkHref.call(this, html);
        }
    });
})();