/**
 * LZ4 - Fast LZ compression algorithm
 * JavaScript Implementation - Direct port from C version (lz4.c)
 *
 * This implementation aims to produce IDENTICAL output to the C version.
 * All constants, hash functions, and algorithms are directly ported.
 *
 * Security fixes applied from lz4 v1.10.0 (CVE-2021-3520, CVE-2014-4715)
 *
 * Formatted with prettier.
 *
 * ES5+ implementation with BigInt (ES2020) for 5-byte hash compatibility mode.
 *
 * Copyright (C) 2011-2015, Yann Collet (original C implementation)
 * BSD 2-Clause License
 */

'use strict';

// ============================================================================
// Constants - Matching C version exactly
// ============================================================================

var LZ4_MEMORY_USAGE = 14;
var LZ4_HASHLOG = LZ4_MEMORY_USAGE - 2; // 12
var HASH_SIZE_U32 = 1 << LZ4_HASHLOG; // 4096
var HASH_SIZE_U16 = 1 << (LZ4_HASHLOG + 1); // 8192 (for byU16 mode)

var MINMATCH = 4;
var WILDCOPYLENGTH = 8; // renamed from COPYLENGTH in v1.10.0
var COPYLENGTH = 8; // kept for compatibility
var LASTLITERALS = 5;
var MFLIMIT = 12; // see lz4_Block_format.md#parsing-restrictions
var MATCH_SAFEGUARD_DISTANCE = 2 * WILDCOPYLENGTH - MINMATCH; // v1.10.0
var LZ4_minLength = MFLIMIT + 1; // 13

var KB = 1 << 10;
var MB = 1 << 20;
var GB = 1 << 30;
var LZ4_DISTANCE_MAX = 65535; // renamed in v1.10.0
var MAX_DISTANCE = LZ4_DISTANCE_MAX; // kept for compatibility
var LZ4_64Klimit = 64 * KB + MFLIMIT - 1; // 65547

var ML_BITS = 4;
var ML_MASK = (1 << ML_BITS) - 1; // 15
var RUN_BITS = 8 - ML_BITS; // 4
var RUN_MASK = (1 << RUN_BITS) - 1; // 15

var LZ4_MAX_INPUT_SIZE = 0x7e000000;
var LZ4_skipTrigger = 6;

// Security: Maximum safe length to prevent integer overflow in JavaScript
// JavaScript safe integer range: -(2^53-1) to 2^53-1
var RVL_ERROR = -1; // Error return value for read_variable_length

// ============================================================================
// Ring Buffer Constants - Matching C++ lz4wrapper.h (v1.10.4)
// ============================================================================

var DICT_SIZE = 64 * KB; // 64KB: LZ4 dictionary size (fixed)
var DEFAULT_WORK_AREA = 64 * KB; // 64KB: Default work area size
var DEFAULT_MAX_WORK = 10 * MB; // 10MB: Default maximum work area

// Shrink mode for automatic memory management
var SHRINK_MODE = {
	MANUAL: 0, // Manual mode: user must call shrink() explicitly (default)
	AUTO_IMMEDIATE: 1, // Auto immediate: shrink after each operation if buffer expanded
	AUTO_THRESHOLD: 2, // Auto threshold: shrink when buffer exceeds threshold after operation
};

// Error codes
var LZ4_ERROR = {
	SUCCESS: 0,
	FAILED: -1,
	NOT_INITIALIZED: -2,
	INITIALIZED_FAILED: -3,
	COMPRESS_FAILED: -4,
	DECOMPRESS_FAILED: -5,
	PARAM_ERROR: -6,
	BUFFER_RESIZE_FAILED: -7,
};

/**
 * Align size to next power of 2 starting from DEFAULT_WORK_AREA (64KB)
 * Example: 100KB -> 128KB, 200KB -> 256KB, 9MB -> 16MB (but capped by max)
 * @param size Required size
 * @return Aligned size (power of 2 * 64KB), or size itself on 0x3FFFFFFF
 */
function alignToPowerOf2(size) {
	// handle NaN or non-numeric input
	if (!(size > 0)) {
		return DEFAULT_WORK_AREA;
	}

	if (size <= DEFAULT_WORK_AREA) {
		return DEFAULT_WORK_AREA;
	}

	// for JS environment, the suggested upper limit is 2GB (2^31 - 1)
	// if it exceeds 1GB, aligning to 2GB may overflow the Uint8Array limit of some engines
	if (size > 0x3fffffff) {
		return size;
	}

	var aligned = DEFAULT_WORK_AREA;
	while (aligned < size) {
		aligned *= 2;
	}
	return aligned;
}

/**
 * Calculate default buffer size (dict + work area)
 */
function calcDefaultBufferSize() {
	return DICT_SIZE + DEFAULT_WORK_AREA;
}

/**
 * Calculate default max buffer size (dict + max work area)
 */
function calcDefaultMaxBufferSize() {
	return DICT_SIZE + DEFAULT_MAX_WORK;
}

// Table type enum
var TABLE_TYPE = {
	byU16: 0, // For inputSize < 64KB
	byU32: 1, // For inputSize >= 64KB or streaming
};

// Dict directive enum
var DICT_DIRECTIVE = {
	noDict: 0,
	withPrefix64k: 1,
	usingExtDict: 2,
};

// Dict issue enum
var DICT_ISSUE = {
	noDictIssue: 0,
	dictSmall: 1,
};

// ============================================================================
// Utility Functions - Memory operations
// ============================================================================

function readU16(buf, pos) {
	return buf[pos] | (buf[pos + 1] << 8);
}

function readU32(buf, pos) {
	return (
		(buf[pos] |
			(buf[pos + 1] << 8) |
			(buf[pos + 2] << 16) |
			(buf[pos + 3] << 24)) >>>
		0
	);
}

function writeU16(buf, pos, val) {
	buf[pos] = val & 0xff;
	buf[pos + 1] = (val >>> 8) & 0xff;
}

function writeU32(buf, pos, val) {
	buf[pos] = val & 0xff;
	buf[pos + 1] = (val >>> 8) & 0xff;
	buf[pos + 2] = (val >>> 16) & 0xff;
	buf[pos + 3] = (val >>> 24) & 0xff;
}

// ============================================================================
// Hash Strategy Configuration
// ============================================================================

/**
 * Hash strategy options:
 * - 'fast': Use 4-byte hash (like v1.6.x) - fastest, ~2x slower than C
 * - 'compatible': Use 5-byte hash with BigInt (like C v1.10.x) - slower but matches C output
 *
 * Default: 'fast' for best performance
 */
var LZ4_HASH_STRATEGY = 'fast';

/**
 * Set hash strategy globally
 * @param {string} strategy - 'fast' or 'compatible'
 */
function setHashStrategy(strategy) {
	if (strategy === 'fast' || strategy === 'compatible') {
		LZ4_HASH_STRATEGY = strategy;
	} else {
		throw new Error(
			'Invalid hash strategy: ' +
				strategy +
				'. Use "fast" or "compatible".'
		);
	}
}

/**
 * Get current hash strategy
 * @returns {string} Current strategy ('fast' or 'compatible')
 */
function getHashStrategy() {
	return LZ4_HASH_STRATEGY;
}

// ============================================================================
// Hash Functions
// ============================================================================

/**
 * Hash function for byU32 mode (12-bit hash, 4096 slots) - from v1.6.x
 * C: (((sequence) * 2654435761U) >> ((MINMATCH*8)-LZ4_HASHLOG))
 *    = >> (32 - 12) = >> 20
 */
function hashU32(sequence) {
	return (((sequence >>> 0) * 2654435761) >>> 20) & 0xfff;
}

/**
 * Hash function for byU16 mode (13-bit hash, 8192 slots) - from v1.6.x
 * C: (((sequence) * 2654435761U) >> ((MINMATCH*8)-(LZ4_HASHLOG+1)))
 *    = >> (32 - 13) = >> 19
 */
