const commonFun = require('./commonFun.js');
const vbsEncode = require('./encode.js');
const vbsDecode = require('./decode.js');
let NoError = "";
function ClientSocket() {
	let st = {
		index: 0, 
		remains: 0
	};
	let err = "";
	ClientSocket.prototype.content = {  // global variable in VbsDecoder
        pingTimes: 0,
		OPEN: true,
		dataList: [],
		state: st // 同一份数据不同帧的序列号
    };
    this.sendAndReceive = function(msg) {
    	// Create WebSocket connection.
		let ws = new WebSocket('wss://echo.websocket.org');
		// let ws = new WebSocket('ws://192.168.199.133:8888/');
		ws.onopen = function () {
			console.log('ws onopen');
			let data = msgHead(msg);
			console.log('ws send data: ', data);
		    ws.send(data);
		};
		ws.onmessage = function (e) {
		    console.log('ws onmessage');
		    console.log('from server: ' + e.data);
		    let data = getData(e.data);
	        console.log("@@", data)
		};
		ws.onclose = function(evt) {
		    console.log("Connection closed.");
		}; 
    }
	// 封装数据
	function msgHead(msg) {
		// 控制位: FIN, Opcode, MASK, Payload_len
		let preBytes = [], 
		    // payBytes = vbsEncode.encodeVBS(msg);
		    payBytes = vbsEncode.encodeVBS(msg);
		let dataLength = payBytes.byteLength;
		// 构建Frame的第一字节
		preBytes.push(0x51);  // "Q"
		// 处理不同长度的dataLength，构建Frame的第二字节（或第2～第8字节）
		// 注意这里以大端字节序构建dataLength > 126的dataLenght
		preBytes.push( // 3个字节
		    (dataLength & 0xFF0000) >> 16,
		    (dataLength & 0xFF00) >> 8,
		    dataLength & 0xFF
		);
		let u8a =new Uint8Array(preBytes.length + dataLength);
		u8a.set(new Uint8Array(preBytes), 0); 
    	u8a.set(new Uint8Array(payBytes), preBytes.length);
		
		return u8a.buffer;
	}
	function blob2abu(blob) {
		let arrayBuffer;
		let uint8Buf;
		let fileReader = new FileReader();
	    fileReader.readAsArrayBuffer(blob);
	    fileReader.onloadend = function (e) {
	    	if(fileReader.result === null) {
	          console.log('readFile unexpected this.result == null');
	          err = "ReadFile unexpected this.result == null !";
	          return;
	        }
			arrayBuffer = fileReader.result;
		    uint8Buf = new Uint8Array(arrayBuffer);
		    return uint8Buf;
		}
		fileReader.error = function (err) {
			err = "Cannot read anything !";
		}
	}
	// // 解析当前帧状态
    function getState(data) {
    	let tempData;
    	let fileReader = new FileReader();
		fileReader.readAsArrayBuffer(data);
		fileReader.onload = function(e) {
		  let arrayBuffer = fileReader.result;
		  tempData = new Uint8Array(arrayBuffer);
	    }
	    fileReader.onerror = function (err) {
			err = "Read fail :" + err;
			return;
		}

        let fin = tempData[0];    //A
        let payloadLength;
        let payloadData;
       	payloadLength = ((tempData[1] & 0xFF) << 16) | (tempData[2] & 0xFF) << 8 | (tempData[3] & 0xFF);

        payloadData = vbsDecode.decodeVBS(tempData, 4);

        this.state = Object.assign({}, {
            fin,
            payloadData,
            payloadLength
        });
    }
	// 解析数据
	// 收集本次message的所有数据
    function getData(data) {
        getState(data);
        if (err != NoError) {
        	return err;
        }
        // 收集本次数据流数据
        return this.state.payloadData;  
    }
}

function webSocket(data) {
   let client = new ClientSocket();
   client.sendAndReceive(data);
}

module.exports = {
	webSocket
}

function test() {
	let msg = {
			"dfhj": "dfhjdf",
			"dfdf": "fgjg",
			"title": "Q",
			"len": "206",
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
	webSocket(msg);
}
test();