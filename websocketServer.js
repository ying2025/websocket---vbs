let   WebSocket = require("ws");
const msgHeader  = require('./message.js').MsgHeader;
const srp6aServer = require('./srp6a/SRP6a.js').NewServer;
const vbsEncode = require('./VBS/encode.js');
const vbsDecode = require('./VBS/decode.js');
const commonFun = require('./commonFun.js');
const maxPayload = 20480;
const maxMessageSize = 64*1024*1024;
const maxAttempTimes = 3;  
let   sleepTime  = 5000; // 5 second
let   emptyString = "";
let   emptyArray  = [];
/**
 *  @dev ServerSocket class
 *  descirpe: deal Websocket event
 *       init server param, listen the connect
 */
class ServerSocket {
      constructor() {
          this.err     = "";
          // this.msgHead = new msgHeader();
          let client = {
             rejectReqFlag: false,
             closeFlag: false,
             isEnc: true,
             canSendHel: false,  // Pass SRP6a verify
             txid: 1,
             send_nonce: 1,
             receiveMsgCounter: 0,
             key: [],
             nonce: "22E7ADD93CFC6393C57EC0B3C17D6B44",
             header: "126735FCC320D25A",
             nonceList: [],
             unDealReplyList: [],
             receiveList: [],
             sendList: [],
             receiveDataList: [],
             sendDataList: [],
             // msgHead: msgHeader,
             srv: null
          };
          this.connect_promise = new Promise((resolve, reject) => {
            let wss = new WebSocket.Server({
              perMessageDeflate: true,
              maxPayload,
              port: 8989
            }, () => {
              const ws = new WebSocket(`ws://localhost:${wss.address().port}`);
              console.log("begin to connect");
            });
            wss.on('connection', (ws, req) => {
                let ip = req.connection.remoteAddress;
                console.log("Connecting IP", ip);
                ws = Object.assign(ws, client);
                let msgHead = new msgHeader();
                this.sayHello(ws, msgHead);
                ws.on('message', function incoming(data) {
                    try {
                         console.log("receive data--", data)
                         if (Object.prototype.toString.call(data) == '[object Uint8Array]' && data.byteLength < 8) {
                            return;
                         }
                         dealRequest(msgHead, ws, data);
                    } catch(e) {
                        console.error(e);
                    }
                });
                ws.on('error', (error) => {
                    console.error("error", error);
                });
                ws.on('close', (evt) => {
                  console.log("Close", evt);
                });
            });
            wss.on('listening', () => {
              console.log("Begin listen")
            });
          });        
    }
    /**
     *  @dev sayHello
     *  Fun: check the encrypt flag. If the flag is true, 
     *       then pack Authenticate message to client, 
     *       else send Hello to client.
     *  @param {ws} Websocket Object.
     *  @param {msgHeader} msgHeader Object
     */
    sayHello(ws, msgHeader) {
       let greetByte;
       if (ws.isEnc) {
          greetByte = this.outCheck(msgHeader);
       } else {
          greetByte = msgHeader.packMsg('H');
       }
       try {
          ws.send(greetByte);
       } catch(e) {
          throw new Error(e);
       }
    }
    /**
     *  @dev outCheck
     *  Fun: SRP6a consult the common key, return C type message data 
     *       pack the command and args, then decode outcheck with VBS
     *       pack header and encode outcheck message, then send the C type message
     *  @param {msgHeader} msgHeader Object
     */
    outCheck(msgHeader) {
       msgHeader._messageHeader.type = 'C';
       let c = Object.assign(msgHeader._check, msgHeader._messageHeader);
       c.cmd = "AUTHENTICATE";
       c.arg["method"] = "SRP6a";
       return msgHeader.packCheck(c.cmd, c.arg);
    }
}
/**
 *  @dev dealRequest
 *  Fun: resolve the receive message, and  response it
 *     If already receive B type message, the rejectReqFlag is true.
 *     If message is encrypt, then  remove nonce   
 *     If receive duplication of data, do nothing with it.
 *  @param {msgHeader}  msgHeader Object      
 *  @param {ws}         Websocket Object
 *  @param {bufferData} receive message
 */
