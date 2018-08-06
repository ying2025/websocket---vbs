const vbsEncode = require('./encode.js');
const vbsDecode = require('./decode.js');
// testVbsKeyVal()
// function testVbsKeyVal() {
//     let u = {"a": "key","js":'23',"78":"sdh","dj":{"djd":"dsdh","hu":{"djd":"dsdh"}}};
//     let myVbs = vbsEncode.encodeVBS(u);
//     let ss = vbsDecode.decodeVBS(myVbs,0);
//     console.log(u, ss)
// }
// testVbsKeyVal()
// function testVbsKeyVal() {
   
//     // let u = {"a": "dfdf"} 
//     // let u = {"a": "key","js":'23',"djd":"dsdh"};
//     // let u = {89:"key","shj":"dfn","23":"dfhjdf"}
//     let cc = {
//     	"k": "edf",
//     	"l": "ddf",
//     	"sd": 1234,
//     	"sdf":"dfjk"
//     }
//     // let u = {"s":cc};
//     let u = {"df":{"sd":"dsf"},"s":cc,"dfj":"dfjk","sjdksd":"df","dfhjdf":"dbfhdfd","93":"dfhdf"};
//     let myVbs = vbsEncode.encodeVBS(u);
//     // console.log(myVbs)
//     let ss = vbsDecode.decodeVBS(myVbs,0);
//     console.log(u, myVbs, ss)
// }
// console.time("testVbsBatchKeyVal");
// testVbsBatchKeyVal()
// console.timeEnd("testVbsBatchKeyVal");
// //  449.957ms
// function testVbsBatchKeyVal() {
//     let cc = {
//         "k": "edf",
//         "l": "ddf",
//         "sd": 1234,
//         "sdf":"dfjk"
//     }
//     for (let i=20;i<2002.8;i++) {
//         // let u = {"s":cc};
//         let u = {"df":{"sd":i},"s":cc,"dfj":"dfjk","sjdksd":i+300.5,"dfhjdf":"dbfhdfd","93":"dfhdf"};
//         let myVbs = vbsEncode.encodeVBS(u);
//         console.log(myVbs.byteLength)
//         let ss = vbsDecode.decodeVBS(myVbs, 0);
//         i++;
//         // console.log(u, myVbs, ss)
//     }
// }
test() 
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
    let myVbs = vbsEncode.encodeVBS(msg);
    console.log(myVbs.byteLength)
    let ss = vbsDecode.decodeVBS(myVbs, 0);
}
// testVbsArray()
// function testVbsArray() {
//     // let u = [7823,8912,[892,1289],92389238293232320,237,[823],23,[3489343,892323,892323],[3748434,8923892],895,8923,80];
// 	// let u = [23,34,[52,372],56,56]; 
// 	// let u = [[78,[90,79]],[892323,[9023,323]]]
//     // let u = [78,[2,9],90,[89]];
// 	// let u = [23,34,52372,56,56,true,false,343,56,"dflkd","df",4,568,89434]; 
//     // let u = [16,new Uint8Array([15,68,12]),1212,128723,2389]; 
//     // let u = [8, new Uint8Array([15,68,12]),67.89,"sdsaf",[167,89.78,89.37,new Uint8Array([89,2389,3489,89.8]),89],"sdhj",89,"hdfdf",new Uint8Array([190,68,12])];
//     // let u = [92389.89, 23.78,829.789,3.127823,2323.20];
//     // let u = [[78,[90,79]],[892323,[909023,78232323]]];
//     // let u = [892323,[909023,78232323]];
//     // let u = ["wehjwe","sdjhdsfd","dfbjdfdf","dfdufdqwqw","sdwuebuweegueygfurwr","sdhhhhhhuer","374823"];
//     // let u = ["why"];
//     // let u = ["shdjsd"]
//     // let u = [89.347,89]
//     // let u = [new Uint8Array([15,68,12,68]),89,67,"dshfjf",new Uint8Array([38,12,68])];
//     // let u = [new Uint8Array([])];
//     // let u = [12,-3.04,-78.6,"string", null,"中国",new Uint8Array([15,68,12,68]),"sddf"];
//     let u = ["中国",2389,9223372036854775823.6,Math.pow(2,128),-78.9,[909023,78232323],"日本","dfjdf","俄罗斯",new Uint8Array([15,68,12,68]),"dfhjdfer","美国","韩国","dhjfdf","澳大利亚"];
//     // let u = {};
//     // let u = Math.pow(2,128);
//     // let u = [true,12,89.78,"hjdf",[89,67],{"df":"dfb","dg":89}];
//     // let u = [{"df":"dfb","dg":89}];
//     // let u = Math.pow(2, 1023)
//     // let u = 36893488147419103232;
//     let myVbs = vbsEncode.encodeVBS(u);
//     // console.log(myVbs)
//     let ss = vbsDecode.decodeVBS(myVbs,0);
//     console.log(u, myVbs, ss)
// }
// testVbsBatArray()
// function testVbsBatArray() {
//     for (let i=0;i<100;) {
//     	 let u = [8, new Uint8Array([15,68,12]),67,[i,89],"sdhj",89,"hdfdf",new Uint8Array([190,68,12])];
// 	    let myVbs = vbsEncode.encodeVBS(u);
// 	    i += 20;
// 	    // console.log(myVbs)
// 	    let ss = vbsDecode.decodeVBS(myVbs);
// 	    console.log(u, myVbs, ss)
//     }  
// }
// console.log([23,34,45,{"key":34,"value":56}])
// testVbsString()
// function testVbsString() {
//     // let u = [89,23,902323,3403493,450459,23902,34903];
//     // let u = ["89","skdj","sdhjs","sdjksd","dshf","dfjk",89,100,290,"sdhj"];  8023238934,237,[823],23,3489343,892323
//     // let u = [12.89,89.8,24,89,"str","sdhj",89.8,80.6,-1.1,-1.25] ,[3748434,8923892],895,8923,80
//     // let u = [12,[9,6],80,[89],90,67]
//     // let u = [[8023238934,237,[823],23,3489343,892323]]
//     let u = [7823,8912,[892,1289],90,237,[823],23,[3489343,892323,892323],[3748434,8923892],895,8923,80];
//     // let u = [null];
//     // let u = -1.367;
//     let myVbs = vbsEncode.encodeVBS(u);
//     // console.log(myVbs)
//     // let ss = vbsDecode.decodeVBS(myVbs, 0);
//     // console.log(u, '----' )
// }
// testVbsBool()
// function testVbsBool() {
//     let u = true; 
//     let myVbs = vbsEncode.encodeVBS(u);
//     // console.log(myVbs)
//     let ss = vbsDecode.decodeVBS(myVbs);
//     console.log(u,ss)
    
