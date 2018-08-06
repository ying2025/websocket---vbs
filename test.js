let payBytes = new Uint8Array([1,2,3]);
let preBytes = [];
preBytes.push(0x51);  // "Q"
let msgTemp = preBytes.concat(payBytes);
let data = new Uint8Array(msgTemp);
console.log("data", msgTemp, data);