function dealRequest(msgHead, ws, bufferData) {
    let err;
    let serverFunc = new ServerFunc(ws, msgHead);

    if (ws.closeFlag == true) {
        if (ws.unDealReplyList.length == 0) {
            let suc = serverFunc.close();
            if (suc) {
                ws.closeFlag = false;
                ws.rejectReqFlag = false;
                return;
            }
        }
    }

    let bufData = new Uint8Array(bufferData);
    let header;
    if (bufData.length > 16 && bufData[8] == 0x58 && bufData[11] == 0x01) {  // encrypt
         let nonce = new Uint8Array(bufferData, 0, 8);
         ws.nonceList.filter((v, j) => {
             if (v.toString() == nonce.toString()) {
                 console.error("Data have been receive");
                 err = "Data have been receive";
                 throw new Error(err);
             }
         });
         ws.nonceList[ws.nonceList.length] = nonce;
         bufData = new Uint8Array(bufData.buffer, 8);
         header = new Uint8Array(bufData.buffer, 8, 8);
    }  else if (bufData.length >= 8) {
         header = new Uint8Array(bufData.buffer, 0, 8);
    } else {
          console.log("Error data type", Object.prototype.toString.call(bufferData), bufferData.byteLength, bufferData.length);
          err = "Receive data is error, the length of data is not less than 8 byte!";
          throw new Error(err);
    }
    if (ws.rejectReqFlag) {  // reject new request if already receive Bay.
        return;
    }
    ws.unDealReplyList[ws.unDealReplyList.length] = bufData;
    resolveRequest(header, bufData, ws, msgHead, serverFunc);
} 
/**
 *  @dev resolveRequest
 *  Fun: resolve the receive message, and  response it
 *     If already receive B type message, the rejectReqFlag is true.
 *     If message is encrypt, then  remove nonce   
 *  @param {header}     message header Object  
 *  @param {bufferData} receive message    
 *  @param {ws}         Websocket Object
 *  @param {msgHead}    msgHead Object
 *  @param {serverFunc} serverFunc Object
 */
function resolveRequest(header, bufData, ws, msgHead, serverFunc){
    let err;
    let head   = serverFunc.getHeader(header);
    serverFunc.checkHeader(head);
    if (serverFunc.err != emptyString) {
        throw new Error(serverFunc.err);
    }
    serverFunc.deleteUndealData(bufData);
    let res;
    switch(head.type) {
        case 'H':
            res = serverFunc.packQuest(serverFunc.isEnc);
            break;
        case 'Q':
            // ws.receiveMsgCounter++;
            // if (ws.receiveMsgCounter > 3) {
            //     ws.closeFlag = true;
            //     ws.rejectReqFlag = true;
            // }
            res = serverFunc.dealRequest(bufData);
            break;
        case 'C':
            res = serverFunc.dealCheck(bufData);
            if (ws.canSendHel) {  
                ws.send(res);
                res = msgHead.packMsg('H');
            }
            break;
        case 'A':
            res = serverFunc.dealAnswer(bufData);
            break;
        case 'B':
            ws.rejectReqFlag = true;
            let flag = serverFunc.gracefulClose(serverFunc, header);
            if (flag) {
               ws.close();
            } else {
               return;
            }
            break;
        default:
            err = "ERROR Message";
            throw new Error(err);
    }
    if (serverFunc.err != emptyString && serverFunc.err != undefined) {
        throw new Error(serverFunc.err);
    }
    if (res != emptyArray && (typeof res != 'undefined') && res != undefined) {
        try {
            ws.send(res);
        } catch(e) {
            throw new Error(e);
        }
    }
}
/**
 *  @dev ServerFunc
 *  Fun: deal Q、A、C、B type message function set
 *  @param {ws}         Websocket Object
 *  @param {msgHeader}  msgHeader Object      
 */
