const commonFun = require('./commonFun.js');
const vbsEncode = require('./VBS/encode.js');
const vbsDecode = require('./VBS/decode.js');
const  msgHeader  = require('./message.js').MsgHeader;
let emptyString = "";
let max_attemp_times = 3;
let WebSocketClient;
if (typeof WebSocket == "undefined" && !process.env.browser) {
	WebSocketClient = require("ws");
} else {
	WebSocketClient = WebSocket;
}
function ClientSocket(wsReconnect) {
	this.wsReconnect = wsReconnect;
    this.err = "";
    this.sendList = []; // record the request txid sequence that client send to server
    this.sendDataList = []; // record the request txid and data sequence that client send to server
    this.undealDataList   = [];
    this.url = '';
 
    this.connectStatus = {
    	noConnect: 0,  //  yet connect
    	connecting: 1, // connecting
    	open: 2,   // open and ready to communicate.
    	closing: 3, // closing
    	closed: 4  // closed
    };
    this.readyState  = 1; 
    this.txid = 1;
    this.maxAttempTimes = max_attemp_times; // Attemp reconnect time
    this.attempTime = 0;
    this.stopFlag = true; // Over the maxAttempTimes stop to try
    this.reconnectSucFlag = false;
    let that = this; // ClientSocket
    that.msgHead = new msgHeader();

    /**
     *  @dev connect
     *  Fun: Init the websocket connection and the relavant event.
     *  @param {ws_server} Server Url.
     *  @param {callback} Callbacl Function, which use to judge the state of the connection
     */
    ClientSocket.prototype.connect = function(ws_server, callback) {
    	try {
    		that.url = ws_server;
    	    that.ws = new WebSocketClient(ws_server);
    	} catch (error) {
    		that.ws = {readState: 3,close:() => {}}; // DISCONNECTED
    		callback("Invalid url : " + ws_server + " closed !");
    	}
		that.ws.onmessage = function (e) {
		    let dataMsg = that.getData(e.data).then((data) => {
		    	console.log('ws onmessage from server: ', data);
		    	if (data.type !== undefined && data.type == 'H') {
			    	callback(that.readyState);
			    	if (that.sendList.length != 0) {
			    		that.sendList.forEach(k => {
					        that.sendDataList.filter(v => {
					            if (v[k] != undefined && typeof v[k] != "undefined") {
					            	try {
					            		if (that.ws.readyState == 1) {
					            			that.ws.send(that.msgHead.cryptQuest(v[k]));
					            			console.log("send txid", k);
					            		}
					            	} catch(e) {
					            		throw new Error(e);
					            	}
					            }
					       });
				    	});
		    		}
			    	// Temp test add 
    				// that.ws.send(that.msgHead.packMsg('H'));
			    }	
		    }).catch((error) => {
		    	if (that.wsReconnect != undefined && typeof that.wsReconnect != "undefined") {
					that.wsReconnect("Connect fail");
				}	
		    	callback(error);
		    });		    
		};

		that.ws.onerror = function(error) {
			that.readyState = that.connectStatus.closing;
			console.log("Socket error: ", error);
			callback(error);
	    };

		that.ws.onclose = function(evt) {	
			that.readyState = that.connectStatus.closed;
			callback(that.readyState);
			if (that.attempTime <= 0 && that.wsReconnect != undefined && typeof that.wsReconnect != "undefined") {
				that.wsReconnect("Connection closed!");
			}	
			console.log("connection closed!", evt);
			if (that.sendList.length != 0) {
				if (that.stopFlag) {
					try {
						that.msgHead._isEnc = false;
						that.connect(that.url ,(readyState) => { // try to connect ws_server
							if (readyState == 2) {
								that.msgHead = new msgHeader();	
								if (that.wsReconnect != undefined && typeof that.wsReconnect != "undefined") {
									that.wsReconnect("");
								}	
								that.reconnectSucFlag = true;	
							} 
							that.attempTime++; 
							if (that.attempTime >= that.maxAttempTimes) {
								that.attempTime = 0;
								that.stopFlag = false;
								if (that.wsReconnect != undefined && typeof that.wsReconnect != "undefined") {
									that.wsReconnect("Retry " + that.attempTime + " times fail");
								}
							}
						});
					} catch(e) {
						 console.error(e);
					}
				}
			}
		}; 
    }
	/**
     *  @dev sendData
     *  Fun: Send data to server. The data to server use xic as header and the vbs code as body.
     *  @param {msgBody} message body.
     *  Additional describe: that.sendList use to record sequence that send to server
     *		that.sendDataList use to record sequence and the relevant data
     */
    ClientSocket.prototype.sendData = function(msgBody, singleSign) {
    	if (that.readyState  == that.connectStatus.open) {
    		let txid;
    		if (singleSign) { // Single request
    			txid = 0;
    		} else {
    			txid = _generateTxid();
    		}
			// if (that.sendList.length > 5) {
			// 	that.err = "Please send message to server later !";
			// 	return that.err;
			// }
			let [u8a, data] = that.msgHead.packQuest(txid, "service", "method", {"d": "sdjkd"}, {"arg": msgBody});	    	
	    	if (txid != 0) {
	    		that.sendList[that.sendList.length] = txid;
	    	}
	    	let obj = {[txid]: u8a};
    		that.sendDataList.push(obj);
    		that.ws.send(data);
	    } else {
	    	that.err = "Please connect to server";
	    	return that.err;
	    }
    }
	/**
     *  @dev getData
     *  Fun: Decode message receiving from server. The message to server use xic as header and the vbs code as body.
     *  @param {data} receive message from server.
     *  Additional describe: Read blob as file, and according to the result to do relevant deal	
     */
    ClientSocket.prototype.getData = function(data) {

		let decodeMsg = _readerBlob(data).then((result) => {
			let msg = that.msgHead.decodeHeader(that.ws, result);;
			if (msg != undefined && typeof msg.type != "undefined") {
				switch (msg.type) {
					case 'H':
						that.readyState  = 2; // Can send message
						break;
					case 'B':
						that.readyState  = 3;
						let allowClose = _graceClose(false);
						let closeMsg;
			            if (allowClose) {
			            	that.ws.close();
			            	closeMsg = "The connection is disconnecting with the server.";
			            } else {
			            	console.log("Waiting !!");
			            	closeMsg = "Waiting for disconnect";
			            }
						return closeMsg;
					case 'Q': 
						// ToDoTemp test add 
					 	// that.ws.send(that.msgHead.packMsg('H'));
						break;
					case 'A':
						// TODO 
						that.sendList = that.sendList.filter(v => v!= msg.txid);
						break;
				}
			}
			if (msg != undefined) {
				return msg;
			}
		 }).catch(function (error) {
		 	if (that.wsReconnect != undefined && typeof that.wsReconnect != "undefined") {
				that.wsReconnect(error);
			}
		    return error;
		});
		return decodeMsg;
    }
    /**
     *  @dev close
     *  Fun: Gracefully close the connection
     *  @param {data} receive message from server.
     *  Additional describe: If the sequence of the request is empty, close it directly, 
     *  or send the undeal message to server
     */
    ClientSocket.prototype.close = function() {
    	that.readyState = 3;
		return new Promise((resolve, reject) => {
			if (!that.ws) {
                that.err = "Websocket already cleared !";
                return reject(that.err);
            }
            let allowClose = _graceClose(true);
            if (allowClose) {
            	that.ws.send(that.msgHead.packMsg('B'));
            	resolve("Close success!");
            } else {
            	// reject("Waiting close!");
            	console.log("Waiting close!");
            }
		});
	}
	/**
     *  @dev _graceClose
     *  Fun: Gracefully close the connection
     *  Additional describe: If the sequence of the request is empty, close it directly, 
     *  or send the undeal message to server
     *  @param {flag} true/false represent Active/passivity close
     */
     function _graceClose(flag) {
		while(that.msgHead.receiveList.length != 0) {
			console.log("Waiting to receive txid list", that.msgHead.receiveList);
		}
		if (that.sendList.length == 0) {
			return true;
		} 
		// According the txid sequence to find the data
		let m = 1; // connect ws_server' times
		let resendTimer = setInterval(() => {
			if (that.sendList.length == 0) {
				if (flag) {
					that.ws.close();
				}
				clearInterval(resendTimer);
				return true;
			}
			if (m >= that.maxAttempTimes) {
				if (!that.reconnectSucFlag) {
					that.ws.close();
				}
				_sleep(2000);
				if (that.wsReconnect != undefined && typeof that.wsReconnect != "undefined") {
					that.wsReconnect("Disconnect with server");
				}
			}
			if (that.ws.readyState == 1) {	
				_sleep(4000); // less than resendTimer Interval number, or it will be wait.
			} else {
				that.connect(that.url ,(readyState) => { // try to connect ws_server
					if (readyState == 2) {
						that.msgHead = new msgHeader();
						that.reconnectSucFlag = true;
						if (that.sendList.length == 0) {
							clearInterval(resendTimer);
							return true;
						}
						if (that.wsReconnect != undefined && typeof that.wsReconnect != "undefined") {
							that.wsReconnect("");
						}	
					} 
					if (m >= that.maxAttempTimes * 2) {
						if (!that.reconnectSucFlag) {
							that.ws.close();
						}
						clearInterval(resendTimer);
						return true;
					}
				});
			}
			m++;
		}, 5000);	
	}
	/**
     *  @dev _sleep
     *  Fun: time _sleep
     */
	function _sleep(time){
	  for( let temp = Date.now(); Date.now() - temp <= time;);
	}
	/**
     *  @dev _readerBlob
     *  Fun: Read blob as arrayBuffer
     *	@param {data}  blob data receiving from server
     *  return Uint8Array
     */
     
    function _readerBlob(data) {
		let tempData;
		return new Promise( function(resolve, reject) {
			let fileReader = new FileReader();
			fileReader.onload = (e) => {
			  let arrayBuffer = fileReader.result;
			  tempData = new Uint8Array(arrayBuffer);
			  resolve(tempData);
			}			
			fileReader.onerror = (err) => {
				that.err = "Read fail :" + err;
				reject(err);;
			}
			fileReader.readAsArrayBuffer(data);
		});	
	}
	/**
     *  @dev _generateTxid
     *  Fun: Generate txid
     *  return txid
     */
    function _generateTxid() {
		return that.txid++;
	}

}

if (typeof(window) === 'undefined') {
    module.exports = {
		ClientSocket
	}
} else {
    window.ClientSocket = ClientSocket;
}
