const commonFun = require('./commonFun.js');
const vbsEncode = require('./encode.js');
const vbsDecode = require('./decode.js');
const  msgHeader  = require('./message.js').MsgHeader;
let NoError = "";

function ClientSocket(ws_server) {

    this.closed = false;
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
		    console.log('ws onmessage from server: ' + e.data);
		    let dataMsg = that.getData(e.data).then((data) => {
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
			console.log("Socket error: " + error);
	    };

		that.ws.onclose = function(evt) {
			that.closed = true;
			that.readyState = that.connectStatus.closing;
			console.log("Wait closing, there are");
			if(that.requestList.length == 0) {
	            that.readyState = that.connectStatus.closed;
	            clearTimeout(that.connectionTimeout);
	            console.log("Connection closed !");
	        } else {
	            that.connectionTimeout = setTimeout(() => {
			        that.requestList = that.requestList.pop(); 
		     	}, 5000);
	        }
		}; 
    }
	
    ClientSocket.prototype.sendData = function(msgBody) {
    	if (that.readyState  == that.connectStatus.open) {
			txid = _genarateTxid();
			let data = msgHead.questMsg(txid, "service", "method", {"d": "sdjkd"}, msgBody);	    	
	    	that.ws.send(data);
	    } else {
	    	that.err = "Please connect to server or Waiting server response ";
	    	return that.err;
	    }
    }
	
	ClientSocket.prototype.close = function() {
		return new Promise((res) => {
			if (that.requestList.length  == 0) {
				that.ws.send(msgHead.helloMsg('B'));
			} else {
				console.log("Waiting for all requests to return !");
			}
			if (!that.ws) {
                console.log("Websocket already cleared", this);
                return res();
            }
            if( that.ws.terminate ) {
                that.ws.terminate();
            }
            else{
                that.ws.close();
            }
            if (that.ws.readyState === 3) res();
		})
	}
	// // 解析当前帧状态
   ClientSocket.prototype.getData = function(data) {
    	let tempData;

		let decodeMsg = _readerBlob(data).then((result) => {
		    tempData = result;

			let msg = msgHead.decodeHeader(tempData);

			if (typeof msg.Type != "undefined") {
				switch (msg.Type) {
					case 'C':          
						this.readyState  = 1; // 
						break;
					case 'H':
						that.readyState  = 2;
						break;
					case 'B':
						that.readyState  = 3;
						that.ws.onclose();
						break;
				}
			}
			console.log("Receive data is : ", msg);
			return msg;
		 }).catch(function (error) {
		    console.log(error);
		    this.err = "Fail: " + error;
		    return this.err;
		});
		return decodeMsg;
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
		let min = 0, max = Math.pow(2, 64);
		return Math.round(Math.random() * (max - min)) + min;
	}

}

module.exports = {
	ClientSocket
}

function test() {
	let msg = {
			"dfhj": "dfhjdf",
			"dfdf": "fgjg",
			"title": "Q",
			"longName": "李四",
			"people": [
				{ "firstName": "Brett", "lastName":"McLaughlin", "email": "aaaa" },
				{ "firstName": "Jason", "lastName":"Hunter", "email": "bbbb"},
				{ "firstName": "Elliotte", "lastName":"Harold", "email": "cccc" },
				{ "secondName": "Brett", "lastName":"McLaughlin", "email": "aaaa" },
				{ "secondName": "Jason", "lastName":"Hunter", "email": "bbbb"},
				{ "secondName": "Elliotte", "lastName":"Harold", "email": "cccc" },
				{ "firstName": "Brett", "lastName":"HJDFdfdf", "email": "aaaa" },
				{ "firstName": "Jason", "lastName":"Hdfdf", "email": "bbbb"},
				{ "firstName": "Elliotte", "lastName":"Hdfld", "email": "cccc" }
			]
	};
	// ws://192.168.199.136:8888/
   // ws://192.168.199.120:8888/
   // wss://echo.websocket.org
   let client = new ClientSocket('wss://echo.websocket.org', msg);
}
// test();