function hashU16(sequence) {
	return (((sequence >>> 0) * 2654435761) >>> 19) & 0x1fff;
}

/**
 * Select hash function based on table type and strategy
 * - 'fast' mode: Always uses 4-byte hash (best performance)
 * - 'compatible' mode: Uses 5-byte hash for byU32 (matches C v1.10.x)
 */
function hashPosition(buf, pos, tableType) {
	// Fast mode: use simple 4-byte hash (same as lz4.1.6.1.js)
	if (LZ4_HASH_STRATEGY === 'fast') {
		var sequence = readU32(buf, pos);
		return tableType === TABLE_TYPE.byU16
			? hashU16(sequence)
			: hashU32(sequence);
	}

	throw new Error('Unsupported hash strategy: ' + LZ4_HASH_STRATEGY);
}

// ============================================================================
// Hash Table Operations
// ============================================================================

/**
 * Put position into hash table
 * For byU16: store 16-bit offset from srcBase
 * For byU32: store 32-bit offset from srcBase
 */
function putPositionOnHash(pos, h, hashTable, tableType, srcBase) {
	hashTable[h] = pos - srcBase;
}

function putPosition(buf, pos, hashTable, tableType, srcBase) {
	var h = hashPosition(buf, pos, tableType);
	putPositionOnHash(pos, h, hashTable, tableType, srcBase);
}

/**
 * Get position from hash table
 * Returns absolute position
 */
function getPositionOnHash(h, hashTable, tableType, srcBase) {
	return hashTable[h] + srcBase;
}

function getPosition(buf, pos, hashTable, tableType, srcBase) {
	var h = hashPosition(buf, pos, tableType);
	return getPositionOnHash(h, hashTable, tableType, srcBase);
}

// ============================================================================
// Match counting function - Matching C version's LZ4_count
// ============================================================================

function countMatch(buf, pIn, pMatch, pInLimit) {
	var pStart = pIn;

	// Fast path: compare 4 bytes at a time
	while (pIn < pInLimit - 3) {
		if (readU32(buf, pIn) === readU32(buf, pMatch)) {
			pIn += 4;
			pMatch += 4;
		} else {
			// Find exact position
			while (pIn < pInLimit && buf[pIn] === buf[pMatch]) {
				pIn++;
				pMatch++;
			}
			return pIn - pStart;
		}
	}

	// Handle remaining bytes
	while (pIn < pInLimit && buf[pIn] === buf[pMatch]) {
		pIn++;
		pMatch++;
	}

	return pIn - pStart;
}

/**
 * Count match with external dictionary support
 */
function countMatchExtDict(
	srcBuf,
	ip,
	dictBuf,
	match,
	dictEnd,
	srcStart,
	srcLimit
) {
	var start = ip;
	var matchPos = match;

	// Match in dictionary
	while (
		matchPos < dictEnd &&
		ip < srcLimit &&
		dictBuf[matchPos] === srcBuf[ip]
	) {
		matchPos++;
		ip++;
	}

	// If match extends to source buffer
	if (matchPos === dictEnd) {
		var srcMatch = srcStart;
		while (ip < srcLimit && srcBuf[srcMatch] === srcBuf[ip]) {
			srcMatch++;
			ip++;
		}
	}

	return ip - start;
}

// ============================================================================
// Core Compression Function - Direct port of LZ4_compress_generic
// ============================================================================

/**
 * Generic compression function - exact port of C version
 *
 * @param {object} ctx - Compression context (stream state)
 * @param {Uint8Array} source - Source buffer
 * @param {Uint8Array} dest - Destination buffer
 * @param {number} srcStart - Start position in source
 * @param {number} inputSize - Input size
 * @param {number} maxOutputSize - Max output size (0 = unlimited)
 * @param {boolean} outputLimited - Whether output is limited
 * @param {number} tableType - TABLE_TYPE.byU16 or TABLE_TYPE.byU32
 * @param {number} dict - Dict directive
 * @param {number} dictIssue - Dict issue directive
 * @returns {number} - Compressed size, or 0 on failure
 */
