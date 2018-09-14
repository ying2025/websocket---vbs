// identifier different type
const vbsKind = {
	VBS_TAIL: 0x01,
	VBS_LIST: 0x02,			
	VBS_DICT: 0x03,
	VBS_NULL: 0x0F,		     // 0000 1111
	VBS_DESCRIPTOR: 0x10,         // 0001 0xxx
	VBS_BOOL: 0x18,         // 0001 100x 	0=F 1=T
	VBS_BLOB: 0x1B,           // binary
	VBS_DECIMAL: 0x1C,         // 0001 110x 	0=+ 1=-
	VBS_FLOATING: 0x1E,         // 0001 111x 	0=+ 1=-
	VBS_STRING: 0x20,         // 001x xxxx
	VBS_INTEGER: 0x40		  // 010x xxxx
}

const VBS_DESCRIPTOR_MAX	= 0x7fff

const VBS_SPECIAL_DESCRIPTOR	= 0x8000

module.exports = {
	vbsKind,
	VBS_DESCRIPTOR_MAX,
	VBS_SPECIAL_DESCRIPTOR
}