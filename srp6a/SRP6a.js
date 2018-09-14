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

	this.randomBytes = function(arr) { //random generate
		let err;
		if (arr.length <= 0) {
			err = "Parameter Error";
			return err; // return err
		}
		let rand = commonFun.randomWord(true, MinSaltSize, MinSaltSize);
		if (rand.length == 0) {
			err = "Generate Error";
			return err; 
		}
		arr.push(rand);
		return emptyString;
	}

	// Array copy to array 
	this._padCopy = function(dst, src) {
		if (src == undefined || dst.length < src.length) {
			console.error("Cann't reach here, dst length is shorter than src");
			return;
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
function NewClient(g, N, bits, hashName) {
	let cli = new Srp6aClient();
	cli = Object.assign(cli, commonFun.deepClone(srp6aBase));
	cli._setHash(cli, hashName);
	cli._setParameter(cli, g, N, bits);
	return cli;
}

function clientInit(g, N, s, id, pass) {
	let bits = 1024;
	let hashName = "SHA1";
	let a = "60975527035CF2AD1989806F0407210BC81EDC04E2762A56AFD529DDDA2D4393";
	let salt = commonFun.str2Bytes(s);

	let cli = NewClient(g, N, bits, hashName);
	cli.setIdentity(id, pass); // 设置cli的id,pass
	cli.setSalt(salt);  // 设置cli的salt	

	let v = cli.computeV();  // 计算cli的_v

	let A = cli._setA(a);   // generate A
	return [A, v, cli];
}
function clientComputeM1(cli, B) {
	cli.setB(B);   // cli设置B
	let S = cli.clientComputeS(); // 计算cli的S
	let M1 = cli.computeM1(cli);  
	return M1;
}
function verifyM2(cli, M2) {
	let M22 = cli.computeM2(cli);
	if (M22.toString() == M2.toString()) {
		console.log("---------Pass---------", M22.toString());
		return [cli._S, cli._N];
	} else {
		console.log("---------Fail---------", M22.toString());
	}
}

function TestSrp6aFixedParam() {
	let N = "EEAF0AB9ADB38DD69C33F80AFA8FC5E86072618775FF3C0B9EA2314C" +
                "9C256576D674DF7496EA81D3383B4813D692C6E0E0D5D8E250B98BE4" +
                "8E495C1D6089DAD15DC7D7B46154D6B6CE8EF4AD69B15D4982559B29" +
                "7BCF1885C529F566660E57EC68EDBC3C05726CC02FD4CBF4976EAA9A" +
                "FD5138FE8376435B9FC61D2FC0EB06E3";
	let hexSalt = "BEB25379D1A8581EB5A727673A2441EE";   
	// let a = "60975527035CF2AD1989806F0407210BC81EDC04E2762A56AFD529DDDA2D4393";
	let id = "alice";
	let pass = "password123";
	let B = [189,12,97,81,44,105,44,12,182,208,65,250,1,187,21,45,73,22,161,231,122,244,106,225,5,57,48,17,186,243,137,100,220,70,160,103,13,209,37,185,90,152,22,82,35,111,153,217,182,129,203,248,120,55,236,153,108,109,160,68,83,114,134,16,208,198,221,181,139,49,136,133,215,216,44,127,141,235,117,206,123,212,251,170,55,8,158,111,156,96,89,243,136,131,142,122,0,3,11,51,30,183,104,64,145,4,64,177,178,122,174,174,235,64,18,183,215,102,82,56,168,227,251,0,75,17,123,88];
	let M2 = [11,10,106,211,2,78,121,181,202,208,64,66,171,179,163,245,146,210,12,23];

	let [A, v, cli] = clientInit(2, N, hexSalt, id, pass);
	let M1 = clientComputeM1(cli, B);
	// console.log(M1.toString())
	verifyM2(cli, M2);
}
// TestSrp6aFixedParam();

if (typeof(window) === 'undefined') {
    module.exports = {
		clientInit,
		clientComputeM1,
		verifyM2
	}
} else {
    window.utils = {
    	clientInit,
		clientComputeM1,
		verifyM2
    }
}