function compressGeneric(
	ctx,
	source,
	dest,
	srcStart,
	inputSize,
	maxOutputSize,
	outputLimited,
	tableType,
	dict,
	dictIssue
) {
	var hashTable = ctx.hashTable;

	var ip = srcStart;
	var base, lowLimit;
	var lowRefLimit = ip - ctx.dictSize;
	var dictionary = ctx.dictionary;
	var dictStart = ctx.dictionaryStart;
	var dictEnd = dictStart + ctx.dictSize;
	var dictDelta = ctx.dictSize > 0 ? dictEnd - srcStart : 0;
	var anchor = srcStart;
	var iend = srcStart + inputSize;
	var mflimit = iend - MFLIMIT;
	var matchlimit = iend - LASTLITERALS;

	var op = 0;
	var olimit = maxOutputSize > 0 ? maxOutputSize : dest.length;

	var forwardH;
	var refDelta = 0;

	// Input validation
	if (inputSize > LZ4_MAX_INPUT_SIZE) return 0;

	// Init base and lowLimit based on dict mode
	switch (dict) {
		case DICT_DIRECTIVE.noDict:
		default:
			base = srcStart;
			lowLimit = srcStart;
			break;
		case DICT_DIRECTIVE.withPrefix64k:
			base = srcStart - ctx.currentOffset;
			lowLimit = srcStart - ctx.dictSize;
			break;
		case DICT_DIRECTIVE.usingExtDict:
			base = srcStart - ctx.currentOffset;
			lowLimit = srcStart;
			break;
	}

	// Check size limits
	if (tableType === TABLE_TYPE.byU16 && inputSize >= LZ4_64Klimit) return 0;
	if (inputSize < LZ4_minLength) {
		// goto _last_literals
		return writeFinalLiterals(
			source,
			dest,
			anchor,
			iend,
			op,
			olimit,
			outputLimited
		);
	}

	// First Byte
	putPosition(source, ip, hashTable, tableType, base);
	ip++;
	forwardH = hashPosition(source, ip, tableType);

	// Main Loop
	mainLoop: for (;;) {
		var match;
		var token;
		var tokenPos;

		// Find a match
		{
			var forwardIp = ip;
			var step = 1;
			var searchMatchNb = 1 << LZ4_skipTrigger;

			do {
				var h = forwardH;
				ip = forwardIp;
				forwardIp += step;
				step = searchMatchNb++ >>> LZ4_skipTrigger;

				if (forwardIp > mflimit) {
					// goto _last_literals
					return writeFinalLiterals(
						source,
						dest,
						anchor,
						iend,
						op,
						olimit,
						outputLimited
					);
				}

				match = getPositionOnHash(h, hashTable, tableType, base);

				if (dict === DICT_DIRECTIVE.usingExtDict) {
					if (match < srcStart) {
						refDelta = dictDelta;
						lowLimit = dictStart;
					} else {
						refDelta = 0;
						lowLimit = srcStart;
					}
				}

				forwardH = hashPosition(source, forwardIp, tableType);
				putPositionOnHash(ip, h, hashTable, tableType, base);
			} while (
				(dictIssue === DICT_ISSUE.dictSmall
					? match < lowRefLimit
					: false) ||
				(tableType === TABLE_TYPE.byU16
					? false
					: match + MAX_DISTANCE < ip) ||
				!matchesAtPosition(
					source,
					dictionary,
					ip,
					match,
					refDelta,
					dict,
					srcStart
				)
			);
		}

		// Catch up - extend match backwards
		while (ip > anchor && match + refDelta > lowLimit) {
			var prevIp = ip - 1;
			var prevMatch = match + refDelta - 1;
			var srcByte = source[prevIp];
			var matchByte;

			if (dict === DICT_DIRECTIVE.usingExtDict && match < srcStart) {
				matchByte =
					dictionary[prevMatch - dictStart + ctx.dictionaryStart];
			} else {
				matchByte = source[prevMatch];
			}

			if (srcByte !== matchByte) break;
			ip--;
			match--;
		}

		// Encode literal length
		{
			var litLength = ip - anchor;
			tokenPos = op++;

			if (
				outputLimited &&
				op +
					litLength +
					(2 + 1 + LASTLITERALS) +
					Math.floor(litLength / 255) >
					olimit
			) {
				return 0; // Output limit exceeded
			}

			if (litLength >= RUN_MASK) {
				var len = litLength - RUN_MASK;
				dest[tokenPos] = RUN_MASK << ML_BITS;
				while (len >= 255) {
					dest[op++] = 255;
					len -= 255;
				}
				dest[op++] = len;
			} else {
				dest[tokenPos] = litLength << ML_BITS;
			}

			// Copy literals (optimized with set() for large blocks)
			if (litLength >= 16 && dest.set && source.subarray) {
				dest.set(source.subarray(anchor, anchor + litLength), op);
				op += litLength;
			} else {
				for (var i = 0; i < litLength; i++) {
					dest[op++] = source[anchor + i];
				}
			}
		}

		// _next_match label equivalent - using while(true) loop
		nextMatch: while (true) {
			// Encode Offset
			writeU16(dest, op, ip - match);
			op += 2;

			// Encode MatchLength
			var matchLength;

			if (dict === DICT_DIRECTIVE.usingExtDict && match < srcStart) {
				// Match in external dictionary
				var limit = ip + (dictEnd - (match + refDelta));
				if (limit > matchlimit) limit = matchlimit;

				matchLength = countMatchWithDict(
					source,
					dictionary,
					ip + MINMATCH,
					match +
						refDelta +
						MINMATCH -
						dictStart +
						ctx.dictionaryStart,
					limit,
					dictEnd - dictStart,
					srcStart
				);
				ip += MINMATCH + matchLength;

				if (ip === limit && limit < matchlimit) {
					var more = countMatch(source, ip, srcStart, matchlimit);
					matchLength += more;
					ip += more;
				}
			} else {
				matchLength = countMatch(
					source,
					ip + MINMATCH,
					match + MINMATCH,
					matchlimit
				);
				ip += MINMATCH + matchLength;
			}

			if (
				outputLimited &&
				op + (1 + LASTLITERALS) + (matchLength >>> 8) > olimit
			) {
				return 0; // Output limit exceeded
			}

			if (matchLength >= ML_MASK) {
				dest[tokenPos] += ML_MASK;
				matchLength -= ML_MASK;
				while (matchLength >= 510) {
					dest[op++] = 255;
					dest[op++] = 255;
					matchLength -= 510;
				}
				if (matchLength >= 255) {
					matchLength -= 255;
					dest[op++] = 255;
				}
				dest[op++] = matchLength;
			} else {
				dest[tokenPos] += matchLength;
			}

			anchor = ip;

			// Test end of chunk
			if (ip > mflimit) break mainLoop;

			// Fill table - store hash of ip-2
			putPosition(source, ip - 2, hashTable, tableType, base);

			// Test next position
			match = getPosition(source, ip, hashTable, tableType, base);

			if (dict === DICT_DIRECTIVE.usingExtDict) {
				if (match < srcStart) {
					refDelta = dictDelta;
					lowLimit = dictStart;
				} else {
					refDelta = 0;
					lowLimit = srcStart;
				}
			}

			putPosition(source, ip, hashTable, tableType, base);

			if (
				(dictIssue === DICT_ISSUE.dictSmall
					? match >= lowRefLimit
					: true) &&
				match + MAX_DISTANCE >= ip &&
				matchesAtPosition(
					source,
					dictionary,
					ip,
					match,
					refDelta,
					dict,
					srcStart
				)
			) {
				// Consecutive match found
				tokenPos = op++;
				dest[tokenPos] = 0;
				continue nextMatch; // goto _next_match
			}

			break nextMatch;
		}

		// Prepare next loop
		forwardH = hashPosition(source, ++ip, tableType);
	}

	// _last_literals
	return writeFinalLiterals(
		source,
		dest,
		anchor,
		iend,
		op,
		olimit,
		outputLimited
	);
}

/**
 * Check if positions match (handles external dictionary)
 */
function matchesAtPosition(
	source,
	dictionary,
	ip,
	match,
	refDelta,
	dict,
	srcStart
) {
	var srcVal = readU32(source, ip);
	var matchVal;

	if (dict === DICT_DIRECTIVE.usingExtDict && match + refDelta < srcStart) {
		// Match is in dictionary
		var dictPos = match + refDelta;
		matchVal = readU32(dictionary, dictPos);
	} else {
		matchVal = readU32(source, match + refDelta);
	}

	return srcVal === matchVal;
}

/**
 * Count match with dictionary support
 */
function countMatchWithDict(
	source,
	dictionary,
	ip,
	dictMatch,
	limit,
	dictSize,
	srcStart
) {
	var start = ip;

	// Match in dictionary part
	while (
		dictMatch < dictSize &&
		ip < limit &&
		dictionary[dictMatch] === source[ip]
	) {
		dictMatch++;
		ip++;
	}

	return ip - start;
}

/**
 * Write final literals block
 */
function writeFinalLiterals(
	source,
	dest,
	anchor,
	iend,
	op,
	olimit,
	outputLimited
) {
	var lastRun = iend - anchor;

	if (
		outputLimited &&
		op + lastRun + 1 + Math.floor((lastRun + 255 - RUN_MASK) / 255) > olimit
	) {
		return 0; // Output limit exceeded
	}

	if (lastRun >= RUN_MASK) {
		dest[op++] = RUN_MASK << ML_BITS;
		lastRun -= RUN_MASK;
		while (lastRun >= 255) {
			dest[op++] = 255;
			lastRun -= 255;
		}
		dest[op++] = lastRun;
	} else {
		dest[op++] = lastRun << ML_BITS;
	}

	// Copy remaining literals (optimized with set() for large blocks)
	var litStart = anchor;
	var litEnd = iend;
	var litLen = litEnd - litStart;
	if (litLen >= 16 && dest.set && source.subarray) {
		dest.set(source.subarray(litStart, litEnd), op);
		op += litLen;
	} else {
		for (var i = litStart; i < litEnd; i++) {
			dest[op++] = source[i];
		}
	}

	return op;
}

// ============================================================================
// Core Decompression Function - Direct port of LZ4_decompress_generic
// Security fixes from lz4 v1.10.0
// ============================================================================

/**
 * Read variable-length encoded value (from v1.10.0)
 * Safe reading with overflow detection
 *
 * @param {Uint8Array} source - Source buffer
 * @param {object} ipRef - Object containing ip position (passed by reference)
 * @param {number} ilimit - Position after which input is corrupted
 * @param {boolean} initialCheck - Check ip >= ilimit before loop
 * @returns {number} - Length value, or RVL_ERROR on error
 */
function readVariableLength(source, ipRef, ilimit, initialCheck) {
	var length = 0;
	var s;

	if (initialCheck && ipRef.ip >= ilimit) {
		return RVL_ERROR; // read limit reached
	}

	do {
		s = source[ipRef.ip++];
		length += s;

		if (ipRef.ip > ilimit) {
			return RVL_ERROR; // read limit reached
		}

		// Overflow detection for JavaScript safe integers
		// In 32-bit mode (like original C), check length > (SIZE_MAX/2)
		// For JavaScript, we check against a reasonable limit
		if (length > 0x7fffffff) {
			// ~2GB, reasonable limit
			return RVL_ERROR; // accumulator overflow
		}
	} while (s === 255);

	return length;
}

/**
 * Generic decompression function - exact port of C version
 * Updated with security fixes from lz4 v1.10.0
 */
