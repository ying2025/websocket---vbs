let hash = require('hash.js');  // 引入Hash
let bigInterger = require("big-integer");  // 引入大整型
let commonFun = require('./srp6aCommonFun.js'); // 引入公共函数部分
let randomSize = 512/2/8;  // 随机数
let MinSaltSize = 16;  // salt的最小
let emptyString = "";   // 与err对比的
let arrEmpty = [];

let srp6aBase = {
	err: "",
	hashName: '',
	hasher: hash.sha,
	bits: 0,
	byteLen: 0,
	iN: bigInterger(0),  
	ig: bigInterger(0),
	ik: bigInterger(0),
	_N: [],
	_g: [],
	_A: [],
	_B: [],
	_S: [],
	_u: [],
	_M1: [],
	_M2: [],
	_K: []
};

function Srp6aBase() {
	this.generateSalt = function() {  // generate salt
	   let salt = new Array(MinSaltSize);
	   let err = this.randomBytes(salt);
	   if (err != emptyString) {
	   	  return emptyString;
	   }
	   salt = commonFun.bytes2Str(salt[salt.length-1]);  // 将其转为16进制字符串
	   return salt;
	}
	this.err = "";
	this.randomBytes = function(arr) { //random generate
		if (arr.length <= 0) {
			this.err = "Parameter Error";
			return this.err; // return err
		}
		let rand = commonFun.randomWord(true, MinSaltSize, MinSaltSize);
		if (rand.length == 0) {
			this.err = "Generate Error";
			return this.err; 
		}
		arr.push(rand);
		return emptyString;
	}

	// Array copy to array 
	this._padCopy = function(dst, src) {
		if (src == undefined || dst.length < src.length) {
			console.error("Cann't reach here, dst length is shorter than src");
			this.err = "Cann't reach here, dst length is shorter than src";
			return this.err;
		}
		let n = dst.length - src.length;

		for (let i = 0; i < src.length; i++) {
			if (typeof src[i] == "string") {
				src[i] = parseInt(src[i]);
			}
			dst[i+n] = src[i];
		}
	   
		for (n--; n >= 0; n--) {
			dst[n] = 0;
		}
	}

	this._setHash = function(b, hashName) {
		if (hashName == 'SHA1') {
			b.hashName = 'SHA1';
			b.hasher   = hash.sha1;
		} else if(hashName == "SHA256") {
			b.hashName = "SHA256";
			b.hasher   = hash.sha256;
		} else {
			b.err = "Unsupported hash";
		}
	}

	this._setParameter = function(b, g, N, bits) {
		if (b.err != emptyString) {
			return;
		}

		if (bits < 512 && bits < N.length * 8) {
			b.err = "bits must be 512 or above, and be len(N)*8 or above";
			return;
		}
		b.bits = bits;
		b.byteLen = parseInt((bits + 7) / 8);
		b.ig = bigInterger(g);  

		b._N = new Array(b.byteLen);
	    b.iN = bigInterger(N, 16);
		let b_iN = bigInterger(b.iN).toString(16);
		let v_iN = commonFun.str2Bytes(b_iN);
		this._padCopy(b._N, v_iN);
	    
		b._g = new Array(b.byteLen);
		let b_ig = bigInterger(b.ig).toString(16);
		// PAD(g)
		this._padCopy(b._g, b_ig);

	    // Compute: k = SHA1(N | PAD(g)) 
		let h = b.hasher();
		let ghash = h.update(b._N).update(b._g).digest("hex");
		b.ik = bigInterger(ghash, 16);
	}

	this._computeU = function(hasher, bufLen, A, B) {
		if (A.length == 0 || B.length == 0) {
			return emptyString;
		}
		// Compute: u = SHA1(PAD(A) | PAD(B))
		let buf1 = new Array(bufLen);
		let buf2 = new Array(bufLen);
		let h = hasher();
		this._padCopy(buf1, A);
		this._padCopy(buf2, B);
		let u_temp = h.update(buf1).update(buf2).digest("hex").toString();
		
		let u = commonFun.str2Bytes(u_temp);
		for (let i = u.length - 1; i >= 0; i--) {
			if (u[i] != 0) {
				return u;
			}
		}
		return emptyString;
	}

	this._compute_u = function(b) {
		// Compute u = H(A, B)
		if (b._u.length == 0 && b.err == emptyString) {
			if (b._A.length == 0 || b._B.length == 0) {
				b.err = "A or B not set yet";
				return;
			}
			b._u = this._computeU(b.hasher, b.byteLen, b._A, b._B);
			if (b._u.length == 0) {
				b.err = "u can't be 0";
				return;
			}
		}
	}

	Srp6aBase.prototype.computeM1 = function(b) {
		if (b._M1.length == 0 && b.err == emptyString) {
			if (b._A.length == 0 || b._B.length == 0) {
				b.err = "A or B is not set yet";
				return emptyString;
			}
			if (b._S.length == 0) {
				b.err = "S must be computed before M1 and M2";
				return emptyString;
			}
			// Compute: M1 = SHA1(PAD(A) | PAD(B) | PAD(S))
			let buf1 = new Array(b.byteLen);
			let buf2 = new Array(b.byteLen);
			let buf3 = new Array(b.byteLen);
	        let h = b.hasher();
			this._padCopy(buf1, b._A);
			this._padCopy(buf2, b._B);
			this._padCopy(buf3, b._S);
			let u_temp = h.update(buf1).update(buf2).update(buf3).digest("hex").toString();
			
			let u = commonFun.str2Bytes(u_temp);
			for (let i = u.length - 1; i >= 0; i--) {
				if (u[i] != 0) {
					return u;
				}
			}
			return emptyString;
		}
	}

	Srp6aBase.prototype.computeM2 = function(b) {
		if (b._M2.length == 0 && b.err == emptyString) {
			let Mtemp = this.computeM1(b);
			if (b.err != emptyString  && Mtemp == undefined && Mtemp.length == 0) {
				return emptyString;
			}
			b._M1 = new Array(Mtemp.length);
			this._padCopy(b._M1, Mtemp);
			
			// Compute: M2 = SHA1(PAD(A) | M1 | PAD(S)) 
			let buf1 = new Array(b.byteLen);
			let buf2 = new Array(b.byteLen);
			let h = b.hasher();
			this._padCopy(buf1, b._A);
			this._padCopy(buf2, b._S);
			let u_temp = h.update(buf1).update(b._M1).update(buf2).digest('hex')

			b._M2 = commonFun.str2Bytes(u_temp);
			
		}
		return b._M2;
	}
}

