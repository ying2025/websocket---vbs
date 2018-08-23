const commonFun = require('./commonFun.js');
const vbsEncode = require('./encode.js');
const vbsDecode = require('./decode.js');
const  msgHeader  = require('./message.js').MsgHeader;
let NoError = "";
let WebSocketClient;
if (typeof WebSocket == "undefined" && !process.env.browser) {
	WebSocketClient = require("ws");
} else {
	WebSocketClient = WebSocket;
}
function ClientSocket(ws_server) {

    this.err = "";
    this.connectionTimeout = null;
    this.requestList = [];
    this.receiveData = {};

	let st = {
		index: 0, 
		remains: 0
	};
    this.connectStatus = {
    	noConnect: 0,  // 未连接
    	connecting: 1, // 连接中
    	open: 2,   // 已连接可以通信
    	closing: 3, // 关闭中
    	closed: 4  // 已关闭
    };
    this.readyState  = 1;
    this.txid = 0;

    let i = 0;
    this.lockReconnect = false; 
    this.reconnectionAttempted = 0;

    let that = this; // ClientSocket
    that.msgHead = new msgHeader();
    
    ClientSocket.prototype.connect = function(callback) {
    	try {
    	    that.ws = new WebSocketClient(ws_server);
    	} catch (error) {
    		that.ws = {readState: 3,close:() => {}}; // DISCONNECTED
    		return new Error("Invalid url", ws_server, " closed !");
    	}
    	// that.ws.binaryType = 'arraybuffer';
    	that.ws.onopen = function () {	
    		that.reconnectionAttempted = 0;
			that.ws.send(that.msgHead.packMsg('H'));
		};

		that.ws.onmessage = function (e) {
		    let dataMsg = that.getData(e.data).then((data) => {
		    	console.log('ws onmessage from server: ', data);
		    	if (data.Type !== undefined && data.Type == 'H') {
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
						that.connect(() => {});
						that.lockReconnect = false;
						console.log("Reconnect start: ", that.reconnectionAttempted);
					}, Math.floor(Math.random() * 4000));
				}
			} 
			callback(that.readyState);
		}; 
    }
	
    ClientSocket.prototype.sendData = function(msgBody) {
    	if (that.readyState  == that.connectStatus.open) {
			let txid = _genarateTxid();
			
			let data = that.msgHead.packQuest(txid, "service", "method", {"d": "sdjkd"}, {"arg": msgBody});	    	
	    	that.ws.send(data);
	    	that.requestList[i++] = txid;
	    } else {
	    	that.err = "Please connect to server";
	    	return that.err;
	    }
    }
	
	// decode blob data
    ClientSocket.prototype.getData = function(data) {

		let decodeMsg = _readerBlob(data).then((result) => {
			let msg = that.msgHead.decodeHeader(result);
			if (typeof msg.Type != "undefined") {
				switch (msg.Type) {
					case 'C':          
						that.readyState  = 1; // 
						break;
					case 'H':
						that.readyState  = 2; // Can send message
						break;
					case 'B':
						that.ws.onclose();
						break;
					case 'A':
						// TODO
						that.requestList = that.requestList.filter(v => v!= msg.txid);
						i--;
						break;
				}
			}
		    console.log("Remaining request : ", that.requestList.length);
			return msg;
		 }).catch(function (error) {
		    return error;
		});
		return decodeMsg;
    }

    ClientSocket.prototype.close = function() {
		return new Promise((resolve, reject) => {
			if (!that.ws) {
                that.err = "Websocket already cleared !";
                return reject(that.err);
            }
            if( that.ws.terminate ) {
                that.ws.terminate();
            }
			if (that.requestList.length == 0) {
				that.lockReconnect = false;
				that.ws.send(that.msgHead.packMsg('B'));
			} else {
				this.err = "Waiting for all requests to return, and there are " + that.requestList.length + " number of bars without receiving";
				return reject(this.err);
			}
		});
	}

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

    function _genarateTxid() {
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