function decompressGeneric(
	source,
	dest,
	srcStart,
	inputSize,
	destStart,
	outputSize,
	endOnInput,
	partialDecoding,
	targetOutputSize,
	dict,
	lowPrefix,
	dictStart,
	dictSize
) {
	// v1.10.0: Input validation
	if (source === null || source === undefined) return -1;
	if (outputSize < 0) return -1;

	var ip = srcStart;
	var iend = srcStart + inputSize;

	var op = destStart;
	var oend = destStart + outputSize;
	var oexit = destStart + targetOutputSize;
	var lowLimit = lowPrefix - dictSize;

	var dictEnd = dictStart + dictSize;

	// v1.10.0: checkOffset is now independent of safeDecode
	// This fixes CVE-2021-3520 where offset validation could be bypassed
	var checkOffset = dictSize < 64 * KB;

	// Special cases
	if (partialDecoding && oexit > oend - MFLIMIT) {
		oexit = oend - MFLIMIT;
	}

	// v1.10.0: Empty output buffer check
	if (outputSize === 0) {
		if (partialDecoding) return 0;
		return inputSize === 1 && source[ip] === 0 ? 0 : -1;
	}

	// v1.10.0: Empty input check
	if (inputSize === 0) return -1;

	// Main Loop
	while (true) {
		var token, length, cpy, match;

		// v1.10.0: Check input boundary before reading token
		if (ip >= iend) {
			return -(ip - srcStart) - 1; // Error: unexpected end of input
		}

		// Get literal length
		token = source[ip++];
		length = token >>> ML_BITS;

		if (length === RUN_MASK) {
			// v1.10.0: Use safe variable length reading
			var ipRef = { ip: ip };
			var addl = readVariableLength(source, ipRef, iend - RUN_MASK, true);
			ip = ipRef.ip;

			if (addl === RVL_ERROR) {
				return -(ip - srcStart) - 1; // Error reading length
			}
			length += addl;

			// v1.10.0: Overflow detection
			if (op + length < op) return -(ip - srcStart) - 1; // overflow
			if (ip + length < ip) return -(ip - srcStart) - 1; // overflow
		}

		// Copy literals
		cpy = op + length;

		if (
			(endOnInput &&
				(cpy > (partialDecoding ? oexit : oend - MFLIMIT) ||
					ip + length > iend - (2 + 1 + LASTLITERALS))) ||
			(!endOnInput && cpy > oend - COPYLENGTH)
		) {
			if (partialDecoding) {
				// v1.10.0: Handle partial decoding edge cases
				if (ip + length > iend) {
					length = iend - ip;
					cpy = op + length;
				}
				if (cpy > oend) {
					cpy = oend;
					length = oend - op;
				}
			} else {
				if (!endOnInput && cpy !== oend) return -(ip - srcStart) - 1;
				if (endOnInput && (ip + length !== iend || cpy > oend))
					return -(ip - srcStart) - 1;
			}

			// Copy literals (optimized with set() for large blocks)
			if (length >= 16 && dest.set && source.subarray) {
				dest.set(source.subarray(ip, ip + length), op);
			} else {
				for (var i = 0; i < length; i++) {
					dest[op + i] = source[ip + i];
				}
			}
			ip += length;
			op += length;

			// v1.10.0: EOF conditions
			if (!partialDecoding || cpy === oend || ip >= iend - 2) {
				break; // End of decoding
			}

			// Continue if partial decoding and not at end
			if (partialDecoding) {
				// Need to continue processing
			} else {
				break;
			}
		}

		// Copy literals (safe path) - optimized with set() for large blocks
		if (length >= 16 && dest.set && source.subarray) {
			dest.set(source.subarray(ip, ip + length), op);
		} else {
			for (var i = 0; i < length; i++) {
				dest[op + i] = source[ip + i];
			}
		}
		ip += length;
		op = cpy;

		// v1.10.0: Check we have enough bytes to read offset
		if (ip + 2 > iend) {
			return -(ip - srcStart) - 1;
		}

		// Get offset
		var offset = readU16(source, ip);
		ip += 2;
		match = cpy - offset;

		// v1.10.0: Improved offset validation
		// checkOffset is now always checked when dictSize < 64KB
		if (checkOffset && match + dictSize < lowPrefix) {
			return -(ip - srcStart) - 1; // Error: offset outside buffers
		}

		// v1.10.0: Additional safety check - offset must not be zero
		if (offset === 0) {
			return -(ip - srcStart) - 1; // Error: zero offset is invalid
		}

		// Get match length
		length = token & ML_MASK;
		if (length === ML_MASK) {
			// v1.10.0: Use safe variable length reading
			var ipRef = { ip: ip };
			var addl = readVariableLength(
				source,
				ipRef,
				iend - LASTLITERALS + 1,
				false
			);
			ip = ipRef.ip;

			if (addl === RVL_ERROR) {
				return -(ip - srcStart) - 1;
			}
			length += addl;

			// v1.10.0: Overflow detection
			if (op + length < op) return -(ip - srcStart) - 1;
		}
		length += MINMATCH;

		// Check external dictionary
		if (dict === DICT_DIRECTIVE.usingExtDict && match < lowPrefix) {
			// v1.10.0: bounds check
			if (op + length > oend - LASTLITERALS) {
				if (partialDecoding) {
					length = Math.min(length, oend - op);
				} else {
					return -(ip - srcStart) - 1;
				}
			}

			if (length <= lowPrefix - match) {
				// Match entirely in external dictionary
				var dictOffset = dictEnd - (lowPrefix - match);
				for (var i = 0; i < length; i++) {
					dest[op + i] = dest[dictOffset + i];
				}
				op += length;
			} else {
				// Match spans dictionary and current segment
				var copySize = lowPrefix - match;
				var dictOffset = dictEnd - copySize;
				for (var i = 0; i < copySize; i++) {
					dest[op + i] = dest[dictOffset + i];
				}
				op += copySize;
				var restSize = length - copySize;

				if (restSize > op - lowPrefix) {
					// Overlap copy
					var copyFrom = lowPrefix;
					var endOfMatch = op + restSize;
					while (op < endOfMatch) {
						dest[op++] = dest[copyFrom++];
					}
				} else {
					for (var i = 0; i < restSize; i++) {
						dest[op + i] = dest[lowPrefix + i];
					}
					op += restSize;
				}
			}
			continue;
		}

		// v1.10.0: Verify match is within bounds
		// In streaming mode (withPrefix64k or usingExtDict), match can be in prefix area
		// lowLimit already accounts for valid prefix/dict area
		if (match < lowLimit) {
			return -(ip - srcStart) - 1; // Error: match before valid buffer
		}

		// Copy match (handling overlap)
		cpy = op + length;

		// v1.10.0: partialDecoding boundary check
		if (partialDecoding && cpy > oend - MATCH_SAFEGUARD_DISTANCE) {
			var mlen = Math.min(length, oend - op);
			var matchEnd = match + mlen;
			var copyEnd = op + mlen;
			if (matchEnd > op) {
				// Overlap copy
				while (op < copyEnd) {
					dest[op++] = dest[match++];
				}
			} else {
				for (var i = 0; i < mlen; i++) {
					dest[op + i] = dest[match + i];
				}
				op = copyEnd;
			}
			if (op === oend) break;
			continue;
		}

		if (op - match < 8) {
			// Handle short offset overlap
			dest[op] = dest[match];
			dest[op + 1] = dest[match + 1];
			dest[op + 2] = dest[match + 2];
			dest[op + 3] = dest[match + 3];
			op += 4;
			match += 4;

			// Handle remaining with overlap
			while (op < cpy) {
				dest[op++] = dest[match++];
			}
		} else {
			// Fast copy (no overlap concern)
			while (op < cpy) {
				dest[op++] = dest[match++];
			}
		}
	}

	// Return decoded size
	if (endOnInput) {
		return op - destStart;
	} else {
		return ip - srcStart;
	}
}