// }
// testVbsBlob()
// function testVbsBlob() {
//     for (let i = 0;i<20; i++) {
//          u = new Uint8Array([1,i,3,4,5,6,230,255]); 
//         let myVbs = vbsEncode.encodeVBS(u);
//         i++;
//         let ss = vbsDecode.decodeVBS(myVbs,0);
//         console.log(u, ss)
//     }  
// }

// testVbsBlob()
// function testVbsBlob() {
//     let u = new Uint8Array([1,6,3,4,5,78,6,230,255]); 
//     let myVbs = vbsEncode.encodeVBS(u);
//     let ss = vbsDecode.decodeVBS(myVbs);
//     console.log(u, ss)  
// }
// function testVbsFloat() {
//     // let u = -1282.8923298283232;  // small number test
//     // let u = Math.pow(2, 1022) - 1  // big number test
//     // let u = NaN;
//     // let u = 7834.343;
//     let u = 1278.2963
//     // let u = 0;
//     let myCode = vbsEncode.encodeVBS(u);
//     let ss = vbsDecode.decodeVBS(myCode, 0);
//     console.log(u, myCode, ss)
//     // let dv = new DataView(myVbs); 
//     // // 从第1个字节读取一个8位无符号整数
//     // let v1 = dv.getUint8(0);
//     // console.log(v1)
// }
// testVbsFloat()
// function testVbsFloat() {
//     // for (let u = 1;u < 50;) {
//     //    let myVbs = vbsEncode.encodeVBS(u);
//     //    let ss = vbsDecode.decodeVBS(myVbs);
//     //    console.log(u, myVbs, ss)
//     //    u += Math.random();
//     // } 
//     for (let u = 10;u < 433555556756565;) {
//        let myVbs = vbsEncode.encodeVBS(u);
//        let ss = vbsDecode.decodeVBS(myVbs,0);
//        console.log(u, myVbs, ss)
//        u *= 51;
//     } 
//     // for ( u = 10.5;u < 428543.44189;) {
//     //    let myVbs = vbsEncode.encodeVBS(u);
//     //    let ss = vbsDecode.decodeVBS(myVbs, 0);
//     //    console.log(u, myVbs, ss)
//     //    u += 100.6898;
//     // }
    
// }
