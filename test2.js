const  msgHeader  = require('./message.js').MsgHeader;
const vbsEncode = require('./VBS/encode.js');
let msgBody = new msgHeader();
function test() {
	let args = {"id": "alice","method":"SRP6a"};
	msgBody.sendSrp6a1(args);
	let ag = {
		N:"EEAF0AB9ADB38DD69C33F80AFA8FC5E86072618775FF3C0B9EA2314C" +
	                "9C256576D674DF7496EA81D3383B4813D692C6E0E0D5D8E250B98BE4" +
	                "8E495C1D6089DAD15DC7D7B46154D6B6CE8EF4AD69B15D4982559B29" +
	                "7BCF1885C529F566660E57EC68EDBC3C05726CC02FD4CBF4976EAA9A" +
	                "FD5138FE8376435B9FC61D2FC0EB06E3",
		s: "BEB25379D1A8581EB5A727673A2441EE",
		hash: "SHA1",
		g: 2,
		B: "bd0c61512c692c0cb6d041fa01bb152d4916a1e77af46ae105393011baf38964dc46a0670dd125b95a981652236f99d9b681cbf87837ec996c6da04453728610d0c6ddb58b318885d7d82c7f8deb75ce7bd4fbaa37089e6f9c6059f388838e7a00030b331eb76840910440b1b27aaeaeeb4012b7d7665238a8e3fb004b117b58"
	}
	msgBody.sendSrp6a3(ag);
	let m2 = [11,10,106,211,2,78,121,181,202,208,64,66,171,179,163,245,146,210,12,23];
	let argv = {
		"M2": m2
	};
	msgBody.verifySrp6aM2(argv);
}
// test()
function SRP6aTest() {
	let cmd = "AUTHENTICATE";
	let arg = {"method": "SRP6a"};
	let newcmd = vbsEncode.encodeVBS(cmd);
	let newarg = vbsEncode.encodeVBS(arg);
	let n = newcmd.byteLength + newarg.byteLength;
	let uint8Arr = new Uint8Array(n + 8);
	uint8Arr.set(new Uint8Array(newcmd), 8);
	uint8Arr.set(new Uint8Array(newarg), 8 + newcmd.byteLength);
	msgBody.unpackCheck(uint8Arr);

}
SRP6aTest()
function SRP6a2Test() {
	let cmd = "SRP6a2";
	let args = {
		N:"EEAF0AB9ADB38DD69C33F80AFA8FC5E86072618775FF3C0B9EA2314C" +
	                "9C256576D674DF7496EA81D3383B4813D692C6E0E0D5D8E250B98BE4" +
	                "8E495C1D6089DAD15DC7D7B46154D6B6CE8EF4AD69B15D4982559B29" +
	                "7BCF1885C529F566660E57EC68EDBC3C05726CC02FD4CBF4976EAA9A" +
	                "FD5138FE8376435B9FC61D2FC0EB06E3",
		s: "BEB25379D1A8581EB5A727673A2441EE",
		hash: "SHA1",
		g: 2,
		B: "bd0c61512c692c0cb6d041fa01bb152d4916a1e77af46ae105393011baf38964dc46a0670dd125b95a981652236f99d9b681cbf87837ec996c6da04453728610d0c6ddb58b318885d7d82c7f8deb75ce7bd4fbaa37089e6f9c6059f388838e7a00030b331eb76840910440b1b27aaeaeeb4012b7d7665238a8e3fb004b117b58"
	}
	
	let newcmd = vbsEncode.encodeVBS(cmd);
	let newarg = vbsEncode.encodeVBS(args);
	let n = newcmd.byteLength + newarg.byteLength;
	let uint8Arr = new Uint8Array(n + 8);
	uint8Arr.set(new Uint8Array(newcmd), 8);
	uint8Arr.set(new Uint8Array(newarg), 8 + newcmd.byteLength);
	let aa = msgBody.unpackCheck(uint8Arr);
	// console.log(aa)
}
// SRP6a2Test()
function SRP6a4Test() {
	let cmd = "SRP6a4";
	let m2 = [11,10,106,211,2,78,121,181,202,208,64,66,171,179,163,245,146,210,12,23];
	let args = {"M2": m2}
	let newcmd = vbsEncode.encodeVBS(cmd);
	let newarg = vbsEncode.encodeVBS(args);
	let n = newcmd.byteLength + newarg.byteLength;
	let uint8Arr = new Uint8Array(n + 8);
	uint8Arr.set(new Uint8Array(newcmd), 8);
	uint8Arr.set(new Uint8Array(newarg), 8 + newcmd.byteLength);
	let aa = msgBody.unpackCheck(uint8Arr);
	// console.log(aa)
}
// SRP6a4Test()
// const srp6aClient = require('./srp6a/SRP6a.js').NewClient;
// let srp6a = new srp6aClient();
// console.log(srp6a)