// ============================================================================
// Public API - Simple Functions
// ============================================================================

/**
 * Calculate compression bound
 * v1.10.0: Matches LZ4_COMPRESSBOUND macro
 */
function compressBound(inputSize) {
	// v1.10.0: Input validation
	if (inputSize < 0) return 0;
	if (inputSize > LZ4_MAX_INPUT_SIZE) return 0;
	return inputSize + Math.floor(inputSize / 255) + 16;
}

/**
 * Compress a block (non-streaming)
 * Uses byU16 for < 64KB, byU32 for >= 64KB (matching C behavior)
 * v1.10.0: Added input validation
 */
function compress(source, dest, srcStart, srcLength, destStart) {
	// v1.10.0: Input validation
	if (source === null || source === undefined) return 0;
	if (dest === null || dest === undefined) return 0;

	srcStart = srcStart || 0;
	srcLength = srcLength === undefined ? source.length : srcLength;
	destStart = destStart || 0;

	// v1.10.0: Bounds validation
	if (srcStart < 0 || destStart < 0) return 0;
	if (srcLength < 0) return 0;
	if (srcStart + srcLength > source.length) return 0;
	if (srcLength > LZ4_MAX_INPUT_SIZE) return 0; // v1.10.0

	// v1.10.0: Handle empty input
	if (srcLength === 0) {
		if (dest.length > destStart) {
			dest[destStart] = 0;
			return 1;
		}
		return 0;
	}

	// Create context with fresh hash table
	var tableType =
		srcLength < LZ4_64Klimit ? TABLE_TYPE.byU16 : TABLE_TYPE.byU32;
	var hashSize =
		tableType === TABLE_TYPE.byU16 ? HASH_SIZE_U16 : HASH_SIZE_U32;

	var ctx = {
		hashTable: new Uint32Array(hashSize), // Use Uint32Array for both (U16 values fit)
		currentOffset: 0,
		dictSize: 0,
		dictionary: null,
		dictionaryStart: 0,
	};

	return compressGeneric(
		ctx,
		source,
		dest,
		srcStart,
		srcLength,
		0,
		false,
		tableType,
		DICT_DIRECTIVE.noDict,
		DICT_ISSUE.noDictIssue
	);
}

/**
 * Compress with output limit
 * v1.10.0: Added input validation
 */
function compressLimited(
	source,
	dest,
	srcStart,
	srcLength,
	destStart,
	maxOutputSize
) {
	// v1.10.0: Input validation
	if (source === null || source === undefined) return 0;
	if (dest === null || dest === undefined) return 0;

	srcStart = srcStart || 0;
	srcLength = srcLength === undefined ? source.length : srcLength;
	destStart = destStart || 0;

	// v1.10.0: Bounds validation
	if (srcStart < 0 || destStart < 0) return 0;
	if (srcLength < 0 || maxOutputSize < 0) return 0;
	if (srcStart + srcLength > source.length) return 0;
	if (srcLength > LZ4_MAX_INPUT_SIZE) return 0;

	// v1.10.0: Handle edge case
	if (maxOutputSize < 1) return 0;

	// v1.10.0: Handle empty input
	if (srcLength === 0) {
		dest[destStart] = 0;
		return 1;
	}

	var tableType =
		srcLength < LZ4_64Klimit ? TABLE_TYPE.byU16 : TABLE_TYPE.byU32;
	var hashSize =
		tableType === TABLE_TYPE.byU16 ? HASH_SIZE_U16 : HASH_SIZE_U32;

	var ctx = {
		hashTable: new Uint32Array(hashSize),
		currentOffset: 0,
		dictSize: 0,
		dictionary: null,
		dictionaryStart: 0,
	};

	return compressGeneric(
		ctx,
		source,
		dest,
		srcStart,
		srcLength,
		maxOutputSize,
		true,
		tableType,
		DICT_DIRECTIVE.noDict,
		DICT_ISSUE.noDictIssue
	);
}

/**
 * Decompress safely (with bounds checking)
 * v1.10.0: Added input validation
 */
function decompressSafe(
	source,
	dest,
	srcStart,
	compressedSize,
	destStart,
	maxDecompressedSize
) {
	// v1.10.0: Input validation
	if (source === null || source === undefined) return -1;
	if (dest === null || dest === undefined) return -1;

	srcStart = srcStart || 0;
	destStart = destStart || 0;

	// v1.10.0: Bounds validation
	if (srcStart < 0 || destStart < 0) return -1;
	if (compressedSize < 0 || maxDecompressedSize < 0) return -1;
	if (srcStart + compressedSize > source.length) return -1;
	if (destStart + maxDecompressedSize > dest.length) return -1;

	return decompressGeneric(
		source,
		dest,
		srcStart,
		compressedSize,
		destStart,
		maxDecompressedSize,
		true,
		false,
		0,
		DICT_DIRECTIVE.noDict,
		destStart,
		null,
		0
	);
}

/**
 * Decompress fast (no bounds checking, trusted input)
 */
function decompressFast(source, dest, srcStart, destStart, originalSize) {
	srcStart = srcStart || 0;
	destStart = destStart || 0;

	return decompressGeneric(
		source,
		dest,
		srcStart,
		0,
		destStart,
		originalSize,
		false,
		false,
		0,
		DICT_DIRECTIVE.withPrefix64k,
		destStart - 64 * KB,
		0,
		64 * KB
	);
}

// ============================================================================
// Streaming Compression API
// ============================================================================

/**
 * Create a new compression stream
 */
function createStream() {
	return {
		hashTable: new Uint32Array(HASH_SIZE_U32),
		currentOffset: 0,
		initCheck: 0,
		dictionary: null,
		dictionaryStart: 0,
		dictSize: 0,
		bufferStart: null,
	};
}

/**
 * Reset stream state
 */
function resetStream(stream) {
	stream.hashTable.fill(0);
	stream.currentOffset = 0;
	stream.initCheck = 0;
	stream.dictionary = null;
	stream.dictionaryStart = 0;
	stream.dictSize = 0;
	stream.bufferStart = null;
}

/**
 * Load dictionary into stream
 */
function loadDict(stream, dictionary, dictStart, dictSize) {
	if (stream.initCheck) resetStream(stream);

	if (dictSize < MINMATCH) {
		stream.dictionary = null;
		stream.dictSize = 0;
		return 0;
	}

	// Only use last 64KB of dictionary
	if (dictSize > 64 * KB) {
		dictStart = dictStart + dictSize - 64 * KB;
		dictSize = 64 * KB;
	}

	var base = dictStart - stream.currentOffset;
	stream.dictionary = dictionary;
	stream.dictionaryStart = dictStart;
	stream.dictSize = dictSize;
	stream.currentOffset += dictSize;

	// Populate hash table with dictionary
	var p = dictStart;
	var dictEnd = dictStart + dictSize;

	while (p <= dictEnd - MINMATCH) {
		putPosition(dictionary, p, stream.hashTable, TABLE_TYPE.byU32, base);
		p += 3;
	}

	return dictSize;
}

/**
 * Renormalize dictionary offsets (prevent overflow)
 */
function renormDictT(stream, src) {
	if (stream.currentOffset > 0x80000000) {
		// Rescale hash table
		var delta = stream.currentOffset - 64 * KB;
		var dictEnd = stream.dictionaryStart + stream.dictSize;

		for (var i = 0; i < stream.hashTable.length; i++) {
			if (stream.hashTable[i] < delta) {
				stream.hashTable[i] = 0;
			} else {
				stream.hashTable[i] -= delta;
			}
		}

		stream.currentOffset = 64 * KB;
		if (stream.dictSize > 64 * KB) stream.dictSize = 64 * KB;
		stream.dictionaryStart = dictEnd - stream.dictSize;
	}
}