// Client
function Srp6aClient() {
	
	Srp6aClient.prototype.identity = '';
	Srp6aClient.prototype.pass = '';
	Srp6aClient.prototype.salt = [];
	Srp6aClient.prototype.ix = bigInterger(0);
	Srp6aClient.prototype.ia = bigInterger(0);
	Srp6aClient.prototype.iB = bigInterger(0);
	Srp6aClient.prototype._v = [];

	Srp6aClient.prototype.setIdentity = function(id, pass) {
		this.identity = id;
		this.pass = pass;
	}

	Srp6aClient.prototype.setSalt = function(salt) {
		if (this.salt.length == 0 && (this.err == emptyString) && salt.length != 0) {
			this.salt = new Array(salt.length);
			this._padCopy(this.salt, salt);
			return true;
		}
		return false;
	}
    // compute x 
	Srp6aClient.prototype._computeX = function() {
		if (commonFun.bigisZero(this.ix) && this.err == emptyString) {
			if (this.identity.length == 0 || this.pass.length == 0 || this.salt.length == 0) {
				this.err = "id, pass or salt not set yet";
				return;
			}
			// Compute: x = SHA1(salt | SHA1(identity | ":" | pass)) 
			// h1.update(this.identity).update(':').update(this.pass).digest('hex') ==  h.1update(this.identity + ':' + this.pass).digest('hex')
	        let h = this.hasher();
	        let buf = h.update(this.identity + ':' + this.pass).digest();
			// reset hash
			let h2 = this.hasher();
			let newBuf = h2.update(this.salt).update(buf).digest('hex')

	        this.ix = bigInterger(newBuf, 16);
		}
	}
	Srp6aClient.prototype.computeV = function() {
		if (this._v.length == 0 && (this.err == emptyString)) {
			if (commonFun.bigisZero(this.iN)) {
				this.err = "Parameters (g,N) not set yet";
				return arrEmpty;
			}	
			this._computeX();
			if (this.err != emptyString) {
				return emptyString;
			}
			// Compute: v = g^x % N 
			this._v = new Array(this.byteLen);
			let i1 = bigInterger(this.ig).modPow(this.ix, this.iN);
			let b_iN = bigInterger(i1).toString(16);
			let v_iN = commonFun.str2Bytes(b_iN);
			this._padCopy(this._v, v_iN);
		}
		return this._v;
	}
	Srp6aClient.prototype._setA = function(a) {
		this.ia = bigInterger(a, 16);
	    // console.log(this.ia, this.iN)
	    // Compute: A = g^a % N 
		let i1 = bigInterger(this.ig).modPow(this.ia, this.iN);
		if (commonFun.bigisZero(i1)) {
			return arrEmpty;
		}
		let b_i1 = bigInterger(i1).toString(16);
		let v_i1 = commonFun.str2Bytes(b_i1);
		if (v_i1 == null) {
			this._A.length = 0;
			return this._A;
		}
		this._A = new Array(this.byteLen);
		this._padCopy(this._A, v_i1);
		return this._A;
	} 
	// set B
	Srp6aClient.prototype.setB = function(B) {
		if (this.err == emptyString && B != arrEmpty) {
			if (B.length > this.byteLen) {
				this.err = "Invalid B, too large";
				return;
			} else {
				this.iB = bigInterger.fromArray(B, 256);
				// 若srv.iB % this.iN == 0
				if (commonFun.bigisZero(bigInterger(this.iB).mod(this.iN))) {
					this.err = "Invalid B, B%%N == 0";
					return;
				}
				this._B = new Array(this.byteLen);
				this._padCopy(this._B, B);
			}
		}
	}
	Srp6aClient.prototype.generateA = function() {
		if (this._A.length == 0 && this.err == emptyString) {
			if (commonFun.bigisZero(this.iN)) {
				this.err = "Parameters (g,N) not set yet";
				return emptyString;
			}
			let err;
			let buf = Array.apply(null, Array(randomSize)).map(function(item, i) {
			    return 0;
			});
			while(this._A.length == 0) {
				err = this.randomBytes(buf);
				if (err != emptyString) {
					this.err = err;
					return emptyString;
				}
				let newbuf = commonFun.bytes2Str(buf[buf.length-1]);  // 将其转为16进制字符串
				this._setA(newbuf);
			}
		}
		return this._A;
	}
	Srp6aClient.prototype.clientComputeS = function() {
		if (this._S.length == 0 && this.err == emptyString) {
			if (this._B.length == 0) {
				this.err = "B is not set yet";
				return emptyString;
			}
			this.generateA();
			this._computeX();
			this._compute_u(this);
			if (this.err != emptyString) {
				return emptyString;
			}
			// Compute: S_user = (B - (k * g^x)) ^ (a + (u * x)) % N 
			this._S = new Array(this.byteLen);
			let iu = bigInterger.fromArray(this._u, 256); // 根据数组生成对应的big类型
			// k * (g**x % N)
			let i1 = bigInterger(this.ig).modPow(this.ix, this.iN).multiply(this.ik);
			//B - (k * ((g**x) % N)) % N
		    i1 = bigInterger(i1).mod(this.iN);
			i1 = bigInterger(this.iB).subtract(i1);
			if (bigInterger(i1).compare(bigInterger(0)) < 0) {
				i1 = bigInterger(i1).add(this.iN);
			}
			// (a + (u * x)) % N
			let u1 = bigInterger(iu).multiply(this.ix).add(this.ia).mod(this.iN);
	        
			let u2 = bigInterger(i1).modPow(u1, this.iN);

			let b_i1 = bigInterger(u2).toString(16);
		    let v_i1 = commonFun.str2Bytes(b_i1);
			this._padCopy(this._S, v_i1);

		}
		return this._S;
	}

}
Srp6aClient.prototype = new Srp6aBase();
function NewClient() {
	let cli = new Srp6aClient();
	cli = Object.assign(cli, commonFun.deepClone(srp6aBase));
	return cli;
}
module.exports = {
	NewClient
}
// if (typeof(window) === 'undefined') {
//     module.exports = {
// 		NewClient
// 	}
// } else {
//     window.utils = {
//     	NewClient
//     }
// }
