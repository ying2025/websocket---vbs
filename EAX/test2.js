let fs = require("fs");

let aesContent = fs.readFileSync("./cryptojs-aes.min.js", "utf8");
let ctrContent = fs.readFileSync("./cryptojs-mode-ctr.min.js", "utf8");
let eaxContent = fs.readFileSync("./eax.js", "utf8");
console.time("sort");
test2();
console.timeEnd("sort");
function test2() {
    eval(aesContent);
    eval(ctrContent);
    eval(eaxContent);

    let vec = {
            key: "8395FCF1E95BEBD697BD010BC766AAC3",
            nonce: "22E7ADD93CFC6393C57EC0B3C17D6B44",
            header: "126735FCC320D25A",
            msg: "CA40D7446E545FFAED3BD12A740A659FFBBB3CEAB7",
            msg2: "91945D3F4DCBEE0BF45EF52255F095A4",
            msg3: "sdsfdgfsa",
            ct: "CB8920F87A6C75CFF39627B56E3ED197C552D295A7CFC46AFC253B4652B1AF3795B124AB6E"
        };
    let keyBytes = CryptoJS.enc.Hex.parse(vec.key),
        msgBytes = CryptoJS.enc.Hex.parse(vec.msg),
        msgBytes2 = CryptoJS.enc.Hex.parse(vec.msg2),
        nonceBytes = CryptoJS.enc.Hex.parse(vec.nonce),
        headerBytes = CryptoJS.enc.Hex.parse(vec.header);
    // console.time("msgBytes3");
    // msgBytes3 = CryptoJS.enc.Hex.parse(vec.msg3);
    // console.timeEnd("msgBytes3");
    // console.time("sort");
    let msgBytes4 = convertUint8ArrayToWordArray1(new Uint8Array([12,234,23,45,34, 67, 89, 89, 23, 89,34,0,45]));
    console.log(convertWordArrayToUint8Array2(msgBytes4))
    // console.log(convertWordArrayToUint8Array(msgBytes4));
    // let aa = new Uint8Array([12,234,34,23,34,45,34, 67, 89, 89, 23, 89,34,12,34,45]);
    // let cc = CryptoJS.lib.WordArray.create(msgBytes4)
    // console.log(cc);
    // let msgBytes4 = CryptoJS.lib.WordArray.create(aa);
    // console.log(msgBytes4)
    // console.timeEnd("sort");
    // let n1 = 1301;
    // let header = [0x58,0x21,0x43,0x01,0x0F,0x0,0x0,0x0];
    // encryption test
    let eax = CryptoJS.EAX.create(keyBytes);
    eax.prepareEncryption(nonceBytes, [headerBytes]);
    // eax.update(msgBytes);
    // eax.update(msgBytes2);
    // eax.update(msgBytes4);
    eax.update(msgBytes4);
    let et = eax.finalize();
    // console.log(vec.msg3.length, "Before", et);
    decryTest(et);
    // console.time("u8");
    // let ct = convertWordArrayToUint8Array(et); // wordArray->Uint8Array
    // // console.log(ct.byteLength)
    // let u8a = new Uint8Array(113);
    // u8a.set([n1], 0);
    // u8a.set(header, 1);
    // u8a.set(ct, 9);
    // console.log(u8a);
    // console.timeEnd("u8");
    // console.log("et: ", et.toString())
    // console.log("msgB1 ",vec.msg.toLowerCase(), "ciphertext match ["+"]");
    // let mt = {sigBytes:200, words: [30013436, 339225106, 514717420, 439661677, 1055518221, 283771922, 187180274, 532897714, 2139526633, -1238283575, 955513085, 1517202526, 364911102, -414118984, 903831885, 798410600, -1129746837, -154427016, 1556115244, -376801970, -568047172, -694785206, 847646790, 1722289609, -1018292141, 688448338, 1181883413, 1377506005, 646973748, 1132451725, 1755141678, 2113546754, 1479599901, -1125090080, -1676847230, -1927057086, -189067454, 404732902, -1705072023, 497809130, -442773377, -1732830414, -135043940, -49167409, 1156938842, 1807692682, -1594885808, 1134712283, 1997958731, -292028612]};
    
    // let rt = convertWordArrayToUint8Array(pt); // wordArray->Uint8Array
    // console.log(pt.toString())
}
function convertUint8ArrayToWordArray1(u8Array) {
    var words = [], i = 0, len = u8Array.length;
     while (i < len) {
        words.push(
            (u8Array[i++] << 24) |
            (u8Array[i++] << 16) |
            (u8Array[i++] << 8)  |
            (u8Array[i++])
        );
    }

    return {
        sigBytes: len,
        words: words
    };
}
function convertWordArrayToUint8Array2(wordArray) {

    var len = wordArray.sigBytes,
        u8_array = new Uint8Array(len),
        offset = 0, word, i
    ;
    for (i=0; i<len; i++) {
        word = wordArray.words[i];
        u8_array[offset++] = word >> 24;
        u8_array[offset++] = (word >> 16) & 0xff;
        u8_array[offset++] = (word >> 8) & 0xff;
        u8_array[offset++] = word & 0xff;
    }
    return u8_array;
}
function decryTest(et) {
    eval(aesContent);
    eval(ctrContent);
    eval(eaxContent);
    let vec = {
            key: "8395FCF1E95BEBD697BD010BC766AAC3",
            nonce: "22E7ADD93CFC6393C57EC0B3C17D6B44",
            header: "126735FCC320D25A",
            msg: "CA40D7446E545FFAED3BD12A740A659FFBBB3CEAB7",
            msg2: "91945D3F4DCBEE0BF45EF52255F095A4",
            msg3: "D07CF6CBB7F313BDDE66B727AFD3C5E8",
            ct: "CB8920F87A6C75CFF39627B56E3ED197C552D295A7CFC46AFC253B4652B1AF3795B124AB6E"
        };
    let keyBytes = CryptoJS.enc.Hex.parse(vec.key),
        nonceBytes = CryptoJS.enc.Hex.parse(vec.nonce),
        headerBytes = CryptoJS.enc.Hex.parse(vec.header);
    let eax = CryptoJS.EAX.create(keyBytes);
    let pt = eax.decrypt(et, nonceBytes, [headerBytes]);
    // console.log(convertWordArrayToUint8Array(pt), "plaintext match ["+"]");
}

function convertUint8ArrayToWordArray(u8Array) {
    var words = [], i = 0, len = u8Array.length;

    while (i < len) {
        words.push(
            (u8Array[i++] << 24) |
            (u8Array[i++] << 16) |
            (u8Array[i++] << 8)  |
            (u8Array[i++])
        );
    }

    return {
        sigBytes: words.length * 4,
        words: words
    };
}
function convertWordArrayToUint8Array(wordArray) {
    var len = wordArray.words.length,
        u8_array = new Uint8Array(len << 2),
        offset = 0, word, i
    ;
    for (i=0; i<len; i++) {
        word = wordArray.words[i];
        u8_array[offset++] = word >> 24;
        u8_array[offset++] = (word >> 16) & 0xff;
        u8_array[offset++] = (word >> 8) & 0xff;
        u8_array[offset++] = word & 0xff;
    }
    return u8_array;
}


