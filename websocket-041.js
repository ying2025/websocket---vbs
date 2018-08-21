const commonFun = require('./commonFun.js');
const vbsEncode = require('./encode.js');
const vbsDecode = require('./decode.js');
const  msgHeader  = require('./message.js').MsgHeader;
let NoError = "";
let keep_alive_interval = 5000;
let max_send_life = 5;
let max_recv_life = max_send_life * 2;
class ClientSocket {
	constructor(ws_server, msg, connectTimeout = 5000, keepAliveCb=null) {
		this.current_reject = null; 
	    this.on_reconnect = null;
	    this.closed = false;
	    this.send_life = max_send_life;
	    this.recv_life = max_recv_life;
	    this.remain_request_number = 0;
	    this.err = "";
	    this.connectionTimeout = setTimeout(() => {
	        if (this.current_reject) {
	            this.current_reject = null;
	            this.err = "Connection attempt timed out after " + connectTimeout / 1000 + "s";
	        }
	     }, connectTimeout);
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
	    // readyState ： 0 连接还没开启
	    this.connectStatus = {
	    	noConnect: 0,  // 未连接
	    	connecting: 1, // 连接中
	    	open: 2,   // 已连接可以通信
	    	closing: 3, // 关闭中
	    	closed: 4  // 已关闭
	    };
	    this.readyState  = 0;
	    let forcedClose = false;

	    // this.connect_promise = new Promise(function(resolve, reject) {
	    // 	this.current_reject = reject;
	    // 	try {
	    // 		this.ws = new WebSocket(ws_server);
	    // 	} catch (e) {
	    // 		this.ws = {readyState: 3, close: () => {}}; // DISCONNECTED
     //            reject(new Error("Invalid url", ws_server, " closed"))
	    // 	}
	    // });

		this.ws = new WebSocket(ws_server);
		this.ws.onopen = function () {
		    clearTimeout(this.connectionTimeout);		
			if (this.readyState  == this.connectStatus.noConnect) {
				let msgHead = new msgHeader();
				this.ws.send(msgHead.helloMsg('H'));
			}
			
			if (this.readyState == this.connectStatus.open) {
				let msgHead = new msgHeader();
				this.ws.send(msgHead.helloMsg('B'));
		    	// ws.send(msgHead.questMsg(783, "service", "method", {"d": "sdjkd"}, msg));
			}

			this.remain_request_number++;
	        if(this.on_reconnect) this.on_reconnect();
			keepalive_timer2 = setInterval(()=>{
		        this.remain_request_number--;
		        if(this.remain_request_number <= 0){
		            console.error(ws_server + ' connection is dead, terminating ws');
		            this.close();
		            return;
		        }       
		    }, 5000);
	    	console.log(keepalive_timer2)
       		this.current_reject = null;
	    };

		this.ws.onmessage = function (e) {
			this.recv_life = max_recv_life;
		    console.log('ws onmessage from server: ' + e.data);
		    let data = this.getData(e.data);
		    this.remain_request_number--;
	        console.log("@@", data);
		};

		this.ws.onerror = function(error) {
			clearInterval(this.keepalive_timer);
	        if (this.keepalive_timer){
	            clearInterval(this.keepalive_timer);
	        }
	        clearTimeout(this.connectionTimeout);
	    };

		this.ws.onclose = function(evt) {
			this.closed = true;
			clearTimeout(this.connectionTimeout);
			this.readyState = this.connectStatus.closing;
			console.log("Wait closing.");
			if(this.remain_request_number == 0){
				console.log(keepalive_timer2)
				clearInterval(keepalive_timer2);
	            this.readyState = this.connectStatus.closed;
	            console.log("Connection closed.");
	        }
		}; 
	}
	
	
	close() {
		return new Promise((res) => {
			 clearInterval(this.keepalive_timer);
			 if (!this.ws) {
                console.log("Websocket already cleared", this);
                return res();
            }
            if( this.ws.terminate ) {
                this.ws.terminate();
            }
            else{
                this.ws.close();
            }
            if (this.readyState === 3) res();
		})
	}
	reader(data) {
		let tempData;
		return new Promise( function(resolve, reject) {
			let fileReader = new FileReader();
			fileReader.onload = (e) => {
			  let arrayBuffer = fileReader.result;
			  tempData = new Uint8Array(arrayBuffer);
			  resolve(tempData);
			}			
			fileReader.onerror = (err) => {
				this.err = "Read fail :" + err;
				reject(err);;
			}
			fileReader.readAsArrayBuffer(data);
		});
		
	}
	// // 解析当前帧状态
    getState(data) {
    	let tempData;

		reader(data).then(function (result) {
		    tempData = result;
		    let msgHead = new msgHeader();
			let [msg, err] = msgHead.decodeHeader(tempData);

			if (typeof msg.Type != "undefined") {
				switch (msg.Type) {
					case 'C':          
						this.readyState  = 1; // 
						break;
					case 'H':
						this.readyState  = 2;
						this.ws.onopen();
						break;
					case 'A':
						this.readyState  = 3;
						break;
					case 'B':
						this.readyState  = 3;
						this.ws.onclose();
						break;
				}
			}
			return [msg, err];
		 }).catch(function (error) {
		    console.log(error);
		    this.err = "Fail: " + error;
		    return this.err;
		});
    }
	// 解析数据
	getData(data) {
        return this.getState(data);
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
test();