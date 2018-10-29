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
let ReconnectFlag = false;
function ClientSocket() {
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
			    	ReconnectFlag = false;
			    	if (that.sendList.length != 0) {
			    		console.log(that.sendList)
			    		console.log("data list", that.sendDataList);
		    			that.sendDataList.filter((v, j) => {
		    				console.log("list", v, j);
							if (that.sendList.indexOf(j+1) != -1) {  // txid start from 1 
							  if (typeof v[j+1] != "undefined" && v[j+1] != undefined) { // sendList is disordered
							  		that.ws.send(that.msgHead.cryptQuest(v[j+1]));
							  } else {
							  	    that.ws.send(that.sendDataList[that.sendList.indexOf(j+1)][j+1]);
							  	  // console.log("rendData list",that.sendList.indexOf(j+1),j, that.sendDataList[that.sendList.indexOf(j+1)][j+1]);
							  }
							}
						});
		    		}
			    	// Temp test add 
    				// that.ws.send(that.msgHead.packMsg('H'));
			    }
		    }).catch((error) => {
		    	callback(error);
		    });		    
		};

		that.ws.onerror = function(error) {
			that.readyState = that.connectStatus.closing;
			console.log("Socket error: ", error);
			ReconnectFlag = true;
			callback(that.readyState);
	    };

		that.ws.onclose = function(evt) {	
			that.readyState = that.connectStatus.closed;
			callback(that.readyState);
			ReconnectFlag = true;
			console.log("connection closed!", evt);
			if (that.sendList.length != 0) {
				that.connect(that.url ,(readyState) => { // try to connect ws_server
					if (readyState == 2) {
						that.msgHead = new msgHeader();
					} 
					that.attempTime++;
					if (that.attempTime >= that.maxAttempTimes) {
						that.attempTime = 0;
						throw new Error("connection fail");
						return;
					}
				});
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
	    		// if (txid == 1) {
	    		// 	txid = 2;
	    		// } else if(txid == 2){
	    		// 	txid = 1;
	    		// }
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
			let msg = that.msgHead.decodeHeader(that.ws, result);
			if (typeof msg.type != "undefined") {
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
			return msg;
		 }).catch(function (error) {
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
            if( that.ws.terminate ) {
                that.ws.terminate();
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
		let m = 0; // connect ws_server' times
		let resendTimer = setInterval(() => {
			if (that.sendList.length == 0) {
				clearInterval(resendTimer);
				if (flag) {
					that.ws.close();
				}
				return true;
			}
			that.sendDataList.filter((v, j) => {
				if (that.sendList.indexOf(j+1) != -1) {  // txid start from 1 
					if (that.ws.readyState == 1) {
						that.readyState = 2;
						if (that.sendList.length == 0 || m >= that.maxAttempTimes) {
							clearInterval(resendTimer);
							if (flag) {
								console.log("flag", flag);
								that.ws.close();
							}
							console.log(22222);
							return;
						}	
						sleep(1000);
						console.log("mmmm", m)
					} else {
						that.connect(that.url ,(readyState) => { // try to connect ws_server
							if (readyState == 2) {
								that.msgHead = new msgHeader();
								ReconnectFlag = false;
								if (that.sendList.length == 0) {
									clearInterval(resendTimer);
									return true;
								}
							} 
						});
						if (m > that.maxAttempTimes) {
							clearInterval(resendTimer);
							that.ws.close();
							return true;
						}
					}
					m++;
				}
			});	
		}, 1000);
		if (that.sendList.length == 0) {
			return true;
		} else {
			return false;
		}
		
	}
	/**
     *  @dev sleep
     *  Fun: time sleep
     */
	function sleep(time){
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
    window.ReconnectFlag = ReconnectFlag;
}
