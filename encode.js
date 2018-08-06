const kindConst  =    require('./kind.js');
const floatOperate =  require('./float.js');
const commonFun = require('./commonFun.js');
function VbsEncoder() {
    VbsEncoder.prototype.bp = [];
    /**
     *  @pack the integer

     *  return: this.bp
     */
    this.encodeInterger = function(value){  // isE: judge whether it is exponent
        if (value < 0) {
                 this._packIntOrStringHead(kindConst.vbsKind.VBS_INTEGER + 0x20, -value); 
           } else {
                this._packIntOrStringHead(kindConst.vbsKind.VBS_INTEGER, value);
           }
           return this.bp;
    }
     /**
     *  @pack the head
     */
    this._packIntOrStringHead = function(kind, num) {
        let n = 0;
        let len = this.bp.length;
        this.bp = _intShift(this.bp, n + len, kind, num); 
    }
    /**
      *  @split num according to byte and  encode every byte
      *   the highest position of every byte set up to 1 except the last byte
      *   the late byte and kind conduct  or operartion
     */
    function _intShift(bp = [], n, kind, num) {
        let numString = num.toString(2);
        let arr = [];
        arr = arr.concat(bp);
        let len = numString.length;
        let numLow;  // bit of every operated
        for(let i=0;num >= 0x20 && (i < len);n++) {
            if (len - i >= 7) { // shift every 7 bit, so that it can form every
                numLow = numString.slice(len - i -7,len - i); // splice 7 bit
                num = numString.slice(0, len - i -7);
                if (typeof num != 'number') {
                    num = parseInt(num, 2);
                }
                i += 7;
                arr[n] = 0x80 | parseInt(numLow, 2); // carry every encode bit
            } else {
                if (typeof num != 'number') {
                    num = parseInt(num, 2);
                }
                arr[n] = 0x80 | num; // carry every encode bit
                num >>= 7;
            }
        }
        arr[n] = kind | num;  // operate (VBS_INTEGER | num[num.length - 1])
        return arr;
    }
    /**
      *  @encode float
      *  split value to expo and mantissa
      *  and then pack expo with encodeInterger
      *  pack mantissa with _packKind
     */
    this.encodeFloat = function(value){  
        let [expo, mantissa] = floatOperate.breakFloat(value);

        if (mantissa < 0) {
              this._packKind(kindConst.vbsKind.VBS_FLOATING + 1, -mantissa); 
           } else {
              this._packKind(kindConst.vbsKind.VBS_FLOATING, mantissa);
           }
           this.encodeInterger(expo);
           return this.bp;
    }
    /**
      *  @pack num and kind
     */
    this._packKind = function(kind, num) {
        let n = 0;
        this.bp = _floatShift(kind, num);
        n = this.bp.length;
        this.bp[n] = kind; // encode identifier
    }
    /**
      *  @split num according to byte and  encode every byte
      *   the highest position of every byte set up to 1 except the last byte
     */
    function _floatShift(kind, num) {
        let numString = num.toString(2);
        let n = 0;
        let arr = [];
        let len = numString.length;
        if (len == 1) {  // only one byte
            arr[n] = 0x80 | num;
            return arr;
        }
        for(let i = 0;i < len;) {
            let numLow;
            if (len - i >= 7) {
                numLow = numString.slice(len - i -7,len - i); // splice 7 bit
                i += 7;
                arr[n] = 0x80 | parseInt(numLow, 2); // carry every encode bit 
            } else {
                numLow = numString.slice(0,len - i); // the last byte
                i += len - i;
                arr[n] = 0x80 | parseInt(numLow, 2);

            }
            n++;
        }
        return arr;
    }

    /**
      *  @blob decode
      *   pack the type of value  and the length of value
      *   pack the blob data 
     */
    this.encodeBlob = function(value) {
        this._packKind(kindConst.vbsKind.VBS_BLOB, value.length);
        let n = this.bp.length;
        for (let i=0;i < value.length; i++) {
            this.bp[n+i] = value[i];
        }
        return this.bp;
    }
    /**
      *  @bool decode
      *   pack the true/false
      *   pack the bool type
     */
    this.encodeBool = function(value) {
        let b = kindConst.vbsKind.VBS_BOOL;
        let n = 0;
        if (value) {
            b += 1;
        }
        this.bp[n] = b;
        return this.bp;
    }
    /**
      *   @pack string
      *   pack the type of the value and the length of the value
      *   pack the data
     */
    this.encodeString = function(value) {
        let bytes = commonFun.stringToByte(value);
        this._packIntOrStringHead(kindConst.vbsKind.VBS_STRING, bytes.length);

        let n = this.bp.length; 
        this.bp = this.bp.concat(bytes); 
        return this.bp;
    }
    /**
      *  @pack  null, undefine, function
      *   pack the null/undefine/function
     */
    this.encodeNull = function(value) {
        let n = 0;
        this.bp[n] = kindConst.vbsKind.VBS_NULL;
        return this.bp;
    }
    /**
      *  @bool null, function
      *   pack the null/undefine/function
     */
    this.encodeArray = function(value) {
        let n = 0;
        let head = kindConst.vbsKind.VBS_LIST;
        let arr = [];
        let arr2 = [];
        for (;n < value.length; n++) {
            arr[n] = vbsStringify(value[n]); // encode value which can be in any type
            arr2 = arr2.concat(arr[n]);
        }
        let tail = kindConst.vbsKind.VBS_TAIL; 
        let arr3 = [];
        this.bp = arr3.concat(head,arr2, tail); // head+arr2+tail
        return this.bp;
    }
    /**
      *   @pack object key/value
      *   pack the type of the value
      *   pack the data
      *   pack the tail
     */
    this.encodeObject = function(value) {
        let head = kindConst.vbsKind.VBS_DICT; // head identity
        let arr = [];
        let obj = _packObject(value); // pack the content by key/value
        let tail = kindConst.vbsKind.VBS_TAIL; 
        this.bp = arr.concat(head,obj, tail); // head+obj+tail  
        return this.bp;
    }
    /**
      *   @pack key and value
     */
    function _packObject(obj) {
      let arr = [];
      let data = [];
      let j=0;
      for (let i in obj) {
        if (obj.hasOwnProperty(i)) {
            arr[j++] = vbsStringify(i); // pack the key
            arr[j++] = vbsStringify(obj[i]); // pack the value that key->value

            data = data.concat(arr[j-2],arr[j-1]); // concat the pack key-value
        }
      }
      return data;
    }
}
/**
  *   @judge the obj type
  *    according to corresponding type to encode the data
*/
function vbsStringify(obj) {
        var vbsEncode = new VbsEncoder();
        if (obj === null) {
            return vbsEncode.encodeNull(obj);
        }
        switch (typeof obj) {
            case 'number':
                // big-float will be lost when store it
                // If the type of obj is exceed 53, it express with float
                if (commonFun.isInteger(obj) && obj <= Math.pow(2, 53)) {  
                    return vbsEncode.encodeInterger(obj);
                } else {
                   return vbsEncode.encodeFloat(obj);
                }
            case 'boolean':
                return vbsEncode.encodeBool(obj);
            case 'string':
                return vbsEncode.encodeString(obj);
            case 'undefined':
            case 'null':
            case 'function':
                return vbsEncode.encodeNull(obj);
            case 'object':
                 if (Object.prototype.toString.call(obj) == '[object Uint8Array]') { // blob
                    return vbsEncode.encodeBlob(obj);
                 } else if (Object.prototype.toString.call(obj) == '[object Array]') { // array
                    return vbsEncode.encodeArray(obj);
                 } else { // key/value
                    return vbsEncode.encodeObject(obj);
                }
        }
}
/**
  *   @encode data interface
  *   Description: Encode u to strCode, and turn strCode into Binary array
*/
function encodeVBS(u) { 
    let strCode = new vbsStringify(u);  // get encode vbs
    let byteArr = new Uint8Array(strCode);

    return byteArr.buffer;
}

module.exports = {
    encodeVBS
}


