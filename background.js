chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('ABplayer.html', {
    'bounds': {
      'width': 400,
      'height': 500
    }
  });
});