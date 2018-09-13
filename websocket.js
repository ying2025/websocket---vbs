const commonFun = require('./commonFun.js');
const vbsEncode = require('./VBS/encode.js');
const vbsDecode = require('./VBS/decode.js');
const  msgHeader  = require('./message.js').MsgHeader;
let NoError = "";
let WebSocketClient;
if (typeof WebSocket == "undefined" && !process.env.browser) {
	WebSocketClient = require("ws");
} else {
	WebSocketClient = WebSocket;
}

function ClientSocket() {
	let resendTimer = null;
    this.err = "";
    this.requestNumber = []; // record the request txid sequence
    this.requestList = []; // record the request txid and data sequence
    this.url = '';

	let st = {
		index: 0, 
		remains: 0
	};
    this.connectStatus = {
    	noConnect: 0,  //  yet connect
    	connecting: 1, // connecting
    	open: 2,   // open and ready to communicate.
    	closing: 3, // closing
    	closed: 4  // closed
    };
    this.readyState  = 1; 
    this.txid = 0;

    let i = 0;
    this.lockReconnect = false; 
    this.reconnectionAttempted = 0;

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
			that.ws.send(that.msgHead.packMsg('H'));
		};

		that.ws.onmessage = function (e) {
		    let dataMsg = that.getData(e.data).then((data) => {
		    	console.log('ws onmessage from server: ', data);
		    	if (data.type !== undefined && data.type == 'H') {
			    	callback(that.readyState);
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
			console.log("connection closed!", evt);
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
			callback(that.readyState);
		}; 
    }
	/**
     *  @dev sendData
     *  Fun: Send data to server. The data to server use xic as header and the vbs code as body.
     *  @param {msgBody} message body.
     *  Additional describe: that.requestNumber use to record sequence that send to server
     *		that.requestList use to record sequence and the relevant data
     */
    ClientSocket.prototype.sendData = function(msgBody) {
    	if (that.readyState  == that.connectStatus.open) {
			let txid = _generateTxid();
			
			let data = that.msgHead.packQuest(txid, "service", "method", {"d": "sdjkd"}, {"arg": msgBody});	    	
	    	that.ws.send(data);
	    	that.requestNumber[i++] = txid;

	    	let obj = {[txid]: data};
	    	that.requestList.push(obj);
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
			let msg = that.msgHead.decodeHeader(result);
			if (typeof msg.type != "undefined") {
				switch (msg.type) {
					case 'C':          
						that.readyState  = 1; // 
						break;
					case 'H':
						that.readyState  = 2; // Can send message
						break;
					case 'B':
						that.lockReconnect = false;
						that.ws.onclose();
						break;
					case 'A':
						// TODO 
						that.requestNumber = that.requestNumber.filter(v => v!= msg.txid);
						if (that.requestNumber.length == 0) {
					    	clearInterval(resendTimer);
						}
						break;
				}
			}
		    console.log("Remaining request : ", that.requestNumber.length);
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
			if (that.requestNumber.length == 0) {
				that.lockReconnect = false;
				that.ws.send(that.msgHead.packMsg('B'));
			} else {
				_graceClose();
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
		let len = that.requestNumber.length;
		let waitSendMsg = [];
		// According the txid sequence to find the data
		that.requestList.filter((v, j) => {
			if (that.requestNumber.indexOf(j) != -1) {
				waitSendMsg.push(Object.values(v));
			}
		});
		let k = 0;
		let m = 0; // connect ws_server' times
		resendTimer = setInterval(() => {
			if (k >= waitSendMsg.length) {
				clearInterval(resendTimer);
		    	return;
			}	
			if (that.requestNumber.length > 0 && that.ws.readyState == 3) {
				m++;
				if (m > 3) {  // At most connect 3 times
					clearInterval(resendTimer);
					return;
				}
				that.connect(that.url ,(readyState) => { // try to connect ws_server
					if (readyState == 2) {
						that.ws.sendData(waitSendMsg[k++]);
					}
				});
			} else { // Server online, send the message directly to server.
				that.ws.send(waitSendMsg[k++]);
			}		
		}, 1000);
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
