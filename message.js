const vbsEncode = require('./VBS/encode.js');
const vbsDecode = require('./VBS/decode.js');
const commonFun = require('./commonFun.js');
const srp6aClient = require('./srp6a/SRP6a.js').NewClient;
// const srp6aClient = require('./srp6a/SRP6a.js');

if (typeof(window) === 'undefined') {
	const fs = require("fs");
	const aesContent = fs.readFileSync("./EAX/cryptojs-aes.min.js", "utf8");
	const ctrContent = fs.readFileSync("./EAX/cryptojs-mode-ctr.min.js", "utf8");
	const eaxContent = fs.readFileSync("./EAX/eax.js", "utf8");
}

let NoError = "";
let MaxMessageSize = 64*1024*1024;
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
			buf: []
		};
		this._answer = {
			txid: 0,
			status: 0,
			argsOff: 0,
			arg: {}
		};
		this._check = {
			cmd: "",
			arg: {}
		};
		this._isEnc = false; // whether encrypt
		this.err = "";
		this.packet = [];
        this.send_nonce = send_nonce;
    	this.noce_increase_step = send_add_state;
    	this.vec = {
            key: "8395FCF1E95BEBD697BD010BC766AAC3",
            nonce: "22E7ADD93CFC6393C57EC0B3C17D6B44",
            header: "126735FCC320D25A",
            ct: "CB8920F87A6C75CFF39627B56E3ED197C552D295A7CFC46AFC253B4652B1AF3795B124AB6E"
        };
    	this.id = "alice";
    	this.pass = "password123";
    	this.cli = null;
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
		} else if (len > MaxMessageSize) {
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
     *  @dev sendSrp6a1
     *  Fun: create client object, set id and password of the client, send id to server.
     *  @param {args}  Srp6a message round
     */
	sendSrp6a1(args) {
		let method = args.method;
		if (method != "SRP6a") {
			this.err = "Unknown authenticate method "+ method;
			return this.err;
		}
		this.cli = new srp6aClient();
		let identity = this.id;
		let pass = this.pass;
		this.cli.setIdentity(identity, pass);
		let command = "SRP6a1";
		let arg = {"I": identity};
		this._isEnc = true;  // Encrypt flag
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
			return this.err;
		}
		
		let hash = args.hash;
		let N = args.N;
		let g = args.g;
		let s = args.s;
		let B = args.B;
		s =	commonFun.strHex2Bytes(s);
		B = commonFun.strHex2Bytes(B); // HEX to byte

		this.cli._setHash(this.cli, hash);
		this.cli._setParameter(this.cli, g, N, 1024);
		this.cli.setSalt(s);  // 设置cli的salt
		this.cli.setB(B); 

		// let a = "60975527035CF2AD1989806F0407210BC81EDC04E2762A56AFD529DDDA2D4393";
		// let A = this.cli._setA(a)   // cli设置a
		let A = this.cli.generateA();
		this.cli.clientComputeS();
		let M1 = this.cli.computeM1(this.cli);
		if (this.cli.err != NoError) {
			return this.cli.err;
		}
		let arg = {"A":A, "M1":M1};	
		return this.packCheck(command, arg);
	}
	/**
     *  @dev packMsg
     *  Fun: send header to server
     *  @param {type}  message type
     */
	packMsg(type) {
		this.fillHeader(type, 0);	
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
		let q = this._quest;
		q.txid = txid;
		if (q.txid < 0) {
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
		if (this._isEnc) {
			this._messageHeader.flags = 0x01;
		}
		this.fillHeader('Q', len);

		let u8a = new Uint8Array(len);
		u8a.set(new Uint8Array(newTxid), 0); 
    	u8a.set(new Uint8Array(newService), newTxid.byteLength);
		u8a.set(new Uint8Array(newMethod), n1);
		u8a.set(new Uint8Array(newCtx), n1 + newMethod.byteLength);
		u8a.set(new Uint8Array(newArg), n1 + n2);
		let msg;
		let nonNum = vbsEncode.encodeVBS(this.send_nonce);
		this.send_nonce += this.noce_increase_step;
		if (this._isEnc) {
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
		return msg.buffer;
	}
	/**
     *  @dev cryptoData
     *  Fun: create ciphex object, then encrypt message
     *  @param {uint8Msg}  Data to be encrypted
     */
	cryptoData(uint8Msg) {
		if (typeof(window) === 'undefined') {
			eval(aesContent);
		    eval(ctrContent);
		    eval(eaxContent);
		}
	    let keyBytes = CryptoJS.enc.Hex.parse(this.vec.key),
	    	nonceBytes = CryptoJS.enc.Hex.parse(this.vec.nonce),
	    	headerBytes = CryptoJS.enc.Hex.parse(this.vec.header);
	    // let msgBytes = CryptoJS.lib.WordArray.create(uint8Msg);
	    let msgBytes = this.convertUint8ArrayToWordArray(uint8Msg);

	    let eax = CryptoJS.EAX.create(keyBytes);
	    eax.prepareEncryption(nonceBytes, [headerBytes]);
	    eax.update(msgBytes);
	    let et = eax.finalize();
	    return et;
	}
	/**
     *  @dev decryptData
     *  Fun: create ciphex object, then encrypt message
     *  @param {uint8Msg}  Data to be encrypted
     */
	decryptData(et) {
		let keyBytes = CryptoJS.enc.Hex.parse(this.vec.key),
			nonceBytes = CryptoJS.enc.Hex.parse(this.vec.nonce),
			headerBytes = CryptoJS.enc.Hex.parse(this.vec.header);
		let eax = CryptoJS.EAX.create(keyBytes);

		let etData = this.convertUint8ArrayToWordArray(et);
		let pt = eax.decrypt(etData, nonceBytes, [headerBytes]);
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
				(u8Array[i++] << 8)  |
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
		let c = Object.assign(this._messageHeader, this._check);
		let pos = 0;
		[c.cmd, pos] = vbsDecode.decodeVBS(uint8Arr, 8);		
		[c.arg, pos] = vbsDecode.decodeVBS(uint8Arr, pos);

		let msg = this.dealCmd(c.cmd, c.arg);
		if (this.err != NoError) {
			return this.err;
		}
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
				tempData = this.sendSrp6a1(arg);
				msg = Object.assign({"data": tempData}, {"type":"C"});
				break;
			case 'SRP6a2':
				tempData = this.sendSrp6a3(arg);
				msg = Object.assign({"data": tempData}, {"type":"C"});
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
     *  @dev verifySrp6aM2
     *  Fun: According to srp6a, Compute M2, verify server send M2. Confirm the public key.
     *  @param {args} param
     */
	verifySrp6aM2(args) {
		let M2 = args.M2;
		let M2_min = this.cli.computeM2(this.cli);
		if (M2.toString() != M2_min.toString()) {
			this.err = "srp6a M2 not equal";
			return this.err;
		}
		this.vec.key = this.cli._S; 
		return true;
	}
	/**
     *  @dev forbidden
     *  Fun: Return why forbidden encrypt.
     *  @param {args} param
     */
	forbidden(args) {
		let reason = args.reason;
		this.err = "Authentication Exception " + reason;
		return this.err;
	}
	/**
     *  @dev unpackAnswer
     *  Fun: Unpack the receive message, if status is 0, the message is normal, or check the reason.
     *  @param {uint8Arr} receive data
     */
	unpackAnswer(uint8Arr) {
		// Normal
		this._messageHeader.type = 'A';
		let a = Object.assign(this._messageHeader, this._answer);

		let len = ((uint8Arr[4] & 0xFF) << 24) + ((uint8Arr[5] & 0xFF) << 16) + ((uint8Arr[6] & 0xFF) << 8) + (uint8Arr[7] & 0xFF);
		let pos = 0;
		if (this._isEnc) {
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
		
		[a.status, pos] = vbsDecode.decodeVBS(uint8Arr, pos);

		[a.arg, pos] = this.unpackAnswerArg(a, uint8Arr, pos);

		if (8+len == pos) { // Decode Right
			return a;
		} else {
			this.err = "Decode message error, the length of encode byte dissatisfy VBS Requirement!";
			return this.err;
		}
		
	}
	/**
     *  @dev unpackAnswerArg
     */
	unpackAnswerArg(a, uint8Arr, pos) {
		if (a.status == 0) { // normally
			[a.arg, pos] = vbsDecode.decodeVBS(uint8Arr, pos); // arg
		} else {
			[a.arg.exname, pos] = vbsDecode.decodeVBS(uint8Arr, pos); // exname
			[a.arg.code, pos] = vbsDecode.decodeVBS(uint8Arr, pos); // code
			[a.arg.tag, pos] = vbsDecode.decodeVBS(uint8Arr, pos); // tag
			[a.arg.message, pos] = vbsDecode.decodeVBS(uint8Arr, pos); // message
			[a.arg.raiser, pos] = vbsDecode.decodeVBS(uint8Arr, pos); // raiser
			[a.arg.detail, pos] = vbsDecode.decodeVBS(uint8Arr, pos); // detail
		}
		return [a.arg, pos];
	}
	/**
     *  @dev decodeHeader
     *  Fun: According to the header, deal the message.
     *  @param {uint8Arr} receive data
     */
	decodeHeader(uint8Arr) {
		//  'A', 'H', 'B', 'C
		if (uint8Arr == undefined || uint8Arr.length < 8) {
			this.err = "The length of message is less than 8 bytes !";
			return this.err;
		}
		if (this._isEnc) { 
			// Remain only encrypt data
			let data = new Uint8Array(uint8Arr.buffer, 8, uint8Arr.length - 8);
			return this.unpackAnswer(data);
		}
		let type = String.fromCharCode(uint8Arr[2]);
		let msg;

		if (uint8Arr[0] != 0x58 || uint8Arr[1] != 0x21) { // magic != 'X' ||  version != '!'
			this.err = "Unknown message magic and version" + uint8Arr[0] + "," +  uint8Arr[1];
			return this.err;
		} 
		if (type == 'H' || type == 'B') {
			if (uint8Arr[3] != 0 || uint8Arr[4] != 0) {
				this.err = "Invalid Hello or Bye message";
				return this.err;
			}
		}

		switch (type) {
			case 'H': 
		    	msg = Object.assign(this._messageHeader, {type:'H'});
		    	break;
		    case 'B':
		    	msg = Object.assign(this._messageHeader, {type:'B'});
		    	break;
		    case 'C':
		    	let data = this.unpackCheck(uint8Arr); // readyState: 1
		    	msg = Object.assign({"data":data}, {type:"C"});
		    	break;
		    case 'A':
		    	msg = this.unpackAnswer(uint8Arr);
		    	break;
		    default: 
		    	this.err = "Unknown message type" + type;
		}
		if (this.err != NoError) {
			throw new Error(this.err);
		}
		return msg;
	}
}


module.exports = {
	MsgHeader
}