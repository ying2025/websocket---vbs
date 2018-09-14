var bigInt  = require("big-integer");  // 引入大整型
// 生成指定长度的16进制随机数
function randomWord(randomFlag, min, max){
    var str = "",
    range = min,
    arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
    // 随机产生
    if(randomFlag){
        range = Math.round(Math.random() * (max-min)) + min;
    }
    for(var i=0; i<range; i++){
        pos = Math.round(Math.random() * (arr.length-1));
        str += arr[pos];
    }
    return str;
}
function deepClone(obj) {
  // 先检测是不是数组和Object
  // let isArr = Object.prototype.toString.call(obj) === '[object Array]';
  let isArr = Array.isArray(obj);
  let isJson = Object.prototype.toString.call(obj) === '[object Object]';
  if (isArr) {
    // 克隆数组
    let newObj = [];
    for (let i = 0; i < obj.length; i++) {
      newObj[i] = deepClone(obj[i]);
    }
    return newObj;
  } else if (isJson) {
    // 克隆Object
    let newObj = {};
    for (let i in obj) {
      newObj[i] = deepClone(obj[i]);
    }
    return newObj;
  }
  // 不是引用类型直接返回
  return obj;
};

Object.prototype.deepClone = function() {
  return deepClone(this);
};
Object.defineProperty(Object.prototype, 'deepClone', {enumerable: false});
//十六进制字符串转字节数组  
function str2Bytes(str) {  
    var pos = 0; 
    var len = str.length;  
    if(len%2 != 0) {  
       return null;   
    }  
    len /= 2;  
    var hexA = new Array();  
    for(var i=0; i<len; i++) {  
       var s = str.substr(pos, 2);  
       var v = parseInt(s, 16);  
       hexA.push(v);  
       pos += 2; 
    }  
    return hexA;  
}    
//字节数组转十六进制字符串  
function bytes2Str(arr) {  
    var str = "";  
    if(arr == undefined) {
      return;
    }
    for(var i=0; i<arr.length; i++){  
       var tmp = arr[i].toString(16);  
       if(tmp.length == 1) {  
           tmp = "0" + tmp;  
       }  
       str += tmp;  
    }  
    return str;  
}  
// bigInter compare with 0
function bigisZero(big) {
    var a = bigInt(big).compare(bigInt(0));
    if (a == 0) {
        return true;
    } else {
        return false;
    }
}
module.exports = {
    randomWord,
    str2Bytes,
    bytes2Str,
    bigisZero,
    deepClone
}
