const commonFun = require('./commonFun.js');
const vbsEncode = require('./VBS/encode.js');
const vbsDecode = require('./VBS/decode.js');
const  msgHeader  = require('./message.js').MsgHeader;
let emptyString = "";
let WebSocketClient;
if (typeof WebSocket == "undefined" && !process.env.browser) {
	WebSocketClient = require("ws");
} else {
	WebSocketClient = WebSocket;
}

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
    this.txid = 0;

    this.lockReconnect = false; 
    this.reconnectionAttempted = 0;
    this.reConnectionFlag = false;  // 

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
    	that.ws.onopen = function () {	
    		that.reconnectionAttempted = 0;
		};

		that.ws.onmessage = function (e) {
		    let dataMsg = that.getData(e.data).then((data) => {
		    	console.log('ws onmessage from server: ', data);
		    	if (data.type !== undefined && data.type == 'H') {
			    	callback(that.readyState);
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
			callback(that.readyState);
	    };

		that.ws.onclose = function(evt) {	
			that.readyState = that.connectStatus.closed;
			callback(that.readyState);
			console.log(that.readyState, "connection closed!", evt);
			// Abnormal closure, auto reconnect to server if it is 
			if (that.lockReconnect && that.reconnectionAttempted == 0) {
				if (that.ws.readyState == that.ws.CLOSED) { 
					that.reconnectionAttempted++;
					that.ws = undefined;
					setTimeout(() => {
						that.connect(that.url, () => {});
						that.lockReconnect = false;
						console.log("Reconnect start: ", that.reconnectionAttempted);
					}, Math.floor(Math.random() * 4000));
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
    ClientSocket.prototype.sendData = function(msgBody) {
    	if (that.readyState  == that.connectStatus.open) {
			let txid = _generateTxid();
			// if (that.sendList.length > 5) {
			// 	that.err = "Please send message to server later !";
			// 	return that.err;
			// }
			let data = that.msgHead.packQuest(txid, "service", "method", {"d": "sdjkd"}, {"arg": msgBody});	    	
	    	that.ws.send(data);
	    	if (txid != 0) {
	    		that.sendList[that.sendList.length] = txid;
	    	}
	    	let obj = {[txid]: data};
    		that.sendDataList.push(obj);
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
						that.lockReconnect = false;
						that.readyState  = 3;
						let allowClose = _graceClose();
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
		return new Promise((resolve, reject) => {
			if (!that.ws) {
                that.err = "Websocket already cleared !";
                return reject(that.err);
            }
            if( that.ws.terminate ) {
                that.ws.terminate();
            }
            let allowClose = _graceClose();
            if (allowClose) {
            	that.ws.send(that.msgHead.packMsg('B'));
            } else {
            	console.log("Waiting !!");
            }
		});
	}
	/**
     *  @dev _graceClose
     *  Fun: Gracefully close the connection
     *  Additional describe: If the sequence of the request is empty, close it directly, 
     *  or send the undeal message to server
     */
     function _graceClose() {
		let len = that.sendList.length;
		let recLen = that.msgHead.receiveList.length;
		while(recLen != 0) {
			console.log("Waiting to receive txid list", that.msgHead.receiveList);
		}
		if (len == 0) {
			that.lockReconnect = false;
			return true;
		}
		// According the txid sequence to find the data
		let m = 0; // connect ws_server' times
		let resendTimer = setInterval(() => {
			if (that.sendList.length == 0) {
				clearInterval(resendTimer);
				return true;
			} 
			that.sendDataList.filter((v, j) => {
				// Todo
				if (that.sendList.indexOf(j) != -1) {
					if (that.ws.readyState == 1) {
						that.readyState = 2;
						if (that.sendList.length == 0 || m > 3) {
							clearInterval(resendTimer);
							return true;
						}
					} else {
						that.connect(that.url ,(readyState) => { // try to connect ws_server
							if (readyState == 2) {
								that.lockReconnect = false;
								that.reConnectionFlag = true;
								that.msgHead = new msgHeader();
								clearInterval(resendTimer);
								that.sendList.length = 0;
								return true;
							}
						});
					}
				}
				m++;
			});	
		}, 1000);
		if (that.sendList.length == 0) {
			return true;
		} else {
			return false;
		}
		
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