class ServerFunc {
    constructor(ws, msgHeader) {
        this.ws = ws;
        this.msgHeader = msgHeader;
        this.err = "";
        this.messageHeader = msgHeader._messageHeader;
        this.attempTimes   = 0;
        this.sleepTime     = sleepTime;
    }
    /**
     *  @dev close 
     *  Fun: Server active close connection         
     */
    close() {
        let flag = false;
        let len = 0,i = 0;
        while(this.msgHeader.receiveList.length != 0) {
             len = this.ws.receiveList.length;
             let bufData = this.ws.receiveDataList[i++]
             this.msgHeader.unpackQuest(bufData);
             if (len == 0) {
                break;
             }
        }
        while(this.ws.sendList.length != 0) {  // wait for reply
            this.attempTimes++;
            wait(this.sleepTime);
            if (this.attempTimes > maxAttempTimes) {
              break;  // force close after attempt three times
            }
        }
        flag = (this.ws.receiveList.length == 0) && (this.ws.sendList.length == 0);
        if (flag) {
            this.ws.send(this.msgHeader.packMsg('B'));
        }
        return flag;
    }
    /**
     *  @dev isRepeatData
     *  Fun: Judge whether receive repeated data
     *  @param {bufferData} receive message         
     */
    isRepeatData(bufData) {
        this.ws.unDealReplyList.filter((v, j) => {
            if (v.toString() == bufData.toString()) {
                return true;
            }
        });
        this.ws.unDealReplyList[this.ws.unDealReplyList.length] = bufData;
        return false;
    }
    /**
     *  @dev getHeader
     *  Fun: resolve the header
     *  @param {header} receive message of the first 8 byte        
     */
    getHeader(header) {
        this.messageHeader.magic    = String.fromCharCode(header[0]);
        this.messageHeader.version  = String.fromCharCode(header[1]);
        this.messageHeader.type     = String.fromCharCode(header[2]);
        this.messageHeader.flags    = header[3];
        this.messageHeader.bodySize = (header[4]<<24) + (header[5]<<16) + (header[6]<<8) + header[7];
        return this.messageHeader;
    }
    /**
     *  @dev checkHeader
     *  Fun: check the header whether is qualified 
     *  @param {header} receive message of the first 8 byte        
     */
    checkHeader(header) {
        if (header.magic != 'X' || header.version != '!') {
             this.err = "Unknown message Magic "+header.magic+" Version"+ header.version; 
             return;
         }
         switch(header.type) {
            case 'Q':
            case 'A':
            case 'C':
               if (header.flags != 0 && header.flags != 0x01) {
                  this.err = "Unknown message Flags"; 
                  return;
               } else if(header.bodySize > maxMessageSize) {
                  this.err = "Message size too large"; 
                  return;
               }
               break;
           case 'H':
           case 'B':
               if (header.flags != 0 || header.bodySize != 0) {
                  this.err = "Invalid Hello or Bye message"; 
                  return;
               } 
               break;
           default:
              this.err = "Unknown message Type" + header.type; 
              return;
         }
         return emptyString;
    }
    /**
     *  @dev deleteUndealData
     *  Fun: delete unDealReplyList which is dealing
     *  @param {bufData} receive message      
     */
    deleteUndealData(bufData) {
        this.ws.unDealReplyList.filter((v, j) => {
            if (v.toString() == bufData.toString()) {
                this.ws.unDealReplyList.splice(j,1);
            }
        });
    }
    /**
     *  @dev packQuest
     *  Fun: pack message, send to client.
     *  Additional describe: If encrypt then the format is nonce(8 bytes) + header(8 bytes) + message(ciphertext)
     *                   else header(8 bytes) + message(Plaintext)
     */
    packQuest(isEnc) {
        let q = Object.assgin(this.msgHeader._quest, {txid: this.ws.txid});
        let ctx = {"sd":344};
        let arg = {"sj":89};
        let [data, msg] = this.msgHeader.packQuest(q.txid, "service","method", ctx, arg);
        if (this.msgHeader.err != emptyString && this.msgHeader.err != undefined) {
              throw new Error(this.msgHeader.err);
        }
        let len = msg.byteLength;
        if (q.txid != 0) {
           this.ws.sendList[this.ws.sendList.length] = q.txid; 
        }
        this.ws.sendDataList[q.txid] = new Uint8Array(msg, 1);
        this.ws.txid++;
        return msg;
    }
    /**
     *  @dev dealRequest
     *  Fun: resolve the request data from client that type is Q
     *      If txid is 0, do nothing, else if the message has alread recceived, 
     *      pack the error message to client,else pack the answer to client
     *      send answer to client
     *  @param {bufData} receive message      
     */
    dealRequest(bufData) {
        this.msgHeader._isEnc = bufData[3];
        this.msgHeader.vec.key = commonFun.bytes2Str(this.ws.key);
        this.msgHeader.vec.nonce = this.ws.nonce;
        this.msgHeader.vec.header = this.ws.header;
        let [q, sendMsg] = this.msgHeader.unpackQuest(bufData);
        console.log("Receive message from client", q.args);
        console.log("The data is to send ", sendMsg);
        if (typeof sendMsg != "undefined" && sendMsg != undefined) {
              this.ws.send(sendMsg);
        }
        if (this.msgHeader.err != emptyString) {
            this.err = this.msgHeader.err;
            this.msgHeader.err = emptyString;
            return;
        }
    }
    /**
     *  @dev dealCheck
     *  Fun: resolve C type data
     *      Get data body, then decode the data with vbs
     *      According to command, send the reference message to client.
     *  @param {bufData} receive message      
     */
    dealCheck(bufData) {
        let c = this.msgHeader._check;
        let pos = 0;
        let len = ((bufData[4] & 0xFF) << 24) + ((bufData[5] & 0xFF) << 16) + ((bufData[6] & 0xFF) << 8) + (bufData[7] & 0xFF);
        [c.cmd, pos] = vbsDecode.decodeVBS(bufData, 8);    
        [c.arg, pos] = vbsDecode.decodeVBS(bufData, pos);
        if (len + 8 != pos) {
            this.err = "Decode message error, the length of encode byte dissatisfy VBS Requirement!";
            throw new Error(this.err);
        }
        let cmd = c.cmd;
        let args = c.arg;
        if (cmd == "SRP6a1") {
            let hexN = "EEAF0AB9ADB38DD69C33F80AFA8FC5E86072618775FF3C0B9EA2314C" +
            "9C256576D674DF7496EA81D3383B4813D692C6E0E0D5D8E250B98BE4" +
            "8E495C1D6089DAD15DC7D7B46154D6B6CE8EF4AD69B15D4982559B29" +
            "7BCF1885C529F566660E57EC68EDBC3C05726CC02FD4CBF4976EAA9A" +
            "FD5138FE8376435B9FC61D2FC0EB06E3";
            let saltHex  = "BEB25379D1A8581EB5A727673A2441EE";
            let hashName = "SHA1";
            let vHex     = "7E273DE8696FFC4F4E337D05B4B375BEB0DDE1569E8FA00A9886D8129BADA1F1822223CA1A605B530E379BA4729FDC59F105B4787E5186F5C671085A1447B52A48CF1970B4FB6F8400BBF4CEBFBB168152E08AB5EA53D15C1AFF87B2B9DA6E04E058AD51CC72BFC9033B564E26480D78E955A5E29E7AB245DB2BE315E2099AFB";
            let g = 2;
            let idPass = {"alice": vHex};
            const bits = 1024;
            let id = args["I"];
            let verifierHex;
            if (idPass.hasOwnProperty(id)) {
              verifierHex = idPass[id];
            } else {
              throw new Error("Cann't find this user!");
            }
            this.ws.srv = new srp6aServer(g, hexN, bits, hashName);
            let v = commonFun.strHex2Bytes(vHex);
            this.ws.srv.setV(v);
            let B = this.ws.srv.generateB();
            let BHex = commonFun.bytes2Str(B);

            this.msgHeader._check.cmd = "SRP6a2";
            this.msgHeader._check.arg["hash"] = hashName;
            this.msgHeader._check.arg["s"]    = saltHex;
            this.msgHeader._check.arg["B"]    = BHex;
            this.msgHeader._check.arg["g"]    = g;
            this.msgHeader._check.arg["N"]    = hexN;
        } else if (cmd == "SRP6a3") {
            let A1  = args["A"];
            let M11 = args["M1"];
            let A   = commonFun.strHex2Bytes(A1);
            let M1  = commonFun.strHex2Bytes(M11);
            this.ws.srv.setA(A);
            this.ws.srv.serverComputeS();
            let M1_mine = this.ws.srv.computeM1(this.ws.srv);
            if (M1_mine.toString() == M1.toString()) {
               let M2 = this.ws.srv.computeM2(this.ws.srv);
               this.msgHeader._check.cmd          = "SRP6a4";
               let M22 = commonFun.bytes2Str(M2);
               this.msgHeader._check.arg["M2"]    = M22;
               this.ws.key = this.ws.srv.computeK(this.ws.srv);
               this.ws.srv = null;
               this.ws.canSendHel = true;
             } else {
               this.err = "Srp6a Error, M1 is different!";
             }
        } else {
            this.err = "XIC.WARNING", "#=client authentication failed";
        }
        if (this.err != emptyString && this.err != undefined) {
            this.msgHeader._check.cmd = "FORBIDDEN";
            this.msgHeader._check.arg["reason"] = this.err;
            this.ws.srv = null;
        }
        return this.msgHeader.packCheck(this.msgHeader._check.cmd, this.msgHeader._check.arg);
    }
    /**
     *  @dev dealAnswer
     *  Fun: Deal A type message
     *      Get answer type message
     *      Remove txid from sendList
     *  @param {bufData} receive message      
     */
    dealAnswer(bufData) {
        let a = this.msgHeader.unpackAnswer(bufData);
        if (this.msgHeader.err != emptyString && this.msgHeader.err != undefined) {
             this.err = this.msgHeader.err;
             return this.err;
        }
        this.ws.sendList.filter(v => v!= a.txid);
    }
    /**
     *  @dev gracefulClose
     *  Fun: Gracefully close the connection with one client.
     *      If unDealReplyList/receiveList/sendList is empty, directly send Bye to client
     *      else deal with request firstly, send Bye to client when receiveList is empty
     *  @param {serverFunc} serverFunc Object  
     *  @param {header}     the message of header    
     */
    gracefulClose(serverFunc, header) {
        let flag = false;
        let len, i=0;
        while(this.ws.unDealReplyList.length != 0) {
             len = this.ws.unDealReplyList.length;
             let bufData = this.ws.unDealReplyList[i++];
             resolveRequest(header, bufData, this.ws, this.msgHead, serverFunc);
             if (len == 0) {
                break;
             }
        }
        i = 0;
        while(this.msgHeader.receiveList.length != 0) {
             len = this.ws.receiveList.length;
             let bufData = this.ws.receiveDataList[i++]
             this.msgHeader.unpackQuest(bufData);
             if (len == 0) {
                break;
             }
        }
        while(this.ws.sendList.length != 0) {  // wait for reply
            this.attempTimes++;
            wait(this.sleepTime);
            if (this.attempTimes > maxAttempTimes) {
              return true;  // force close after attempt three times
            }
        }
        let tag = (this.ws.receiveList.length == 0) && (this.ws.sendList.length == 0);
        if (tag) {
            flag = true;
        }
        return flag;
    } 
}
/**
 *  @dev waitSend
 *  Fun: send v and then wait for 3 s
 */
async function wait(time) {
  await _sleep(time);
}
/**
 *  @dev _sleep
 *  Fun: time _sleep
 *  return time
 */
function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

new ServerSocket();

module.exports = {
    ServerSocket
}



