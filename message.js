const vbsEncode = require('./VBS/encode.js');
const vbsDecode = require('./VBS/decode.js');
const commonFun = require('./commonFun.js');
if (typeof(window) === 'undefined') {
	const fs = require("fs");
	const aesContent = fs.readFileSync("../EAX/cryptojs-aes.min.js", "utf8");
	const ctrContent = fs.readFileSync("../EAX/cryptojs-mode-ctr.min.js", "utf8");
	const eaxContent = fs.readFileSync("../EAX/eax.js", "utf8");
}

let NoError = "";
let MaxMessageSize = 64*1024*1024;
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
			command: "",
			arg: {}
		};
		this._isEnc = false; // whether encrypt
		this.err = "";
		this.packet = [];
		this.vec = {
            key: "8395FCF1E95BEBD697BD010BC766AAC3",
            nonce: "22E7ADD93CFC6393C57EC0B3C17D6B44",
            header: "126735FCC320D25A",
            ct: "CB8920F87A6C75CFF39627B56E3ED197C552D295A7CFC46AFC253B4652B1AF3795B124AB6E"
        };
	}
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
	packMsg(type) {
		this.fillHeader(type, 0);	
		let u8a = new Uint8Array(this.packet);
		return u8a.buffer;
	}
	packQuest(randomNum, txid, service, method, ctx, args) {
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
		let nonNum = vbsEncode.encodeVBS(randomNum);

		if (!this._isEnc) {
			let et = this.cryptoData(u8a);
			let ct = this.convertWordArrayToUint8Array(et);
			msg = new Uint8Array(ct.byteLength + 16);	
			msg.set(new Uint8Array(nonNum), 0);
			msg.set(this.packet, 8);
			msg.set(ct, 16);	
		} else {
			msg = new Uint8Array(u8a.byteLength + 16);
			msg.set(new Uint8Array(nonNum), 0);
			msg.set(this.packet, 8);
			msg.set(u8a, 16);
		}
		return msg.buffer;
	}
	cryptoData(uint8Msg) {
		if (typeof(window) === 'undefined') {
			eval(aesContent);
		    eval(ctrContent);
		    eval(eaxContent);
		}
	    let keyBytes = CryptoJS.enc.Hex.parse(this.vec.key),
	    	nonceBytes = CryptoJS.enc.Hex.parse(this.vec.nonce),
	    	headerBytes = CryptoJS.enc.Hex.parse(this.vec.header);
	    let msgBytes = CryptoJS.lib.WordArray.create(uint8Msg);

	    let eax = CryptoJS.EAX.create(keyBytes);
	    eax.prepareEncryption(nonceBytes, [headerBytes]);
	    eax.update(msgBytes);
	    let et = eax.finalize();
	    return et;
	}
	convertWordArrayToUint8Array(wordArray) {
	    let len = wordArray.words.length,
	        u8_array = new Uint8Array(len << 2),
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
	decryptData(et) {
		let keyBytes = CryptoJS.enc.Hex.parse(this.vec.key),
			headerBytes = CryptoJS.enc.Hex.parse(this.vec.header);
		let eax = CryptoJS.EAX.create(keyBytes);
		let pt = eax.decrypt(et, keyBytes, [headerBytes]);
		return pt;
	}
	// packQuest(txid, service, method, ctx, args) {
	// 	let q = this._quest;
	// 	q.txid = txid;
	// 	if (q.txid < 0) {
	// 		this.err = "txid not set yet";
	// 		return this.err;
	// 	}
	// 	let newTxid = vbsEncode.encodeVBS(txid);
	// 	let newService = vbsEncode.encodeVBS(service);
	// 	let newMethod =  vbsEncode.encodeVBS(method);
	// 	let newCtx = vbsEncode.encodeVBS(ctx);
	// 	let newArg = vbsEncode.encodeVBS(args);

	// 	let n1 = newTxid.byteLength + newService.byteLength;
	// 	let n2 = newMethod.byteLength + newCtx.byteLength;
	// 	let len = n1 + n2 + newArg.byteLength; 
	// 	if (this._isEnc) {
	// 		this._messageHeader.flags = 0x01;
	// 	}
	// 	this.fillHeader('Q', len);

	// 	let u8a = new Uint8Array(8 + len);

	// 	u8a.set(this.packet, 0);
	// 	u8a.set(new Uint8Array(newTxid), 8); 
 //    	u8a.set(new Uint8Array(newService), 8 + newTxid.byteLength);
	// 	u8a.set(new Uint8Array(newMethod), 8 + n1);
	// 	u8a.set(new Uint8Array(newCtx), 8 + n1 + newMethod.byteLength);
	// 	u8a.set(new Uint8Array(newArg), 8 + n1 + n2);
	// 	if (this._isEnc) {
	// 		console.log(u8a);
	// 	} else {
	// 		return u8a.buffer;
	// 	}
	// }

	// TODO encryption
	unpackCheck(uint8Arr) {
		let c = Object.assgin(this._messageHeader, this._check);
		let pos = 0;
		[c.cmd, pos] = vbsDecode.decodeVBS(uint8Arr, 8);
		[c.arg, pos] = vbsDecode.decodeVBS(uint8Arr, pos);
		return c;
	}
	//
	unpackAnswer(uint8Arr) {
		// Normal
		this._messageHeader.type = 'A';
		let a = Object.assign(this._messageHeader, this._answer);
		// let a = this._answer;
		let len = ((uint8Arr[4] & 0xFF) << 24) + ((uint8Arr[5] & 0xFF) << 16) + ((uint8Arr[6] & 0xFF) << 8) + (uint8Arr[7] & 0xFF);
		let pos = 0;
		[a.txid, pos] = vbsDecode.decodeVBS(uint8Arr, 8);
		
		[a.status, pos] = vbsDecode.decodeVBS(uint8Arr, pos);

		[a.arg, pos] = this.unpackAnswerArg(a, uint8Arr, pos);

		// [a.arg, pos] = vbsDecode.decodeVBS(uint8Arr, pos); // arg
		if (8+len == pos) { // Decode Right
			return a;
		} else {
			this.err = "Decode message error, the length of encode byte dissatisfy VBS Requirement!";
			return this.err;
		}
		
	}
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
	//
	decodeHeader(uint8Arr) {
		//  'A', 'H', 'B', 'C
		if (uint8Arr == undefined || uint8Arr.length < 8) {
			this.err = "The length of message is less than 8 bytes !";
			return this.err;
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
		    	msg = this.unpackCheck(uint8Arr); // readyState: 1
		    	break;
		    case 'A':
		    	msg = this.unpackAnswer(uint8Arr);
		    	break;
		    default: 
		    	this.err = "Unknown message type" + type;
		}
		return msg;
	}
}


module.exports = {
	MsgHeader
}