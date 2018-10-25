// judeg obj whether is integer
function isInteger(obj) {
    return typeof obj === 'number' && (obj % 1 === 0);
}
// string to byte
function stringToByte(str) {
	var bytes = new Array();
	var len, c;
	len = str.length;
	for(var i = 0; i < len; i++) {
		c = str.charCodeAt(i);
		if(c >= 0x010000 && c <= 0x10FFFF) {
			bytes.push(((c >> 18) & 0x07) | 0xF0);
			bytes.push(((c >> 12) & 0x3F) | 0x80);
			bytes.push(((c >> 6) & 0x3F) | 0x80);
			bytes.push((c & 0x3F) | 0x80);
		} else if(c >= 0x000800 && c <= 0x00FFFF) {
			bytes.push(((c >> 12) & 0x0F) | 0xE0);
			bytes.push(((c >> 6) & 0x3F) | 0x80);
			bytes.push((c & 0x3F) | 0x80);
		} else if(c >= 0x000080 && c <= 0x0007FF) {
			bytes.push(((c >> 6) & 0x1F) | 0xC0);
			bytes.push((c & 0x3F) | 0x80);
		} else {
			bytes.push(c & 0xFF);
		}
	}
	return bytes;


}

// ArrayBuf to string 
function abToString(arr, pos, n) {
	if(typeof arr === 'string') {
		return arr;
	}
	var str = '',
	    _arr = arr;
	for(var i = pos; i < n; i++) {
		var one = _arr[i].toString(2),
			v = one.match(/^1+?(?=0)/);
		if(v && one.length == 8) {
			var bytesLength = v[0].length;
			var store = _arr[i].toString(2).slice(7 - bytesLength);
			for(var st = 1; st < bytesLength; st++) {
				store += _arr[st + i].toString(2).slice(2);
			}
			str += String.fromCharCode(parseInt(store, 2));
			i += bytesLength - 1;
		} else {
			str += String.fromCharCode(_arr[i]);
		}
	}
	return str;
}

function isEmpty(value) {
  return (Array.isArray(value) && value.length === 0) || (Object.prototype.isPrototypeOf(value) && Object.keys(value).length === 0);
}

// put obj to arr1
function arrCopy(arr1, obj) {
	if (typeof obj != "undefined") {
		arr1.push(obj);
	}
	return arr1;
}
// byte to hex 
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

function judgeIsBasicType(obj) {
	let isBasic;
	switch (typeof obj) {
        case 'number':
        case 'boolean':
        case 'string':
        case 'undefined':
        case 'null':
        case 'symbol':
        	isBasic = true;
        	break;
        default:
        	isBasic = false;
    }
    return isBasic;
}
// 深度拷贝
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
//十六进制字符串转字节数组  
function strHex2Bytes(str) {  
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

module.exports = {
    isInteger,
    stringToByte,
    isEmpty,
    arrCopy,
    abToString,
    judgeIsBasicType,
    strHex2Bytes,
    bytes2Str,
    deepClone
}
