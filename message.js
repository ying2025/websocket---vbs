const vbsEncode = require('./encode.js');
const vbsDecode = require('./decode.js');
const commonFun = require('./commonFun.js');
let NoError = "";
let MaxMessageSize = 64*1024*1024;
class MsgHeader {
	constructor(flags = 0x00) {
		this._MessageHeader = {
			Magic: 'X', // 'X'  0x58
			Version: '!', // '!' 0x21
			Type: '',      // 'Q', 'A', 'H', 'B', 'C'
			Flags: 0x00,   // 0x00 or 0x01, default 0x00
			BodySize: 0    // 4 bytes and big endian byte order
		};
		this._Quest = {
			txid: 0,
			reserved: 8, 
			start: -1,
			buf: []
		};
		this._Answer = {
			txid: 0,
			status: 0,
			argsOff: 0,
			arg: {}
		};
		this.err = "";
		this.packet = [];
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
		this.packet[3] = this._MessageHeader.Flags; // flag
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

	packQuest(txid, service, method, ctx, args) {
		let q = this._Quest;
		q.txid = txid;
		if (q.txid < 0) {
			this.err = "txid not set yet";
			return;
		}
		let newTxid = vbsEncode.encodeVBS(txid);
		let newService = vbsEncode.encodeVBS(service);
		let newMethod =  vbsEncode.encodeVBS(method);
		let newCtx = vbsEncode.encodeVBS(ctx);
		let newArg = vbsEncode.encodeVBS(args);

		let n1 = newTxid.byteLength + newService.byteLength;
		let n2 = newMethod.byteLength + newCtx.byteLength;
		let len = n1 + n2 + newArg.byteLength;
		this.fillHeader('Q', len);

		let u8a = new Uint8Array(8 + len);

		u8a.set(this.packet, 0);
		u8a.set(new Uint8Array(newTxid), 8); 
    	u8a.set(new Uint8Array(newService), 8 + newTxid.byteLength);
		u8a.set(new Uint8Array(newMethod), 8 + n1);
		u8a.set(new Uint8Array(newCtx), 8 + n1 + newMethod.byteLength);
		u8a.set(new Uint8Array(newArg), 8 + n1 + n2);

		return u8a.buffer;
	}

	// TODO encryption
	unpackCheck(uint8Arr) {
		
	}
	//
	unpackAnswer(uint8Arr) {
		// Normal
		this._MessageHeader.Type = 'A';
		let a = Object.assign(this._MessageHeader, this._Answer);
		// let a = this._Answer;
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

		if (uint8Arr[0] != 0x58 || uint8Arr[1] != 0x21) { // Magic != 'X' ||  Version != '!'
			this.err = "Unknown message Magic and Version" + uint8Arr[0] + "," +  uint8Arr[1];
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
		    	msg = Object.assign(this._MessageHeader, {Type:'H'});
		    	break;
		    case 'B':
		    	msg = Object.assign(this._MessageHeader, {Type:'B'});
		    	break;
		    case 'C':
		    	msg = this.unpackCheck(uint8Arr); // readyState: 1
		    	break;
		    case 'A':
		    	msg = this.unpackAnswer(uint8Arr);
		    	break;
		    default: 
		    	this.err = "Unknown message Type" + type;
		}
		return msg;
	}
}


module.exports = {
	MsgHeader
}