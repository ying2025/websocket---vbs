const  MaxLength = 0;	// <= 0 means no limits

var MaxStringLength = 1<<31 - 1;

var MaxDepth = 1<<15 - 1;

var MaxInt64 = Math.pow(2, 63) - 1;

module.exports = {
    MaxLength,
    MaxStringLength,
    MaxDepth,
    MaxInt64
}