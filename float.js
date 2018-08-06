var   bigNumber    =   require('bignumber.js');
const flt_ZERO_ZERO = 0;    // 0.0 js不区分
const flt_ZERO      = 1;    // +0.0 or -0.0  js不区分
const flt_INF       = 2;    // +inf or -inf
const flt_NAN       = 3;    // nan

function FloatOperate() {
    
    this._breakFloat = function(v) {
        var expo, mantissa;
        let [s, e, m] = _floatToNumber(v);
        let negative = s ? true : false;
        for (let i=0; i< 52; i++) {
	            if (m % 1 ==0) {  
	                break;
	            } else {
	                m = m * 2;
	                e--;
	            }
	     }
    	expo = e;
        if (negative) {
            mantissa = -m;
        } else {
            mantissa = m;
        }
        return [expo, mantissa];
    }
    function _assembleFloat(sign, exponent, mantissa)
    {
        return [sign, exponent, mantissa];
    }
    function _floatToNumber(flt)
    {
        if (isNaN(flt)) // Special case: NaN
        	return _assembleFloat(0, flt_NAN, 0); // Mantissa is nonzero for NaN
        var sign = (flt < 0) ? 1 : 0;
        flt = Math.abs(flt); 
        var exponent = Math.floor(Math.log(flt) / Math.LN2);
        // 此处微调，原先：exponent > 127 | exponent < -126
        if (exponent > 1023 | exponent < -1022) // Special case: +-Infinity (and huge numbers)
        	return _assembleFloat(sign, flt_INF, 0); // Mantissa is zero for +-Infinity
        var mantissa = flt / Math.pow(2, exponent);
        return [sign, exponent, mantissa];
    }

    this._makeFloat = function(mantissa, expo) {
        let num, negative = false;
        if (mantissa == 0) {
        	if (expo < 0) {
        		expo = -expo;
        		negative = true;
        	} 
            if (expo < flt_ZERO) {
                num = 0;
        	} else if (expo == flt_INF) {
                if (negative) {
                    num = Number.NEGATIVE_INFINITY;
                } else {
                    num = Number.POSITIVE_INFINITY;
                }
            } else {
        		num = Number.NaN;
        	}
        } else {
        	if (mantissa < 0) {
        		mantissa = -mantissa;
        		negative = true;
        	}
        	if (expo >= 0x7FF) { // Special case: +-Infinity
        	   if (negative) {
        	   	 num = Number.NEGATIVE_INFINITY;
        	   } else {
        	   	 num = Number.POSITIVE_INFINITY;
        	   }
        	} else {
                for (let i=0; i< 52; i++) {
                    if (mantissa < 2 && ((mantissa % 1 != 0) | mantissa == 1)) {  
                        break;
                    } else {
                            mantissa = mantissa / 2;
                            expo++;
                    }
                }
                // num = mantissa * Math.pow(2, expo);
                let temp_num = bigNumber(mantissa).multipliedBy(bigNumber(2).exponentiatedBy(expo));
                num = temp_num.toNumber();
                if (num > Math.pow(2, 63)) {
                    num = temp_num.valueOf();
                }
                if (negative) {
                    num = -num;
                }
            }
        }
        return num;
    }
}
function breakFloat(v) {
    return new FloatOperate()._breakFloat(v);
}

function makeFloat(mantissa, expo) {
	return new FloatOperate()._makeFloat(mantissa, expo);
}

module.exports = {
    breakFloat,
    makeFloat
}