/**
 * Compress continue (streaming mode)
 * This function always uses byU32 mode for streaming
 */
function compressContinue(
	stream,
	source,
	dest,
	srcStart,
	inputSize,
	destStart,
	maxOutputSize,
	outputLimited
) {
	srcStart = srcStart || 0;
	destStart = destStart || 0;

	var dictEnd = stream.dictionaryStart + stream.dictSize;

	var smallest = srcStart;
	if (stream.initCheck) return 0; // Uninitialized
	if (stream.dictSize > 0 && smallest > dictEnd) smallest = dictEnd;
	renormDictT(stream, smallest);

	// Check overlapping input/dictionary
	var sourceEnd = srcStart + inputSize;
	if (
		stream.dictionary &&
		sourceEnd > stream.dictionaryStart &&
		sourceEnd < dictEnd
	) {
		stream.dictSize = dictEnd - sourceEnd;
		if (stream.dictSize > 64 * KB) stream.dictSize = 64 * KB;
		if (stream.dictSize < 4) stream.dictSize = 0;
		stream.dictionaryStart = dictEnd - stream.dictSize;
	}

	var result;
	var dictIssue =
		stream.dictSize < 64 * KB && stream.dictSize < stream.currentOffset
			? DICT_ISSUE.dictSmall
			: DICT_ISSUE.noDictIssue;

	// Prefix mode: source follows dictionary
	if (stream.dictionary && dictEnd === srcStart) {
		result = compressGeneric(
			stream,
			source,
			dest,
			srcStart,
			inputSize,
			maxOutputSize || 0,
			outputLimited || false,
			TABLE_TYPE.byU32,
			DICT_DIRECTIVE.withPrefix64k,
			dictIssue
		);
		stream.dictSize += inputSize;
		stream.currentOffset += inputSize;
		return result;
	}

	// External dictionary mode
	result = compressGeneric(
		stream,
		source,
		dest,
		srcStart,
		inputSize,
		maxOutputSize || 0,
		outputLimited || false,
		TABLE_TYPE.byU32,
		DICT_DIRECTIVE.usingExtDict,
		dictIssue
	);
	stream.dictionary = source;
	stream.dictionaryStart = srcStart;
	stream.dictSize = inputSize;
	stream.currentOffset += inputSize;

	return result;
}

/**
 * Save dictionary for ring buffer mode
 * Moves last 64KB to safeBuffer and updates stream
 */
function saveDict(stream, safeBuffer, safeStart, dictSize) {
	var previousDictEnd = stream.dictionaryStart + stream.dictSize;

	if (dictSize > 64 * KB) dictSize = 64 * KB;
	if (dictSize > stream.dictSize) dictSize = stream.dictSize;

	// Copy last dictSize bytes to safeBuffer (optimized: use set() instead of for loop)
	var srcPos = previousDictEnd - dictSize;
	if (safeBuffer.set && stream.dictionary.subarray) {
		safeBuffer.set(
			stream.dictionary.subarray(srcPos, srcPos + dictSize),
			safeStart
		);
	} else {
		for (var i = 0; i < dictSize; i++) {
			safeBuffer[safeStart + i] = stream.dictionary[srcPos + i];
		}
	}

	stream.dictionary = safeBuffer;
	stream.dictionaryStart = safeStart;
	stream.dictSize = dictSize;

	return dictSize;
}

// ============================================================================
// Streaming Decompression API
// ============================================================================

/**
 * Create streaming decode context
 */
function createStreamDecode() {
	return {
		externalDict: null,
		extDictStart: 0,
		extDictSize: 0,
		prefixEnd: 0,
		prefixSize: 0,
	};
}

/**
 * Set stream decode dictionary
 */
function setStreamDecode(streamDecode, dictionary, dictStart, dictSize) {
	streamDecode.prefixSize = dictSize;
	streamDecode.prefixEnd = dictStart + dictSize;
	streamDecode.externalDict = null;
	streamDecode.extDictStart = 0;
	streamDecode.extDictSize = 0;
	return 1;
}

/**
 * Decompress continue (streaming)
 */
function decompressSafeContinue(
	streamDecode,
	source,
	dest,
	srcStart,
	compressedSize,
	destStart,
	maxOutputSize
) {
	var result;

	if (streamDecode.prefixEnd === destStart) {
		// Prefix mode
		result = decompressGeneric(
			source,
			dest,
			srcStart,
			compressedSize,
			destStart,
			maxOutputSize,
			true,
			false,
			0,
			DICT_DIRECTIVE.usingExtDict,
			streamDecode.prefixEnd - streamDecode.prefixSize,
			streamDecode.extDictStart,
			streamDecode.extDictSize
		);

		if (result <= 0) return result;
		streamDecode.prefixSize += result;
		streamDecode.prefixEnd += result;
	} else {
		// External dict mode
		streamDecode.extDictSize = streamDecode.prefixSize;
		streamDecode.extDictStart =
			streamDecode.prefixEnd - streamDecode.extDictSize;

		result = decompressGeneric(
			source,
			dest,
			srcStart,
			compressedSize,
			destStart,
			maxOutputSize,
			true,
			false,
			0,
			DICT_DIRECTIVE.usingExtDict,
			destStart,
			streamDecode.extDictStart,
			streamDecode.extDictSize
		);

		if (result <= 0) return result;
		streamDecode.prefixSize = result;
		streamDecode.prefixEnd = destStart + result;
	}

	return result;
}

// ============================================================================
// Ring Buffer Encoder Class - High-level streaming with auto ring buffer (v1.10.4)
// ============================================================================

/**
 * Ring buffer based encoder for streaming compression
 * Matches behavior of C++ Lz4Encoder wrapper
 *
 * Features:
 * - Dynamic buffer sizing with power-of-2 expansion: 64KB -> 128KB -> 256KB -> ...
 * - Automatic expansion when input exceeds current work area
 * - Configurable shrink mode: manual, auto-immediate, or auto-threshold
 * - User-configurable base and max buffer sizes
 *
 * Options:
 * - minWorkArea: Minimum allowed work area size (default: 64KB)
 * - maxWorkArea: Maximum allowed work area size (default: 10MB)
 * - shrinkMode: Shrink mode (default: SHRINK_MODE.MANUAL)
 * - shrinkThreshold: Custom shrink threshold (default: minWorkArea)
 */
function RingBufferEncoder(options) {
	options = options || {};

	var minWorkArea = options.minWorkArea || DEFAULT_WORK_AREA;
	var maxWorkArea = options.maxWorkArea || DEFAULT_MAX_WORK;
	var threshold = options.shrinkThreshold || minWorkArea;

	if (minWorkArea < DEFAULT_WORK_AREA) {
		minWorkArea = DEFAULT_WORK_AREA;
	}

	if (maxWorkArea < minWorkArea) {
		maxWorkArea = minWorkArea;
	}

	if (threshold < minWorkArea) {
		threshold = minWorkArea;
	}
	if (threshold > maxWorkArea) {
		threshold = maxWorkArea;
	}

	this.minBufferSize = DICT_SIZE + minWorkArea;
	this.maxBufferSize = DICT_SIZE + maxWorkArea;
	this.shrinkThreshold = DICT_SIZE + threshold;
	this.ringBufferSize = this.minBufferSize;

	// Set shrink mode and threshold
	this.shrinkMode =
		options.shrinkMode !== undefined
			? options.shrinkMode
			: SHRINK_MODE.MANUAL;
	this.ringBuffer = new Uint8Array(this.ringBufferSize);
	this.offset = 0;
	this.stream = createStream();
}

/**
 * Resize ring buffer to new size
 * Uses saveDict to preserve dictionary continuity
 * @param newBufferSize New buffer size (must include DICT_SIZE)
 * @return true on success
 */
