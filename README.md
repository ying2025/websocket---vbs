# Websocket + VBS-encode/decode + xic

Run in Browser.
Firstly, You should install the necessary package as following.         
         
                  npm install --save bignumber.js
                  npm install ws
                  npm install big-integer
                  npm install hash.js
                  
Secondly, You should conver into a program that can be run by a browser.
    
                   npm  install browserify -g. 
                   browserify websocket.js > index.js
  
Now you can use it in html just by
  <script type="text/javascript" src="./index.js"></script>
