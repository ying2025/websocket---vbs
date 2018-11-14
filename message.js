const vbsEncode = require('./VBS/encode.js');
const vbsDecode = require('./VBS/decode.js');
const commonFun = require('./commonFun.js');
const srp6aClient = require('./srp6a/SRP6a.js').NewClient;

let emptyString = "";
let maxMessageSize = 64*1024*1024;
let send_nonce = 30000000023234; // counter of sending to server 
let send_add_state = 2; // The step of each increase

class MsgHeader {
	constructor() {
		this._messageHeader = {
			magic: 'X', // 'X'  0x58
			version: '!', // '!' 0x21
			type: '',      // 'Q', 'A', 'H', 'B', 'C'
			flags: 0x00,   // 0x00 or 0x01, default 0x00
			bodySize: 0    // 4 bytes and big endian byte order
		};
		this._quest = {
			txid: 0,
			service: "",
			method: "",
			ctx: "",
			args: ""
		};
		this._answer = {
			txid: 0,
			status: 0,
			argsOff: 0,
			args: {}
		};
		this._check = {
			cmd: "",
			arg: {}
		};
		this._isEnc = false; // whether encrypt
		this.isDealFlag = false;
		this.err = "";
		this.packet = [];
		this.send_nonce = send_nonce;
    	this.noce_increase_step = send_add_state;
    	this.alreadyPassCheck = false;
    	this.vec = {
            key: "8395FCF1E95BEBD697BD010BC766AAC3",
            nonce: "22E7ADD93CFC6393C57EC0B3C17D6B44",
            header: "126735FCC320D25A",
            ct: "CB8920F87A6C75CFF39627B56E3ED197C552D295A7CFC46AFC253B4652B1AF3795B124AB6E"
        };
    	this.id = "alice";
    	this.pass = "password123";
    	this.cli = null;
    	this.receiveList = []; // Similar a server  record the receive txid sequence
    	this.receiveDataList = []; // Similar a server  record the receive txid and data sequence
	}
	/**
     *  @dev fillHeader
     *  Fun: Pack the header of the message
     *  @param {type} message type
     *  @param {len}  message length
     */
	fillHeader(type, len) {
		if (len < 0) {
			this.err = "Can't reach here";
			return;
		} else if (len > maxMessageSize) {
			this.err = "Size is to large" + len;
			return;
		}
		this.packet[0] = 0x58; // 'X' 
		this.packet[1] =  0x21; // '!'
		this.packet[2] = type.charCodeAt(); // type
		this.packet[3] = this._messageHeader.flags; // flag
		this.packet[4] = (len >> 24) & 0xFF;
		this.packet[5] = (len >> 16) & 0xFF;
		this.packet[6] = (len >> 8) & 0xFF;
		this.packet[7] = len & 0xFF;
	}
	/**
     *  @dev packCheck
     *  Fun: Pack the Srp6a message round
     *  @param {command} command
     *  @param {args}  Srp6a message round
     */
	packCheck(command, args) {
		let cmdBytes = vbsEncode.encodeVBS(command);
		let argBytes = vbsEncode.encodeVBS(args);
		
		let n = cmdBytes.byteLength + argBytes.byteLength;
		this.fillHeader('C', n);
		let u8a = new Uint8Array(8 + n);
		u8a.set(this.packet, 0);
		u8a.set(new Uint8Array(cmdBytes), 8);
		u8a.set(new Uint8Array(argBytes), 8 + cmdBytes.byteLength);
		return u8a.buffer;
	}
	/**
     *  @dev packMsg
     *  Fun: send header to server
     *  @param {type}  message type
     */
	packMsg(type) {
		this.fillHeader(type, 0);	
		this.packet[3] = 0x00;
		let u8a = new Uint8Array(this.packet);
		return u8a.buffer;
	}
	/**
     *  @dev packQuest
     *  Fun: pack message, send to server.
     *  @param {txid}  query txid
     *  @param {service}  service name
     *  @param {method}  method name
     *  @param {ctx}  context
     *  @param {args}  param
     *  Additional describe: If encrypt then the format is nonce(8 bytes) + header(8 bytes) + message(ciphertext)
     *                   else header(8 bytes) + message(Plaintext)
     */
	packQuest(txid, service, method, ctx, args) {
		if (txid < 0) {
			this.err = "txid not set yet";
			return this.err;
		}
		let newTxid = vbsEncode.encodeVBS(txid);
		let newService = vbsEncode.encodeVBS(service);
		let newMethod =  vbsEncode.encodeVBS(method);
		let newCtx = vbsEncode.encodeVBS(ctx);
		let newArg = vbsEncode.encodeVBS(args);

		let n1 = newTxid.byteLength + newService.byteLength;
		let n2 = newMethod.byteLength + newCtx.byteLength;
		let len = n1 + n2 + newArg.byteLength; 

		let u8a = new Uint8Array(len);
		u8a.set(new Uint8Array(newTxid), 0); 
    	u8a.set(new Uint8Array(newService), newTxid.byteLength);
		u8a.set(new Uint8Array(newMethod), n1);
		u8a.set(new Uint8Array(newCtx), n1 + newMethod.byteLength);
		u8a.set(new Uint8Array(newArg), n1 + n2);
		let msgBuffer = this.cryptQuest(u8a);
		console.log("send data id ", txid);
		return [u8a, msgBuffer];
	}
	cryptQuest(u8a) {
		let msg;	
		if (this._isEnc) {
			this._messageHeader.flags = 0x01;
		}
		let len = u8a.length;
		this.fillHeader('Q', len);

		this.send_nonce += this.noce_increase_step;
		if (this._isEnc) {
			let et = this.cryptoData(u8a);
			let nonNum = vbsEncode.encodeVBS(this.send_nonce);
			let ct = this.convertWordArrayToUint8Array(et);
			msg = new Uint8Array(ct.byteLength + 16);	
			msg.set(new Uint8Array(nonNum), 0);
			msg.set(this.packet, 8);
			msg.set(ct, 16);	
		} else {
			msg = new Uint8Array(u8a.byteLength + 8);
			msg.set(this.packet, 0);
			msg.set(u8a, 8);
		}
		return msg.buffer;
	}
	/**
     *  @dev cryptoData
     *  Fun: create ciphex object, then encrypt message
     *  @param {uint8Msg}  Data to be encrypted
     */
	cryptoData(uint8Msg) {
		let et;
		if (typeof(window) === 'undefined') { // server
			let fs = require("fs");
			let CryptoJS = require('crypto-js/core');
			require('cryptojs-extension/build_node/eax.js');

			let keyBytes = CryptoJS.enc.Hex.parse(this.vec.key),
	    	nonceBytes = CryptoJS.enc.Hex.parse(this.vec.nonce),
	    	headerBytes = CryptoJS.enc.Hex.parse(this.vec.header);
		    // let msgBytes = CryptoJS.lib.WordArray.create(uint8Msg);
		    let msgBytes = this.convertUint8ArrayToWordArray(uint8Msg);
		    let eax = CryptoJS.EAX.create(keyBytes);
		    eax.prepareEncryption(nonceBytes, [headerBytes]);
		    eax.update(msgBytes);
		    et = eax.finalize();
		} else {  // client
			let keyBytes = CryptoJS.enc.Hex.parse(this.vec.key),
	    	nonceBytes = CryptoJS.enc.Hex.parse(this.vec.nonce),
	    	headerBytes = CryptoJS.enc.Hex.parse(this.vec.header);
		    // let msgBytes = CryptoJS.lib.WordArray.create(uint8Msg);
		    let msgBytes = this.convertUint8ArrayToWordArray(uint8Msg);
		    let eax = CryptoJS.EAX.create(keyBytes);
		    eax.prepareEncryption(nonceBytes, [headerBytes]);
		    eax.update(msgBytes);
		    et = eax.finalize();
		}
	    
	    return et;
	}
	/**
     *  @dev decryptData
     *  Fun: create ciphex object, then encrypt message
     *  @param {uint8Msg}  Data to be encrypted
     */
	decryptData(et) {
		let pt;
		if (typeof(window) === 'undefined') {
			let fs = require("fs");
			let CryptoJS = require('crypto-js/core');
			require('cryptojs-extension/build_node/eax.js');

			let keyBytes = CryptoJS.enc.Hex.parse(this.vec.key),
				nonceBytes = CryptoJS.enc.Hex.parse(this.vec.nonce),
				headerBytes = CryptoJS.enc.Hex.parse(this.vec.header);
			let eax = CryptoJS.EAX.create(keyBytes);
			let etData = this.convertUint8ArrayToWordArray(et);
			pt = eax.decrypt(etData, nonceBytes, [headerBytes]);
		} else {
			let keyBytes = CryptoJS.enc.Hex.parse(this.vec.key),
			nonceBytes = CryptoJS.enc.Hex.parse(this.vec.nonce),
			headerBytes = CryptoJS.enc.Hex.parse(this.vec.header);
			let eax = CryptoJS.EAX.create(keyBytes);
			let etData = this.convertUint8ArrayToWordArray(et);
			pt = eax.decrypt(etData, nonceBytes, [headerBytes]);
		}
		return pt;
	}
	convertWordArrayToUint8Array(wordArray) {
		// let len = wordArray.words.length,
			   // u8_array = new Uint8Array(len << 2),
	    let len = wordArray.sigBytes,
	        u8_array = new Uint8Array(len),
	        offset = 0, word, i;
	    for (i=0; i<len; i++) {
	        word = wordArray.words[i];
	        u8_array[offset++] = word >> 24;
	        u8_array[offset++] = (word >> 16) & 0xff;
	        u8_array[offset++] = (word >> 8) & 0xff;
	        u8_array[offset++] = word & 0xff;
	    }
	    return u8_array;
	}
	// Uint8Array transfer to WordArray 
	convertUint8ArrayToWordArray(u8Array) {
		let words = [], i = 0, len = u8Array.length;
		while (i < len) {
			words.push(
				(u8Array[i++] << 24) |
				(u8Array[i++] << 16) |
				(u8Array
					[i++] << 8)  |
				(u8Array[i++])
			);
		}
		// return {sigBytes: words.length * 4,words: words};
		// adjust the len, avoid unreal bytes
		return {sigBytes: len, words: words}; 
	}
	/**
     *  @dev unpackCheck
     *  Fun: Unpack command and arg, according to command, send the relevant command to server 
     *  @param {uint8Arr}  command and arg
     */
	unpackCheck(uint8Arr) {
		this._messageHeader.type = 'C';
		let c = Object.assign(commonFun.deepClone(this._check), this._messageHeader);
		let pos = 0;
		[c.cmd, pos] = vbsDecode.decodeVBS(uint8Arr, 8);		
		[c.arg, pos] = vbsDecode.decodeVBS(uint8Arr, pos);
		let msg = this.dealCmd(c.cmd, c.arg);
		return msg;
	}
	/**
     *  @dev dealCmd
     *  Fun: According to command, send different command and param.
     *  @param {command}  command
     *  @param {arg} param
     */
	dealCmd(command, arg) {
		let msg;
		let tempData;
		switch(command) {
			case 'FORBIDDEN':
				this.forbidden(arg);
				break; 
			case 'AUTHENTICATE':
				msg = this.sendSrp6a1(arg);
				break;
			case 'SRP6a2':
				msg = this.sendSrp6a3(arg);
				break;
			case 'SRP6a4':
				msg = this.verifySrp6aM2(arg);
				break;		
			default:
				this.err = "Unknown command type !";	
				return;
		}
		return msg;
	}
	/**
     *  @dev sendSrp6a1
     *  Fun: create client object, set id and password of the client, send id to server.
     *  @param {args}  Srp6a message round
     */
	sendSrp6a1(args) {
		let method = args.method;
		if (method != "SRP6a") {
			this.err = "Unknown authenticate method "+ method;
			return;
		}
		// this.cli = commonFun.deepClone(new srp6aClient());
		this.cli = new srp6aClient();
		let identity = this.id;
		let pass = this.pass;
		this.cli.setIdentity(identity, pass);
		let command = "SRP6a1";
		let arg = {"I": identity};
		return this.packCheck(command, arg);
	}
	/**
     *  @dev sendSrp6a3
     *  Fun: set param of the client, generate A, compute M1.
     *           Send A and M1 to Server.
     *  @param {args}  Srp6a message round
     */
	sendSrp6a3(args) {
		let command = "SRP6a3";
		if (this.cli == null) {
			this.err = "Client cann't be empty !";
			return;
		}
		let hash = args.hash;
		let N = args.N;
		let g = args.g;
		let s = args.s;
		let B = args.B;
		s =	commonFun.strHex2Bytes(s);
		B = commonFun.strHex2Bytes(B); // HEX to byte
		
		this.cli._setHash(this.cli, hash);
		this.cli._setParameter(this.cli, g, N, N.length * 4); //N is string type rather than byte, so it multiply 4
		this.cli.setSalt(s);  // 设置cli的salt
		this.cli.setB(B); 
		// let a = "60975527035CF2AD1989806F0407210BC81EDC04E2762A56AFD529DDDA2D4393";
		// let A = this.cli._setA(a)   // cli设置a
		let A = this.cli.generateA();
		let S = this.cli.clientComputeS();
		let M1 = this.cli.computeM1(this.cli);
		if (this.cli.err != emptyString) {
			this.err = this.cli.err;
			return;
		}
		let A1 = commonFun.bytes2Str(A);
		let M11 = commonFun.bytes2Str(M1);
		let arg = {"A":A1, "M1":M11};
		return this.packCheck(command, arg);
	}
	/**
     *  @dev verifySrp6aM2
     *  Fun: According to srp6a, Compute M2, verify server send M2. Confirm the public key.
     *  @param {args} param
     */
	verifySrp6aM2(args) {
		let M2 = args.M2;
		let M2_min = this.cli.computeM2(this.cli);
		let M2_mine = new Uint8Array(M2_min);
		if (M2.toString() != M2_mine.toString()) {
			this._isEnc = false;
			this.err = "srp6a M2 not equal";
			return;
		}
		this.cli.computeK(this.cli);
		this.vec.key = commonFun.bytes2Str(this.cli._K);
		this._messageHeader.flags = 0x01; // encrypt
		this._isEnc = true;  // Encrypt flag
		this.alreadyPassCheck = true;
	}
	/**
     *  @dev forbidden
     *  Fun: Return why forbidden encrypt.
     *  @param {args} param
     */
	forbidden(args) {
		let reason = args.reason;
		if (typeof reason == "object") {
			reason =  JSON.stringify(reason);
		}
		this.err = "Authentication Exception " + reason;
		return;
	}
	/**
     *  @dev unpackQuest
     *  Fun: Unpack the receive message. If it is encrypt, decrypt it first.
     *         pack header and data, then get txid by decoding it with VBS
     *         Judge whether data is repeated. If it is, throw the new receive, 
     *		   and pack the error answer. Else decode q
     *		   pack answer 
     *  @param {uint8Arr} receive data
     */
	unpackQuest(uint8Arr) {
		let enc = uint8Arr[3];
		let len = ((uint8Arr[4] & 0xFF) << 24) + ((uint8Arr[5] & 0xFF) << 16) + ((uint8Arr[6] & 0xFF) << 8) + (uint8Arr[7] & 0xFF);
		if (this._isEnc || (enc == 0x01)) {
			let pt = this.decryptData(new Uint8Array(uint8Arr.buffer, 16, uint8Arr.length - 8));
			if (pt == false) {
				this.err = "Decrypt data Error !";
				return this.err;
			}
			let data = this.convertWordArrayToUint8Array(pt);
			let header = new Uint8Array(uint8Arr.buffer, 0, 8);
			
			let tempArr = new Uint8Array(8 + data.length);
			tempArr.set(header, 0);
			tempArr.set(data, 8);
			uint8Arr = tempArr;
		}
		let q = this.decodeQuest(len, uint8Arr);
		if (q.txid == 0) {
			return [q, undefined];
		}
		this._messageHeader.type = 'A';
		let a = Object.assign(commonFun.deepClone(this._answer), this._messageHeader);
		a.txid = q.txid;

		let content = new Uint8Array(uint8Arr.buffer, 9); // receive data expect txid 
		let repeateFlag = this.isAlreadReceive(content);
		let errFlag = (this.err != emptyString && this.err != undefined);
		if ((repeateFlag && this.isDealFlag) || errFlag) {
			a.status = 1;
			this.packUnormalAnswerArg(a,"exname",1001+q.txid,"tag","message","raiser",this.err);
			return [q, this.packAnswer(a)];
		}

		if (this.receiveList.indexOf(q.txid) == -1) {
			this.receiveDataList[q.txid] =  content// Record receive data list
			this.receiveList[this.receiveList.length] = q.txid;
			this.isDealFlag = true;
		}
		let msg = this.packAnswerBody(a);
		return [q, this.packAnswer(msg)];
	}
	/**
     *  @dev decodeQuest
     *  Fun: Decode quest
     *  @param {uint8Arr} receive data
     */
	decodeQuest(len, uint8Arr) {
		let pos = 0;
		this._messageHeader.type = 'Q';
		let q = Object.assign(commonFun.deepClone(this._quest), this._messageHeader);
		[q.txid, pos] = vbsDecode.decodeVBS(uint8Arr, 8);	
		[q.service, pos] = vbsDecode.decodeVBS(uint8Arr, pos);
		[q.method, pos] = vbsDecode.decodeVBS(uint8Arr, pos);
		[q.ctx, pos] = vbsDecode.decodeVBS(uint8Arr, pos);
		[q.args, pos] = vbsDecode.decodeVBS(uint8Arr, pos);
		if (8+len != pos) { // Decode Right
			this.err = "Decode message error, the length of encode byte dissatisfy VBS Requirement!";
		}
		return q;
	}
	/**
     *  @dev isAlreadReceive
     *  Fun: judge whether alread receive the same data.
     */
	isAlreadReceive(content) {
		let flag = false;
		this.receiveDataList.filter((v, j) => {
			if (content.toString() == v.toString()) {
				this.err = "Receive duplicate received data";
				flag = true;
				console.log("duplicate ID is:", j);
				return;
			}
		});
		return flag;
	}
	/**
     *  @dev packAnswerBody
     *  Fun: pack answer message. If it is unnormal, pack the error
     */
	packAnswerBody(a) {
		if (this.err != emptyString) {
			a.status = 1;
			this.packUnormalAnswerArg(a,"exname",1001 + a.txid,"tag","Expect answer","raiser",this.err);
		} else {
			a.status = 0;
			a.args = {};
			a.args["pass"] = "pass txid :" + a.txid; 
			a.args["first"] = "this is server1 reply";
			a.args["second"] = "this is server1 reply2";
		}
		return a;
	}
	/**
     *  @dev pac kAnswer
     *  Fun: encode answer message with VBS. If this._isEnc is true, pack nonce+header+ct
     *       else pack header+u8a
     */
	packAnswer(a) {
		let newTxid =  vbsEncode.encodeVBS(a.txid);
		let newStatus = vbsEncode.encodeVBS(a.status);
		let newArg = vbsEncode.encodeVBS(a.args);

		if (this._isEnc) {
			this._messageHeader.flags = 0x01;
		}
		let len = newTxid.byteLength + newStatus.byteLength + newArg.byteLength;
		this.fillHeader('A', len);

		let u8a = new Uint8Array(len);
		u8a.set(new Uint8Array(newTxid), 0); 
    	u8a.set(new Uint8Array(newStatus), newTxid.byteLength);
		u8a.set(new Uint8Array(newArg), newTxid.byteLength+newStatus.byteLength);

		let msg;
		if (this._isEnc) {
			let nonNum = vbsEncode.encodeVBS(this.send_nonce);
			this.send_nonce += this.noce_increase_step;
			let et = this.cryptoData(u8a);
			let ct = this.convertWordArrayToUint8Array(et);
			msg = new Uint8Array(ct.byteLength + 16);	
			msg.set(new Uint8Array(nonNum), 0);
			msg.set(this.packet, 8);
			msg.set(ct, 16);
		} else {
			msg = new Uint8Array(u8a.byteLength + 8);
			msg.set(this.packet, 0);
			msg.set(u8a, 8);
		}
		this.receiveList = this.receiveList.filter(v => v!= a.txid);
		return msg.buffer;
	}
	/**
     *  @dev packUnormalAnswerArg
     */
	packUnormalAnswerArg(a,exname,code,tag,message,raiser,detail) {
		a.args.exname = exname;
		a.args.code   =  code;
		a.args.tag   =  tag;
		a.args.message   =  message;
		a.args.raiser   =  raiser;
		a.args.detail   =  detail;
		return;
	}
	/**
     *  @dev unpackAnswer
     *  Fun: Unpack the receive message, if status is 0, the message is normal, or check the reason.
     *  @param {uint8Arr} receive data
     */
	unpackAnswer(uint8Arr) {
		// Normal
		this._messageHeader.type = 'A';
		let a = Object.assign(commonFun.deepClone(this._answer), this._messageHeader);
		let enc = uint8Arr[3];
		let len = ((uint8Arr[4] & 0xFF) << 24) + ((uint8Arr[5] & 0xFF) << 16) + ((uint8Arr[6] & 0xFF) << 8) + (uint8Arr[7] & 0xFF);
		let pos = 0;
		if (this._isEnc || (enc == 0x01)) {
			let pt = this.decryptData(new Uint8Array(uint8Arr.buffer, 16, uint8Arr.length - 8));
			if (pt == false) {
				this.err = "Decrypt data Error !";
				return this.err;
			}
			let data = this.convertWordArrayToUint8Array(pt);
			let header = new Uint8Array(uint8Arr.buffer, 0, 8);			
			let tempArr = new Uint8Array(8 + data.length);
			tempArr.set(header, 0);
			tempArr.set(data, 8);
			uint8Arr = tempArr;
		}
		[a.txid, pos] = vbsDecode.decodeVBS(uint8Arr, 8);
		let content  = new Uint8Array(uint8Arr.buffer, 9); // receive data expect txid 
		// let repeateFlag = this.isAlreadReceive(content);
		// if (repeateFlag) {
		// 	this.receiveList = this.receiveList.filter(v => v!= a.txid);
		// 	return this.err;
		// }
		[a.status, pos] = vbsDecode.decodeVBS(uint8Arr, pos);
		[a.args, pos] = vbsDecode.decodeVBS(uint8Arr, pos);
		
		this.receiveDataList[a.txid] =  content;// Record receive data list
		if (8+len == pos) { // Decode Right
			return a;
		} else {
			this.err = "Decode message error, the length of encode byte dissatisfy VBS Requirement!";
			return this.err;
		}		
	}
	/**
     *  @dev decodeHeader
     *  Fun: According to the header, deal the message.
     *  @param {uint8Arr} receive data
     */
	decodeHeader(ws, uint8Arr) {
		//  'A', 'H', 'B', 'C,'Q'
		this.err = emptyString; // clear the error which is alread throw
		if (uint8Arr == undefined || uint8Arr.length < 8) {
			this.err = "The length of message is less than 8 bytes !";
			throw new Error(this.err);
		}
		let msg;
		if (uint8Arr.length > 16 && uint8Arr[9] != 0x58 && uint8Arr[11] == 0x01) {
			let data = new Uint8Array(uint8Arr.buffer, 8, uint8Arr.length - 8); // data except nonce
			let type = String.fromCharCode(uint8Arr[10]);
			switch (type) {
				case 'Q':
			    	let [q, sendMsg] = this.unpackQuest(data);
			    	if (typeof sendMsg != "undefined" && sendMsg != undefined) {
			    		ws.send(sendMsg);
			    	}  
			    	msg = q;
		    		break;
			    case 'A':
			    	msg = this.unpackAnswer(data);
			    	break;
			    default: 
			    	this.err = "Unknown message type" + type;
			}
			if (this.err != emptyString) {
				throw new Error(this.err);
			}
			return msg;
		}

		let type = String.fromCharCode(uint8Arr[2]);
		if (uint8Arr[0] != 0x58 || uint8Arr[1] != 0x21) { // magic != 'X' ||  version != '!'
			this.err = "Unknown message magic and version" + uint8Arr[0] + "," +  uint8Arr[1];
			return this.err;
		} 
		if (type == 'H' || type == 'B') {
			if (uint8Arr[3] != 0 || uint8Arr[4] != 0) {
				this.err = "Invalid Hello or Bye message";
				throw new Error(this.err);;
			}
		}
		switch (type) {
			case 'H': 
				this._messageHeader.flags = uint8Arr[4];
		    	msg = Object.assign(this._messageHeader, {type:'H'});
		    	break;
		    case 'B':
		    	msg = Object.assign(this._messageHeader, {type:'B'});
		    	this._isEnc = false;
		    	break;
		    case 'C':
		    	if (this.alreadyPassCheck) {
		    		msg = "Already Pass SRP6a Verify!";
		    		return msg;
		    	}
		    	msg = this.unpackCheck(uint8Arr); // readyState: 1
		    	let errFlag = (this.err == emptyString ||  this.err == undefined);
		    	if (typeof msg != "undefined" && msg != undefined && ws.readyState == 1) {
		    		ws.send(msg);
		    	} else if(this._isEnc && errFlag) { 
		    		msg = "Pass SRP6a Verify!";
		    		this.cli = null;
		    	} else if(!this._isEnc && errFlag) {
		    		msg = "SRP6a is Verifing!";
		    	} else {
		    		msg = "SRP6a Verify fail: " + this.err;
		    		console.error("Check Error: ", this.err);
		    	}
		    	break;
		    case 'Q':
		    	msg = this.unpackQuest(uint8Arr);
		    	if (typeof msg != "undefined" && msg != undefined && ws.readyState == 1) {
			    	ws.send(msg);
			    }  
		    	break;
		    case 'A':
		    	msg = this.unpackAnswer(uint8Arr);
		    	break;
		    default: 
		    	this.err = "Unknown message type" + type;
		}
		if (this.err != emptyString) {
			throw new Error(this.err);
		}
		return msg;
	}
}


module.exports = {
	MsgHeader
}

