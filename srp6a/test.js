const srp6aClient = require('./SRP6a.js').NewClient;
const srp6aServer = require('./SRP6a.js').NewServer;
let commonFun = require('./srp6aCommonFun.js'); // 引入公共函数部分
function TestSrp6aFixedParam() {
	var N = "EEAF0AB9ADB38DD69C33F80AFA8FC5E86072618775FF3C0B9EA2314C" +
                "9C256576D674DF7496EA81D3383B4813D692C6E0E0D5D8E250B98BE4" +
                "8E495C1D6089DAD15DC7D7B46154D6B6CE8EF4AD69B15D4982559B29" +
                "7BCF1885C529F566660E57EC68EDBC3C05726CC02FD4CBF4976EAA9A" +
                "FD5138FE8376435B9FC61D2FC0EB06E3";
	var hexSalt = "BEB25379D1A8581EB5A727673A2441EE";   
	var a = "60975527035CF2AD1989806F0407210BC81EDC04E2762A56AFD529DDDA2D4393";
	var b = "E487CB59D31AC550471E81F00F6928E01DDA08E974A004F49E61F5D105284D20";
	var id = "alice";
	var pass = "password123";
	var id2 = "alice122";
	var pass2 = "password123";

	var salt =commonFun.str2Bytes(hexSalt);// // console.log(hash.utils.toArray(hexn));   

	var srv = new srp6aServer(2, N, 1024,"SHA1");

	var cli = new srp6aClient();;
	cli.setIdentity(id, pass); // 设置cli的id,pass
	cli._setHash(cli, "SHA1");
	cli._setParameter(cli, 2, N, N.length * 4);
	cli.setSalt(salt);  // 设置cli的salt

	var v= cli.computeV();  // 计算cli的_v
	srv.setV(v);  // src设置iv
    
	var A = cli._setA(a)   // cli设置a
	srv.setA(A);   // srv设置A；
  
	var B = srv._setB(b);   // srv设置b
	cli.setB(B);   // cli设置B

	var S1 = srv.serverComputeS(); // 计算srv的S
	var S1Hex = commonFun.bytes2Str(S1);
	var S2 = cli.clientComputeS(); // 计算cli的S
	var S2Hex = commonFun.bytes2Str(S2);
	console.log("S1: ", S1.toString(16))
	console.log("S2: ", S2.toString(16))
	console.log("------------------")
	console.log("S1 hex: ", S1Hex)
	console.log("S2 hex: ", S1Hex)
	var K = cli.computeK(cli);
	console.log("K========: ", commonFun.bytes2Str(K).length, K.length)
	var M11 = srv.computeM1(srv);
	var M12 = cli.computeM1(cli);
	var M11Hex = commonFun.bytes2Str(M11);
	var M12Hex = commonFun.bytes2Str(M12);
	console.log("--------M1----------")
	console.log("M11: ", M11.toString())
	console.log("M12: ", M12.toString())
	console.log("------------------")
	console.log("M11 hex: ", M11Hex)
	console.log("M12 hex: ", M12Hex)

	var M21 = srv.computeM2(srv);
	var M22 = cli.computeM2(cli);
	var M21Hex = commonFun.bytes2Str(M21);
	var M22Hex = commonFun.bytes2Str(M22);
	console.log("--------M2----------")
	console.log("M21: ", M21.toString())
	console.log("M22: ",M22.toString())
	console.log("------------------")
	console.log("M21 hex: ", M21Hex)
	console.log("M22 hex: ", M22Hex)
}
TestSrp6aFixedParam();