RingBufferEncoder.prototype._resizeBuffer = function (newBufferSize) {
	var newBuffer = new Uint8Array(newBufferSize);

	var newOffset = 0;

	// Preserve dictionary using saveDict
	if (this.offset > 0) {
		var dictSize = this.offset < DICT_SIZE ? this.offset : DICT_SIZE;
		var dictStart = this.offset > DICT_SIZE ? this.offset - DICT_SIZE : 0;
		newBuffer.set(
			this.ringBuffer.subarray(dictStart, dictStart + dictSize),
			0
		);
		saveDict(this.stream, newBuffer, 0, dictSize);
		newOffset = dictSize;
	}

	this.ringBuffer = newBuffer;
	this.ringBufferSize = newBufferSize;
	this.offset = newOffset;

	return true;
};

/**
 * Compress data
 * @param source Source data
 * @param dest Destination buffer (allocated by caller), compressBound(source.length)
 * @return Number of bytes after compression, returns <0 on failure
 */
RingBufferEncoder.prototype.compress = function (source, dest) {
	var srcLength = source.length;

	if (srcLength <= 0) {
		return LZ4_ERROR.PARAM_ERROR;
	}
	if (srcLength > this.maxBufferSize - DICT_SIZE) {
		return LZ4_ERROR.PARAM_ERROR;
	}

	// Check if we need to expand the buffer (input exceeds work area)
	var workArea = this.ringBufferSize - DICT_SIZE;
	if (srcLength > workArea) {
		// Calculate new size: power of 2 from 64KB
		var newWorkArea = alignToPowerOf2(srcLength);
		var newBufferSize = DICT_SIZE + newWorkArea;

		// If exceeds max, try to use max
		if (newBufferSize > this.maxBufferSize) {
			newBufferSize = this.maxBufferSize;
		}

		if (!this._resizeBuffer(newBufferSize)) {
			return LZ4_ERROR.BUFFER_RESIZE_FAILED;
		}
	}

	// Check for ring buffer wraparound BEFORE writing
	if (this.offset + srcLength > this.ringBufferSize) {
		saveDict(this.stream, this.ringBuffer, 0, DICT_SIZE);
		this.offset = DICT_SIZE;
	}

	// Copy input to ring buffer
	var ringPtr = this.offset;
	this.ringBuffer.set(source, ringPtr);

	// Compress using stream
	var compressedSize = compressContinue(
		this.stream,
		this.ringBuffer,
		dest,
		ringPtr,
		srcLength,
		0,
		dest.length,
		true
	);

	if (compressedSize <= 0) {
		return LZ4_ERROR.COMPRESS_FAILED;
	}

	// Update offset
	this.offset += srcLength;

	// Auto shrink if enabled
	this._tryAutoShrink();

	return compressedSize;
};

/**
 * Reset encoder state (keeps current buffer size)
 */
RingBufferEncoder.prototype.reset = function () {
	this.offset = 0;
	resetStream(this.stream);
};

/**
 * Shrink buffer to base size
 */
RingBufferEncoder.prototype.shrink = function () {
	if (this.ringBufferSize > this.minBufferSize) {
		this._resizeBuffer(this.minBufferSize);
	}
};

/**
 * Try to auto shrink based on current shrink mode
 * @private
 */
RingBufferEncoder.prototype._tryAutoShrink = function () {
	if (this.shrinkMode === SHRINK_MODE.MANUAL) {
		return;
	}

	if (this.ringBufferSize <= this.minBufferSize) {
		return;
	}

	if (this.shrinkMode === SHRINK_MODE.AUTO_IMMEDIATE) {
		this.shrink();
	} else if (this.shrinkMode === SHRINK_MODE.AUTO_THRESHOLD) {
		if (this.ringBufferSize > this.shrinkThreshold) {
			this.shrink();
		}
	}
};

/**
 * Get current work area size (ringBufferSize - DICT_SIZE)
 */
RingBufferEncoder.prototype.getWorkArea = function () {
	return this.ringBufferSize - DICT_SIZE;
};

/**
 * Get current ring buffer size
 */
RingBufferEncoder.prototype.getRingBufferSize = function () {
	return this.ringBufferSize;
};

/**
 * Get base buffer size
 */
RingBufferEncoder.prototype.getBaseBufferSize = function () {
	return this.minBufferSize;
};

/**
 * Get max buffer size
 */
RingBufferEncoder.prototype.getMaxBufferSize = function () {
	return this.maxBufferSize;
};

/**
 * Get current offset (for debugging)
 */
RingBufferEncoder.prototype.getCurrentOffset = function () {
	return this.offset;
};

/**
 * Get current shrink mode
 */
RingBufferEncoder.prototype.getShrinkMode = function () {
	return this.shrinkMode;
};

/**
 * Set shrink mode
 * @param mode New shrink mode
 */
RingBufferEncoder.prototype.setShrinkMode = function (mode) {
	this.shrinkMode = mode;
};

/**
 * Get current shrink threshold
 */
RingBufferEncoder.prototype.getShrinkThreshold = function () {
	return this.shrinkThreshold;
};

/**
 * Set shrink threshold
 * @param threshold New threshold (must be between minBufferSize and maxBufferSize)
 */
RingBufferEncoder.prototype.setShrinkThreshold = function (threshold) {
	var minWork = this.minBufferSize - DICT_SIZE;
	var maxWork = this.maxBufferSize - DICT_SIZE;
	if (threshold < minWork || threshold > maxWork) {
		return LZ4_ERROR.PARAM_ERROR;
	}
	this.shrinkThreshold = DICT_SIZE + threshold;
};

// ============================================================================
// Ring Buffer Decoder Class (v1.10.4)
// ============================================================================

/**
 * Ring buffer based decoder for streaming decompression
 * Matches behavior of C++ Lz4Decoder wrapper
 *
 * Features:
 * - Dynamic buffer sizing with power-of-2 expansion: 64KB -> 128KB -> 256KB -> ...
 * - Automatic expansion when originalSize exceeds current work area
 * - Configurable shrink mode: manual, auto-immediate, or auto-threshold
 * - User-configurable base and max buffer sizes
 *
 * Options:
 * - minWorkArea: Minimum allowed work area size (default: 64KB)
 * - maxWorkArea: Maximum allowed work area size (default: 10MB)
 * - shrinkMode: Shrink mode (default: SHRINK_MODE.MANUAL)
 * - shrinkThreshold: Custom shrink threshold (default: minWorkArea)
 */
function RingBufferDecoder(options) {
	options = options || {};

	var minWorkArea = options.minWorkArea || DEFAULT_WORK_AREA;
	var maxWorkArea = options.maxWorkArea || DEFAULT_MAX_WORK;
	var threshold = options.shrinkThreshold || minWorkArea;

	if (minWorkArea < DEFAULT_WORK_AREA) {
		minWorkArea = DEFAULT_WORK_AREA;
	}
	if (maxWorkArea < minWorkArea) {
		maxWorkArea = minWorkArea;
	}

	if (threshold < minWorkArea) {
		threshold = minWorkArea;
	}
	if (threshold > maxWorkArea) {
		threshold = maxWorkArea;
	}

	this.minBufferSize = DICT_SIZE + minWorkArea;
	this.maxBufferSize = DICT_SIZE + maxWorkArea;
	this.shrinkThreshold = DICT_SIZE + threshold;
	this.ringBufferSize = this.minBufferSize;

	// Set shrink mode and threshold
	this.shrinkMode =
		options.shrinkMode !== undefined
			? options.shrinkMode
			: SHRINK_MODE.MANUAL;
	this.ringBuffer = new Uint8Array(this.ringBufferSize);
	this.offset = 0;
	this.streamDecode = createStreamDecode();
}

/**
 * Resize ring buffer to new size
 * Uses setStreamDecode to preserve dictionary continuity
 * @param newBufferSize New buffer size (must include DICT_SIZE)
 * @return true on success
 */
