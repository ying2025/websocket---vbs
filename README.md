# Websocket + VBS-encode/decode + xic+EAX
Client run in Browser.
Firstly, You should install the necessary package as following.         
         
                  npm install --save bignumber.js
                  npm install big-integer
                  npm install hash.js
                  
Secondly, You should conver into a program that can be run by a browser.   
                   npm  install browserify -g. 
                   browserify websocket.js > index.js  
Now you can use it in html just by


                 <script type="text/javascript" src="./index.js"></script>
 		 <script type="text/javascript" src="./EAX/cryptojs-aes.min.js"></script>
 		 <script type="text/javascript" src="./EAX/cryptojs-mode-ctr.min.js"></script>
 		 <script type="text/javascript" src="./EAX/eax.js"></script>
Server run in node.
Firstly, You should install the necessary package as following.         
         
                  npm install --save bignumber.js
                  npm install ws
                  npm install big-integer
                  npm install hash.js
                  npm install --save crypto-js pkaminski/cryptojs-extension
Secondly, You must use eax such as following

                  let fs = require("fs");
		   let CryptoJS = require('crypto-js/core');
		   require('cryptojs-extension/build_node/eax.js');
Thirdly, You can debug nodejs as following


                  node --inspect websocketServer.js
