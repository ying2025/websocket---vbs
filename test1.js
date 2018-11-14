// test4()
function test4() {
  var personObj1 = {
      name: 'Alex',
      age: 30
  };
  var personObj2 = changeAgeAndReference(personObj1);
  console.log(personObj1); // -> ?
  console.log(personObj2); // -> 
}

function changeAgeAndReference(person) {
    person.age = 25;
    person = {
        name: 'John',
        age: 50
    };
    
    return person;
}
// console.time("test");
// sleep(1000)
// console.timeEnd("test");
function sleep(time){
  for( let temp = Date.now(); Date.now() - temp <= time;);
}
// console.time("test2");
// waitSend().then(() => {
   
   
// }).catch((e) => {

// })
// console.timeEnd("test2");
async function waitSend() {
    console.time("test1");
    await _sleep(1000);
    console.timeEnd("test1");
}
function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// console.time("test");
// test4()
// console.timeEnd("test");

function test4() {
   let sendDataList = [{0:23},{4:89}, {1:45},{2:45},{3:89},{0:25},{5:89}];
   let sendList = [1,2,3];
   sendList.forEach(id => {
        sendDataList.filter((v, j) => {
            if (v[id] != undefined) {
                console.log(v, j)
            }
       });
    });
   // sendDataList.filter((v, j) => {
   //      // console.log(v, j);
        
   //      // console.log(sendList.indexOf(j), j)
   //      if (sendList.indexOf(j) != -1) {
   //          // console.log(v[j])
   //      }
   // });
}

// test5()
function test5() {
   let sendDataList = [{0:23},{4:89}, {1:45},{2:45},{3:89},{0:25},{5:89}];
   let sendList = [1,2,3];
   console.log(111)
   sendDataList.filter((v, j) => {
      if (sendList.indexOf(j) != -1) {
          console.log(v, j)
      }
   })
}
test6()
function test6(aa) {
    c = testA(aa);
    let as = c("aaa")
    console.log(as)
}
function testA(wsReconnect) {
    if (wsReconnect != undefined && typeof wsReconnect != "undefined") {
      return wsReconnect;
    } else {
      return (d) => {return d};
    }
}












// test3()
function test3() {
  let WebSocket = require("ws");
  const assert = require('assert');
  const  msgHeader  = require('./message.js').MsgHeader;
  let    msgHead = new msgHeader();
  const maxPayload = 20480;
  const wss = new WebSocket.Server({
      perMessageDeflate: true,
      maxPayload,
      port: 8989
    }, () => {
      const ws = new WebSocket(`ws://localhost:${wss.address().port}`);
      console.log("begin")
  });
  // console.log(wss)
  wss.on('request', (ws) => {

  });
  wss.on('listening', (ws) => {
    console.log("Begin listen")
  });
  wss.on("error", (ws) => {

  });
  wss.on('connection', (ws) => {
      console.log("Connect")
      ws.on('message', function incoming(data) {
         console.log("22222")
         let decodeMsg = _readerBlob(data).then((result) => {
             console.log('received: %s', result);
           }).catch(function (error) {
            return error;
        });
      });
      ws.send(msgHead.packMsg('H'));
   });
}


function _readerBlob(data) {
    let tempData;
    console.log(3333, data)
    return new Promise( function(resolve, reject) {
      let fileReader = new FileReader();
      fileReader.onload = (e) => {
        let arrayBuffer = fileReader.result;
        tempData = new Uint8Array(arrayBuffer);
        console.log(4444, tempData)
        resolve(tempData);
      }     
      fileReader.onerror = (err) => {
        that.err = "Read fail :" + err;
        reject(err);;
      }
      fileReader.readAsArrayBuffer(data);
    }); 
  }

// test3()
function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

function test() {
	console.time("test");
	sleep(1000);
	console.timeEnd("test");
	console.time("m");
	waitSend();
	console.timeEnd("m");
}
// test()
/**
     *  @dev waitSend
     *  Fun: send v and then wait for 3 s
     */
async function waitSend() {
  await _sleep(1000);
}
/**
 *  @dev _sleep
 *  Fun: time _sleep
 *  return time
 */
function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function test2() {
  console.error("1122")
}
// test2()
