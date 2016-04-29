(function () {
    // Element のプロトタイプに innerHTML Setter を取得する
    var nativeLinkHref = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src').setter;

    // Element のプロトタイプに innerHTML Setter を設定する
    Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        setter: function(html) {
            console.log(this.tagName + 'の src が設定されました！');
            return nativeLinkHref.call(this, html);
        }
    });
})();