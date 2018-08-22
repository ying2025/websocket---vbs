const commonFun = require('./commonFun.js');
const vbsEncode = require('./encode.js');
const vbsDecode = require('./decode.js');
const  msgHeader  = require('./message.js').MsgHeader;
let NoError = "";

function ClientSocket(ws_server) {

    this.err = "";
    this.connectionTimeout = null;
    this.requestList = [];
    this.receiveData = {};

	let st = {
		index: 0, 
		remains: 0
	};
	this.content = {  
        pingTimes: 0,
		OPEN: true,
		dataList: [],
		state: st, // 同一份数据不同帧的序列号
		ws_server: ''
    };
    this.connectStatus = {
    	noConnect: 0,  // 未连接
    	connecting: 1, // 连接中
    	open: 2,   // 已连接可以通信
    	closing: 3, // 关闭中
    	closed: 4  // 已关闭
    };
    this.readyState  = 0;
    let txid = 0;
    let i = 0;

    let that = this; // ClientSocket
    let msgHead = new msgHeader();
    
    ClientSocket.prototype.connect = function(callback) {
    	that.ws = new WebSocket(ws_server);

    	that.ws.onopen = function () {	
			if (that.readyState  == that.connectStatus.noConnect) {
				that.ws.send(msgHead.helloMsg('H'));
			} 
		};

		that.ws.onmessage = function (e) {
		    let dataMsg = that.getData(e.data).then((data) => {
		    	console.log('ws onmessage from server: ', data);
		    	if (data.Type !== undefined && data.Type == 'H') {
			    	callback(that.readyState);
			    }
			    if (typeof data != "undefined" && typeof data.txid != "undefined") {
			    	that.requestList = that.requestList.filter(v => v!= data.txid); // delete txid in data.txid
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
			callback(that.readyState);
		}; 
    }
	
    ClientSocket.prototype.sendData = function(msgBody) {
    	if (that.readyState  == that.connectStatus.open) {
			txid = _genarateTxid();
			let data = msgHead.questMsg(txid, "service", "method", {"d": "sdjkd"}, {"arg": msgBody});	    	
	    	that.ws.send(data);
	    } else {
	    	that.err = "Please connect to server";
	    	return that.err;
	    }
    }
	
	// decode blob data
    ClientSocket.prototype.getData = function(data) {

		let decodeMsg = _readerBlob(data).then((result) => {

			let msg = msgHead.decodeHeader(result);
			if (typeof msg.Type != "undefined") {
				switch (msg.Type) {
					case 'C':          
						that.readyState  = 1; // 
						break;
					case 'H':
						that.readyState  = 2;
						break;
					case 'B':
						that.ws.onclose();
						break;
				}
			}
			console.log("Receive data is : ", msg);
			return msg;
		 }).catch(function (error) {
		    this.err = "Fail: " + error;
		    return this.err;
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
			if (that.requestList.length  == 0) {
				that.ws.send(msgHead.helloMsg('B'));
			} else {
				this.err = "Waiting for all requests to return, and there are " + that.requestList.length + " number of bars without receiving";
				return reject(this.err);
			}
		})
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
		let min = 0, max = Math.pow(2, 53);
		return Math.round(Math.random() * (max - min)) + min;
	}

}

if (typeof(window) === 'undefined') {
    module.exports = {
		ClientSocket
	}
} else {
    window.ClientSocket = ClientSocket;
}