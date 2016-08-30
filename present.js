
  document.onmousedown = function(e){
    var n = new RegExp("/(\\d*)").exec(window.location.pathname)[1];
    if (e.button == 0){
      window.location.replace((+n+1) + ".html");
    } else if (e.button == 2) {
      window.location.replace((+n-1) + ".html");
    }
    e.preventDefault(true);
  };
