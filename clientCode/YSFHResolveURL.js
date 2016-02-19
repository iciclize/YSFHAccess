var YSFHResolveURL = (function () {
    

/**
 * Copied from http://blog.livedoor.jp/aki_mana/archives/5453297.html on 2016-2-18
 */
var parseURL = function( url ){
	var r = {};
	var re = /^(?:(https?:)?(?:\/\/(([^\/:]+)(?::([0-9]+))?)))?(\/?[^?#]*)(\??[^?#]*)(#?.*)/;
	var p = 'protocol host hostname port pathname search hash'.split(' ');
	var m = String( url ).match( re );
	if( m ) {
		p.forEach(function( prop, idx ){
			r[prop] = typeof m[(idx+1)] === 'undefined' ? null: m[(idx+1)];
		});
	}
	// 相対指定でない（絶対指定、プロトコル略記、ホストルート記述のとき）
	if( r.pathname.indexOf('.') !== 0 ){
		p.forEach(function( prop ){
			if( r[prop] === '' ) r[prop] = location[prop];
		});
	}
	return r;
};


/**
 * Copied from http://blog.livedoor.jp/aki_mana/archives/6175908.html on 2016-2-18
 */
var resolveURL = function( from, to ){
  var fromURI = parseURL( from );
  var toURI = parseURL( to );
  
  var rslt = {
    protocol : toURI.protocol || fromURI.protocol || location.protocol,
    hostname : toURI.hostname || fromURI.hostname || location.hostname,
    port : toURI.port || fromURI.port || location.port,
    pathname : (function(){
      var fDir  = fromURI.pathname.substr( 0, fromURI.pathname.lastIndexOf('/') ).split('/');
      var tDir  = toURI.pathname.substr( 0, toURI.pathname.lastIndexOf('/') ).split('/');
      var tFile = toURI.pathname.substr( toURI.pathname.lastIndexOf('/')+1 );
		
      if( fDir[fDir.length-1] === '' ) fDir.pop();
      if( tDir[tDir.length-1] === '' ) tDir.pop();

      while( fDir[0] === '..' || fDir[0] === '.' ) fDir.shift();
      while( tDir[0] === '.' ) 	tDir.shift();
      while( tDir[0] === '..' ) {
        if(fDir.length>0) fDir.pop();
        tDir.shift();
      }
      tDir.push( tFile );
      return fDir.concat(tDir).join('/')
    })(),
    search : '',
    hash : ''
  };
  // 第二引数の相対パスを絶対PATHにするための処理が完了。
  return rslt;
}


return resolveURL;

})();