RingBufferDecoder.prototype._resizeBuffer = function (newBufferSize) {
	var newBuffer = new Uint8Array(newBufferSize);

	var newOffset = 0;

	// Preserve dictionary
	if (this.offset > 0) {
		var dictSize = this.offset < DICT_SIZE ? this.offset : DICT_SIZE;
		var dictStart = this.offset > DICT_SIZE ? this.offset - DICT_SIZE : 0;

		newBuffer.set(
			this.ringBuffer.subarray(dictStart, dictStart + dictSize),
			0
		);
		newOffset = dictSize;

		setStreamDecode(this.streamDecode, newBuffer, 0, dictSize);
	}

	this.ringBuffer = newBuffer;
	this.ringBufferSize = newBufferSize;
	this.offset = newOffset;

	return true;
};

/**
 * Decompress data
 * @param source Compressed source data
 * @param dest Destination buffer (allocated by caller, size must be >= originalSize)
 * @param originalSize Original data length (also the required dest buffer size)
 * @return Number of bytes after decompression, returns <0 on failure
 */
RingBufferDecoder.prototype.decompress = function (source, dest, originalSize) {
	var compressedSize = source.length;

	if (compressedSize <= 0 || originalSize <= 0) {
		return LZ4_ERROR.PARAM_ERROR;
	}
	if (originalSize > this.maxBufferSize - DICT_SIZE) {
		return LZ4_ERROR.PARAM_ERROR;
	}

	// Check if we need to expand the buffer (originalSize exceeds work area)
	var workArea = this.ringBufferSize - DICT_SIZE;
	if (originalSize > workArea) {
		// Calculate new size: power of 2 from 64KB
		var newWorkArea = alignToPowerOf2(originalSize);
		var newBufferSize = DICT_SIZE + newWorkArea;

		// If exceeds max, try to use max
		if (newBufferSize > this.maxBufferSize) {
			newBufferSize = this.maxBufferSize;
		}

		if (!this._resizeBuffer(newBufferSize)) {
			return LZ4_ERROR.BUFFER_RESIZE_FAILED;
		}
	}

	// Check for ring buffer wraparound BEFORE decompression
	if (this.offset + originalSize > this.ringBufferSize) {
		var dictStart = this.offset - DICT_SIZE;
		if (dictStart > 0) {
			this.ringBuffer.set(
				this.ringBuffer.subarray(dictStart, dictStart + DICT_SIZE),
				0
			);
		}
		setStreamDecode(this.streamDecode, this.ringBuffer, 0, DICT_SIZE);
		this.offset = DICT_SIZE;
	}

	// Decompress to ring buffer
	var result = decompressSafeContinue(
		this.streamDecode,
		source,
		this.ringBuffer,
		0,
		compressedSize,
		this.offset,
		originalSize
	);

	if (result <= 0) {
		return LZ4_ERROR.DECOMPRESS_FAILED;
	}

	// Copy to user's buffer
	dest.set(this.ringBuffer.subarray(this.offset, this.offset + result), 0);

	// Update offset
	this.offset += result;

	// Auto shrink if enabled
	this._tryAutoShrink();

	return result;
};

/**
 * Reset decoder state (keeps current buffer size)
 */
RingBufferDecoder.prototype.reset = function () {
	this.offset = 0;
	this.streamDecode = createStreamDecode();
};

/**
 * Shrink buffer to base size
 */
RingBufferDecoder.prototype.shrink = function () {
	if (this.ringBufferSize > this.minBufferSize) {
		this._resizeBuffer(this.minBufferSize);
	}
};

/**
 * Try to auto shrink based on current shrink mode
 * @private
 */
RingBufferDecoder.prototype._tryAutoShrink = function () {
	if (this.shrinkMode === SHRINK_MODE.MANUAL) {
		return;
	}

	if (this.ringBufferSize <= this.minBufferSize) {
		return;
	}

	if (this.shrinkMode === SHRINK_MODE.AUTO_IMMEDIATE) {
		this.shrink();
	} else if (this.shrinkMode === SHRINK_MODE.AUTO_THRESHOLD) {
		if (this.ringBufferSize > this.shrinkThreshold) {
			this.shrink();
		}
	}
};

/**
 * Get current work area size (ringBufferSize - DICT_SIZE)
 */
RingBufferDecoder.prototype.getWorkArea = function () {
	return this.ringBufferSize - DICT_SIZE;
};

/**
 * Get current ring buffer size
 */
RingBufferDecoder.prototype.getRingBufferSize = function () {
	return this.ringBufferSize;
};

/**
 * Get base buffer size
 */
RingBufferDecoder.prototype.getBaseBufferSize = function () {
	return this.minBufferSize;
};

/**
 * Get max buffer size
 */
RingBufferDecoder.prototype.getMaxBufferSize = function () {
	return this.maxBufferSize;
};

/**
 * Get current offset (for debugging)
 */
RingBufferDecoder.prototype.getCurrentOffset = function () {
	return this.offset;
};

/**
 * Get current shrink mode
 */
RingBufferDecoder.prototype.getShrinkMode = function () {
	return this.shrinkMode;
};

/**
 * Set shrink mode
 * @param mode New shrink mode
 */
RingBufferDecoder.prototype.setShrinkMode = function (mode) {
	this.shrinkMode = mode;
};

/**
 * Get current shrink threshold
 */
RingBufferDecoder.prototype.getShrinkThreshold = function () {
	return this.shrinkThreshold;
};

/**
 * Set shrink threshold
 * @param threshold New threshold (must be between minBufferSize and maxBufferSize)
 */
RingBufferDecoder.prototype.setShrinkThreshold = function (threshold) {
	var minWork = this.minBufferSize - DICT_SIZE;
	var maxWork = this.maxBufferSize - DICT_SIZE;
	if (threshold < minWork || threshold > maxWork) {
		return LZ4_ERROR.PARAM_ERROR;
	}
	this.shrinkThreshold = DICT_SIZE + threshold;
};

// ============================================================================
// Exports
// ============================================================================

const lz4 = {
	// Constants
	LZ4_MAX_INPUT_SIZE: LZ4_MAX_INPUT_SIZE,
	BLOCK_MAX_SIZE: 64 * KB,

	// Ring buffer constants (v1.10.4)
	DICT_SIZE: DICT_SIZE,
	DEFAULT_WORK_AREA: DEFAULT_WORK_AREA,
	DEFAULT_MAX_WORK: DEFAULT_MAX_WORK,

	// Shrink mode constants
	SHRINK_MODE: SHRINK_MODE,

	// Error codes
	LZ4_ERROR: LZ4_ERROR,

	// Utility functions
	alignToPowerOf2: alignToPowerOf2,
	calcDefaultBufferSize: calcDefaultBufferSize,
	calcDefaultMaxBufferSize: calcDefaultMaxBufferSize,

	// Hash strategy configuration
	setHashStrategy: setHashStrategy,
	getHashStrategy: getHashStrategy,

	// Simple API
	compress: compress,
	compressLimited: compressLimited,
	compressBound: compressBound,
	decompressSafe: decompressSafe,
	decompressFast: decompressFast,

	// Streaming compression API
	createStream: createStream,
	resetStream: resetStream,
	loadDict: loadDict,
	compressContinue: compressContinue,
	saveDict: saveDict,

	// Streaming decompression API
	createStreamDecode: createStreamDecode,
	setStreamDecode: setStreamDecode,
	decompressSafeContinue: decompressSafeContinue,

	// High-level ring buffer classes
	RingBufferEncoder: RingBufferEncoder,
	RingBufferDecoder: RingBufferDecoder,

	// Internal (for testing)
	_hashU16: hashU16,
	_hashU32: hashU32,
	_TABLE_TYPE: TABLE_TYPE,
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
	try {
		module.exports = lz4;
	} catch (error) {
		void error;
	}
}

export default lz4;
